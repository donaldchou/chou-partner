import { NextResponse, type NextRequest } from "next/server";
import { handleError } from "@/lib/api";
import { restoreDeletedOrder } from "@/lib/deleted-orders";
import { requireEditor } from "@/lib/unlock";

type Ctx = RouteContext<"/api/admin/deleted-orders/[id]/restore">;

/** POST /api/admin/deleted-orders/<id>/restore 還原到訂單列表（需要驗證碼） */
export async function POST(_req: NextRequest, ctx: Ctx) {
  try {
    await requireEditor();
    return NextResponse.json(await restoreDeletedOrder((await ctx.params).id));
  } catch (err) {
    return handleError(err);
  }
}
