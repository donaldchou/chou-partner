import { Schema } from "mongoose";
import { AGENCY_STATUSES, BACKUP_KINDS, GROUP_BUY_STATUSES, GROUP_BUYER_KINDS, SHIPPING_MODES } from "@/lib/enums";
import { dateTime, defineModel, fileUrl, idField, money, photos, required, str, sub, ymd } from "./_shared";

const ItemSchema = new Schema({ id: idField, product: str, spec: str, price: money, qty: { type: Number, default: 0, min: 0 } }, sub);

const CoopNoteSchema = new Schema({ id: idField, date: ymd, content: required("合作內容") }, sub);

/** 寄送資訊（業者沒提供宅配單時，由平台產生宅配單） */
const RecipientSchema = new Schema(
  {
    id: idField,
    name: required("收件人"),
    phone: required("收件人電話"),
    address: required("收件地址"),
    content: str,
    qty: { type: Number, default: 1, min: 1 },
    note: str,
  },
  sub,
);

/** 宅配單備份：業者提供的檔案（fileUrl，Vercel Blob）或系統產生當下的收件人快照（rows） */
const BackupSchema = new Schema(
  {
    id: idField,
    kind: { type: String, enum: BACKUP_KINDS, required: true },
    fileName: required("檔名"),
    createdAt: dateTime,
    count: { type: Number, min: 0 },
    rows: { type: [RecipientSchema], default: undefined },
    fileUrl: str,
  },
  sub,
);

const GroupBuySchema = new Schema({
  _id: idField,
  buyerId: { ...str, index: true }, // 開這團的團購業者（選填）
  name: required("團購名稱"),
  contactName: required("聯絡者姓名"),
  phone: required("電話"),
  address: str,
  lineName: str,
  cardImage: fileUrl,
  startDate: { ...ymd, required: [true, "請填寫開團日期"] as [true, string] },
  endDate: { ...ymd, required: [true, "請填寫結團日期"] as [true, string] },
  status: { type: String, enum: GROUP_BUY_STATUSES, default: "洽談中", index: true },
  items: { type: [ItemSchema], default: [] },
  coopNotes: { type: [CoopNoteSchema], default: [] },
  shippingMode: { type: String, enum: SHIPPING_MODES, default: "provided" },
  recipients: { type: [RecipientSchema], default: [] },
  backups: { type: [BackupSchema], default: [] },
  createdAt: ymd,
});
GroupBuySchema.index({ startDate: -1 });

GroupBuySchema.pre("validate", function () {
  const start = this.get("startDate") as string;
  const end = this.get("endDate") as string;
  if (start && end && end < start) this.invalidate("endDate", "結團日期不可早於開團日期");
});

export const GroupBuyModel = defineModel("GroupBuy", GroupBuySchema, "groupBuys");

/** 團購業者：像旅行社一樣分配合中／待聯絡；社群團購主常常沒有公開電話，所以電話選填 */
const GroupBuyerSchema = new Schema({
  _id: idField,
  name: required("團購業者名稱"),
  contactName: str,
  phone: str,
  otherPhones: { type: [{ type: String, trim: true }], default: [] },
  address: str,
  lineName: str,
  website: str,
  links: { type: [{ type: String, trim: true }], default: [] },
  cardImages: photos,
  cardImage: fileUrl,
  note: str,
  createdAt: ymd,
  status: { type: String, enum: AGENCY_STATUSES, default: "配合中", index: true },
  kind: { type: String, enum: ["", ...GROUP_BUYER_KINDS], default: "" },
  city: str,
  fruitDeal: str, // 網路上查到有賣水果／生鮮團購的證據
  source: str, // 資料來源網址
});
GroupBuyerSchema.index({ name: 1 });

export const GroupBuyerModel = defineModel("GroupBuyer", GroupBuyerSchema, "groupBuyers");
