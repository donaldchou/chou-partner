"use client";

import { KeyRound, Search, Trash2, UserPlus } from "lucide-react";
import { useState } from "react";
import {
  Badge,
  Button,
  Card,
  Empty,
  Field,
  Input,
  Modal,
  PageHeader,
  Pagination,
  Select,
  Spinner,
  Tabs,
  useDebounced,
} from "@/components/ui";
import { api, useMe } from "@/lib/store";
import { useFetch } from "@/lib/use-fetch";
import { cn } from "@/lib/utils";

type User = {
  id: string;
  email: string;
  name: string;
  role: "admin" | "user";
  active: boolean;
  lastLoginAt: string | null;
  createdAt: string;
};

export default function AdminPage() {
  const [tab, setTab] = useState<"users" | "data">("users");
  return (
    <div>
      <PageHeader title="後台管理" subtitle="帳號與身分、所有資料的檢視與刪除（只有管理者看得到）" />
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "users", label: "使用者管理" },
          { value: "data", label: "所有資料" },
        ]}
      />
      {tab === "users" ? <UsersPanel /> : <DataPanel />}
    </div>
  );
}

const fmt = (d: string | null) => (d ? new Date(d).toLocaleString("zh-TW", { hour12: false }).slice(0, -3) : "從未登入");

/* ---------------- 使用者管理 ---------------- */

function UsersPanel() {
  const me = useMe();
  const { data, error, reload } = useFetch("admin-users", () => api<User[]>("/api/admin/users"));
  const [adding, setAdding] = useState(false);
  const [resetting, setResetting] = useState<User | null>(null);

  async function patch(u: User, body: Partial<User> & { password?: string }) {
    try {
      await api(`/api/admin/users/${u.id}`, { method: "PATCH", body: JSON.stringify(body) });
      reload();
      return true;
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
      return false;
    }
  }

  async function remove(u: User) {
    if (!confirm(`確定刪除帳號 ${u.email}？`)) return;
    try {
      await api(`/api/admin/users/${u.id}`, { method: "DELETE" });
      reload();
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <Card className="p-0">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-4">
        <div>
          <h2 className="font-semibold text-slate-800">帳號（{data?.length ?? "…"}）</h2>
          <p className="text-xs text-slate-500">
            管理者：可以新增、修改、刪除資料並使用後台；一般使用者：只能查看。沒有註冊頁，帳號由這裡建立。
          </p>
        </div>
        <Button onClick={() => setAdding(true)}>
          <UserPlus size={16} /> 新增帳號
        </Button>
      </div>
      {error && <p className="p-5 text-sm text-red-600">{error}</p>}
      {!data ? (
        <Spinner />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-slate-50 text-left text-xs text-slate-500">
              <tr>
                <th className="px-5 py-3 font-medium">帳號</th>
                <th className="px-5 py-3 font-medium">身分</th>
                <th className="px-5 py-3 font-medium">狀態</th>
                <th className="px-5 py-3 font-medium">最後登入</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.map((u) => {
                const self = u.id === me?.id;
                return (
                  <tr key={u.id} className={cn(!u.active && "bg-slate-50 text-slate-400")}>
                    <td className="px-5 py-3">
                      <div className="font-medium text-slate-800">
                        {u.email} {self && <Badge color="blue">我</Badge>}
                      </div>
                      <div className="text-xs text-slate-500">{u.name || "（未填姓名）"}</div>
                    </td>
                    <td className="px-5 py-3">
                      <Select
                        className="w-36"
                        value={u.role}
                        disabled={self}
                        onChange={(e) => patch(u, { role: e.target.value as User["role"] })}
                      >
                        <option value="admin">管理者</option>
                        <option value="user">一般使用者</option>
                      </Select>
                    </td>
                    <td className="px-5 py-3">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          className="h-4 w-4"
                          checked={u.active}
                          disabled={self}
                          onChange={(e) => patch(u, { active: e.target.checked })}
                        />
                        {u.active ? "啟用" : "已停用"}
                      </label>
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 text-slate-500">{fmt(u.lastLoginAt)}</td>
                    <td className="whitespace-nowrap px-5 py-3 text-right">
                      <Button variant="ghost" onClick={() => setResetting(u)}>
                        <KeyRound size={15} /> 重設密碼
                      </Button>
                      {!self && (
                        <Button variant="ghost" className="text-red-600" onClick={() => remove(u)}>
                          <Trash2 size={15} />
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {adding && (
        <AddUserModal
          onClose={() => setAdding(false)}
          onDone={() => {
            setAdding(false);
            reload();
          }}
        />
      )}
      {resetting && (
        <PasswordModal
          user={resetting}
          onClose={() => setResetting(null)}
          onSave={async (password) => {
            if (await patch(resetting, { password })) {
              alert("密碼已重設");
              setResetting(null);
            }
          }}
        />
      )}
    </Card>
  );
}

function AddUserModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ email: "", name: "", password: "", role: "user" });
  const [busy, setBusy] = useState(false);
  return (
    <Modal open onClose={onClose} title="新增帳號">
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await api("/api/admin/users", { method: "POST", body: JSON.stringify(f) });
            onDone();
          } catch (err) {
            alert(err instanceof Error ? err.message : String(err));
            setBusy(false);
          }
        }}
      >
        <Field label="Email" required>
          <Input type="email" required autoFocus value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
        </Field>
        <Field label="姓名">
          <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </Field>
        <Field label="密碼" required hint="至少 8 個字元，建立後請告訴對方登入後自行保管">
          <Input
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={f.password}
            onChange={(e) => setF({ ...f, password: e.target.value })}
          />
        </Field>
        <Field label="身分">
          <Select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>
            <option value="user">一般使用者（只能查看）</option>
            <option value="admin">管理者</option>
          </Select>
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            取消
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? "建立中…" : "建立帳號"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function PasswordModal({ user, onClose, onSave }: { user: User; onClose: () => void; onSave: (password: string) => void }) {
  const [password, setPassword] = useState("");
  return (
    <Modal open onClose={onClose} title={`重設 ${user.email} 的密碼`}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          onSave(password);
        }}
      >
        <Field label="新密碼" required hint="至少 8 個字元">
          <Input
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            取消
          </Button>
          <Button type="submit">重設密碼</Button>
        </div>
      </form>
    </Modal>
  );
}

/* ---------------- 所有資料 ---------------- */

type CollectionInfo = { name: string; label: string; count: number };
type Row = { id: string; title: string; sub: string; date: string };

function DataPanel() {
  const { data: collections, reload: reloadCounts } = useFetch("admin-collections", () => api<CollectionInfo[]>("/api/admin/data"));
  const [name, setName] = useState("customers");
  const [kw, setKw] = useState("");
  const [page, setPage] = useState(1);
  const q = useDebounced(kw.trim());
  const key = JSON.stringify({ name, q, page });
  const { data, loading, reload } = useFetch(key, () =>
    api<{ items: Row[]; total: number; page: number; limit: number }>(
      `/api/admin/data/${name}?${new URLSearchParams({ q, page: String(page) })}`,
    ),
  );
  const [viewing, setViewing] = useState<Row | null>(null);

  async function remove(r: Row) {
    let cascade = false;
    if (name === "customers" || name === "agencies") {
      const what = name === "customers" ? "這位客戶的所有訂單" : "這家旅行社的所有預約";
      if (!confirm(`刪除「${r.title}」會一起刪除${what}，確定嗎？此動作無法復原。`)) return;
      cascade = true;
    } else if (!confirm(`確定刪除「${r.title}」？此動作無法復原。`)) return;
    try {
      await api(`/api/admin/data/${name}/${encodeURIComponent(r.id)}${cascade ? "?cascade=true" : ""}`, { method: "DELETE" });
      reload();
      reloadCounts();
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[220px_1fr]">
      <Card className="h-fit p-2">
        {(collections ?? []).map((c) => (
          <button
            key={c.name}
            onClick={() => {
              setName(c.name);
              setPage(1);
              setKw("");
            }}
            className={cn(
              "flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm",
              name === c.name ? "bg-brand-500 font-medium text-white" : "text-slate-600 hover:bg-slate-100",
            )}
          >
            {c.label}
            <span className={name === c.name ? "text-white/80" : "text-slate-400"}>{c.count.toLocaleString()}</span>
          </button>
        ))}
      </Card>

      <Card className="p-0">
        <div className="border-b border-slate-100 p-4">
          <div className="relative">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              value={kw}
              onChange={(e) => {
                setKw(e.target.value);
                setPage(1);
              }}
              placeholder="搜尋…"
              className="pl-9"
            />
          </div>
          {data && (
            <p className="mt-2 text-xs text-slate-500">
              共 {data.total.toLocaleString()} 筆{loading && "（更新中…）"}
            </p>
          )}
        </div>
        {!data ? (
          <Spinner />
        ) : data.items.length === 0 ? (
          <div className="p-5">
            <Empty>沒有資料</Empty>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {data.items.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                <button className="min-w-0 flex-1 text-left" onClick={() => setViewing(r)}>
                  <div className="truncate font-medium text-slate-800 hover:text-brand-700">{r.title}</div>
                  <div className="truncate text-xs text-slate-500">
                    {r.sub}
                    {r.date && `・${r.date.replace("T", " ")}`}
                  </div>
                </button>
                <Button variant="ghost" onClick={() => setViewing(r)}>
                  檢視
                </Button>
                {name !== "users" && (
                  <Button variant="ghost" className="text-red-600" onClick={() => remove(r)}>
                    <Trash2 size={15} />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
        {data && (
          <div className="px-4 pb-4">
            <Pagination page={page} limit={data.limit} total={data.total} onChange={setPage} />
          </div>
        )}
      </Card>

      {viewing && <RawModal collection={name} row={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}

function RawModal({ collection, row, onClose }: { collection: string; row: Row; onClose: () => void }) {
  const { data, error } = useFetch(`raw:${collection}:${row.id}`, () =>
    api<unknown>(`/api/admin/data/${collection}/${encodeURIComponent(row.id)}`),
  );
  return (
    <Modal open onClose={onClose} title={row.title} wide>
      {error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : !data ? (
        <Spinner />
      ) : (
        <pre className="max-h-[70vh] overflow-auto rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-700">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </Modal>
  );
}
