import { Schema } from "mongoose";
import {
  BRANDS,
  DELIVERY_SLOTS,
  LEGACY_SOURCES,
  ORDER_CHANNELS,
  ORDER_STATUSES,
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
  SHIPMENT_STATUSES,
} from "@/lib/enums";
import { dateTime, defineModel, idField, money, required, str, sub, ymd } from "./_shared";

const ItemSchema = new Schema(
  { sku: str, product: required("品項"), spec: str, qty: { type: Number, default: 1, min: 0 }, unitPrice: money, subtotal: money },
  sub,
);

const ExtraSchema = new Schema({ name: required("加購品項"), desc: str, amount: { type: Number, default: 0 } }, sub);

const PackageSchema = new Schema(
  { trackingNo: str, boxes: { type: Number, default: 0 }, collectAmount: { type: Number, default: 0 }, labelUrl: str, printedAt: dateTime },
  sub,
);

const ShipmentSchema = new Schema(
  {
    id: idField,
    recipient: {
      type: new Schema({ name: str, phone: str, phone2: str, zip: str, address: str }, sub),
      default: () => ({}),
    },
    items: { type: [new Schema({ sku: str, product: str, spec: str, qty: { type: Number, default: 0 } }, sub)], default: [] },
    deliverySlot: { type: String, enum: DELIVERY_SLOTS, default: "" },
    requestedShipDate: ymd,
    shippedAt: dateTime,
    carrier: str,
    packages: { type: [PackageSchema], default: [] },
    status: { type: String, enum: SHIPMENT_STATUSES, default: "待出貨" },
  },
  sub,
);

const PaymentSchema = new Schema(
  {
    method: { type: String, enum: PAYMENT_METHODS, default: "" },
    status: { type: String, enum: PAYMENT_STATUSES, default: "未付款" },
    codFee: money,
    paidAmount: { type: Number, default: 0 },
    paidAt: dateTime,
    reports: { type: [new Schema({ text: str, photoUrl: str, reportedAt: dateTime }, sub)], default: [] },
  },
  sub,
);

const AmountsSchema = new Schema(
  {
    items: { type: Number, default: 0 },
    extras: { type: Number, default: 0 },
    codFee: { type: Number, default: 0 },
    shipping: { type: Number, default: 0 },
    adjust: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
  },
  sub,
);

const LegacySchema = new Schema(
  {
    source: { type: String, enum: LEGACY_SOURCES, required: true },
    file: str,
    key: { type: String, required: true },
    rawText: str,
    parsedBy: { type: String, enum: ["rule", "ai"], default: "rule" },
    needsReview: { type: Boolean, default: false },
    reviewReasons: { type: [String], default: [] },
    importedAt: dateTime,
  },
  sub,
);

/** 訂單：網站、電話、LINE、現場…所有通路統一 */
const OrderSchema = new Schema({
  _id: idField,
  orderNo: { ...required("訂單編號") },
  channel: { type: String, enum: ORDER_CHANNELS, required: true },
  brand: { type: String, enum: BRANDS, default: "" },
  season: { type: Number, required: true },
  customerId: { type: String, ref: "Customer", required: [true, "請選擇客戶"] as [true, string] },
  buyer: {
    type: new Schema({ name: str, phone: str, phone2: str, email: str, gender: str }, sub),
    default: () => ({}),
  },
  referrer: str,
  orderedAt: { ...dateTime, required: [true, "請填寫下單時間"] as [true, string] },
  items: { type: [ItemSchema], default: [] },
  extras: { type: [ExtraSchema], default: [] },
  shipments: { type: [ShipmentSchema], default: [] },
  payment: { type: PaymentSchema, default: () => ({}) },
  amounts: { type: AmountsSchema, default: () => ({}) },
  status: { type: String, enum: ORDER_STATUSES, default: "新訂單" },
  processedAt: dateTime,
  note: str,
  internalNote: str,
  legacy: { type: LegacySchema, default: undefined },
});

OrderSchema.index({ orderNo: 1 }, { unique: true });
OrderSchema.index({ customerId: 1, orderedAt: -1 });
OrderSchema.index({ season: -1, channel: 1 });
OrderSchema.index({ orderedAt: -1 });
OrderSchema.index({ status: 1 });
OrderSchema.index({ "shipments.packages.trackingNo": 1 });
OrderSchema.index({ "legacy.key": 1 }, { unique: true, sparse: true });
OrderSchema.index({ "legacy.needsReview": 1 });

/** 小計與總金額一律由後端重算 */
OrderSchema.pre("validate", function () {
  const items = (this.get("items") ?? []) as { qty: number; unitPrice: number; subtotal: number }[];
  for (const i of items) i.subtotal = Math.round((i.qty || 0) * (i.unitPrice || 0));
  const extras = (this.get("extras") ?? []) as { amount: number }[];
  const a = this.get("amounts") as Record<string, number>;
  const codFee = Number(this.get("payment.codFee") || 0);
  a.items = items.reduce((s, i) => s + i.subtotal, 0);
  a.extras = extras.reduce((s, e) => s + (e.amount || 0), 0);
  a.codFee = codFee;
  a.total = a.items + a.extras + codFee + (a.shipping || 0) + (a.adjust || 0);
});

export const OrderModel = defineModel("Order", OrderSchema, "orders");
