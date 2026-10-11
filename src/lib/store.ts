"use client";

import { useSyncExternalStore } from "react";
import type { Agency, AppState, Booking, Customer, GroupBuy } from "./types";

// 前端資料快取：啟動時從 /api/db 載入，寫入時先更新畫面（樂觀更新）再送到後端。
const EMPTY: AppState = { customers: [], agencies: [], bookings: [], groupBuys: [] };

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
  const data = await res.json().catch(() => ({}));
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

/** 資料庫完全沒有資料時，放入示範資料 */
export async function loadDemo() {
  await api("/api/seed", { method: "POST" });
  await reload();
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
    alert(`儲存失敗：${e instanceof Error ? e.message : String(e)}`);
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

// 呼叫端多半不等待結果（畫面已先更新），失敗時 send() 已提示並重新載入
const quiet = (p: Promise<unknown>) => void p.catch(() => {});

export const actions = {
  saveCustomer: (c: Customer) => quiet(save("customers", c)),
  deleteCustomer: (id: string) => quiet(remove("customers", id)),

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
