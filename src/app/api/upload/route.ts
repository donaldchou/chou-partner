import { NextResponse } from "next/server";
import { HttpError, handleError, readFile } from "@/lib/api";
import { uploadBlob } from "@/lib/blob";

// Vercel 伺服器上傳的 body 上限約 4.5MB；照片在前端會先壓縮成 JPEG（約 100–300KB）
const MAX_BYTES = 4 * 1024 * 1024;

/** 允許上傳的檔案：圖片（名片、照片）與宅配單常見格式 */
const ALLOWED = [
  /^image\/(jpeg|png|webp|gif|heic|heif)$/,
  /^application\/pdf$/,
  /^text\/csv$/,
  /^application\/vnd\.ms-excel$/,
  /^application\/vnd\.openxmlformats-officedocument\.(spreadsheetml\.sheet|wordprocessingml\.document)$/,
  /^application\/msword$/,
];
const EXT_TYPES: Record<string, string> = { csv: "text/csv", xls: "application/vnd.ms-excel", pdf: "application/pdf" };

/**
 * POST /api/upload（multipart：file、folder = cards | people | shipping…）
 * 上傳到 Vercel Blob，回傳 { url, name, size, contentType }；把 url 存進 MongoDB 的欄位
 */
export async function POST(req: Request) {
  try {
    const { file, form } = await readFile(req, "file", MAX_BYTES);
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    // 有些瀏覽器不給 csv / xls 的 MIME type，用副檔名補
    const contentType = file.type || EXT_TYPES[ext] || "application/octet-stream";
    if (!ALLOWED.some((re) => re.test(contentType))) {
      throw new HttpError(415, `不支援的檔案格式（${contentType}），請上傳圖片、PDF、Excel、CSV 或 Word`);
    }
    const folder = String(form.get("folder") ?? "files").replace(/[^a-z0-9-]/gi, "") || "files";
    // 中文檔名放進網址容易出問題，Blob 路徑用日期 + 副檔名，原始檔名另外回傳
    const name = `${new Date().toISOString().slice(0, 10)}${ext ? "." + ext.replace(/[^a-z0-9]/g, "") : ""}`;
    const url = await uploadBlob(new Blob([await file.arrayBuffer()], { type: contentType }), folder, name);
    return NextResponse.json({ url, name: file.name, size: file.size, contentType }, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}
