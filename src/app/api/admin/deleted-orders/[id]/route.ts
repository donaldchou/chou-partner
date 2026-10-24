import { connection, NextResponse, type NextRequest } from "next/server";
import { handleError } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { getDeletedOrder, purgeDeletedOrder } from "@/lib/deleted-orders";
import { requireEditor } from "@/lib/unlock";

type Ctx = RouteContext<"/api/admin/deleted-orders/[id]">;

/** GET /api/admin/deleted-orders/<id> 檢視整筆已刪除的訂單 */
export async function GET(_req: NextRequest, ctx: Ctx) {
  await connection();
  try {
    await requireAdmin();
    return NextResponse.json(await getDeletedOrder((await ctx.params).id));
  } catch (err) {
    return handleError(err);
  }
}

/** DELETE /api/admin/deleted-orders/<id> 永久刪除（需要驗證碼），無法復原 */
export async function DELETE(_req: NextRequest, ctx: Ctx) {
  try {
    await requireEditor();
    await purgeDeletedOrder((await ctx.params).id);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return handleError(err);
  }
}
