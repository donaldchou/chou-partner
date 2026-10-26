import { CustomerModel } from "@/models/customer";
import { CustomerTagModel } from "@/models/customer-tag";
import { GroupBuyerModel, GroupBuyModel } from "@/models/group-buy";
import { AgencyModel, BookingModel, BusCompanyModel } from "@/models/tour";
import { HttpError, fromClient, toClient } from "./api";
import { COLLECTIONS, DATE_FIELD, FILTERS, SEARCH_FIELDS, SORT, type CollectionName } from "./collections";
import { assertNoInlineFiles, collectFileUrls, deleteFiles, deleteRemovedFiles } from "./storage";
import { connectDB } from "./mongodb";
import type { AgencyPlan, AppState, Booking, Person } from "./types";
import { uid } from "./utils";

type Data = Record<string, unknown>;

/** 不回傳給前端的內部欄位 */
const HIDDEN = "";

export const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** GET /api/db：前端啟動時一次載入全部資料 */
export async function loadAll(): Promise<AppState> {
  await connectDB();
  const entries = await Promise.all(
    (Object.keys(COLLECTIONS) as CollectionName[]).map(async (name) => {
      const docs = await COLLECTIONS[name].find().select(HIDDEN).sort(SORT[name]).lean();
      return [name, docs.map((d) => toClient(d))] as const;
    }),
  );
  return Object.fromEntries(entries) as unknown as AppState;
}

/** GET /api/<collection>?q=關鍵字&from=&to=&欄位=值 */
export async function listDocs(name: CollectionName, params: URLSearchParams) {
  await connectDB();
  const and: Data[] = [];

  for (const f of FILTERS[name] ?? []) {
    const v = params.get(f);
    if (v) and.push({ [f]: v });
  }

  // 關鍵字：空白分隔的每個字都要在任一欄位出現；電話可以不打「-」
  const q = params.get("q")?.trim();
  const fields = SEARCH_FIELDS[name];
  if (q && fields) {
    for (const term of q.split(/\s+/)) {
      const re = new RegExp(escapeRegex(term), "i");
      and.push({ $or: fields.map((f) => ({ [f]: re })) });
    }
  }

  const dateField = DATE_FIELD[name];
  const from = params.get("from");
  const to = params.get("to");
  if (dateField && (from || to)) {
    and.push({ [dateField]: { ...(from && { $gte: from }), ...(to && { $lte: to + "￿" }) } });
  }

  const docs = await COLLECTIONS[name]
    .find(and.length ? { $and: and } : {})
    .select(HIDDEN)
    .sort(SORT[name])
    .lean();
  return docs.map((d) => toClient(d));
}

export async function getDoc(name: CollectionName, id: string) {
  await connectDB();
  const doc = await COLLECTIONS[name].findById(id).select(HIDDEN).lean();
  if (!doc) throw new HttpError(404, "找不到資料");
  return toClient(doc);
}

/* ---------------- 各集合的寫入規則 ---------------- */

/**
 * 預約：旅行社要存在，領隊要是這家旅行社登錄的人，方案要是這家旅行社的方案；
 * 遊覽車公司（選填）要存在，司機要是旅行社或這家遊覽車公司登錄的司機
 */
async function checkBooking(data: Data) {
  const agency = (await AgencyModel.findById(data.agencyId).lean()) as { people?: Person[]; plans?: AgencyPlan[] } | null;
  if (!agency) throw new HttpError(400, `找不到旅行社（${String(data.agencyId)}）`);
  const people = agency.people ?? [];
  if (data.leaderId && !people.some((p) => p.id === data.leaderId && p.role === "領隊")) {
    throw new HttpError(400, `這家旅行社沒有這位領隊（${String(data.leaderId)}）`);
  }
  let busDrivers: Person[] = [];
  if (data.busCompanyId) {
    const bus = (await BusCompanyModel.findById(data.busCompanyId).lean()) as { people?: Person[] } | null;
    if (!bus) throw new HttpError(400, `找不到遊覽車公司（${String(data.busCompanyId)}）`);
    busDrivers = bus.people ?? [];
  }
  const drivers = [...people.filter((p) => p.role === "司機"), ...busDrivers];
  if (data.driverId && !drivers.some((p) => p.id === data.driverId)) {
    throw new HttpError(400, `旅行社與遊覽車公司都沒有這位司機（${String(data.driverId)}）`);
  }
  if (data.planId && !(agency.plans ?? []).some((p) => p.id === data.planId)) {
    throw new HttpError(400, `這家旅行社沒有這個採果方案（${String(data.planId)}）`);
  }
}

/** 旅行社或遊覽車公司更新、刪除後：預約上的司機已經不在旅行社也不在遊覽車公司名單裡，就清掉 */
async function clearStaleDrivers(filter: Record<string, unknown>) {
  type Row = Pick<Booking, "agencyId" | "busCompanyId" | "driverId"> & { _id: string };
  const bookings = (await BookingModel.find({ ...filter, driverId: { $ne: "" } }).select("agencyId busCompanyId driverId").lean()) as unknown as Row[];
  const people = async (Model: typeof AgencyModel, id?: string) =>
    id ? (((await Model.findById(id).select("people").lean()) as { people?: Person[] } | null)?.people ?? []) : [];
  for (const b of bookings) {
    const ok = [...(await people(AgencyModel, b.agencyId)).filter((p) => p.role === "司機"), ...(await people(BusCompanyModel, b.busCompanyId))];
    if (!ok.some((p) => p.id === b.driverId)) await BookingModel.updateOne({ _id: b._id }, { $set: { driverId: "" } });
  }
}

/** 旅行社更新後：已移除的領隊／司機／方案，從預約裡清掉 */
async function syncBookingRefs(agencyId: string, data: Data) {
  const people = (data.people as Person[] | undefined) ?? [];
  const plans = (data.plans as AgencyPlan[] | undefined) ?? [];
  const ids = (role: string) => people.filter((p) => p.role === role).map((p) => p.id);
  await BookingModel.updateMany({ agencyId, leaderId: { $nin: ["", ...ids("領隊")] } }, { $set: { leaderId: "" } });
  await clearStaleDrivers({ agencyId });
  await BookingModel.updateMany({ agencyId, planId: { $nin: ["", ...plans.map((p) => p.id)] } }, { $set: { planId: "" } });
}

/** 標籤選項：名稱不可重複；「回購客」由系統依訂單自動標記，不能手動管理 */
async function checkCustomerTag(id: string, data: Data) {
  const tagName = String(data.name ?? "").trim();
  if (tagName === "回購客") throw new HttpError(400, "「回購客」會依訂單自動標記，不需要新增");
  if (await CustomerTagModel.exists({ _id: { $ne: id }, name: tagName })) throw new HttpError(409, `已經有「${tagName}」這個標籤`);
  data.name = tagName;
}

/** 標籤改名：已經貼了舊名稱的客戶一起改成新名稱 */
async function renameCustomerTag(before: Data | null, data: Data) {
  const from = String(before?.name ?? "");
  const to = String(data.name ?? "");
  if (!from || from === to) return;
  await CustomerModel.updateMany({ tags: from }, { $addToSet: { tags: to } });
  await CustomerModel.updateMany({ tags: from }, { $pull: { tags: from } });
}

async function beforeWrite(name: CollectionName, id: string, data: Data) {
  assertNoInlineFiles(data);
  if (name === "bookings") await checkBooking(data);
  if (name === "groupBuys" && data.buyerId && !(await GroupBuyerModel.exists({ _id: data.buyerId }))) {
    throw new HttpError(400, `找不到團購業者（${String(data.buyerId)}）`);
  }
  if (name === "customerTags") await checkCustomerTag(id, data);
}

async function afterWrite(name: CollectionName, id: string, data: Data, before: Data | null = null) {
  if (name === "agencies") await syncBookingRefs(id, data);
  if (name === "busCompanies") await clearStaleDrivers({ busCompanyId: id });
  if (name === "customerTags") await renameCustomerTag(before, data);
}

/** POST /api/<collection>：新增（沒帶 id 時自動產生） */
export async function createDoc(name: CollectionName, body: Data) {
  await connectDB();
  const Model = COLLECTIONS[name];
  const id = typeof body.id === "string" && body.id ? body.id : uid(name.slice(0, 1));
  if (await Model.exists({ _id: id })) throw new HttpError(409, "這個 id 已經存在");
  const data = fromClient(body);
  await beforeWrite(name, id, data);
  const doc = await Model.create({ ...data, _id: id });
  return toClient(doc.toObject());
}

/** PUT /api/<collection>/<id>：存在就整筆覆寫，不存在就建立（前端的新增與編輯共用） */
export async function saveDoc(name: CollectionName, id: string, body: Data) {
  await connectDB();
  const Model = COLLECTIONS[name];
  const data = fromClient(body);
  await beforeWrite(name, id, data);

  const doc = await Model.findById(id);
  if (!doc) {
    const created = await Model.create({ ...data, _id: id });
    await afterWrite(name, id, data);
    return { doc: toClient(created.toObject()), created: true };
  }

  const before = doc.toObject() as Data;
  doc.overwrite({ ...data, _id: id });
  await doc.save();
  await afterWrite(name, id, data, before);
  await deleteRemovedFiles(before, data);
  return { doc: toClient(doc.toObject()), created: false };
}

/** DELETE /api/<collection>/<id>；旅行社有預約時要帶 ?cascade=true 才會連預約一起刪 */
export async function deleteDoc(name: CollectionName, id: string, cascade: boolean) {
  await connectDB();
  const Model = COLLECTIONS[name];
  const doc = await Model.findById(id).lean();
  if (!doc) throw new HttpError(404, "找不到資料");

  if (name === "agencies") {
    const count = await BookingModel.countDocuments({ agencyId: id });
    if (count && !cascade) {
      throw new HttpError(409, `這家旅行社還有 ${count} 筆預約，確定要一起刪除請加上 ?cascade=true`, { bookings: count });
    }
    await BookingModel.deleteMany({ agencyId: id });
  }

  await Model.deleteOne({ _id: id });

  // 團購業者刪掉不影響團購：只清掉團購上的業者
  if (name === "groupBuyers") await GroupBuyModel.updateMany({ buyerId: id }, { $set: { buyerId: "" } });

  // 遊覽車公司刪掉不影響預約：只清掉預約上的公司，以及只屬於這家公司的司機
  if (name === "busCompanies") {
    const affected = await BookingModel.find({ busCompanyId: id }).select("_id").lean();
    await BookingModel.updateMany({ busCompanyId: id }, { $set: { busCompanyId: "" } });
    await clearStaleDrivers({ _id: { $in: affected.map((b) => (b as { _id: unknown })._id) } });
  }
  await deleteFiles(collectFileUrls(doc));
}
