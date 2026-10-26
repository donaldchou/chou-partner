"use client";

import Link from "next/link";
import { Lock, LockOpen, Minus, Plus, ShieldAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { lockNow, unlock, useCanEdit, useCodeRequest, useUnlock, type CodeRequest } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Button, Field, Input, Modal } from "./ui";

/**
 * 驗證碼：所有頁面都可以直接檢視；新增、修改、刪除才要驗證碼（後端寫入 API 呼叫 requireEditor）。
 * - 只有後台管理頁的 <UnlockPanel /> 可以解鎖（可調 1–12 小時，預設 1 小時），期間都不用再輸入
 * - 其他時候寫入：api() 透過 <CodePrompt />（AppShell）跳出輸入框，驗證碼只對這一次動作有效
 * - 每頁標題旁有 <UnlockTimer />（PageHeader 自動加上）
 */

/** 每秒更新的現在時間（倒數用） */
function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [active]);
  return now;
}

/** 倒數：1 小時以上顯示 時:分:秒，否則 分:秒 */
const mmss = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const pad = (n: number) => String(n).padStart(2, "0");
  const h = Math.floor(s / 3600);
  return `${h ? `${h}:` : ""}${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
};

// 和後端 UNLOCK_HOURS（src/lib/session.ts）一致
const HOURS_MIN = 1;
const HOURS_MAX = 12;

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** 頁面標題旁的小標籤：解鎖中顯示倒數，沒解鎖時提示可到後台解鎖（只有管理者看得到） */
export function UnlockTimer() {
  const canEdit = useCanEdit();
  const until = useUnlock();
  const now = useNow(!!until);
  if (!canEdit || until === undefined) return null;
  const left = until ? until - now : 0;

  if (left > 0) {
    return (
      <div
        className={cn(
          "inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm ring-1 ring-inset",
          left <= 5 * 60 * 1000 ? "bg-red-50 text-red-700 ring-red-600/20" : "bg-emerald-50 text-emerald-800 ring-emerald-600/20",
        )}
      >
        <LockOpen size={15} />
        驗證碼已解鎖，<b className="tabular-nums">{mmss(left)}</b> 後失效
        <button onClick={() => void lockNow()} className="ml-1 text-xs underline underline-offset-2 opacity-80 hover:opacity-100">
          立即鎖定
        </button>
      </div>
    );
  }
  return (
    <div className="inline-flex items-center gap-2 rounded-full bg-slate-200/60 px-3 py-1 text-sm text-slate-600">
      <Lock size={15} />
      新增／修改／刪除需輸入驗證碼
      <Link href="/admin" className="text-xs text-brand-700 underline underline-offset-2 hover:text-brand-900">
        到後台解鎖
      </Link>
    </div>
  );
}

/** 寫入時需要驗證碼的輸入框：放在 AppShell，由 api() 觸發；驗證碼只對這一次動作有效 */
export function CodePrompt() {
  const req = useCodeRequest();
  if (!req) return null;
  return <CodePromptDialog req={req} />;
}

function CodePromptDialog({ req }: { req: CodeRequest }) {
  const [code, setCode] = useState("");
  const [empty, setEmpty] = useState(false);
  const error = empty ? "請輸入驗證碼" : req.error;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return setEmpty(true);
    await req.submit(code.trim());
    setCode("");
  }

  return (
    <Modal
      open
      onClose={req.cancel}
      title="需要驗證碼"
      footer={
        <>
          <Button variant="secondary" onClick={req.cancel}>
            取消
          </Button>
          <Button type="submit" form="code-prompt" disabled={req.busy}>
            {req.busy ? "驗證中…" : "確認"}
          </Button>
        </>
      }
    >
      <form id="code-prompt" onSubmit={submit} className="space-y-4">
        <div className="flex gap-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          <ShieldAlert size={20} className="shrink-0" />
          <div>
            新增、修改、刪除資料需要驗證碼，這次輸入只對這個動作有效。
            <div className="mt-0.5 text-xs text-amber-700">
              要一段時間內免輸入，請到
              <Link href="/admin" onClick={req.cancel} className="mx-0.5 text-brand-700 underline underline-offset-2">
                後台管理
              </Link>
              解鎖。
            </div>
          </div>
        </div>
        <Field label="請輸入驗證碼">
          <Input
            type="password"
            autoFocus
            autoComplete="off"
            value={code}
            onChange={(e) => {
              setCode(e.target.value);
              setEmpty(false);
            }}
          />
        </Field>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      </form>
    </Modal>
  );
}

/** 驗證碼解鎖區塊：輸入一次，選定的時數內不用再輸入；解鎖中顯示倒數與「立即鎖定」 */
export function UnlockPanel() {
  const until = useUnlock();
  const now = useNow(!!until);
  const [hours, setHours] = useState(HOURS_MIN);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const left = until ? until - now : 0;
  const unlocked = left > 0;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return setError("請輸入驗證碼");
    setBusy(true);
    setError("");
    try {
      await unlock(code.trim(), hours);
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
      setCode("");
    }
  }

  return (
    <div
      className={cn(
        "mb-5 rounded-2xl border p-4",
        unlocked ? "border-emerald-200 bg-emerald-50/60" : "border-amber-200 bg-amber-50/60",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {unlocked ? <LockOpen size={22} className="text-emerald-700" /> : <Lock size={22} className="text-amber-700" />}
          <div>
            <div className="font-semibold text-slate-800">驗證碼解鎖</div>
            <div className="text-sm text-slate-600">
              {unlocked ? (
                <>
                  已解鎖，新增／修改／刪除都不用再輸入驗證碼，
                  <b className={cn("tabular-nums", left <= 5 * 60 * 1000 && "text-red-600")}>{mmss(left)}</b> 後失效。
                </>
              ) : (
                `輸入一次驗證碼，${hours} 小時內所有需要驗證碼的動作都不用再輸入。`
              )}
            </div>
          </div>
        </div>
        {unlocked ? (
          <Button variant="secondary" onClick={() => void lockNow()}>
            立即鎖定
          </Button>
        ) : (
          <form onSubmit={submit} className="flex flex-wrap items-start gap-2">
            {/* 時數只能用 − ＋ 調整，不能直接輸入 */}
            <div className="flex h-[42px] items-center rounded-lg border border-slate-300 bg-white" role="group" aria-label="解鎖時數">
              <button
                type="button"
                aria-label="減少 1 小時"
                disabled={hours <= HOURS_MIN}
                onClick={() => setHours((h) => Math.max(HOURS_MIN, h - 1))}
                className="flex h-full w-9 items-center justify-center rounded-l-lg text-slate-600 hover:bg-slate-100 disabled:text-slate-300 disabled:hover:bg-transparent"
              >
                <Minus size={16} />
              </button>
              <span className="min-w-16 select-none text-center text-sm font-semibold tabular-nums text-slate-800" aria-live="polite">
                {hours} 小時
              </span>
              <button
                type="button"
                aria-label="增加 1 小時"
                disabled={hours >= HOURS_MAX}
                onClick={() => setHours((h) => Math.min(HOURS_MAX, h + 1))}
                className="flex h-full w-9 items-center justify-center rounded-r-lg text-slate-600 hover:bg-slate-100 disabled:text-slate-300 disabled:hover:bg-transparent"
              >
                <Plus size={16} />
              </button>
            </div>
            <div>
              <Input
                type="password"
                autoComplete="off"
                placeholder="請輸入驗證碼"
                className="w-44"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value);
                  setError("");
                }}
              />
              {error && <div className="mt-1 text-xs font-medium text-red-600">{error}</div>}
            </div>
            <Button type="submit" disabled={busy || until === undefined}>
              {busy ? "驗證中…" : `解鎖 ${hours} 小時`}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}

