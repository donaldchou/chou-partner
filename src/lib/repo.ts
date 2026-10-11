import { AgencyModel, BookingModel } from "@/models/tour";
import { HttpError, fromClient, toClient } from "./api";
import { COLLECTIONS, DATE_FIELD, FILTERS, SEARCH_FIELDS, SORT, type CollectionName } from "./collections";
import { assertNoInlineFiles, collectBlobUrls, deleteBlobs, deleteRemovedBlobs } from "./blob";
import { connectDB } from "./mongodb";
import type { AppState, Person } from "./types";
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

/** 預約：旅行社要存在，領隊／司機要是這家旅行社登錄的人 */
async function checkBooking(data: Data) {
  const agency = (await AgencyModel.findById(data.agencyId).lean()) as { people?: Person[] } | null;
  if (!agency) throw new HttpError(400, `找不到旅行社（${String(data.agencyId)}）`);
  const people = agency.people ?? [];
  for (const [field, role] of [
    ["leaderId", "領隊"],
    ["driverId", "司機"],
  ] as const) {
    const pid = data[field];
    if (pid && !people.some((p) => p.id === pid && p.role === role)) {
      throw new HttpError(400, `這家旅行社沒有這位${role}（${String(pid)}）`);
    }
  }
}

/** 旅行社更新後：已移除的領隊／司機，從預約裡清掉 */
async function syncBookingPeople(agencyId: string, data: Data) {
  const people = (data.people as Person[] | undefined) ?? [];
  const ids = (role: string) => people.filter((p) => p.role === role).map((p) => p.id);
  await BookingModel.updateMany({ agencyId, leaderId: { $nin: ["", ...ids("領隊")] } }, { $set: { leaderId: "" } });
  await BookingModel.updateMany({ agencyId, driverId: { $nin: ["", ...ids("司機")] } }, { $set: { driverId: "" } });
}

async function beforeWrite(name: CollectionName, data: Data) {
  assertNoInlineFiles(data);
  if (name === "bookings") await checkBooking(data);
}

async function afterWrite(name: CollectionName, id: string, data: Data) {
  if (name === "agencies") await syncBookingPeople(id, data);
}

/** POST /api/<collection>：新增（沒帶 id 時自動產生） */
export async function createDoc(name: CollectionName, body: Data) {
  await connectDB();
  const Model = COLLECTIONS[name];
  const id = typeof body.id === "string" && body.id ? body.id : uid(name.slice(0, 1));
  if (await Model.exists({ _id: id })) throw new HttpError(409, "這個 id 已經存在");
  const data = fromClient(body);
  await beforeWrite(name, data);
  const doc = await Model.create({ ...data, _id: id });
  return toClient(doc.toObject());
}

/** PUT /api/<collection>/<id>：存在就整筆覆寫，不存在就建立（前端的新增與編輯共用） */
export async function saveDoc(name: CollectionName, id: string, body: Data) {
  await connectDB();
  const Model = COLLECTIONS[name];
  const data = fromClient(body);
  await beforeWrite(name, data);

  const doc = await Model.findById(id);
  if (!doc) {
    const created = await Model.create({ ...data, _id: id });
    await afterWrite(name, id, data);
    return { doc: toClient(created.toObject()), created: true };
  }

  const before = doc.toObject();
  doc.overwrite({ ...data, _id: id });
  await doc.save();
  await afterWrite(name, id, data);
  await deleteRemovedBlobs(before, data);
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
  await deleteBlobs(collectBlobUrls(doc));
}
