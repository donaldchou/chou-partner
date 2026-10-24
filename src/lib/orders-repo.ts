import { CustomerModel } from "@/models/customer";
import { OrderModel } from "@/models/order";
import { HttpError, fromClient, toClient } from "./api";
import { assertNoInlineFiles, collectFileUrls, deleteFiles, deleteRemovedFiles } from "./storage";
import { suspectFilter } from "./customer-quality";
import { recomputeStats } from "./customer-stats";
import { connectDB } from "./mongodb";
import { digitsOf, toPhone } from "./legacy/normalize";
import { escapeRegex } from "./repo";
import type { Customer, Order, OrderChannel, Phone } from "./types";
import { uid } from "./utils";

type Data = Record<string, unknown>;

/** 列表不需要原文與付款回報，減少傳輸量 */
const LIST_FIELDS = "-legacy.rawText -payment.reports";

/** GET /api/orders?q=&season=&channel=&status=&brand=&payStatus=&review=1&customerId=&page=&limit= */
export async function listOrders(params: URLSearchParams) {
  await connectDB();
  const and: Data[] = [];
  for (const [param, field] of [
    ["channel", "channel"],
    ["status", "status"],
    ["brand", "brand"],
    ["payStatus", "payment.status"],
    ["customerId", "customerId"],
  ] as const) {
    const v = params.get(param);
    if (v) and.push({ [field]: v });
  }
  const season = Number(params.get("season"));
  if (season) and.push({ season });
  if (params.get("review") === "1") and.push({ "legacy.needsReview": true });

  const q = params.get("q")?.trim();
  if (q) {
    for (const term of q.split(/\s+/)) {
      const re = new RegExp(escapeRegex(term), "i");
      const digits = term.replace(/\D/g, "");
      and.push({
        $or: [
          { orderNo: re },
          { "buyer.name": re },
          { "buyer.phone": re },
          { "shipments.recipient.name": re },
          { "shipments.recipient.address": re },
          { "shipments.recipient.phone": re },
          { "shipments.packages.trackingNo": re },
          { "items.product": re },
          { "items.spec": re },
          { referrer: re },
          { note: re },
          ...(digits.length >= 4 ? [{ "buyer.phone": new RegExp(digits.split("").join("\\D?")) }] : []),
        ],
      });
    }
  }

  const limit = Math.min(200, Math.max(1, Number(params.get("limit")) || 30));
  const page = Math.max(1, Number(params.get("page")) || 1);
  const filter = and.length ? { $and: and } : {};
  const sort: Record<string, 1 | -1> = params.get("sort") === "old" ? { orderedAt: 1, _id: 1 } : { orderedAt: -1, _id: 1 };
  const [docs, total, sum] = await Promise.all([
    OrderModel.find(filter)
      .select(LIST_FIELDS)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    OrderModel.countDocuments(filter),
    OrderModel.aggregate([{ $match: filter }, { $group: { _id: null, total: { $sum: "$amounts.total" } } }]),
  ]);
  return { items: docs.map((d) => toClient<Order>(d)), total, page, limit, amount: (sum[0]?.total as number) ?? 0 };
}

/** GET /api/orders/<id>：訂單 + 客戶基本資料 */
export async function getOrder(id: string) {
  await connectDB();
  const doc = await OrderModel.findById(id).lean();
  if (!doc) throw new HttpError(404, "找不到訂單");
  const order = toClient<Order>(doc);
  const customer = await CustomerModel.findById(order.customerId).select("name company phones addresses lineName stats").lean();
  return { ...order, customer: customer ? toClient<Customer>(customer) : null };
}

const PREFIX: Record<OrderChannel, string> = { 網站: "W", 電話: "T", LINE: "T", 現場: "T", 團購: "G", 旅行社: "R" };

/** 新訂單編號：T-2026-0042（通路代碼-產季-流水號） */
async function nextOrderNo(channel: OrderChannel, season: number) {
  const prefix = `${PREFIX[channel] ?? "T"}-${season}-`;
  const last = (await OrderModel.find({ orderNo: new RegExp(`^${prefix}\\d{4}$`) })
    .select("orderNo")
    .sort({ orderNo: -1 })
    .limit(1)
    .lean()) as unknown as { orderNo: string }[];
  let n = last[0] ? Number(last[0].orderNo.slice(prefix.length)) + 1 : 1;
  while (await OrderModel.exists({ orderNo: `${prefix}${String(n).padStart(4, "0")}` })) n++;
  return `${prefix}${String(n).padStart(4, "0")}`;
}

/** 訂購人的有效電話若客戶資料裡還沒有，就補進去（收件人可能是送禮對象，不補） */
async function syncBuyerPhones(customerId: string, buyer: unknown) {
  const b = (buyer ?? {}) as Partial<Order["buyer"]>;
  // digits 跟客戶表單一樣含分機，比對才不會把同一支電話重複加入
  const phones = [toPhone(b.phone), toPhone(b.phone2)]
    .filter((p): p is Phone => !!p)
    .map((p) => ({ ...p, digits: digitsOf(p.number) }));
  const c = (await CustomerModel.findById(customerId).select("phones").lean()) as unknown as Pick<Customer, "phones"> | null;
  if (!c) return;
  const has = new Set(c.phones.map((x) => digitsOf(x.number)));
  const add = phones.filter((p, i) => !has.has(p.digits) && phones.findIndex((x) => x.digits === p.digits) === i);
  if (add.length) await CustomerModel.updateOne({ _id: customerId }, { $push: { phones: { $each: add } } });
}

/** PUT /api/orders/<id>：整筆儲存（不存在時建立）；之後重算相關客戶的統計 */
export async function saveOrder(id: string, body: Data) {
  await connectDB();
  const data = fromClient(body);
  delete data.customer;
  assertNoInlineFiles(data);
  if (!data.customerId || !(await CustomerModel.exists({ _id: data.customerId }))) throw new HttpError(400, "請選擇客戶");

  const doc = await OrderModel.findById(id);
  if (!doc) {
    if (!data.orderNo) data.orderNo = await nextOrderNo(data.channel as OrderChannel, Number(data.season));
    const created = await OrderModel.create({ ...data, _id: id });
    await syncBuyerPhones(String(data.customerId), data.buyer);
    await recomputeStats([String(data.customerId)]);
    return { doc: toClient(created.toObject()), created: true };
  }
  const before = doc.toObject() as unknown as Order & { _id: string };
  // 匯入原文不能從前端改掉
  if (before.legacy)
    data.legacy = {
      ...before.legacy,
      ...(data.legacy as Data),
      rawText: before.legacy.rawText,
      key: before.legacy.key,
      source: before.legacy.source,
    };
  doc.overwrite({ ...data, _id: id });
  await doc.save();
  await syncBuyerPhones(String(data.customerId), data.buyer);
  await recomputeStats([before.customerId, String(data.customerId)]);
  await deleteRemovedFiles(before, data);
  return { doc: toClient(doc.toObject()), created: false };
}

export async function createOrder(body: Data) {
  return (await saveOrder(typeof body.id === "string" && body.id ? body.id : uid("o"), body)).doc;
}

export async function deleteOrder(id: string) {
  await connectDB();
  const doc = (await OrderModel.findById(id).lean()) as unknown as (Order & { _id: string }) | null;
  if (!doc) throw new HttpError(404, "找不到訂單");
  await OrderModel.deleteOne({ _id: id });
  await recomputeStats([doc.customerId]);
  await deleteFiles(collectFileUrls(doc));
}

/** GET /api/stats：儀表板統計 */
export async function dashboardStats() {
  await connectDB();
  const seasons = ((await OrderModel.distinct("season")) as number[]).sort((a, b) => b - a);
  const season = seasons[0] ?? new Date().getFullYear();
  // 客戶數不含標記為無效的客戶
  const [customers, repeat, suspect, review, pending, unpaid, bySeason, byChannel] = await Promise.all([
    CustomerModel.countDocuments({ invalid: null }),
    CustomerModel.countDocuments({ tags: "回購客", invalid: null }),
    CustomerModel.countDocuments(await suspectFilter()),
    OrderModel.countDocuments({ "legacy.needsReview": true }),
    OrderModel.countDocuments({ status: { $in: ["新訂單", "處理中"] } }),
    OrderModel.countDocuments({ "payment.status": "待匯款", status: { $ne: "已取消" } }),
    OrderModel.aggregate([
      { $match: { status: { $ne: "已取消" } } },
      { $group: { _id: "$season", orders: { $sum: 1 }, amount: { $sum: "$amounts.total" } } },
      { $sort: { _id: 1 } },
    ]),
    OrderModel.aggregate([
      { $match: { season, status: { $ne: "已取消" } } },
      { $group: { _id: "$channel", orders: { $sum: 1 }, amount: { $sum: "$amounts.total" } } },
      { $sort: { orders: -1 } },
    ]),
  ]);
  return {
    season,
    seasons,
    customers,
    repeatCustomers: repeat,
    suspectCustomers: suspect,
    needsReview: review,
    pendingOrders: pending,
    unpaidOrders: unpaid,
    bySeason: bySeason.map((r) => ({ season: r._id as number, orders: r.orders as number, amount: r.amount as number })),
    byChannel: byChannel.map((r) => ({ channel: r._id as string, orders: r.orders as number, amount: r.amount as number })),
  };
}
