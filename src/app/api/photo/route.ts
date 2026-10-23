import { connection, type NextRequest } from "next/server";
import { HttpError, handleError } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { readStored } from "@/lib/storage";

/**
 * GET /api/photo?url=<ll3:...>
 * 照片存在 ll3 主機，不能直接公開開啟，由這裡讀取後回傳。
 */
export async function GET(req: NextRequest) {
  // 每次請求都即時讀取，不要在 build 時預先產生
  await connection();
  try {
    await requireUser();
    const url = req.nextUrl.searchParams.get("url");
    if (!url) throw new HttpError(400, "缺少 url");
    const f = await readStored(url);
    return new Response(f.body, {
      headers: {
        "Content-Type": f.contentType,
        ...(f.length ? { "Content-Length": String(f.length) } : {}),
        // 檔名含隨機碼，內容不會改變，可以長期快取在瀏覽器（private：不讓 CDN 共用）
        "Cache-Control": "private, max-age=31536000, immutable",
      },
    });
  } catch (err) {
    return handleError(err);
  }
}
