import { NextResponse } from "next/server";
import { HttpError, handleError, readJson } from "@/lib/api";
import { checkPassword, publicUser } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import { sessionCookie, signSession } from "@/lib/session";
import { UserModel } from "@/models/user";

// 同一個 Email 連續輸錯 5 次，鎖 15 分鐘（記在伺服器記憶體，重啟會重置）
const MAX_FAILS = 5;
const LOCK_MS = 15 * 60 * 1000;
const fails = new Map<string, { count: number; until: number }>();

/** POST /api/auth/login { email, password } → 設定 HttpOnly cookie，回傳使用者資料 */
export async function POST(req: Request) {
  try {
    const body = await readJson(req);
    const email = String(body.email ?? "")
      .trim()
      .toLowerCase();
    const password = String(body.password ?? "");
    if (!email || !password) throw new HttpError(400, "請輸入 Email 和密碼");

    const f = fails.get(email);
    if (f && f.count >= MAX_FAILS && f.until > Date.now()) {
      throw new HttpError(429, `密碼錯誤太多次，請 ${Math.ceil((f.until - Date.now()) / 60000)} 分鐘後再試`);
    }

    await connectDB();
    const user = (await UserModel.findOne({ email }).lean()) as {
      _id: string;
      passwordHash: string;
      role: "admin" | "user";
      active: boolean;
    } | null;
    // 帳號不存在和密碼錯誤用同一個訊息，避免被試出哪些 Email 有帳號
    if (!user || !(await checkPassword(password, user.passwordHash))) {
      const cur = fails.get(email);
      fails.set(email, { count: (cur && cur.until > Date.now() ? cur.count : 0) + 1, until: Date.now() + LOCK_MS });
      throw new HttpError(401, "Email 或密碼錯誤");
    }
    if (!user.active) throw new HttpError(403, "這個帳號已停用，請聯絡管理者");
    fails.delete(email);

    await UserModel.updateOne({ _id: user._id }, { $set: { lastLoginAt: new Date() } });
    const token = await signSession({ userId: user._id, email, role: user.role });
    const res = NextResponse.json(publicUser({ ...user, lastLoginAt: new Date() }));
    res.cookies.set(sessionCookie(token));
    return res;
  } catch (err) {
    return handleError(err);
  }
}
