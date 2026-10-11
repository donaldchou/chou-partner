import { connection, NextResponse } from "next/server";
import { handleError, readJson } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { requireUnlocked } from "@/lib/unlock";
import { createUser, listUsers } from "@/lib/admin-users";

/** GET /api/admin/users 所有帳號（不含密碼） */
export async function GET() {
  // 讀 cookie，只能在請求時執行
  await connection();
  try {
    await requireUnlocked(await requireAdmin());
    return NextResponse.json(await listUsers());
  } catch (err) {
    return handleError(err);
  }
}

/** POST /api/admin/users { email, name, password, role } 新增帳號 */
export async function POST(req: Request) {
  try {
    await requireUnlocked(await requireAdmin());
    return NextResponse.json(await createUser(await readJson(req)), { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}
