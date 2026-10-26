import { timingSafeEqual } from "node:crypto";
import { cookies, headers } from "next/headers";
import { HttpError } from "./api";
import { requireAdmin, type PublicUser } from "./auth";
import { UNLOCK_COOKIE, verifyUnlock } from "./session";

/**
 * 驗證碼：新增、修改、刪除資料除了管理者身分還要驗證碼（環境變數 ADMIN_CODE）。兩種方式：
 * - 後台管理頁解鎖：發一個綁定登入者、選定時數（1–12 小時，預設 1）有效的解鎖 cookie，期間都不用再輸入
 * - 其他頁面：每次動作輸入一次，放在 x-verify-code header，只對這一個請求有效
 */
export function checkCode(code: unknown) {
  const expected = process.env.ADMIN_CODE;
  if (!expected) throw new HttpError(500, "尚未設定驗證碼：請在 .env.local 加上 ADMIN_CODE");
  const a = Buffer.from(String(code ?? ""));
  const b = Buffer.from(expected);
  // 長度不同時也要做一次比較，避免從回應時間猜出長度
  return a.length === b.length ? timingSafeEqual(a, b) : (timingSafeEqual(b, b), false);
}

// 同一個帳號連續輸錯 5 次，鎖 15 分鐘（記在伺服器記憶體）
const MAX_FAILS = 5;
const LOCK_MS = 15 * 60 * 1000;
const fails = new Map<string, { count: number; until: number }>();

/** 檢查驗證碼並計算錯誤次數；錯誤時丟出 403（badCode），錯太多次丟出 429 */
export function assertCode(userId: string, code: unknown) {
  const f = fails.get(userId);
  if (f && f.count >= MAX_FAILS && f.until > Date.now()) {
    throw new HttpError(429, `驗證碼錯誤太多次，請 ${Math.ceil((f.until - Date.now()) / 60000)} 分鐘後再試`);
  }
  if (!checkCode(code)) {
    fails.set(userId, { count: (f && f.until > Date.now() ? f.count : 0) + 1, until: Date.now() + LOCK_MS });
    throw new HttpError(403, "驗證碼錯誤", { badCode: true });
  }
  fails.delete(userId);
}

/** 目前登入者的解鎖到期時間（毫秒）；沒有解鎖時是 null */
export async function unlockedUntil(user: PublicUser) {
  return verifyUnlock((await cookies()).get(UNLOCK_COOKIE)?.value, user.id);
}

/** 需要驗證碼的 API：已在後台解鎖，或這次請求附上正確的驗證碼；都沒有時回 423，前端會跳出驗證碼輸入框 */
export async function requireUnlocked(user: PublicUser) {
  if (await unlockedUntil(user)) return;
  const header = (await headers()).get("x-verify-code");
  if (header === null) throw new HttpError(423, "請輸入驗證碼", { needCode: true });
  assertCode(user.id, decodeURIComponent(header));
}

/** 新增、修改、刪除資料：管理者 + 驗證碼 */
export async function requireEditor() {
  const user = await requireAdmin();
  await requireUnlocked(user);
  return user;
}
