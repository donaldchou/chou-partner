import { NextResponse, type NextRequest } from "next/server";
import { handleError, readJson } from "@/lib/api";
import { requireUser, requireAdmin } from "@/lib/auth";
import { deleteOrder, getOrder, saveOrder } from "@/lib/orders-repo";

type Ctx = RouteContext<"/api/orders/[id]">;

/** GET /api/orders/<id>：訂單 + 客戶基本資料 */
export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    await requireUser();
    return NextResponse.json(await getOrder((await ctx.params).id));
  } catch (err) {
    return handleError(err);
  }
}

/** PUT /api/orders/<id> 整筆儲存（不存在時建立）；金額由後端重算 */
export async function PUT(req: NextRequest, ctx: Ctx) {
  try {
    await requireAdmin();
    const { doc, created } = await saveOrder((await ctx.params).id, await readJson(req));
    return NextResponse.json(doc, { status: created ? 201 : 200 });
  } catch (err) {
    return handleError(err);
  }
}

/** DELETE /api/orders/<id> */
export async function DELETE(_req: NextRequest, ctx: Ctx) {
  try {
    await requireAdmin();
    await deleteOrder((await ctx.params).id);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return handleError(err);
  }
}
