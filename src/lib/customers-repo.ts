import { CustomerModel } from "@/models/customer";
import { OrderModel } from "@/models/order";
import { HttpError, fromClient, toClient } from "./api";
import { assertNoInlineFiles, collectFileUrls, deleteFiles, deleteRemovedFiles } from "./storage";
import { sharedPhones, suspectFilter, suspectReasons, suspectReasonsOf } from "./customer-quality";
import { recomputeStats } from "./customer-stats";
import { connectDB } from "./mongodb";
import { escapeRegex } from "./repo";
import type { Customer, Order } from "./types";
import { nowStr, today, uid } from "./utils";

type Data = Record<string, unknown>;

/** 客戶列表裡附帶的訂單摘要（歷年訂購紀錄與規格） */
export type OrderBrief = Pick<Order, "id" | "orderNo" | "orderedAt" | "season" | "channel" | "status" | "items" | "amounts">;
const BRIEF = "orderNo orderedAt season channel status items amounts customerId";

/**
 * 關鍵字：空白分隔的每個字都要符合。
 * 比對姓名、公司、電話（可不打「-」）、地址、Email、LINE、備註、標籤，
 * 以及買過的品項／規格（例如「甜柿 台中」= 住台中、買過甜柿的客戶）
 */
async function keywordFilter(q: string): Promise<Data[]> {
  const and: Data[] = [];
  for (const term of q.split(/\s+/).filter(Boolean)) {
    const re = new RegExp(escapeRegex(term), "i");
    const or: Data[] = [
      { name: re },
      { company: re },
      { title: re },
      { "phones.number": re },
      { "addresses.address": re },
      { emails: re },
      { lineName: re },
      { note: re },
      { tags: re },
    ];
    const digits = term.replace(/\D/g, "");
    if (digits.length >= 3) or.push({ "phones.digits": new RegExp(escapeRegex(digits)) });
    if (!/^\d+$/.test(term)) {
      const ids = await OrderModel.distinct("customerId", { $or: [{ "items.product": re }, { "items.spec": re }] });
      if (ids.length) or.push({ _id: { $in: ids } });
    }
    and.push({ $or: or });
  }
  return and;
}

const SORTS: Record<string, Record<string, 1 | -1>> = {
  recent: { "stats.lastOrderAt": -1, _id: 1 },
  orders: { "stats.orderCount": -1, _id: 1 },
  spent: { "stats.totalSpent": -1, _id: 1 },
  name: { name: 1, _id: 1 },
  created: { createdAt: -1, _id: 1 },
};

/**
 * GET /api/customers?q=&source=&tag=&status=&sort=&page=&limit=&withOrders=1
 * status：空白 = 有效客戶（預設）、suspect = 疑似無效（待確認）、invalid = 已標記無效、all = 全部
 */
export async function listCustomers(params: URLSearchParams) {
  await connectDB();
  const and: Data[] = [];
  const status = params.get("status") ?? "";
  if (status === "invalid") and.push({ invalid: { $ne: null } });
  else if (status === "suspect") and.push(await suspectFilter());
  else if (status !== "all") and.push({ invalid: null });
  const q = params.get("q")?.trim();
  if (q) and.push(...(await keywordFilter(q)));
  const source = params.get("source");
  if (source) and.push({ sources: source });
  const tag = params.get("tag");
  if (tag) and.push({ tags: tag });

  const limit = Math.min(100, Math.max(1, Number(params.get("limit")) || 20));
  const page = Math.max(1, Number(params.get("page")) || 1);
  const filter = and.length ? { $and: and } : {};
  const [docs, total] = await Promise.all([
    CustomerModel.find(filter)
      .sort(SORTS[params.get("sort") ?? "recent"] ?? SORTS.recent)
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    CustomerModel.countDocuments(filter),
  ]);
  const items = docs.map((d) => toClient<Customer & { orders?: OrderBrief[] }>(d));

  if (params.get("withOrders") === "1" && items.length) {
    const orders = await OrderModel.find({ customerId: { $in: items.map((c) => c.id) } })
      .select(BRIEF)
      .sort({ orderedAt: -1 })
      .lean();
    const byCustomer = new Map<string, OrderBrief[]>();
    for (const o of orders) {
      const c = toClient<OrderBrief & { customerId: string }>(o);
      byCustomer.set(c.customerId, [...(byCustomer.get(c.customerId) ?? []), c]);
    }
    items.forEach((c) => (c.orders = byCustomer.get(c.id) ?? []));
  }
  if (status === "suspect") {
    const shared = new Set(await sharedPhones());
    items.forEach((c) => (c.suspectReasons = suspectReasons(c, shared)));
  }
  return { items, total, page, limit };
}

/** 各狀態的客戶數（客戶查詢頁的分頁標籤） */
export async function customerCounts() {
  await connectDB();
  const [valid, suspect, invalid] = await Promise.all([
    CustomerModel.countDocuments({ invalid: null }),
    CustomerModel.countDocuments(await suspectFilter()),
    CustomerModel.countDocuments({ invalid: { $ne: null } }),
  ]);
  return { valid, suspect, invalid };
}

/**
 * PATCH /api/customers/<id>/status
 * { invalid: { reason, note } } 標記無效、{ invalid: null } 取消標記、{ suspectChecked: true } 確認是正常客戶
 */
export async function setCustomerStatus(id: string, body: Data, by: string) {
  await connectDB();
  const doc = await CustomerModel.findById(id);
  if (!doc) throw new HttpError(404, "找不到客戶");
  if ("invalid" in body) {
    const inv = body.invalid as { reason?: string; note?: string } | null;
    doc.set("invalid", inv ? { reason: inv.reason, note: String(inv.note ?? "").trim(), at: nowStr(), by } : null);
  }
  if ("suspectChecked" in body) doc.set("suspectChecked", !!body.suspectChecked);
  await doc.save();
  return getCustomer(id);
}

/** GET /api/customers/<id>：客戶 + 全部訂單 */
export async function getCustomer(id: string) {
  await connectDB();
  const doc = await CustomerModel.findById(id).lean();
  if (!doc) throw new HttpError(404, "找不到客戶");
  const orders = await OrderModel.find({ customerId: id }).sort({ orderedAt: -1 }).lean();
  const c = toClient<Customer>(doc);
  return { ...c, suspectReasons: await suspectReasonsOf(c), orders: orders.map((o) => toClient<Order>(o)) };
}

/** PUT /api/customers/<id>：stats 由訂單重算，前端送來的不採用 */
export async function saveCustomer(id: string, body: Data) {
  await connectDB();
  const data = fromClient(body);
  delete data.stats;
  delete data.orders;
  // 無效標記只能從 /status 修改，編輯資料時保留原本的
  delete data.invalid;
  delete data.suspectChecked;
  delete data.suspectReasons;
  assertNoInlineFiles(data);
  const doc = await CustomerModel.findById(id);
  if (!doc) {
    const created = await CustomerModel.create({ createdAt: today(), ...data, _id: id });
    return { doc: toClient(created.toObject()), created: true };
  }
  const before = doc.toObject();
  const keep = before as { stats?: unknown; invalid?: unknown; suspectChecked?: boolean };
  doc.overwrite({ ...data, _id: id, stats: keep.stats, invalid: keep.invalid ?? null, suspectChecked: !!keep.suspectChecked });
  await doc.save();
  await deleteRemovedFiles(before, data);
  return { doc: toClient(doc.toObject()), created: false };
}

export async function createCustomer(body: Data) {
  const id = typeof body.id === "string" && body.id ? body.id : uid("c");
  await connectDB();
  if (await CustomerModel.exists({ _id: id })) throw new HttpError(409, "這個 id 已經存在");
  return (await saveCustomer(id, body)).doc;
}

/** DELETE /api/customers/<id>；有訂單時要帶 ?cascade=true 才會連訂單一起刪 */
export async function deleteCustomer(id: string, cascade: boolean) {
  await connectDB();
  const doc = await CustomerModel.findById(id).lean();
  if (!doc) throw new HttpError(404, "找不到客戶");
  const count = await OrderModel.countDocuments({ customerId: id });
  if (count && !cascade) throw new HttpError(409, `這位客戶有 ${count} 張訂單，確定要一起刪除請加上 ?cascade=true`, { orders: count });
  const orders = await OrderModel.find({ customerId: id }).lean();
  await OrderModel.deleteMany({ customerId: id });
  await CustomerModel.deleteOne({ _id: id });
  await deleteFiles([...collectFileUrls(doc), ...collectFileUrls(orders)]);
}

/** POST /api/customers/<id>/merge { from: 另一位客戶 id }：把重複的客戶併進來，訂單一起移過來 */
export async function mergeCustomers(intoId: string, fromId: string) {
  await connectDB();
  if (intoId === fromId) throw new HttpError(400, "不能和自己合併");
  const [into, from] = await Promise.all([CustomerModel.findById(intoId), CustomerModel.findById(fromId).lean()]);
  if (!into || !from) throw new HttpError(404, "找不到客戶");
  const f = from as unknown as Customer;
  const phones = into.get("phones") as Customer["phones"];
  for (const p of f.phones) if (!phones.some((x) => x.digits === p.digits)) phones.push(p);
  const emails = into.get("emails") as string[];
  for (const e of f.emails) if (!emails.includes(e)) emails.push(e);
  const addresses = into.get("addresses") as Customer["addresses"];
  for (const a of f.addresses) if (!addresses.some((x) => x.address === a.address)) addresses.push(a);
  const sources = into.get("sources") as string[];
  for (const s of f.sources) if (!sources.includes(s)) sources.push(s);
  const tags = into.get("tags") as string[];
  for (const t of f.tags) if (!tags.includes(t)) tags.push(t);
  for (const k of ["company", "title", "lineName", "cardImage", "gender"] as const) if (!into.get(k) && f[k]) into.set(k, f[k]);
  if (f.note) into.set("note", [into.get("note"), f.note].filter(Boolean).join("\n"));
  into.set({ phones, emails, addresses, sources, tags });
  await into.save();
  await OrderModel.updateMany({ customerId: fromId }, { $set: { customerId: intoId } });
  await CustomerModel.deleteOne({ _id: fromId });
  await recomputeStats([intoId]);
  return getCustomer(intoId);
}
