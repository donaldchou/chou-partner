import { del, put } from "@vercel/blob";
import { HttpError } from "./api";

// Blob store 是 public：網址可直接在瀏覽器開啟（網址含隨機碼，無法被猜到）
const BLOB_URL = /^https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\/chou-partner\//i;

export const isBlobUrl = (v: unknown): v is string => typeof v === "string" && BLOB_URL.test(v);

function token() {
  const t = process.env.BLOB_READ_WRITE_TOKEN;
  if (!t) throw new Error("請在 .env.local 設定 BLOB_READ_WRITE_TOKEN");
  return t;
}

/** 上傳檔案到 Vercel Blob（chou-partner/<folder>/），回傳檔案網址，由呼叫端存進 MongoDB */
export async function uploadBlob(file: Blob, folder: string, name: string) {
  const blob = await put(`chou-partner/${folder}/${name}`, file, {
    access: "public",
    addRandomSuffix: true,
    contentType: file.type || "application/octet-stream",
    token: token(),
  });
  return blob.url;
}

/** 找出資料裡所有 Blob 網址（包含巢狀欄位，例如 people[].photos、backups[].fileUrl） */
export function collectBlobUrls(value: unknown, out = new Set<string>()): Set<string> {
  if (isBlobUrl(value)) out.add(value);
  else if (Array.isArray(value)) value.forEach((v) => collectBlobUrls(v, out));
  else if (value && typeof value === "object") Object.values(value).forEach((v) => collectBlobUrls(v, out));
  return out;
}

/** 刪除不再使用的檔案。失敗只記錄，不影響資料庫操作。 */
export async function deleteBlobs(urls: Iterable<string>) {
  const list = [...urls];
  if (!list.length) return;
  try {
    await del(list, { token: token() });
  } catch (err) {
    console.warn("刪除 Blob 檔案失敗：", err);
  }
}

/** 文件更新後，刪掉舊版有、新版沒有的檔案 */
export async function deleteRemovedBlobs(before: unknown, after: unknown) {
  const kept = collectBlobUrls(after);
  await deleteBlobs([...collectBlobUrls(before)].filter((u) => !kept.has(u)));
}

/** 拒絕 base64 內嵌檔案，確保 MongoDB 只存 Blob 網址 */
export function assertNoInlineFiles(value: unknown): void {
  if (typeof value === "string" && value.startsWith("data:")) {
    throw new HttpError(400, "照片與檔案必須先上傳到 /api/upload，資料中只能存網址");
  }
  if (Array.isArray(value)) value.forEach(assertNoInlineFiles);
  else if (value && typeof value === "object") Object.values(value).forEach(assertNoInlineFiles);
}
