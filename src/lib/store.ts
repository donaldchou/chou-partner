"use client";

import { useSyncExternalStore } from "react";
import type { Agency, AppState, Booking, Customer, GroupBuy, Order, Product } from "./types";

// 前端資料快取：啟動時從 /api/db 載入，寫入時先更新畫面（樂觀更新）再送到後端。
const EMPTY: AppState = { products: [], agencies: [], bookings: [], groupBuys: [] };

export type DBStatus = "idle" | "loading" | "ready" | "error";

let state: AppState = EMPTY;
let status: DBStatus = "idle";
let error = "";
let statusSnapshot: { status: DBStatus; error: string } = { status, error };
const SERVER_STATUS = statusSnapshot;
const listeners = new Set<() => void>();
const emit = () => {
  statusSnapshot = { status, error };
  listeners.forEach((l) => l());
};

export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const isForm = init?.body instanceof FormData;
  const res = await fetch(url, {
    ...init,
    headers: isForm ? init?.headers : { "Content-Type": "application/json", ...init?.headers },
  });
  if (res.status === 204) return undefined as T;
  // 登入過期或帳號被停用：回登入頁，登入後再回到這一頁
  if (res.status === 401 && typeof window !== "undefined" && location.pathname !== "/login") {
    await fetch("/api/auth/logout", { method: "POST" });
    // 故意整頁重新載入，清掉記憶體裡的資料
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = `/login?next=${encodeURIComponent(location.pathname + location.search)}`;
  }
  const data = await res.json().catch(() => ({}));
  // 新增、修改、刪除需要驗證碼：跳出輸入框，解鎖後自動重送這個請求（取消時丟出 cancelled 錯誤）
  if (res.status === 423 && data.needCode) {
    setUnlock(null);
    await requestCode();
    return api<T>(url, init);
  }
  if (!res.ok) throw Object.assign(new Error(data.error ?? `HTTP ${res.status}`), { status: res.status, data });
  return data as T;
}

export async function reload() {
  // 已經載入過就在背景更新，不讓畫面回到載入中
  if (status !== "ready") {
    status = "loading";
    emit();
  }
  try {
    state = await api<AppState>("/api/db");
    status = "ready";
    error = "";
  } catch (e) {
    status = "error";
    error = e instanceof Error ? e.message : String(e);
  }
  emit();
}

function subscribe(l: () => void) {
  listeners.add(l);
  if (status === "idle") void reload();
  return () => listeners.delete(l);
}

export function useAppState() {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => EMPTY,
  );
}

export function useDBStatus() {
  return useSyncExternalStore(
    subscribe,
    () => statusSnapshot,
    () => SERVER_STATUS,
  );
}

/** 資料已從資料庫載入（詳細頁用來避免閃出「找不到」） */
export function useLoaded() {
  return useDBStatus().status === "ready";
}

/* ---------------- 寫入：先改畫面，再送到後端；失敗時提示並重新載入 ---------------- */

type Coll = keyof AppState;
type Item<K extends Coll> = AppState[K][number];

function setLocal(next: AppState) {
  state = next;
  emit();
}

async function send(request: Promise<unknown>) {
  try {
    await request;
  } catch (e) {
    // 取消輸入驗證碼不算錯誤，只把畫面還原
    if (!isCancelled(e)) alert(`儲存失敗：${e instanceof Error ? e.message : String(e)}`);
    await reload();
    throw e;
  }
}

function save<K extends Coll>(key: K, item: Item<K>) {
  const list = state[key] as Item<K>[];
  const exists = list.some((x) => x.id === item.id);
  setLocal({ ...state, [key]: exists ? list.map((x) => (x.id === item.id ? item : x)) : [item, ...list] });
  return send(api(`/api/${key}/${encodeURIComponent(item.id)}`, { method: "PUT", body: JSON.stringify(item) }));
}

function remove<K extends Coll>(key: K, id: string, query = "") {
  setLocal({ ...state, [key]: (state[key] as Item<K>[]).filter((x) => x.id !== id) });
  return send(api(`/api/${key}/${encodeURIComponent(id)}${query}`, { method: "DELETE" }));
}

// 呼叫端多半不等待結果（畫面已先更新），失敗時 send() 已提示並重新載入；需要時可 await 得知是否成功
const quiet = (p: Promise<unknown>) => p.then(
  () => true,
  () => false,
);

export const actions = {
  saveProduct: (p: Product) => quiet(save("products", p)),

  // 後端會把被移除的領隊／司機從預約裡清掉，存完重新載入預約
  saveAgency: (a: Agency) => quiet(save("agencies", a).then(reload)),
  deleteAgency: (id: string) => {
    setLocal({ ...state, bookings: state.bookings.filter((b) => b.agencyId !== id) });
    quiet(remove("agencies", id, "?cascade=true"));
  },

  saveBooking: (b: Booking) => quiet(save("bookings", b)),
  deleteBooking: (id: string) => quiet(remove("bookings", id)),

  saveGroupBuy: (g: GroupBuy) => quiet(save("groupBuys", g)),
  deleteGroupBuy: (id: string) => quiet(remove("groupBuys", id)),
};

/* ---------------- 客戶與訂單：資料量大，用分頁 API，不放進全域快取 ---------------- */

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export type OrderBrief = Pick<Order, "id" | "orderNo" | "orderedAt" | "season" | "channel" | "status" | "items" | "amounts">;
export type CustomerWithOrders = Customer & { orders: Order[] };
export type OrderWithCustomer = Order & { customer: Customer | null };

const qs = (params: Record<string, string | number | undefined>) =>
  new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== "") as [string, string][]).toString();

export const customersApi = {
  list: (params: Record<string, string | number | undefined>) =>
    api<Page<Customer & { orders?: OrderBrief[] }> & { counts?: CustomerCounts }>(`/api/customers?${qs(params)}`),
  get: (id: string) => api<CustomerWithOrders>(`/api/customers/${encodeURIComponent(id)}`),
  save: (c: Customer) => api<Customer>(`/api/customers/${encodeURIComponent(c.id)}`, { method: "PUT", body: JSON.stringify(c) }),
  remove: (id: string, cascade = false) =>
    api(`/api/customers/${encodeURIComponent(id)}${cascade ? "?cascade=true" : ""}`, { method: "DELETE" }),
  merge: (into: string, from: string) =>
    api<CustomerWithOrders>(`/api/customers/${encodeURIComponent(into)}/merge`, { method: "POST", body: JSON.stringify({ from }) }),
  /** 標記無效（invalid）、取消標記（invalid: null）、確認是正常客戶（suspectChecked: true） */
  setStatus: (id: string, body: { invalid?: { reason: string; note: string } | null; suspectChecked?: boolean }) =>
    api<CustomerWithOrders>(`/api/customers/${encodeURIComponent(id)}/status`, { method: "PATCH", body: JSON.stringify(body) }),
};

export type CustomerCounts = { valid: number; suspect: number; invalid: number };

export const ordersApi = {
  list: (params: Record<string, string | number | undefined>) => api<Page<Order> & { amount: number }>(`/api/orders?${qs(params)}`),
  get: (id: string) => api<OrderWithCustomer>(`/api/orders/${encodeURIComponent(id)}`),
  save: (o: Order) => api<Order>(`/api/orders/${encodeURIComponent(o.id)}`, { method: "PUT", body: JSON.stringify(o) }),
  remove: (id: string) => api(`/api/orders/${encodeURIComponent(id)}`, { method: "DELETE" }),
};

export interface DashboardStats {
  season: number;
  seasons: number[];
  customers: number;
  repeatCustomers: number;
  suspectCustomers: number;
  needsReview: number;
  pendingOrders: number;
  unpaidOrders: number;
  bySeason: { season: number; orders: number; amount: number }[];
  byChannel: { channel: string; orders: number; amount: number }[];
}
export const statsApi = { get: () => api<DashboardStats>("/api/stats") };

/* ---------------- 目前登入的使用者 ---------------- */
export type Me = { id: string; email: string; name: string; role: "admin" | "user" };
let me: Me | null = null;
let meLoading = false;
const meListeners = new Set<() => void>();

async function loadMe() {
  meLoading = true;
  try {
    me = await api<Me>("/api/auth/me");
  } catch {
    me = null;
  }
  meListeners.forEach((l) => l());
}

/** 目前登入的使用者；還沒載入完是 null */
export function useMe(): Me | null {
  return useSyncExternalStore(
    (l) => {
      meListeners.add(l);
      if (!meLoading) void loadMe();
      return () => meListeners.delete(l);
    },
    () => me,
    () => null,
  );
}

/** 只有管理者可以新增、修改、刪除；一般使用者只能看 */
export const useCanEdit = () => useMe()?.role === "admin";

export async function logout() {
  await fetch("/api/auth/logout", { method: "POST" });
  // 整頁重新載入，清掉記憶體裡的資料
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.href = "/login";
}

/* ---------------- 驗證碼解鎖（輸入一次，1 小時內免輸入） ---------------- */
let unlockUntil: number | null = null; // 到期時間（毫秒）
let unlockLoaded = false;
const unlockListeners = new Set<() => void>();
let unlockTimer: ReturnType<typeof setTimeout> | undefined;

function setUnlock(expiresAt: number | null) {
  unlockUntil = expiresAt && expiresAt > Date.now() ? expiresAt : null;
  clearTimeout(unlockTimer);
  // 到期時自動切回「需要驗證碼」
  if (unlockUntil) unlockTimer = setTimeout(() => setUnlock(null), unlockUntil - Date.now());
  unlockListeners.forEach((l) => l());
}

async function loadUnlock() {
  unlockLoaded = true;
  try {
    setUnlock((await api<{ expiresAt: number | null }>("/api/unlock")).expiresAt);
  } catch {
    setUnlock(null);
  }
}

/** 解鎖到期時間（毫秒）；沒有解鎖是 null；還沒問過伺服器是 undefined */
export function useUnlock(): number | null | undefined {
  return useSyncExternalStore(
    (l) => {
      unlockListeners.add(l);
      if (!unlockLoaded) void loadUnlock();
      return () => unlockListeners.delete(l);
    },
    () => (unlockLoaded ? unlockUntil : undefined),
    () => undefined,
  );
}

export async function unlock(code: string) {
  const { expiresAt } = await api<{ expiresAt: number }>("/api/unlock", { method: "POST", body: JSON.stringify({ code }) });
  setUnlock(expiresAt);
}

export async function lockNow() {
  await api("/api/unlock", { method: "DELETE" });
  setUnlock(null);
}

/* ---------------- 需要驗證碼時的輸入框（<CodePrompt /> 放在 AppShell） ---------------- */
let codeAsk: { resolve: () => void; reject: (e: Error) => void } | null = null;
let codePromise: Promise<void> | null = null;
const codeListeners = new Set<() => void>();
const emitCode = () => codeListeners.forEach((l) => l());

/** 同時有好幾個請求需要驗證碼時，共用同一個輸入框 */
function requestCode() {
  codePromise ??= new Promise<void>((resolve, reject) => {
    codeAsk = { resolve, reject };
    emitCode();
  }).finally(() => {
    codeAsk = null;
    codePromise = null;
    emitCode();
  });
  return codePromise;
}

/** 是否正在等使用者輸入驗證碼 */
export function useCodeRequested() {
  return useSyncExternalStore(
    (l) => {
      codeListeners.add(l);
      return () => codeListeners.delete(l);
    },
    () => codeAsk !== null,
    () => false,
  );
}

/** 輸入驗證碼：正確時解鎖並繼續剛才的動作；錯誤時丟出錯誤，輸入框保持開著 */
export async function submitCode(code: string) {
  await unlock(code);
  codeAsk?.resolve();
}

export function cancelCode() {
  codeAsk?.reject(Object.assign(new Error("已取消：新增、修改、刪除需要驗證碼"), { cancelled: true }));
}

export const isCancelled = (e: unknown) => !!(e as { cancelled?: boolean } | null)?.cancelled;

/** 顯示「xx失敗：原因」；取消輸入驗證碼時不顯示 */
export function alertError(prefix: string, e: unknown) {
  if (!isCancelled(e)) alert(`${prefix}：${e instanceof Error ? e.message : e}`);
}
