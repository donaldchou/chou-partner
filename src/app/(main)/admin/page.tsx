"use client";

import { Eye, KeyRound, Plus, RefreshCw, Search, Trash2 } from "lucide-react";
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
import { UnlockPanel } from "@/components/unlock";
import { alertError, api, isCancelled, useMe } from "@/lib/store";
import { openStoredFile, photoSrc } from "@/lib/upload";
import { useFetch } from "@/lib/use-fetch";
import { cn } from "@/lib/utils";

type Tab = "users" | "data" | "files";

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
          { value: "files", label: "清理未使用的檔案" },
        ]}
      />
      {tab === "users" ? <UsersTab /> : tab === "data" ? <DataTab /> : <FilesTab />}
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
  // 修改名稱失敗或取消輸入驗證碼：換 key 讓輸入框回到原本的名稱
  const [nameKey, setNameKey] = useState(0);

  // 新增、修改、刪除：沒在上方解鎖時，送出會跳出驗證碼輸入框（只對這一次有效）
  const patch = async (u: User, body: Partial<User> & { password?: string }) => {
    await api(`/api/admin/users/${u.id}`, { method: "PATCH", body: JSON.stringify(body) });
    reload();
  };

  async function update(u: User, body: Partial<User>) {
    try {
      await patch(u, body);
    } catch (e) {
      alertError("修改失敗", e);
      setNameKey((k) => k + 1);
    }
  }

  async function remove(u: User) {
    if (!confirm(`確定刪除使用者 ${u.email}？此動作無法復原。`)) return;
    try {
      await api(`/api/admin/users/${u.id}`, { method: "DELETE" });
      reload();
    } catch (e) {
      alertError("刪除失敗", e);
    }
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">
          管理者可以新增、修改、刪除資料並進入後台；一般使用者登入後只能檢視。沒有註冊頁，帳號都從這裡建立。
        </p>
        <Button onClick={() => setAdding(true)}>
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
                  onBlur={(e) => e.target.value !== u.name && update(u, { name: e.target.value })}
                />
              </Td>
              <Td>
                <Select
                  value={u.role}
                  disabled={self}
                  className="w-32"
                  title={self ? "不能變更自己的身分" : undefined}
                  onChange={(e) => update(u, { role: e.target.value as User["role"] })}
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
                    onChange={(e) => update(u, { active: e.target.checked })}
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
                <Button variant="ghost" className="px-2 py-1.5" onClick={() => setResetting(u)} title="重設密碼">
                  <KeyRound size={14} /> 重設密碼
                </Button>
                {!self && (
                  <Button variant="ghost" className="px-2 py-1.5 text-red-600" onClick={() => remove(u)} title="刪除">
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
      if (!isCancelled(err)) setError(errMsg(err));
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
      if (!isCancelled(err)) setError(errMsg(err));
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

/* ---------------- 清理未使用的檔案 ---------------- */

type HostFile = { url: string; size: number; time: string; used: boolean; recent: boolean };
type FileScan = { total: number; totalBytes: number; used: number; unused: HostFile[] };

const FOLDERS: Record<string, string> = { cards: "名片", people: "領隊／司機照片", shipping: "宅配單" };

const fmtSize = (n: number) =>
  n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${Math.round(n / 1024)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`;

function FilesTab() {
  const { data, loading, error, reload } = useFetch("admin-files", () => api<FileScan>("/api/admin/files"));
  const [busy, setBusy] = useState(false);
  const removable = data?.unused.filter((f) => !f.recent) ?? [];
  const recent = (data?.unused.length ?? 0) - removable.length;

  async function clean() {
    if (!confirm(`確定刪除 ${removable.length} 個未使用的檔案（${fmtSize(removable.reduce((s, f) => s + f.size, 0))}）？刪除後無法復原。`)) return;
    setBusy(true);
    try {
      const r = await api<{ deleted: number; failed: number }>("/api/admin/files", { method: "DELETE" });
      alert(`已刪除 ${r.deleted} 個檔案${r.failed ? `，${r.failed} 個刪除失敗` : ""}`);
      reload();
    } catch (e) {
      alertError("清理失敗", e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-3xl text-sm text-slate-500">
          比對 ll3 主機上的照片與檔案和資料庫，找出沒有被任何客戶、旅行社、團購用到的檔案（例如上傳名片後按了取消）。
          24 小時內上傳的先保留，因為可能還有表單正在填寫。
        </p>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={reload} disabled={loading || busy}>
            <RefreshCw size={15} /> 重新檢查
          </Button>
          <Button variant="dangerSolid" onClick={clean} disabled={!removable.length || busy || loading}>
            <Trash2 size={15} /> {busy ? "刪除中…" : `刪除 ${removable.length} 個未使用的檔案`}
          </Button>
        </div>
      </div>
      {error && <p className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      {data && (
        <p className="mb-3 text-sm text-slate-700">
          主機上共 {data.total} 個檔案（{fmtSize(data.totalBytes)}），使用中 {data.used} 個，未使用 {data.unused.length} 個
          {recent > 0 && <span className="text-slate-500">（其中 {recent} 個是 24 小時內上傳的，暫不刪除）</span>}。
        </p>
      )}
      <Table head={["預覽", "類別", "檔名", "大小", "上傳時間", "狀態"]}>
        {data?.unused.map((f) => {
          const [folder, name] = f.url.slice(4).split("/");
          const isImage = /\.(jpe?g|png|webp|gif)$/i.test(name);
          return (
            <tr key={f.url} className="hover:bg-slate-50">
              <Td>
                {isImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photoSrc(f.url)} alt="" loading="lazy" className="h-12 w-12 rounded-md border border-slate-200 object-cover" />
                ) : (
                  <button className="text-xs text-brand-700 hover:underline" onClick={() => openStoredFile(f.url, name)}>
                    開啟
                  </button>
                )}
              </Td>
              <Td>{FOLDERS[folder] ?? folder}</Td>
              <Td className="font-mono text-xs text-slate-500">{name}</Td>
              <Td className="whitespace-nowrap text-slate-600">{fmtSize(f.size)}</Td>
              <Td className="whitespace-nowrap text-slate-600">{fmtTime(f.time)}</Td>
              <Td>{f.recent ? <Badge color="amber">24 小時內，保留</Badge> : <Badge color="red">可刪除</Badge>}</Td>
            </tr>
          );
        })}
        {data && !data.unused.length && (
          <tr>
            <Td colSpan={6} className="py-8 text-center text-slate-400">
              沒有未使用的檔案
            </Td>
          </tr>
        )}
        {!data && !error && (
          <tr>
            <Td colSpan={6} className="py-8 text-center text-slate-400">
              檢查中…
            </Td>
          </tr>
        )}
      </Table>
    </>
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
  const current = collections?.find((c) => c.name === name);
  const canDelete = name !== "users"; // 帳號請到「使用者管理」刪除

  async function askDelete(r: Row) {
    const cascade = CASCADE[name];
    if (!confirm(`即將刪除${current?.label ?? ""}「${r.title}」${cascade ? `，並一起刪除${cascade}` : ""}，無法復原。確定嗎？`)) return;
    try {
      await api(`/api/admin/data/${name}/${encodeURIComponent(r.id)}${cascade ? "?cascade=true" : ""}`, { method: "DELETE" });
      setViewing(null);
      reload();
      reloadCounts();
    } catch (e) {
      alertError("刪除失敗", e);
    }
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
