import { SignJWT, jwtVerify } from "jose";

/**
 * JWT 登入憑證：簽發、驗證和 cookie 設定。這裡不碰資料庫，proxy 也能用。
 * 密鑰讀環境變數 JWT_SECRET（至少 32 個字元）。
 */
export const SESSION_COOKIE = "chou_partner_session";
export const SESSION_DAYS = 7;

export type Role = "admin" | "user";
export type Session = { userId: string; email: string; role: Role };

function secret() {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 32) throw new Error("請在 .env.local 設定 JWT_SECRET（至少 32 個字元）");
  return new TextEncoder().encode(s);
}

export async function signSession(s: Session) {
  return new SignJWT({ email: s.email, role: s.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(s.userId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secret());
}

/** 驗證 JWT；過期、被竄改或格式不對都回傳 null */
export async function verifySession(token: string | undefined): Promise<Session | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    if (!payload.sub || typeof payload.email !== "string") return null;
    return { userId: payload.sub, email: payload.email, role: payload.role === "admin" ? "admin" : "user" };
  } catch {
    return null;
  }
}

export const sessionCookie = (token: string) => ({
  name: SESSION_COOKIE,
  value: token,
  httpOnly: true, // 前端 JavaScript 讀不到，避免被 XSS 偷走
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: SESSION_DAYS * 24 * 60 * 60,
});

/* ---------------- 驗證碼解鎖：輸入一次驗證碼，選定的時數內不用再輸入 ---------------- */
export const UNLOCK_COOKIE = "chou_partner_unlock";
/** 後台解鎖可選的時數：預設 1 小時，最多 12 小時 */
export const UNLOCK_HOURS = { min: 1, max: 12, default: 1 } as const;

/** 綁定登入者的解鎖憑證，回傳 token 與到期時間（毫秒） */
export async function signUnlock(userId: string, hours: number) {
  const exp = Math.floor((Date.now() + hours * 3600 * 1000) / 1000);
  const token = await new SignJWT({ purpose: "unlock" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(exp)
    .sign(secret());
  return { token, expiresAt: exp * 1000 };
}

/** 解鎖憑證有效（同一個使用者、還沒過期）時回傳到期時間（毫秒），否則 null */
export async function verifyUnlock(token: string | undefined, userId: string): Promise<number | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    if (payload.purpose !== "unlock" || payload.sub !== userId || !payload.exp) return null;
    return payload.exp * 1000;
  } catch {
    return null;
  }
}

export const unlockCookie = (token: string, hours: number) => ({
  name: UNLOCK_COOKIE,
  value: token,
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: hours * 3600,
});
