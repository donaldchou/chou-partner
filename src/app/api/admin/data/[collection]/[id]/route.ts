import { NextResponse, type NextRequest } from "next/server";
import { handleError } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { requireUnlocked } from "@/lib/unlock";
import { deleteRow, getRaw } from "@/lib/admin-data";

type Ctx = RouteContext<"/api/admin/data/[collection]/[id]">;

/** GET /api/admin/data/<collection>/<id> 單筆完整內容 */
export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    await requireAdmin();
    const { collection, id } = await ctx.params;
    return NextResponse.json(await getRaw(collection, id));
  } catch (err) {
    return handleError(err);
  }
}

/** DELETE /api/admin/data/<collection>/<id>?cascade=true（客戶連訂單、旅行社連預約一起刪） */
export async function DELETE(req: NextRequest, ctx: Ctx) {
  try {
    const user = await requireAdmin();
    await requireUnlocked(user);
    const { collection, id } = await ctx.params;
    await deleteRow(collection, id, req.nextUrl.searchParams.get("cascade") === "true", user.email);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return handleError(err);
  }
}
