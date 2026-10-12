import { connection, NextResponse } from "next/server";
import { handleError, readJson } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { UNLOCK_COOKIE, signUnlock, unlockCookie } from "@/lib/session";
import { assertCode, unlockedUntil } from "@/lib/unlock";

/** GET /api/unlock → { expiresAt }（毫秒；沒有解鎖是 null） */
export async function GET() {
  // 讀 cookie，只能在請求時執行
  await connection();
  try {
    const user = await requireAdmin();
    return NextResponse.json({ expiresAt: await unlockedUntil(user) });
  } catch (err) {
    return handleError(err);
  }
}

/** POST /api/unlock { code } 驗證碼正確 → 解鎖 1 小時（只有後台管理頁會呼叫） */
export async function POST(req: Request) {
  try {
    const user = await requireAdmin();
    const { code } = await readJson(req);
    assertCode(user.id, code);
    const { token, expiresAt } = await signUnlock(user.id);
    const res = NextResponse.json({ expiresAt });
    res.cookies.set(unlockCookie(token));
    return res;
  } catch (err) {
    return handleError(err);
  }
}

/** DELETE /api/unlock 立即上鎖 */
export async function DELETE() {
  try {
    await requireAdmin();
    const res = NextResponse.json({ expiresAt: null });
    res.cookies.delete(UNLOCK_COOKIE);
    return res;
  } catch (err) {
    return handleError(err);
  }
}
