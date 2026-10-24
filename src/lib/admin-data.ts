import type { Model } from "mongoose";
import { CustomerModel } from "@/models/customer";
import { GroupBuyModel } from "@/models/group-buy";
import { OrderModel } from "@/models/order";
import { ProductModel } from "@/models/product";
import { AgencyModel, BookingModel } from "@/models/tour";
import { UserModel } from "@/models/user";
import { HttpError, toClient } from "./api";
import { publicUser } from "./auth";
import { deleteCustomer } from "./customers-repo";
import { connectDB } from "./mongodb";
import { deleteOrder } from "./orders-repo";
import { deleteDoc, escapeRegex } from "./repo";

type Row = Record<string, unknown>;
const s = (v: unknown) => (v === undefined || v === null ? "" : String(v));

/**
 * 後台「所有資料」：每個集合怎麼搜尋、列表要顯示什麼。
 * 刪除一律走各集合原本的規則（例如刪客戶要一起刪訂單、刪旅行社要一起刪預約）。
 */
const ADMIN_COLLECTIONS: Record<
  string,
  {
    label: string;
    model: Model<unknown>;
    search: string[];
    sort: Record<string, 1 | -1>;
    row: (d: Row) => { title: string; sub: string; date: string };
  }
> = {
  customers: {
    label: "客戶",
    model: CustomerModel,
    search: ["name", "company", "phones.digits", "phones.number", "addresses.address", "emails"],
    sort: { "stats.lastOrderAt": -1 },
    row: (d) => ({
      title: `${s(d.name)}${d.company ? `（${s(d.company)}）` : ""}`,
      sub: `${((d.phones as { number: string }[]) ?? []).map((p) => p.number).join("、")}・${s((d.stats as Row)?.orderCount)} 筆訂單`,
      date: s((d.stats as Row)?.lastOrderAt) || s(d.createdAt),
    }),
  },
  orders: {
    label: "訂單",
    model: OrderModel,
    search: ["orderNo", "buyer.name", "buyer.phone", "shipments.recipient.name", "legacy.file"],
    sort: { orderedAt: -1 },
    row: (d) => ({
      title: `${s(d.orderNo)} ${s((d.buyer as Row)?.name)}`,
      sub: `${s(d.channel)}・${s(d.status)}・NT$ ${Number((d.amounts as Row)?.total ?? 0).toLocaleString()}${(d.legacy as Row)?.needsReview ? "・待確認" : ""}`,
      date: s(d.orderedAt),
    }),
  },
  products: {
    label: "產品",
    model: ProductModel,
    search: ["_id", "name", "category"],
    sort: { _id: 1 },
    row: (d) => ({ title: `${s(d._id)} ${s(d.name)}`, sub: `${s(d.brand)}・${s(d.category)}`, date: "" }),
  },
  agencies: {
    label: "旅行社",
    model: AgencyModel,
    search: ["name", "contactName", "phone"],
    sort: { name: 1 },
    row: (d) => ({ title: s(d.name), sub: `${s(d.phone)}・領隊/司機 ${((d.people as unknown[]) ?? []).length} 位`, date: s(d.createdAt) }),
  },
  bookings: {
    label: "採果預約",
    model: BookingModel,
    search: ["plate", "county", "note"],
    sort: { datetime: -1 },
    row: (d) => ({
      title: `${s(d.datetime).replace("T", " ")} ${s(d.headcount)} 人`,
      sub: `${s(d.plate)}・${s(d.county)}・${s(d.status)}`,
      date: s(d.datetime),
    }),
  },
  groupBuys: {
    label: "團購",
    model: GroupBuyModel,
    search: ["name", "contactName", "phone"],
    sort: { startDate: -1 },
    row: (d) => ({ title: s(d.name), sub: `${s(d.contactName)}・${s(d.status)}`, date: s(d.startDate) }),
  },
  users: {
    label: "使用者帳號",
    model: UserModel,
    search: ["email", "name"],
    sort: { createdAt: 1 },
    row: (d) => ({
      title: s(d.email),
      sub: `${d.role === "admin" ? "管理者" : "一般使用者"}${d.active ? "" : "・已停用"}`,
      date: d.createdAt ? new Date(d.createdAt as string).toISOString().slice(0, 10) : "",
    }),
  },
};

function collectionOf(name: string) {
  const c = ADMIN_COLLECTIONS[name];
  if (!c) throw new HttpError(404, `沒有 ${name} 這個資料集合`);
  return c;
}

/** 各集合筆數 */
export async function collectionCounts() {
  await connectDB();
  return Promise.all(
    Object.entries(ADMIN_COLLECTIONS).map(async ([name, c]) => ({ name, label: c.label, count: await c.model.estimatedDocumentCount() })),
  );
}

export async function listRows(name: string, params: URLSearchParams) {
  await connectDB();
  const c = collectionOf(name);
  const q = params.get("q")?.trim();
  const filter = q
    ? {
        $and: q.split(/\s+/).map((term) => {
          const re = new RegExp(escapeRegex(term), "i");
          return { $or: c.search.map((f) => ({ [f]: re })) };
        }),
      }
    : {};
  const limit = 50;
  const page = Math.max(1, Number(params.get("page")) || 1);
  const [docs, total] = await Promise.all([
    c.model
      .find(filter)
      .select("-passwordHash -legacy.rawText")
      .sort(c.sort)
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    c.model.countDocuments(filter),
  ]);
  return { items: docs.map((d) => ({ id: String((d as Row)._id), ...c.row(d as Row) })), total, page, limit };
}

/** 單筆完整內容（使用者帳號不含密碼雜湊） */
export async function getRaw(name: string, id: string) {
  await connectDB();
  const c = collectionOf(name);
  const doc = await c.model.findById(id).lean();
  if (!doc) throw new HttpError(404, "找不到資料");
  return name === "users" ? publicUser(doc) : toClient(doc);
}

export async function deleteRow(name: string, id: string, cascade: boolean, by: string) {
  if (name === "users") throw new HttpError(400, "使用者帳號請到「使用者管理」刪除");
  collectionOf(name);
  if (name === "customers") return deleteCustomer(id, cascade);
  if (name === "orders") return deleteOrder(id, by);
  return deleteDoc(name as "products" | "agencies" | "bookings" | "groupBuys", id, cascade);
}
