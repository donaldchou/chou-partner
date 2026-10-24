import { Schema } from "mongoose";
import { defineModel, str } from "./_shared";

/**
 * 已刪除的訂單（後台「已刪除紀錄」）：整筆訂單原樣放在 order 欄位，可以還原或永久刪除。
 * 外層欄位只是列表、搜尋用的摘要。
 */
const DeletedOrderSchema = new Schema({
  _id: { type: String, required: true }, // 和原本的訂單 id 相同，還原時沿用
  orderNo: str,
  customerId: str,
  customerName: str,
  buyerName: str,
  total: { type: Number, default: 0 },
  orderedAt: str,
  deletedAt: str,
  deletedBy: str,
  order: { type: Schema.Types.Mixed, required: true },
});

DeletedOrderSchema.index({ deletedAt: -1 });

export const DeletedOrderModel = defineModel("DeletedOrder", DeletedOrderSchema, "deletedOrders");
