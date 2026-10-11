import { connection, NextResponse } from "next/server";
import { handleError } from "@/lib/api";
import { loadAll } from "@/lib/repo";

/** GET /api/db 一次取得所有資料，前端啟動時使用 */
export async function GET() {
  // 每次請求都即時讀資料庫，不要在 build 時預先產生
  await connection();
  try {
    return NextResponse.json(await loadAll());
  } catch (err) {
    return handleError(err);
  }
}
