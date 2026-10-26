import { connection, NextResponse } from "next/server";
import { handleError, readJson } from "@/lib/api";
import { getPageAccess, savePageAccess } from "@/lib/access";
import { requireAdmin } from "@/lib/auth";
import { requireUnlocked } from "@/lib/unlock";

/** GET /api/admin/page-access → { allowed, users[] }：一般使用者可以看的頁面與各帳號另外隱藏的頁面 */
export async function GET() {
  await connection();
  try {
    await requireAdmin();
    return NextResponse.json(await getPageAccess());
  } catch (err) {
    return handleError(err);
  }
}

/** PUT /api/admin/page-access { allowed: PageKey[], hidden: { 帳號 id: PageKey[] } }（要驗證碼） */
export async function PUT(req: Request) {
  try {
    const me = await requireAdmin();
    await requireUnlocked(me);
    return NextResponse.json(await savePageAccess(await readJson(req)));
  } catch (err) {
    return handleError(err);
  }
}
