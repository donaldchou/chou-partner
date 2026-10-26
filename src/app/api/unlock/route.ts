import { connection, NextResponse } from "next/server";
import { HttpError, handleError, readJson } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { UNLOCK_COOKIE, UNLOCK_HOURS, signUnlock, unlockCookie } from "@/lib/session";
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

/** POST /api/unlock { code, hours? } 驗證碼正確 → 解鎖 hours 小時（預設 1，1–12；只有後台管理頁會呼叫） */
export async function POST(req: Request) {
  try {
    const user = await requireAdmin();
    const { code, hours: raw = UNLOCK_HOURS.default } = await readJson(req);
    const hours = Number(raw);
    if (!Number.isInteger(hours) || hours < UNLOCK_HOURS.min || hours > UNLOCK_HOURS.max) {
      throw new HttpError(400, `解鎖時數需為 ${UNLOCK_HOURS.min}–${UNLOCK_HOURS.max} 小時`);
    }
    assertCode(user.id, code);
    const { token, expiresAt } = await signUnlock(user.id, hours);
    const res = NextResponse.json({ expiresAt });
    res.cookies.set(unlockCookie(token, hours));
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
