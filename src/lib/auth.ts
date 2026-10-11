import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { UserModel } from "@/models/user";
import { HttpError, toClient } from "./api";
import { connectDB } from "./mongodb";
import { SESSION_COOKIE, verifySession, type Role } from "./session";

export type PublicUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  active: boolean;
  lastLoginAt: string | null;
  createdAt: string;
};

/** 給前端的使用者資料（拿掉密碼雜湊） */
export function publicUser(doc: unknown): PublicUser {
  const user = toClient<Record<string, unknown>>(doc);
  delete user.passwordHash;
  delete user.updatedAt;
  return user as unknown as PublicUser;
}

export const hashPassword = (password: string) => bcrypt.hash(password, 12);
export const checkPassword = (password: string, hash: string) => bcrypt.compare(password, hash);

export function assertPassword(password: unknown): asserts password is string {
  if (typeof password !== "string" || password.length < 8) throw new HttpError(400, "密碼至少要 8 個字元");
}

/**
 * 從 cookie 取出目前登入的使用者，並回資料庫確認帳號還在、沒被停用。
 * 身分以資料庫為準：後台改了身分或停用帳號會立刻生效，不用等 JWT 過期。
 */
export async function currentUser(): Promise<PublicUser | null> {
  const session = await verifySession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!session) return null;
  await connectDB();
  const doc = await UserModel.findById(session.userId).lean();
  if (!doc) return null;
  const user = publicUser(doc);
  return user.active ? user : null;
}

/** 必須登入，否則 401 */
export async function requireUser() {
  const user = await currentUser();
  if (!user) throw new HttpError(401, "請先登入");
  return user;
}

/** 必須是管理者，否則 403（一般使用者只能看） */
export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "admin") throw new HttpError(403, "只有管理者可以修改資料");
  return user;
}
