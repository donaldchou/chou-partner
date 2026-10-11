import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { HttpError } from "./api";
import type { PublicUser } from "./auth";
import { UNLOCK_COOKIE, verifyUnlock } from "./session";

/**
 * 驗證碼：後台等敏感功能，除了管理者身分還要輸入驗證碼（環境變數 ADMIN_CODE）。
 * 輸入正確後發一個綁定登入者、1 小時有效的解鎖 cookie，期間所有需要驗證碼的功能都不用再輸入。
 */
export function checkCode(code: unknown) {
  const expected = process.env.ADMIN_CODE;
  if (!expected) throw new HttpError(500, "尚未設定驗證碼：請在 .env.local 加上 ADMIN_CODE");
  const a = Buffer.from(String(code ?? ""));
  const b = Buffer.from(expected);
  // 長度不同時也要做一次比較，避免從回應時間猜出長度
  return a.length === b.length ? timingSafeEqual(a, b) : (timingSafeEqual(b, b), false);
}

/** 目前登入者的解鎖到期時間（毫秒）；沒有解鎖時是 null */
export async function unlockedUntil(user: PublicUser) {
  return verifyUnlock((await cookies()).get(UNLOCK_COOKIE)?.value, user.id);
}

/** 需要驗證碼的 API：沒有解鎖時回 423，前端會跳出驗證碼輸入框 */
export async function requireUnlocked(user: PublicUser) {
  if (!(await unlockedUntil(user))) throw new HttpError(423, "請先輸入驗證碼", { needCode: true });
}
