import { connection, NextResponse } from "next/server";
import { HttpError, handleError, readJson } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { UNLOCK_COOKIE, signUnlock, unlockCookie } from "@/lib/session";
import { checkCode, unlockedUntil } from "@/lib/unlock";

// 同一個帳號連續輸錯 5 次，鎖 15 分鐘（記在伺服器記憶體）
const MAX_FAILS = 5;
const LOCK_MS = 15 * 60 * 1000;
const fails = new Map<string, { count: number; until: number }>();

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

/** POST /api/unlock { code } 驗證碼正確 → 解鎖 1 小時 */
export async function POST(req: Request) {
  try {
    const user = await requireAdmin();
    const f = fails.get(user.id);
    if (f && f.count >= MAX_FAILS && f.until > Date.now()) {
      throw new HttpError(429, `驗證碼錯誤太多次，請 ${Math.ceil((f.until - Date.now()) / 60000)} 分鐘後再試`);
    }
    const { code } = await readJson(req);
    if (!checkCode(code)) {
      fails.set(user.id, { count: (f && f.until > Date.now() ? f.count : 0) + 1, until: Date.now() + LOCK_MS });
      throw new HttpError(403, "驗證碼錯誤");
    }
    fails.delete(user.id);
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
