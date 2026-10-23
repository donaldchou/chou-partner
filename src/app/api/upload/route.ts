import { NextResponse } from "next/server";
import { HttpError, handleError } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { LL3_PREFIX, ll3Done, ll3PutAll } from "@/lib/ll3";
import { FILE_TYPES, extOf, newFilePath } from "@/lib/storage";

/** 瀏覽器每次最多送 3MB（Vercel 請求上限約 4.5MB），伺服器再切成 ll3 主機能收的小塊 */
const MAX_PART = 3 * 1024 * 1024;
const MAX_FILE = 30 * 1024 * 1024;
/** 每個瀏覽器分段最多切成 100 塊以內，塊號 = index * 100 + j，合併時依塊號排序 */
const SUB_PER_PART = 100;

/**
 * POST /api/upload（multipart/form-data），上傳到 ll3 主機。小檔案一次送完，大檔案分段送：
 *   file      這一段的內容
 *   uploadId  同一個檔案的每一段都相同（16–40 個小寫英數字，由瀏覽器產生）
 *   index     第幾段（從 0 開始）
 *   last      最後一段送 "1"，伺服器合併檔案
 *   name      原始檔名（決定副檔名）
 *   size      整個檔案的大小
 *   folder    資料夾：cards | people | shipping…
 * 最後一段回傳：{ url: "ll3:folder/xxx.ext", name, size, contentType }，把 url 存進 MongoDB
 */
export async function POST(req: Request) {
  try {
    await requireAdmin();
    const form = await req.formData().catch(() => {
      throw new HttpError(400, "請用 multipart/form-data 上傳");
    });
    const file = form.get("file");
    if (!(file instanceof Blob) || file.size === 0) throw new HttpError(400, "缺少檔案");
    if (file.size > MAX_PART) throw new HttpError(413, "每段上限 3MB");

    const uploadId = String(form.get("uploadId") ?? "");
    if (!/^[a-z0-9]{16,40}$/.test(uploadId)) throw new HttpError(400, "uploadId 格式錯誤");
    const index = Number(form.get("index") ?? 0);
    if (!Number.isInteger(index) || index < 0 || index > 999) throw new HttpError(400, "index 格式錯誤");
    const name = String(form.get("name") ?? "").slice(0, 200);
    const ext = extOf(name);
    if (!FILE_TYPES[ext]) {
      throw new HttpError(415, `不支援的檔案格式（.${ext}），請上傳圖片（JPG、PNG）、PDF、Excel、CSV 或 Word`);
    }
    const size = Number(form.get("size") ?? 0);
    if (!Number.isInteger(size) || size <= 0) throw new HttpError(400, "size 格式錯誤");
    if (size > MAX_FILE) throw new HttpError(413, "檔案太大（上限 30MB）");

    await ll3PutAll(uploadId, new Uint8Array(await file.arrayBuffer()), index * SUB_PER_PART);
    if (form.get("last") !== "1") return NextResponse.json({ ok: true });

    const folder = String(form.get("folder") ?? "files").replace(/[^a-z0-9-]/gi, "").toLowerCase() || "files";
    const path = newFilePath(folder, ext === "jpeg" ? "jpg" : ext);
    await ll3Done(uploadId, path, size);
    return NextResponse.json({ url: LL3_PREFIX + path, name, size, contentType: FILE_TYPES[ext] }, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}
