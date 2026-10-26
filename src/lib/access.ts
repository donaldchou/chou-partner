import { SettingModel } from "@/models/setting";
import { UserModel } from "@/models/user";
import { HttpError } from "./api";
import { requireUser, type PublicUser } from "./auth";
import { connectDB } from "./mongodb";
import { isPageKey, PAGE_KEYS, type PageAccessSettings, type PageKey } from "./page-access";

const SETTING_ID = "pageAccess";

/** ① 一般使用者可以看的頁面；還沒設定過＝全部都可以看（跟以前一樣） */
export async function basePages(): Promise<PageKey[]> {
  await connectDB();
  const doc = (await SettingModel.findById(SETTING_ID).lean()) as { allowed?: string[] } | null;
  return doc?.allowed ? PAGE_KEYS.filter((k) => doc.allowed!.includes(k)) : [...PAGE_KEYS];
}

/** 這個帳號看得到的頁面：管理者全部；一般使用者 ＝ ① 有勾、② 沒勾 */
export async function pagesFor(user: PublicUser): Promise<PageKey[]> {
  if (user.role === "admin") return [...PAGE_KEYS];
  const hidden = user.hiddenPages ?? [];
  return (await basePages()).filter((k) => !hidden.includes(k));
}

/** 讀取資料的 API：要有其中一個頁面的權限，否則 403 */
export async function requirePage(...keys: PageKey[]) {
  const user = await requireUser();
  if (user.role === "admin") return user;
  const pages = await pagesFor(user);
  if (!keys.some((k) => pages.includes(k))) throw new HttpError(403, "你的帳號沒有權限查看這個頁面");
  return user;
}

/** 後台「頁面權限」分頁要的資料 */
export async function getPageAccess(): Promise<PageAccessSettings> {
  await connectDB();
  const users = (await UserModel.find({ role: "user" }).sort({ createdAt: 1 }).lean()) as unknown as {
    _id: string;
    email: string;
    name?: string;
    active: boolean;
    hiddenPages?: string[];
  }[];
  return {
    allowed: await basePages(),
    users: users.map((u) => ({
      id: String(u._id),
      email: u.email,
      name: u.name ?? "",
      active: u.active,
      hiddenPages: (u.hiddenPages ?? []).filter(isPageKey),
    })),
  };
}

/** 儲存：{ allowed: PageKey[], hidden: { 帳號 id: PageKey[] } }；只接受認得的頁面、只改一般使用者 */
export async function savePageAccess(body: Record<string, unknown>) {
  await connectDB();
  if (!Array.isArray(body.allowed)) throw new HttpError(400, "缺少 allowed");
  const allowed = PAGE_KEYS.filter((k) => (body.allowed as unknown[]).includes(k));
  await SettingModel.updateOne({ _id: SETTING_ID }, { $set: { allowed } }, { upsert: true });

  const hidden = (body.hidden ?? {}) as Record<string, unknown>;
  if (typeof hidden !== "object" || Array.isArray(hidden)) throw new HttpError(400, "hidden 格式不正確");
  for (const [id, keys] of Object.entries(hidden)) {
    if (!Array.isArray(keys)) throw new HttpError(400, "hidden 格式不正確");
    await UserModel.updateOne({ _id: id, role: "user" }, { $set: { hiddenPages: PAGE_KEYS.filter((k) => keys.includes(k)) } });
  }
  return getPageAccess();
}
