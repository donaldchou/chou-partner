import type { Model } from "mongoose";
import { CustomerTagModel } from "@/models/customer-tag";
import { GroupBuyerModel, GroupBuyModel } from "@/models/group-buy";
import { ProductModel } from "@/models/product";
import { AgencyModel, BookingModel, BusCompanyModel } from "@/models/tour";
import type { AppState } from "./types";

export type CollectionName = keyof AppState;

/**
 * 通用 API /api/<collection> 對應的 Model；名稱與前端 AppState 的 key 相同。
 * 客戶與訂單資料量大，有專用的分頁 API（/api/customers、/api/orders），不在這裡。
 */
export const COLLECTIONS: Record<CollectionName, Model<unknown>> = {
  products: ProductModel,
  agencies: AgencyModel,
  busCompanies: BusCompanyModel,
  bookings: BookingModel,
  groupBuys: GroupBuyModel,
  groupBuyers: GroupBuyerModel,
  customerTags: CustomerTagModel,
};

export const isCollection = (name: string): name is CollectionName => name in COLLECTIONS;

/** 列表預設排序 */
export const SORT: Record<CollectionName, Record<string, 1 | -1>> = {
  products: { brand: 1, _id: 1 },
  agencies: { name: 1 },
  busCompanies: { name: 1 },
  bookings: { datetime: 1 },
  groupBuys: { startDate: -1 },
  groupBuyers: { name: 1 },
  customerTags: { order: 1, name: 1 },
};

/** GET /api/<collection>?欄位=值 可直接篩選的欄位 */
export const FILTERS: Partial<Record<CollectionName, string[]>> = {
  products: ["brand", "category"],
  agencies: ["status", "license", "city"],
  bookings: ["agencyId", "busCompanyId", "status", "county"],
  groupBuys: ["buyerId", "status", "shippingMode"],
  groupBuyers: ["status", "kind", "city"],
};

/** ?q= 關鍵字搜尋的欄位（不分大小寫、空白分隔的每個字都要符合） */
export const SEARCH_FIELDS: Partial<Record<CollectionName, string[]>> = {
  products: ["_id", "name", "category", "spec"],
  agencies: ["name", "contactName", "phone", "otherPhones", "lineName", "address", "website", "fruitTour", "people.name", "people.phone", "people.lineName"],
  busCompanies: ["name", "contactName", "phone", "otherPhones", "lineName", "people.name", "people.phone", "people.lineName"],
  bookings: ["plate", "county", "buyingPowerNote", "note"],
  groupBuys: ["name", "contactName", "phone", "lineName", "items.product", "recipients.name", "recipients.phone"],
  groupBuyers: ["name", "contactName", "phone", "otherPhones", "lineName", "address", "website", "fruitDeal"],
};

/** ?from= ?to= 日期區間篩選的欄位 */
export const DATE_FIELD: Partial<Record<CollectionName, string>> = {
  bookings: "datetime",
  groupBuys: "startDate",
};
