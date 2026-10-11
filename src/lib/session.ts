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
