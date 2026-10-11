import type { Model } from "mongoose";
import { CustomerModel } from "@/models/customer";
import { GroupBuyModel } from "@/models/group-buy";
import { AgencyModel, BookingModel } from "@/models/tour";
import type { AppState } from "./types";

export type CollectionName = keyof AppState;

/** API 路徑 /api/<collection> 對應的 Model；名稱與前端 AppState 的 key 相同 */
export const COLLECTIONS: Record<CollectionName, Model<unknown>> = {
  customers: CustomerModel,
  agencies: AgencyModel,
  bookings: BookingModel,
  groupBuys: GroupBuyModel,
};

export const isCollection = (name: string): name is CollectionName => name in COLLECTIONS;

/** 列表預設排序 */
export const SORT: Record<CollectionName, Record<string, 1 | -1>> = {
  customers: { createdAt: -1 },
  agencies: { name: 1 },
  bookings: { datetime: 1 },
  groupBuys: { startDate: -1 },
};

/** GET /api/<collection>?欄位=值 可直接篩選的欄位 */
export const FILTERS: Partial<Record<CollectionName, string[]>> = {
  customers: ["source"],
  bookings: ["agencyId", "status", "county"],
  groupBuys: ["status", "shippingMode"],
};

/** ?q= 關鍵字搜尋的欄位（不分大小寫、空白分隔的每個字都要符合） */
export const SEARCH_FIELDS: Partial<Record<CollectionName, string[]>> = {
  customers: [
    "company",
    "name",
    "title",
    "phone",
    "phoneDigits",
    "address",
    "email",
    "lineName",
    "note",
    "orders.items.product",
    "orders.items.spec",
  ],
  agencies: ["name", "contactName", "phone", "lineName", "people.name", "people.phone", "people.lineName"],
  bookings: ["plate", "county", "buyingPowerNote", "note"],
  groupBuys: ["name", "contactName", "phone", "lineName", "items.product", "recipients.name", "recipients.phone"],
};

/** ?from= ?to= 日期區間篩選的欄位 */
export const DATE_FIELD: Partial<Record<CollectionName, string>> = {
  customers: "orders.date",
  bookings: "datetime",
  groupBuys: "startDate",
};
