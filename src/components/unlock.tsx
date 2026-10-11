"use client";

import { KeyRound, Lock, Timer } from "lucide-react";
import { useEffect, useState } from "react";
import { lockNow, unlock, useUnlock } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Button, Card, Input, Spinner } from "./ui";

/**
 * 需要驗證碼的頁面。新增頁面時加在這裡，並在頁面用 <CodeGate> 包住內容、
 * PageHeader 的 info 放 <UnlockTimer />（後端 API 要呼叫 requireUnlocked）。
 */
export const CODE_PAGES = ["/admin"];

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

/** 驗證碼剩餘時間：解鎖中顯示倒數（最後 5 分鐘變紅）與「立即上鎖」 */
export function UnlockTimer() {
  const until = useUnlock();
  const now = useNow(!!until);
  if (!until) return null;
  const left = until - now;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium ring-1 ring-inset",
        left <= 5 * 60 * 1000 ? "bg-red-50 text-red-700 ring-red-600/20" : "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
      )}
      title="驗證碼有效期間，所有需要驗證碼的功能都不用再輸入"
    >
      <Timer size={15} />
      驗證碼 {mmss(left)} 後失效
      <button onClick={() => void lockNow()} className="ml-1 inline-flex items-center gap-0.5 text-xs underline-offset-2 hover:underline">
        <Lock size={12} /> 立即上鎖
      </button>
    </span>
  );
}

/** 沒有解鎖時顯示驗證碼輸入框；解鎖後才顯示內容 */
export function CodeGate({ children }: { children: React.ReactNode }) {
  const until = useUnlock();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (until === undefined) return <Spinner />;
  if (until) return <>{children}</>;

  return (
    <Card className="mx-auto mt-6 max-w-md p-7">
      <div className="mb-4 flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
          <KeyRound size={22} />
        </span>
        <div>
          <h2 className="text-lg font-semibold text-slate-800">請輸入驗證碼</h2>
          <p className="text-sm text-slate-500">輸入正確後 1 小時內，所有需要驗證碼的功能都不用再輸入</p>
        </div>
      </div>
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            await unlock(code);
            setCode("");
          } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
          } finally {
            setBusy(false);
          }
        }}
      >
        <Input
          type="password"
          autoComplete="off"
          autoFocus
          required
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="驗證碼"
        />
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <Button type="submit" disabled={busy || !code} className="w-full">
          {busy ? "確認中…" : "解鎖"}
        </Button>
      </form>
    </Card>
  );
}
