/**
 * 一般使用者的頁面權限（前後端共用）。
 * 帳號看得到的頁面 ＝ 後台「① 一般使用者可以看的頁面」有勾，且「② 個別帳號再隱藏」沒勾；管理者永遠看得到全部。
 * 只有管理者能用的頁面（建檔、匯入、後台…）不在這裡，一律只給管理者。
 */
export const USER_PAGES = [
  { key: "dashboard", label: "儀表板", group: "總覽" },
  { key: "customers", label: "客戶查詢", group: "客戶管理" },
  { key: "orders", label: "訂單列表", group: "訂單管理" },
  { key: "bookings", label: "採果預約", group: "採果/旅行社/遊覽車管理" },
  { key: "agencies", label: "旅行社管理", group: "採果/旅行社/遊覽車管理" },
  { key: "buses", label: "遊覽車管理", group: "採果/旅行社/遊覽車管理" },
  { key: "gbList", label: "團購列表", group: "團購管理" },
  { key: "gbManage", label: "團購管理", group: "團購管理" },
] as const;

export type PageKey = (typeof USER_PAGES)[number]["key"];
export const PAGE_KEYS: PageKey[] = USER_PAGES.map((p) => p.key);
export const isPageKey = (v: unknown): v is PageKey => PAGE_KEYS.includes(v as PageKey);
export const pageLabel = (k: PageKey) => USER_PAGES.find((p) => p.key === k)!.label;

/** 網址屬於哪個頁面；不屬於任何一個（登入頁、後台）回 null */
export function pageOfPath(path: string): PageKey | null {
  if (path === "/") return "dashboard";
  if (path.startsWith("/customers")) return "customers";
  if (path.startsWith("/orders")) return "orders";
  if (path.startsWith("/tours/bookings")) return "bookings";
  if (path.startsWith("/tours/agencies")) return "agencies";
  if (path.startsWith("/tours/bus-companies")) return "buses";
  if (path.startsWith("/group-buys/buyers")) return "gbManage";
  if (path.startsWith("/group-buys")) return "gbList";
  return null;
}

/** 頁面的網址（沒有權限的頁面改連到第一個看得到的頁面用） */
export const PAGE_HREF: Record<PageKey, string> = {
  dashboard: "/",
  customers: "/customers",
  orders: "/orders",
  bookings: "/tours/bookings",
  agencies: "/tours/agencies",
  buses: "/tours/bus-companies",
  gbList: "/group-buys",
  gbManage: "/group-buys/buyers",
};

/** /api/db、/api/<collection> 的資料：有其中一個頁面的權限才給（例如採果預約要顯示旅行社名稱）；沒列的集合（產品、標籤）都給 */
export const COLLECTION_PAGES: Partial<Record<string, PageKey[]>> = {
  agencies: ["agencies", "bookings"],
  bookings: ["bookings", "agencies", "buses"],
  busCompanies: ["buses", "bookings"],
  groupBuys: ["gbList", "gbManage"],
  groupBuyers: ["gbManage", "gbList"],
};

export type PageAccessSettings = {
  /** ① 一般使用者可以看的頁面 */
  allowed: PageKey[];
  /** 一般使用者帳號與各自另外隱藏的頁面 */
  users: { id: string; email: string; name: string; active: boolean; hiddenPages: PageKey[] }[];
};
