import { Schema } from "mongoose";
import { CUSTOMER_SOURCES, GENDERS, PHONE_TYPES } from "@/lib/enums";
import { dateTime, defineModel, digitsOf, fileUrl, idField, required, str, sub, ymd } from "./_shared";

const PhoneSchema = new Schema(
  {
    number: { ...str, required: true },
    digits: { type: String, default: "" },
    type: { type: String, enum: PHONE_TYPES, default: "手機" },
  },
  sub,
);

const AddressSchema = new Schema({ zip: str, address: { ...str, required: true }, lastUsedAt: dateTime }, sub);

const StatsSchema = new Schema(
  {
    orderCount: { type: Number, default: 0 },
    totalSpent: { type: Number, default: 0 },
    firstOrderAt: dateTime,
    lastOrderAt: dateTime,
    lastProduct: str,
  },
  sub,
);

/** 客戶：一人一筆，以電話去重；訂單另外存在 orders 集合 */
const CustomerSchema = new Schema({
  _id: idField,
  name: required("客戶姓名"),
  company: str,
  title: str,
  gender: { type: String, enum: GENDERS, default: "" },
  phones: { type: [PhoneSchema], default: [] },
  emails: { type: [String], default: [] },
  lineName: str,
  addresses: { type: [AddressSchema], default: [] },
  sources: { type: [{ type: String, enum: CUSTOMER_SOURCES }], default: [] },
  tags: { type: [String], default: [] },
  /** 由 orders 重算，不要直接修改 */
  stats: { type: StatsSchema, default: () => ({}) },
  cardImage: fileUrl,
  note: str,
  createdAt: ymd,
});

CustomerSchema.index({ "phones.digits": 1 });
CustomerSchema.index({ name: 1 });
CustomerSchema.index({ company: 1 });
CustomerSchema.index({ "stats.lastOrderAt": -1 });

CustomerSchema.pre("validate", function () {
  const phones = (this.get("phones") ?? []) as { number: string; digits: string }[];
  for (const p of phones) p.digits = digitsOf(p.number);
});

export const CustomerModel = defineModel("Customer", CustomerSchema, "customers");
