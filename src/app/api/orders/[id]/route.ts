import { NextResponse, type NextRequest } from "next/server";
import { handleError, readJson } from "@/lib/api";
import { requirePage } from "@/lib/access";
import { requireEditor } from "@/lib/unlock";
import { deleteOrder, getOrder, saveOrder } from "@/lib/orders-repo";

type Ctx = RouteContext<"/api/orders/[id]">;

/** GET /api/orders/<id>：訂單 + 客戶基本資料 */
export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    await requirePage("orders");
    return NextResponse.json(await getOrder((await ctx.params).id));
  } catch (err) {
    return handleError(err);
  }
}

/** PUT /api/orders/<id> 整筆儲存（不存在時建立）；金額由後端重算 */
export async function PUT(req: NextRequest, ctx: Ctx) {
  try {
    // 新增、修改、刪除都要驗證碼
    await requireEditor();
    const { doc, created } = await saveOrder((await ctx.params).id, await readJson(req));
    return NextResponse.json(doc, { status: created ? 201 : 200 });
  } catch (err) {
    return handleError(err);
  }
}

/** DELETE /api/orders/<id> */
export async function DELETE(_req: NextRequest, ctx: Ctx) {
  try {
    // 新增、修改、刪除都要驗證碼；刪除的訂單會移到後台「已刪除紀錄」
    const user = await requireEditor();
    await deleteOrder((await ctx.params).id, user.email);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return handleError(err);
  }
}
