"use client";

import Link from "next/link";
import { Lock, LockOpen, ShieldAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { cancelCode, lockNow, submitCode, unlock, useCanEdit, useCodeRequested, useUnlock } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Button, Field, Input, Modal } from "./ui";

/**
 * 驗證碼：所有頁面都可以直接檢視；新增、修改、刪除才要驗證碼（後端寫入 API 呼叫 requireEditor）。
 * - 每頁標題旁有 <UnlockTimer />（PageHeader 自動加上）
 * - 寫入時還沒解鎖：api() 會透過 <CodePrompt />（AppShell）跳出輸入框，解鎖後自動重送
 * - 後台管理頁另有 <UnlockPanel />，動作先用 useCodeGate().ask(...) 確認
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

const mmss = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

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
        到後台解鎖 1 小時
      </Link>
    </div>
  );
}

/** 寫入時需要驗證碼的輸入框：放在 AppShell，由 api() 觸發 */
export function CodePrompt() {
  const open = useCodeRequested();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  if (!open) return null;

  const close = () => {
    setCode("");
    setError("");
    cancelCode();
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return setError("請輸入驗證碼");
    setBusy(true);
    setError("");
    try {
      await submitCode(code.trim());
      setCode("");
    } catch (err) {
      setError(errMsg(err));
      setCode("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={close}
      title="需要驗證碼"
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            取消
          </Button>
          <Button type="submit" form="code-prompt" disabled={busy}>
            {busy ? "驗證中…" : "確認"}
          </Button>
        </>
      }
    >
      <form id="code-prompt" onSubmit={submit} className="space-y-4">
        <div className="flex gap-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          <ShieldAlert size={20} className="shrink-0" />
          <div>新增、修改、刪除資料需要驗證碼。輸入後 1 小時內不用再輸入。</div>
        </div>
        <Field label="請輸入驗證碼">
          <Input
            type="password"
            autoFocus
            autoComplete="off"
            value={code}
            onChange={(e) => {
              setCode(e.target.value);
              setError("");
            }}
          />
        </Field>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      </form>
    </Modal>
  );
}

/** 驗證碼解鎖區塊：輸入一次，1 小時內不用再輸入；解鎖中顯示倒數與「立即鎖定」 */
export function UnlockPanel() {
  const until = useUnlock();
  const now = useNow(!!until);
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
      await unlock(code.trim());
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
                "輸入一次驗證碼，1 小時內所有需要驗證碼的動作都不用再輸入。"
              )}
            </div>
          </div>
        </div>
        {unlocked ? (
          <Button variant="secondary" onClick={() => void lockNow()}>
            立即鎖定
          </Button>
        ) : (
          <form onSubmit={submit} className="flex items-start gap-2">
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
              {busy ? "驗證中…" : "解鎖 1 小時"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}

interface CodeAsk {
  title: string;
  confirmLabel: string;
  danger?: boolean;
  message: React.ReactNode;
  /** 真正要做的動作（已解鎖時才會呼叫）；丟出錯誤會顯示在對話框 */
  run: () => Promise<void>;
  /** 按取消關掉時（例如把畫面上已改的值還原） */
  onCancel?: () => void;
}

/**
 * 需要驗證碼的動作：ask(...) 後把 dialog 放進畫面。
 * 已解鎖：一般動作直接執行、不跳對話框；刪除仍會確認，只是不用輸入驗證碼。
 * 沒解鎖：輸入驗證碼（同時解鎖 1 小時）後執行。
 */
export function useCodeGate() {
  const until = useUnlock();
  const [ask, setAsk] = useState<(CodeAsk & { needCode: boolean }) | null>(null);

  function open(a: CodeAsk) {
    const unlocked = !!until && until > Date.now();
    if (unlocked && !a.danger) {
      // 剛好到期等失敗時，改成跳出輸入驗證碼
      a.run().catch((e: Error & { status?: number }) => {
        if (e.status === 423) setAsk({ ...a, needCode: true });
        else alert(errMsg(e));
      });
      return;
    }
    setAsk({ ...a, needCode: !unlocked });
  }

  const dialog = ask && (
    <CodeModal
      ask={ask}
      onClose={() => {
        ask.onCancel?.();
        setAsk(null);
      }}
      onDone={() => setAsk(null)}
      onNeedCode={() => setAsk({ ...ask, needCode: true })}
    />
  );
  return { ask: open, dialog };
}

function CodeModal({
  ask,
  onClose,
  onDone,
  onNeedCode,
}: {
  ask: CodeAsk & { needCode: boolean };
  onClose: () => void;
  onDone: () => void;
  onNeedCode: () => void;
}) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (ask.needCode && !code.trim()) return setError("請輸入驗證碼");
    setBusy(true);
    setError("");
    try {
      if (ask.needCode) await unlock(code.trim());
      await ask.run();
      onDone();
    } catch (err) {
      if ((err as { status?: number }).status === 423) onNeedCode();
      setError(errMsg(err));
      setCode("");
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={ask.title}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            取消
          </Button>
          <Button type="submit" form="code-form" disabled={busy} variant={ask.danger ? "dangerSolid" : "primary"}>
            {busy ? "處理中…" : ask.confirmLabel}
          </Button>
        </>
      }
    >
      <form id="code-form" onSubmit={submit} className="space-y-4">
        <div className={cn("flex gap-3 rounded-lg p-3 text-sm", ask.danger ? "bg-red-50 text-red-800" : "bg-amber-50 text-amber-900")}>
          <ShieldAlert size={20} className="shrink-0" />
          <div>{ask.message}</div>
        </div>
        {ask.needCode ? (
          <Field label="請輸入驗證碼" hint="驗證後 1 小時內不用再輸入">
            <Input
              type="password"
              autoFocus
              autoComplete="off"
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                setError("");
              }}
            />
          </Field>
        ) : (
          <p className="text-sm text-emerald-700">驗證碼已解鎖，這次不需輸入。</p>
        )}
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      </form>
    </Modal>
  );
}
