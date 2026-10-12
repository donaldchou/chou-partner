import { Schema } from "mongoose";
import { CUSTOMER_SOURCES, GENDERS, INVALID_REASONS, PHONE_TYPES } from "@/lib/enums";
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

/** 無效客戶的標記：原因、說明、誰在什麼時候標記的 */
const InvalidSchema = new Schema(
  {
    reason: { type: String, enum: INVALID_REASONS, required: true },
    note: str,
    at: dateTime,
    by: str,
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
  /** 標記為無效：客戶查詢預設不顯示、儀表板不計入；null = 有效客戶 */
  invalid: { type: InvalidSchema, default: null },
  /** 疑似無效清單裡已確認「這位是正常客戶」，不再列入 */
  suspectChecked: { type: Boolean, default: false },
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
