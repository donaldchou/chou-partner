import { connection, NextResponse } from "next/server";
import { handleError } from "@/lib/api";
import { pagesFor } from "@/lib/access";
import { requireUser } from "@/lib/auth";

/** GET /api/auth/me 目前登入的使用者 + 看得到的頁面 pages（帳號停用或被刪除時回 401） */
export async function GET() {
  // 讀 cookie，只能在請求時執行
  await connection();
  try {
    const user = await requireUser();
    return NextResponse.json({ ...user, pages: await pagesFor(user) });
  } catch (err) {
    return handleError(err);
  }
}
