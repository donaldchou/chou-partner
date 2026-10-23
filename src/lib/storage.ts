import { randomBytes } from "node:crypto";
import { CustomerModel } from "@/models/customer";
import { GroupBuyModel } from "@/models/group-buy";
import { AgencyModel } from "@/models/tour";
import { HttpError } from "./api";
import { LL3_PREFIX, isLl3Url, ll3Delete, ll3Get } from "./ll3";
import { connectDB } from "./mongodb";

/** 照片與檔案都存在 ll3 主機，MongoDB 存 "ll3:<folder>/<name>" */
export const isStoredUrl = isLl3Url;

/** 可以上傳的副檔名與 Content-Type（要跟 file_api_partner.asp 的 ContentTypeOf 一致） */
export const FILE_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  pdf: "application/pdf",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  csv: "text/csv",
  txt: "text/plain",
  zip: "application/zip",
};

export const extOf = (name: string) => (name.includes(".") ? name.split(".").pop()!.toLowerCase() : "");

/** 新檔案在主機上的路徑：folder/日期-亂數.副檔名（原始檔名另外存在資料裡） */
export function newFilePath(folder: string, ext: string) {
  const d = new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10).replace(/-/g, "");
  return `${folder}/${d}-${randomBytes(6).toString("hex")}.${ext}`;
}

/** 讀檔，給 /api/photo、/api/file、名片辨識使用 */
export async function readStored(url: string, range?: { offset: number; length: number }) {
  if (!isLl3Url(url)) throw new HttpError(400, "不是這個平台的檔案網址");
  const path = url.slice(LL3_PREFIX.length);
  const res = await ll3Get(path, range);
  return {
    body: res.body!,
    contentType: FILE_TYPES[extOf(path)] ?? "application/octet-stream",
    length: Number(res.headers.get("content-length") ?? 0),
    total: Number(res.headers.get("x-file-size") ?? 0),
  };
}

/** 找出資料裡所有檔案網址（包含巢狀欄位，例如 people[].photos、backups[].fileUrl） */
export function collectFileUrls(value: unknown, out = new Set<string>()): Set<string> {
  if (isStoredUrl(value)) out.add(value);
  else if (Array.isArray(value)) value.forEach((v) => collectFileUrls(v, out));
  else if (value && typeof value === "object") Object.values(value).forEach((v) => collectFileUrls(v, out));
  return out;
}

/** 刪除不再使用的檔案。失敗只記錄，不影響資料庫操作。 */
export async function deleteFiles(urls: Iterable<string>) {
  const list = [...urls];
  if (!list.length) return;
  const results = await Promise.allSettled(list.map((u) => ll3Delete(u.slice(LL3_PREFIX.length))));
  for (const r of results) if (r.status === "rejected") console.warn("刪除檔案失敗：", r.reason);
}

/** 已儲存的資料是否用到這個檔案（存檔案網址的欄位都要列在這裡） */
export async function isFileReferenced(url: string) {
  await connectDB();
  const found = await Promise.all([
    CustomerModel.exists({ cardImage: url }),
    AgencyModel.exists({ $or: [{ cardImage: url }, { "people.photos": url }] }),
    GroupBuyModel.exists({ $or: [{ cardImage: url }, { "backups.fileUrl": url }] }),
  ]);
  return found.some(Boolean);
}

/** 文件更新後，刪掉舊版有、新版沒有的檔案 */
export async function deleteRemovedFiles(before: unknown, after: unknown) {
  const kept = collectFileUrls(after);
  await deleteFiles([...collectFileUrls(before)].filter((u) => !kept.has(u)));
}

/** 拒絕 base64 內嵌檔案，確保 MongoDB 只存檔案網址 */
export function assertNoInlineFiles(value: unknown): void {
  if (typeof value === "string" && value.startsWith("data:")) {
    throw new HttpError(400, "照片與檔案必須先上傳到 /api/upload，資料中只能存網址");
  }
  if (Array.isArray(value)) value.forEach(assertNoInlineFiles);
  else if (value && typeof value === "object") Object.values(value).forEach(assertNoInlineFiles);
}
