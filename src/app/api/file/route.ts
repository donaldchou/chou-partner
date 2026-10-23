import { connection, type NextRequest } from "next/server";
import { HttpError, handleError } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { readStored } from "@/lib/storage";

/** 每次最多回傳 3MB（Vercel 回應上限約 4.5MB），大檔案由瀏覽器分段讀取後組合（同 upload.ts 的 FILE_PART） */
const FILE_PART = 3 * 1024 * 1024;

/**
 * GET /api/file?url=<ll3:...>&part=<第幾段，從 0 開始>
 * 回傳這一段的內容，標頭 X-File-Size 是整個檔案的大小（前端用 openStoredFile 讀取）。
 */
export async function GET(req: NextRequest) {
  // 每次請求都即時讀取，不要在 build 時預先產生
  await connection();
  try {
    await requireUser();
    const url = req.nextUrl.searchParams.get("url");
    if (!url) throw new HttpError(400, "缺少 url");
    const part = Number(req.nextUrl.searchParams.get("part") ?? 0);
    if (!Number.isInteger(part) || part < 0) throw new HttpError(400, "part 格式錯誤");
    const f = await readStored(url, { offset: part * FILE_PART, length: FILE_PART });
    return new Response(f.body, {
      headers: {
        "Content-Type": f.contentType,
        ...(f.length ? { "Content-Length": String(f.length) } : {}),
        "X-File-Size": String(f.total),
        "Cache-Control": "private, max-age=31536000, immutable",
      },
    });
  } catch (err) {
    return handleError(err);
  }
}
