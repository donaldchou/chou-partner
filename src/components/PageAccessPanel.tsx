"use client";

import { EyeOff, Lock } from "lucide-react";
import { useState } from "react";
import { USER_PAGES, type PageAccessSettings, type PageKey } from "@/lib/page-access";
import { alertError, api } from "@/lib/store";
import { useFetch } from "@/lib/use-fetch";
import { cn } from "@/lib/utils";
import { Badge, Button, Card, Empty, SectionTitle, Spinner } from "./ui";

/** 只有管理者能用的頁面：列出來讓管理者知道，不能開給一般使用者 */
const ADMIN_ONLY = ["客戶建檔", "歷史紀錄匯入", "疑似無效客戶", "標籤管理", "新增訂單", "待確認訂單", "後台管理"];

/** 依選單分組 */
const GROUPS = [...new Set(USER_PAGES.map((p) => p.group))].map((g) => ({ name: g, pages: USER_PAGES.filter((p) => p.group === g) }));

type Draft = { allowed: PageKey[]; hidden: Record<string, PageKey[]> };

/**
 * 後台「頁面權限」：① 一般使用者可以看的頁面，② 個別帳號再隱藏。
 * 帳號看得到的頁面 ＝ ① 有勾 且 ② 沒勾；管理者永遠看得到全部。
 */
export default function PageAccessPanel() {
  const { data, error, reload } = useFetch("admin-page-access", () => api<PageAccessSettings>("/api/admin/page-access"));
  const [draft, setDraft] = useState<Draft | null>(null);
  const [selected, setSelected] = useState("");
  const [saving, setSaving] = useState(false);

  if (error) return <Empty>讀取失敗：{error}</Empty>;
  if (!data) return <Spinner />;

  const cur: Draft = draft ?? { allowed: data.allowed, hidden: Object.fromEntries(data.users.map((u) => [u.id, u.hiddenPages])) };
  const user = data.users.find((u) => u.id === selected) ?? data.users[0];
  const hiddenOf = (id: string) => cur.hidden[id] ?? [];
  const visibleFor = (id: string) => cur.allowed.filter((k) => !hiddenOf(id).includes(k));

  const toggle = (list: PageKey[], k: PageKey) => (list.includes(k) ? list.filter((x) => x !== k) : [...list, k]);
  const toggleBase = (k: PageKey) => setDraft({ ...cur, allowed: toggle(cur.allowed, k) });
  const toggleHidden = (id: string, k: PageKey) => setDraft({ ...cur, hidden: { ...cur.hidden, [id]: toggle(hiddenOf(id), k) } });

  async function save() {
    if (!draft) return;
    setSaving(true);
    try {
      await api("/api/admin/page-access", { method: "PUT", body: JSON.stringify(draft) });
      setDraft(null);
      reload();
    } catch (e) {
      alertError("儲存失敗", e);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <Card>
        <SectionTitle right={<Badge color="blue">一般使用者可看 {cur.allowed.length} / {USER_PAGES.length} 頁</Badge>}>
          ① 一般使用者可以看的頁面
        </SectionTitle>
        <p className="-mt-1 mb-4 text-sm text-slate-500">打勾＝所有一般使用者都看得到；沒打勾的頁面會從左邊選單消失，直接輸入網址或呼叫資料 API 也會被擋。</p>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {GROUPS.map((g) => (
            <div key={g.name} className="rounded-xl border border-slate-200 p-3">
              <div className="mb-2 text-sm font-semibold text-brand-700">{g.name}</div>
              {g.pages.map((p) => {
                const on = cur.allowed.includes(p.key);
                return (
                  <label
                    key={p.key}
                    className={cn("flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-2", on ? "bg-brand-50 text-slate-800" : "text-slate-500")}
                  >
                    <input type="checkbox" checked={on} onChange={() => toggleBase(p.key)} className="h-4 w-4 accent-brand-600" />
                    {p.label}
                  </label>
                );
              })}
            </div>
          ))}
        </div>
        <p className="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-slate-400">
          <Lock size={13} /> 只有管理者能用（不能開給一般使用者）：{ADMIN_ONLY.join("、")}
        </p>
      </Card>

      <Card>
        <SectionTitle>② 個別帳號再隱藏（選填）</SectionTitle>
        <p className="-mt-1 mb-4 text-sm text-slate-500">先選帳號，再勾選要「對這個帳號隱藏」的頁面。只能比 ① 更少，不能多開；① 已關掉的頁面會鎖住。</p>
        {!user ? (
          <Empty>目前沒有一般使用者帳號，請先到「使用者管理」新增</Empty>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[minmax(200px,260px)_1fr_minmax(200px,260px)] lg:items-start">
            <div className="space-y-2">
              <div className="text-sm font-semibold text-slate-600">一般使用者帳號</div>
              {data.users.map((u) => {
                const n = cur.allowed.filter((k) => hiddenOf(u.id).includes(k)).length;
                return (
                  <button
                    key={u.id}
                    type="button"
                    aria-pressed={u.id === user.id}
                    onClick={() => setSelected(u.id)}
                    className={cn(
                      "flex w-full flex-col items-start gap-0.5 rounded-xl border px-3.5 py-3 text-left",
                      u.id === user.id ? "border-2 border-brand-600 bg-brand-50" : "border-slate-200 bg-white hover:bg-slate-50",
                    )}
                  >
                    <span className="font-semibold text-slate-800">
                      {u.name || u.email}
                      {!u.active && <span className="ml-1.5 text-xs font-normal text-slate-400">（已停用）</span>}
                    </span>
                    <span className="text-xs text-slate-500">{u.email}</span>
                    <span
                      className={cn(
                        "mt-1 rounded-full px-2 py-0.5 text-xs font-semibold",
                        n ? "bg-accent-50 text-accent-600" : "bg-emerald-50 text-emerald-700",
                      )}
                    >
                      {n ? `另外隱藏 ${n} 頁` : "跟一般使用者相同"}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="rounded-xl border border-slate-200 p-4">
              <div className="mb-3 flex items-center gap-2 font-semibold text-slate-800">
                <EyeOff size={18} className="text-accent-600" /> 對「{user.name || user.email}」隱藏這些頁面
              </div>
              <div className="space-y-3">
                {GROUPS.map((g) => (
                  <div key={g.name}>
                    <div className="mb-1 text-xs font-semibold text-brand-700">{g.name}</div>
                    {g.pages.map((p) => {
                      const off = !cur.allowed.includes(p.key);
                      const hidden = !off && hiddenOf(user.id).includes(p.key);
                      return (
                        <label
                          key={p.key}
                          className={cn(
                            "flex items-center gap-2.5 rounded-lg px-2 py-2",
                            off ? "cursor-not-allowed bg-slate-50 text-slate-400 line-through" : hidden ? "cursor-pointer bg-accent-50" : "cursor-pointer",
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={hidden}
                            disabled={off}
                            onChange={() => toggleHidden(user.id, p.key)}
                            className="h-4 w-4 accent-accent-500"
                          />
                          <span className="flex-1">{p.label}</span>
                          <span className={cn("text-xs font-semibold", off ? "text-slate-400" : hidden ? "text-accent-600" : "text-emerald-700")}>
                            {off ? "① 已關閉" : hidden ? "已隱藏" : "看得到"}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>

            <aside aria-label="登入後選單預覽" className="rounded-xl bg-gradient-to-b from-brand-800 to-brand-950 p-4 text-white">
              <div className="text-xs text-brand-200">預覽：{user.name || user.email} 登入後的選單</div>
              {GROUPS.map((g) => {
                const pages = g.pages.filter((p) => visibleFor(user.id).includes(p.key));
                if (!pages.length) return null;
                return (
                  <div key={g.name} className="pt-3">
                    <div className="mb-1 text-xs font-semibold text-brand-200/80">{g.name}</div>
                    {pages.map((p) => (
                      <div key={p.key} className="mb-0.5 rounded-lg bg-white/10 px-3 py-1.5 text-sm">
                        {p.label}
                      </div>
                    ))}
                  </div>
                );
              })}
              {visibleFor(user.id).length === 0 && <div className="pt-3 text-sm text-accent-400">這個帳號登入後看不到任何頁面</div>}
              <div className="pt-3 text-xs text-brand-200/80">共 {visibleFor(user.id).length} 個頁面</div>
            </aside>
          </div>
        )}
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">規則：帳號看得到的頁面 ＝ ① 有勾 且 ② 沒勾。管理者永遠看得到全部。儲存需要驗證碼。</p>
        <div className="flex gap-2">
          <Button variant="secondary" disabled={!draft || saving} onClick={() => setDraft(null)}>
            取消變更
          </Button>
          <Button disabled={!draft || saving} onClick={() => void save()}>
            {saving ? "儲存中…" : "儲存權限設定"}
          </Button>
        </div>
      </div>
    </div>
  );
}
