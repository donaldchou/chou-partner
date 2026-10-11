import { Schema } from "mongoose";
import { BOOKING_STATUSES, BUYING_POWERS, COUNTIES, PERSON_ROLES } from "@/lib/enums";
import { dateTime, defineModel, fileUrl, idField, photos, required, str, sub, ymd } from "./_shared";

/** 旅行社的領隊／司機 */
const PersonSchema = new Schema(
  {
    id: idField,
    role: { type: String, enum: PERSON_ROLES, required: true },
    name: required("姓名"),
    phone: required("電話"),
    lineName: str,
    photos,
  },
  sub,
);

const AgencySchema = new Schema({
  _id: idField,
  name: required("旅行社名稱"),
  contactName: str,
  phone: required("電話"),
  address: str,
  lineName: str,
  cardImage: fileUrl,
  note: str,
  createdAt: ymd,
  people: { type: [PersonSchema], default: [] },
});
AgencySchema.index({ name: 1 });

export const AgencyModel = defineModel("Agency", AgencySchema, "agencies");

/** 遊覽車採果預約；領隊、司機引用旅行社底下 people 的 id */
const BookingSchema = new Schema({
  _id: idField,
  agencyId: { type: String, ref: "Agency", required: [true, "請選擇旅行社"] as [true, string], index: true },
  datetime: { ...dateTime, required: [true, "請填寫預約時間"] as [true, string] },
  headcount: { type: Number, required: [true, "請填寫總人數"] as [true, string], min: [1, "總人數至少 1 人"] as [number, string] },
  leaderId: str,
  driverId: str,
  plate: { ...required("車牌號碼"), uppercase: true },
  county: { type: String, enum: COUNTIES, required: [true, "請選擇客戶居住縣市"] as [true, string] },
  buyingPower: { type: String, enum: BUYING_POWERS, default: "中" },
  buyingPowerNote: str,
  status: { type: String, enum: BOOKING_STATUSES, default: "已預約", index: true },
  revenue: { type: Number, min: 0 },
  note: str,
});
BookingSchema.index({ datetime: 1 });

export const BookingModel = defineModel("Booking", BookingSchema, "bookings");
