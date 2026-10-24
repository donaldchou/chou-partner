import { CustomerModel } from "@/models/customer";
import { DeletedOrderModel } from "@/models/deleted-order";
import { OrderModel } from "@/models/order";
import { HttpError, toClient } from "./api";
import { recomputeStats } from "./customer-stats";
import { connectDB } from "./mongodb";
import { escapeRegex } from "./repo";
import { collectFileUrls, deleteFiles } from "./storage";
import type { Order } from "./types";

type Raw = Record<string, unknown>;

/** 台灣時間 YYYY-MM-DDTHH:mm（伺服器在 Vercel 是 UTC，不能用 nowStr） */
const twNow = () => new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 16);

/** 刪除訂單：整筆移到「已刪除紀錄」（檔案先留著，永久刪除時才刪），重算客戶統計 */
export async function trashOrder(id: string, by: string) {
  await connectDB();
  const doc = (await OrderModel.findById(id).lean()) as (Raw & { _id: string; customerId: string }) | null;
  if (!doc) throw new HttpError(404, "找不到訂單");
  const customer = (await CustomerModel.findById(doc.customerId).select("name").lean()) as { name?: string } | null;
  const o = doc as unknown as Order;
  await DeletedOrderModel.updateOne(
    { _id: id },
    {
      $set: {
        orderNo: o.orderNo,
        customerId: o.customerId,
        customerName: customer?.name ?? "",
        buyerName: o.buyer?.name ?? "",
        total: o.amounts?.total ?? 0,
        orderedAt: o.orderedAt,
        deletedAt: twNow(),
        deletedBy: by,
        order: doc,
      },
    },
    { upsert: true },
  );
  await OrderModel.deleteOne({ _id: id });
  await recomputeStats([doc.customerId]);
}

/** GET /api/admin/deleted-orders?q=&page= */
export async function listDeletedOrders(params: URLSearchParams) {
  await connectDB();
  const q = params.get("q")?.trim();
  const filter = q
    ? {
        $and: q.split(/\s+/).map((term) => {
          const re = new RegExp(escapeRegex(term), "i");
          return { $or: [{ orderNo: re }, { customerName: re }, { buyerName: re }, { deletedBy: re }] };
        }),
      }
    : {};
  const limit = 50;
  const page = Math.max(1, Number(params.get("page")) || 1);
  const [docs, total] = await Promise.all([
    DeletedOrderModel.find(filter).select("-order").sort({ deletedAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    DeletedOrderModel.countDocuments(filter),
  ]);
  return { items: docs.map((d) => toClient(d)), total, page, limit };
}

/** GET /api/admin/deleted-orders/<id>：摘要 + 整筆訂單 + 客戶是否還在 */
export async function getDeletedOrder(id: string) {
  await connectDB();
  const doc = (await DeletedOrderModel.findById(id).lean()) as (Raw & { customerId: string }) | null;
  if (!doc) throw new HttpError(404, "找不到這筆已刪除的訂單");
  const customerExists = !!(await CustomerModel.exists({ _id: doc.customerId }));
  return { ...toClient<Raw>(doc), order: toClient(doc.order), customerExists };
}

/** POST /api/admin/deleted-orders/<id>/restore：搬回訂單；客戶已不存在、單號已被使用時不能還原 */
export async function restoreDeletedOrder(id: string) {
  await connectDB();
  const doc = (await DeletedOrderModel.findById(id).lean()) as { order: Raw & { _id: string; orderNo: string; customerId: string; legacy?: { key?: string } } } | null;
  if (!doc) throw new HttpError(404, "找不到這筆已刪除的訂單");
  const order = doc.order;
  if (!(await CustomerModel.exists({ _id: order.customerId }))) {
    throw new HttpError(409, "這筆訂單的客戶已經被刪除，無法還原。");
  }
  if (await OrderModel.exists({ _id: order._id })) throw new HttpError(409, "訂單列表裡已經有這筆訂單。");
  if (await OrderModel.exists({ orderNo: order.orderNo })) {
    throw new HttpError(409, `訂單編號 ${order.orderNo} 已經被其他訂單使用，無法還原。`);
  }
  if (order.legacy?.key && (await OrderModel.exists({ "legacy.key": order.legacy.key }))) {
    throw new HttpError(409, "這筆訂單之後又被重新匯入了，無法還原（會重複）。");
  }
  // 原樣寫回（當初存檔時已驗證過），不經過 schema 以免改到任何欄位
  await OrderModel.collection.insertOne(order as never);
  await DeletedOrderModel.deleteOne({ _id: id });
  await recomputeStats([order.customerId]);
  return { id: order._id, orderNo: order.orderNo };
}

/** DELETE /api/admin/deleted-orders/<id>：永久刪除（連同訂單用到的檔案），無法復原 */
export async function purgeDeletedOrder(id: string) {
  await connectDB();
  const doc = (await DeletedOrderModel.findById(id).lean()) as { order: unknown } | null;
  if (!doc) throw new HttpError(404, "找不到這筆已刪除的訂單");
  await DeletedOrderModel.deleteOne({ _id: id });
  await deleteFiles(collectFileUrls(doc.order));
}
