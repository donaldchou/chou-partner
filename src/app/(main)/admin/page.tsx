"use client";

import { Eye, KeyRound, Plus, Search, Trash2 } from "lucide-react";
import { useState } from "react";
import {
  Badge,
  Button,
  Field,
  Input,
  Modal,
  PageHeader,
  Pagination,
  Select,
  Spinner,
  Table,
  Tabs,
  Td,
  useDebounced,
} from "@/components/ui";
import { UnlockPanel, useCodeGate } from "@/components/unlock";
import { api, useMe } from "@/lib/store";
import { useFetch } from "@/lib/use-fetch";
import { cn } from "@/lib/utils";

type Tab = "users" | "data";

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>("users");
  return (
    <div>
      <PageHeader title="後台管理" subtitle="管理登入帳號，以及檢視、刪除資料庫裡的所有資料。只有管理者看得到這一頁。" unlockTimer={false} />
      <UnlockPanel />
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "users", label: "使用者管理" },
          { value: "data", label: "所有資料" },
        ]}
      />
      {tab === "users" ? <UsersTab /> : <DataTab />}
    </div>
  );
}

/* ---------------- 使用者管理 ---------------- */

type User = {
  id: string;
  email: string;
  name: string;
  role: "admin" | "user";
  active: boolean;
  lastLoginAt: string | null;
  createdAt: string;
};

const fmtTime = (s: string | null) => (s ? new Date(s).toLocaleString("zh-TW", { hour12: false }).slice(0, -3) : "—");

function UsersTab() {
  const me = useMe();
  const { data: users, error, reload } = useFetch("admin-users", () => api<User[]>("/api/admin/users"));
  const [adding, setAdding] = useState(false);
  const [resetting, setResetting] = useState<User | null>(null);
  // 修改名稱時取消輸入驗證碼：換 key 讓輸入框回到原本的名稱
  const [nameKey, setNameKey] = useState(0);
  const gate = useCodeGate();

  const patch = async (u: User, body: Partial<User> & { password?: string }) => {
    await api(`/api/admin/users/${u.id}`, { method: "PATCH", body: JSON.stringify(body) });
    reload();
  };

  // 新增、修改、刪除都要先輸入驗證碼（後端也會再檢查）
  function askPatch(u: User, body: Partial<User>, what: string) {
    gate.ask({
      title: "修改使用者",
      confirmLabel: "確認修改",
      message: (
        <>
          修改 <b>{u.email}</b> 的{what}需要驗證碼。
        </>
      ),
      run: () => patch(u, body),
      onCancel: () => setNameKey((k) => k + 1),
    });
  }

  function askAdd() {
    gate.ask({
      title: "新增使用者",
      confirmLabel: "下一步",
      message: "新增使用者需要驗證碼。",
      run: async () => setAdding(true),
    });
  }

  function askReset(u: User) {
    gate.ask({
      title: "重設密碼",
      confirmLabel: "下一步",
      message: (
        <>
          重設 <b>{u.email}</b> 的密碼需要驗證碼。
        </>
      ),
      run: async () => setResetting(u),
    });
  }

  function askDelete(u: User) {
    gate.ask({
      title: "刪除使用者",
      confirmLabel: "確認刪除",
      danger: true,
      message: (
        <>
          即將刪除使用者 <b>{u.email}</b>，無法復原。
        </>
      ),
      run: async () => {
        await api(`/api/admin/users/${u.id}`, { method: "DELETE" });
        reload();
      },
    });
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">
          管理者可以新增、修改、刪除資料並進入後台；一般使用者登入後只能檢視。沒有註冊頁，帳號都從這裡建立。
        </p>
        <Button onClick={askAdd}>
          <Plus size={16} /> 新增使用者
        </Button>
      </div>
      {error && <p className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      <Table head={["Email", "名稱", "身分", "狀態", "最後登入", ""]}>
        {users?.map((u) => {
          const self = u.id === me?.id;
          return (
            <tr key={u.id} className="hover:bg-slate-50">
              <Td className="font-medium text-slate-900">
                {u.email} {self && <Badge color="green">我</Badge>}
              </Td>
              <Td>
                <Input
                  key={`${u.name}-${nameKey}`}
                  defaultValue={u.name}
                  placeholder="（未填）"
                  className="w-28"
                  onBlur={(e) => e.target.value !== u.name && askPatch(u, { name: e.target.value }, "名稱")}
                />
              </Td>
              <Td>
                <Select
                  value={u.role}
                  disabled={self}
                  className="w-32"
                  title={self ? "不能變更自己的身分" : undefined}
                  onChange={(e) => askPatch(u, { role: e.target.value as User["role"] }, "身分")}
                >
                  <option value="admin">管理者</option>
                  <option value="user">一般使用者</option>
                </Select>
              </Td>
              <Td>
                <label className={cn("flex items-center gap-2 whitespace-nowrap", self ? "opacity-50" : "cursor-pointer")}>
                  <input
                    type="checkbox"
                    checked={u.active}
                    disabled={self}
                    onChange={(e) => askPatch(u, { active: e.target.checked }, e.target.checked ? "狀態（啟用）" : "狀態（停用）")}
                    className="h-4 w-4 accent-brand-600"
                  />
                  {u.active ? "啟用" : <span className="text-red-600">停用</span>}
                </label>
              </Td>
              <Td className="whitespace-nowrap text-slate-600">
                {fmtTime(u.lastLoginAt)}
                <div className="text-xs text-slate-400">建立 {fmtTime(u.createdAt)}</div>
              </Td>
              <Td className="whitespace-nowrap text-right">
                <Button variant="ghost" className="px-2 py-1.5" onClick={() => askReset(u)} title="重設密碼">
                  <KeyRound size={14} /> 重設密碼
                </Button>
                {!self && (
                  <Button variant="ghost" className="px-2 py-1.5 text-red-600" onClick={() => askDelete(u)} title="刪除">
                    <Trash2 size={14} />
                  </Button>
                )}
              </Td>
            </tr>
          );
        })}
        {!users && !error && (
          <tr>
            <Td colSpan={6} className="py-8 text-center text-slate-400">
              載入中…
            </Td>
          </tr>
        )}
      </Table>
      {gate.dialog}
      {adding && (
        <AddUserModal
          onClose={() => setAdding(false)}
          onAdded={() => {
            setAdding(false);
            reload();
          }}
        />
      )}
      {resetting && <PasswordModal user={resetting} onClose={() => setResetting(null)} onSave={(password) => patch(resetting, { password })} />}
    </>
  );
}

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

function AddUserModal({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [form, setForm] = useState({ email: "", name: "", password: "", role: "user" as User["role"] });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/api/admin/users", { method: "POST", body: JSON.stringify(form) });
      onAdded();
    } catch (err) {
      setError(errMsg(err));
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="新增使用者"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            取消
          </Button>
          <Button type="submit" form="add-user" disabled={busy}>
            {busy ? "建立中…" : "建立"}
          </Button>
        </>
      }
    >
      <form id="add-user" onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <Field label="Email" required className="sm:col-span-2">
          <Input type="email" required autoFocus value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </Field>
        <Field label="名稱">
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="例：阿明" />
        </Field>
        <Field label="身分">
          <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as User["role"] })}>
            <option value="user">一般使用者（只能看）</option>
            <option value="admin">管理者</option>
          </Select>
        </Field>
        <Field label="密碼（至少 8 個字元）" required className="sm:col-span-2">
          <Input
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
        </Field>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 sm:col-span-2">{error}</p>}
      </form>
    </Modal>
  );
}

function PasswordModal({ user, onClose, onSave }: { user: User; onClose: () => void; onSave: (p: string) => Promise<void> }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await onSave(password);
      onClose();
    } catch (err) {
      setError(errMsg(err));
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`重設密碼：${user.email}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            取消
          </Button>
          <Button type="submit" form="reset-password" disabled={busy}>
            {busy ? "儲存中…" : "儲存新密碼"}
          </Button>
        </>
      }
    >
      <form id="reset-password" onSubmit={submit} className="space-y-3">
        <Field label="新密碼（至少 8 個字元）" required>
          <Input
            type="password"
            required
            minLength={8}
            autoFocus
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      </form>
    </Modal>
  );
}

/* ---------------- 所有資料 ---------------- */

type CollectionInfo = { name: string; label: string; count: number };
type Row = { id: string; title: string; sub: string; date: string };

/** 刪除時會一起刪掉的關聯資料 */
const CASCADE: Record<string, string> = {
  customers: "這位客戶的所有訂單",
  agencies: "這家旅行社的所有預約",
};

function DataTab() {
  const { data: collections, reload: reloadCounts } = useFetch("admin-collections", () => api<CollectionInfo[]>("/api/admin/data"));
  const [name, setName] = useState("customers");
  const [kw, setKw] = useState("");
  const [page, setPage] = useState(1);
  const q = useDebounced(kw.trim());
  const { data, loading, error, reload } = useFetch(JSON.stringify({ name, q, page }), () =>
    api<{ items: Row[]; total: number; page: number; limit: number }>(
      `/api/admin/data/${name}?${new URLSearchParams({ q, page: String(page) })}`,
    ),
  );
  const [viewing, setViewing] = useState<Row | null>(null);
  const gate = useCodeGate();
  const current = collections?.find((c) => c.name === name);
  const canDelete = name !== "users"; // 帳號請到「使用者管理」刪除

  function askDelete(r: Row) {
    const cascade = CASCADE[name];
    gate.ask({
      title: "刪除資料",
      confirmLabel: "確認刪除",
      danger: true,
      message: (
        <>
          即將刪除{current?.label}「<b>{r.title}</b>」{cascade && <>，並一起刪除{cascade}</>}，無法復原。
        </>
      ),
      run: async () => {
        await api(`/api/admin/data/${name}/${encodeURIComponent(r.id)}${cascade ? "?cascade=true" : ""}`, { method: "DELETE" });
        setViewing(null);
        reload();
        reloadCounts();
      },
    });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[16rem_1fr]">
      <section className="h-fit rounded-2xl border border-slate-200/80 bg-white p-2 shadow-sm shadow-slate-200/60">
        <nav className="flex flex-col">
          {(collections ?? []).map((c) => (
            <button
              key={c.name}
              onClick={() => {
                setName(c.name);
                setPage(1);
                setKw("");
              }}
              className={cn(
                "flex items-center justify-between rounded-lg px-3 py-2 text-left text-sm",
                c.name === name ? "bg-brand-600 font-medium text-white" : "text-slate-700 hover:bg-slate-100",
              )}
            >
              <span>{c.label}</span>
              <span className={cn("tabular-nums", c.name === name ? "text-white/80" : "text-slate-400")}>{c.count.toLocaleString()}</span>
            </button>
          ))}
          {!collections && <Spinner />}
        </nav>
      </section>

      <div className="min-w-0">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900">
            {current?.label ?? name}{" "}
            <span className="text-sm font-normal text-slate-500">
              （{name}，共 {data ? data.total.toLocaleString() : "…"} 筆{loading && data && "，更新中…"}）
            </span>
          </h2>
          <div className="relative w-full max-w-xs">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              value={kw}
              onChange={(e) => {
                setKw(e.target.value);
                setPage(1);
              }}
              placeholder="搜尋名稱、電話、單號…"
              className="pl-9"
            />
          </div>
        </div>
        {error && <p className="mb-3 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
        <Table head={["ID", "名稱", "說明", "日期", ""]}>
          {data?.items.map((r) => (
            <tr key={r.id} className="hover:bg-slate-50">
              <Td className="max-w-40 truncate font-mono text-xs text-slate-500">{r.id}</Td>
              <Td className="font-medium text-slate-800">{r.title || <span className="text-slate-400">—</span>}</Td>
              <Td className="max-w-md truncate text-slate-500">{r.sub}</Td>
              <Td className="whitespace-nowrap text-slate-500">{r.date ? r.date.replace("T", " ").slice(0, 16) : "—"}</Td>
              <Td className="whitespace-nowrap text-right">
                <Button variant="ghost" className="px-2 py-1.5" onClick={() => setViewing(r)} title="檢視原始資料">
                  <Eye size={14} /> 檢視
                </Button>
                {canDelete && (
                  <Button variant="ghost" className="px-2 py-1.5 text-red-600" onClick={() => askDelete(r)} title="刪除">
                    <Trash2 size={14} />
                  </Button>
                )}
              </Td>
            </tr>
          ))}
          {data && !data.items.length && (
            <tr>
              <Td colSpan={5} className="py-8 text-center text-slate-400">
                {q ? "沒有符合的資料" : "這個集合沒有資料"}
              </Td>
            </tr>
          )}
          {!data && !error && (
            <tr>
              <Td colSpan={5} className="py-8 text-center text-slate-400">
                載入中…
              </Td>
            </tr>
          )}
        </Table>
        {data && <Pagination page={page} limit={data.limit} total={data.total} onChange={setPage} />}
        <p className="mt-3 text-xs text-slate-500">要修改內容請到各功能頁面編輯；這裡只提供檢視與刪除。</p>
      </div>

      {viewing && (
        <RawModal
          collection={name}
          label={current?.label ?? name}
          row={viewing}
          onClose={() => setViewing(null)}
          onDelete={canDelete ? () => askDelete(viewing) : undefined}
        />
      )}
      {gate.dialog}
    </div>
  );
}

function RawModal({
  collection,
  label,
  row,
  onClose,
  onDelete,
}: {
  collection: string;
  label: string;
  row: Row;
  onClose: () => void;
  onDelete?: () => void;
}) {
  const { data, error } = useFetch(`raw:${collection}:${row.id}`, () =>
    api<unknown>(`/api/admin/data/${collection}/${encodeURIComponent(row.id)}`),
  );
  return (
    <Modal
      open
      wide
      onClose={onClose}
      title={`${label}：${row.title || row.id}`}
      footer={
        <>
          {onDelete && (
            <Button variant="danger" className="mr-auto" onClick={onDelete}>
              <Trash2 size={15} /> 刪除這筆
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>
            關閉
          </Button>
        </>
      }
    >
      {error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : !data ? (
        <Spinner />
      ) : (
        <pre className="max-h-[70vh] overflow-auto whitespace-pre-wrap break-all rounded-lg bg-white p-4 font-mono text-xs leading-relaxed text-slate-700 ring-1 ring-slate-200">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </Modal>
  );
}
