import { Schema } from "mongoose";
import { CUSTOMER_SOURCES } from "@/lib/enums";
import { defineModel, digitsOf, fileUrl, idField, money, required, str, sub, ymd } from "./_shared";

const OrderItemSchema = new Schema(
  {
    product: required("產品"),
    spec: str,
    qty: { type: Number, default: 1, min: 0 },
    unitPrice: money,
  },
  sub,
);

const OrderSchema = new Schema(
  {
    id: idField,
    date: { ...ymd, required: [true, "請填寫訂購日期"] as [true, string] },
    items: {
      type: [OrderItemSchema],
      validate: [(v: unknown[]) => v.length > 0, "訂購紀錄至少要有一項產品"],
    },
    note: str,
  },
  sub,
);

/** 客戶：名片建檔、手動建檔或從 Word / MDB 匯入；訂購紀錄內嵌在客戶底下 */
const CustomerSchema = new Schema({
  _id: idField,
  company: str,
  name: required("客戶姓名"),
  title: str,
  phone: required("電話"),
  /** 只留數字的電話，用來比對重複客戶與搜尋 */
  phoneDigits: { type: String, index: true },
  email: { ...str, lowercase: true },
  address: str,
  lineName: str,
  note: str,
  cardImage: fileUrl,
  source: { type: String, enum: CUSTOMER_SOURCES, default: "手動" },
  createdAt: ymd,
  orders: { type: [OrderSchema], default: [] },
});

CustomerSchema.index({ name: 1 });
CustomerSchema.index({ company: 1 });
CustomerSchema.index({ "orders.date": -1 });

CustomerSchema.pre("validate", function () {
  this.set("phoneDigits", digitsOf(this.get("phone")));
});

export const CustomerModel = defineModel("Customer", CustomerSchema, "customers");
