import { Schema } from "mongoose";
import { AGENCY_LICENSES, AGENCY_STATUSES, BOOKING_STATUSES, BUYING_POWERS, COUNTIES, PERSON_ROLES } from "@/lib/enums";
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

/** 旅行社的採果方案 */
const PlanSchema = new Schema(
  {
    id: idField,
    group: str,
    name: required("方案名稱"),
    content: str,
    photos,
    cardPhoto: str, // 員工參考卡用的照片（photos 其中一張）
  },
  sub,
);

const AgencySchema = new Schema({
  _id: idField,
  name: required("旅行社名稱"),
  contactName: str,
  phone: required("電話"),
  otherPhones: { type: [{ type: String, trim: true }], default: [] },
  address: str,
  lineName: str,
  website: str,
  /** 名片照片（可多張）；cardImage 是其中選來辨識的那張 */
  cardImages: photos,
  cardImage: fileUrl,
  note: str,
  createdAt: ymd,
  status: { type: String, enum: AGENCY_STATUSES, default: "配合中", index: true },
  license: { type: String, enum: ["", ...AGENCY_LICENSES], default: "" }, // 觀光署登記種類
  regNo: str, // 觀光署註冊編號
  city: str, // 縣市（篩選用）
  fruitTour: str, // 網路上查到的採果行程（說明或網址）
  source: str, // 資料來源網址
  people: { type: [PersonSchema], default: [] },
  plans: { type: [PlanSchema], default: [] },
});
AgencySchema.index({ name: 1 });

export const AgencyModel = defineModel("Agency", AgencySchema, "agencies");

/** 配合的遊覽車公司；people 是這家公司的司機 */
const BusCompanySchema = new Schema({
  _id: idField,
  name: required("遊覽車公司名稱"),
  contactName: str,
  phone: required("電話"),
  otherPhones: { type: [{ type: String, trim: true }], default: [] },
  address: str,
  lineName: str,
  website: str,
  cardImages: photos,
  cardImage: fileUrl,
  note: str,
  createdAt: ymd,
  people: { type: [PersonSchema], default: [] },
});
BusCompanySchema.index({ name: 1 });

export const BusCompanyModel = defineModel("BusCompany", BusCompanySchema, "busCompanies");

/** 遊覽車採果預約；領隊、司機引用旅行社底下 people 的 id，方案引用 plans 的 id */
const BookingSchema = new Schema({
  _id: idField,
  agencyId: { type: String, ref: "Agency", required: [true, "請選擇旅行社"] as [true, string], index: true },
  datetime: { ...dateTime, required: [true, "請填寫預約時間"] as [true, string] },
  headcount: { type: Number, required: [true, "請填寫總人數"] as [true, string], min: [1, "總人數至少 1 人"] as [number, string] },
  leaderId: str,
  driverId: str,
  busCompanyId: { ...str, index: true },
  planId: str,
  plate: { ...str, uppercase: true },
  county: { type: String, enum: ["", ...COUNTIES], default: "" },
  buyingPower: { type: String, enum: BUYING_POWERS, default: "中" },
  buyingPowerNote: str,
  status: { type: String, enum: BOOKING_STATUSES, default: "已預約", index: true },
  revenue: { type: Number, min: 0 },
  note: str,
});
BookingSchema.index({ datetime: 1 });

export const BookingModel = defineModel("Booking", BookingSchema, "bookings");
