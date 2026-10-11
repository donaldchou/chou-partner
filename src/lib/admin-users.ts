import { UserModel } from "@/models/user";
import { HttpError } from "./api";
import { assertPassword, hashPassword, publicUser, type PublicUser } from "./auth";
import { connectDB } from "./mongodb";
import type { Role } from "./session";

type Data = Record<string, unknown>;

const roleOf = (v: unknown): Role => (v === "admin" ? "admin" : "user");

export async function listUsers() {
  await connectDB();
  return (await UserModel.find().sort({ role: 1, createdAt: 1 }).lean()).map(publicUser);
}

/** 管理者新增帳號（沒有註冊頁），預設是一般使用者 */
export async function createUser(body: Data) {
  await connectDB();
  const email = String(body.email ?? "")
    .trim()
    .toLowerCase();
  assertPassword(body.password);
  if (await UserModel.exists({ email })) throw new HttpError(409, "這個 Email 已經有帳號");
  const doc = await UserModel.create({
    email,
    name: String(body.name ?? "").trim(),
    passwordHash: await hashPassword(body.password),
    role: roleOf(body.role),
    active: true,
  });
  return publicUser(doc.toObject());
}

/** 至少要留一位啟用中的管理者，避免沒有人能進後台 */
async function assertKeepsAdmin(excludeId: string) {
  const others = await UserModel.countDocuments({ _id: { $ne: excludeId }, role: "admin", active: true });
  if (!others) throw new HttpError(400, "至少要保留一位啟用中的管理者");
}

/** 修改姓名、身分、啟用狀態或重設密碼；不能把自己降級或停用 */
export async function updateUser(id: string, body: Data, me: PublicUser) {
  await connectDB();
  const user = await UserModel.findById(id);
  if (!user) throw new HttpError(404, "找不到這個帳號");

  if (body.name !== undefined) user.set("name", String(body.name).trim());
  if (body.role !== undefined && roleOf(body.role) !== user.get("role")) {
    if (id === me.id) throw new HttpError(400, "不能修改自己的身分");
    if (user.get("role") === "admin") await assertKeepsAdmin(id);
    user.set("role", roleOf(body.role));
  }
  if (body.active !== undefined && Boolean(body.active) !== user.get("active")) {
    if (id === me.id) throw new HttpError(400, "不能停用自己的帳號");
    if (!body.active && user.get("role") === "admin") await assertKeepsAdmin(id);
    user.set("active", Boolean(body.active));
  }
  if (body.password !== undefined) {
    assertPassword(body.password);
    user.set("passwordHash", await hashPassword(body.password));
  }
  await user.save();
  return publicUser(user.toObject());
}

export async function deleteUser(id: string, me: PublicUser) {
  await connectDB();
  if (id === me.id) throw new HttpError(400, "不能刪除自己的帳號");
  const user = await UserModel.findById(id).lean();
  if (!user) throw new HttpError(404, "找不到這個帳號");
  if ((user as unknown as { role: string }).role === "admin") await assertKeepsAdmin(id);
  await UserModel.deleteOne({ _id: id });
}
