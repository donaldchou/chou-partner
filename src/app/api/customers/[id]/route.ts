import { NextResponse, type NextRequest } from "next/server";
import { handleError, readJson } from "@/lib/api";
import { deleteCustomer, getCustomer, saveCustomer } from "@/lib/customers-repo";

type Ctx = RouteContext<"/api/customers/[id]">;

/** GET /api/customers/<id>：客戶 + 全部訂單 */
export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    return NextResponse.json(await getCustomer((await ctx.params).id));
  } catch (err) {
    return handleError(err);
  }
}

/** PUT /api/customers/<id> 整筆儲存（不存在時建立）；統計欄位由訂單重算 */
export async function PUT(req: NextRequest, ctx: Ctx) {
  try {
    const { doc, created } = await saveCustomer((await ctx.params).id, await readJson(req));
    return NextResponse.json(doc, { status: created ? 201 : 200 });
  } catch (err) {
    return handleError(err);
  }
}

/** DELETE /api/customers/<id>?cascade=true（有訂單時要帶 cascade 才會一起刪） */
export async function DELETE(req: NextRequest, ctx: Ctx) {
  try {
    await deleteCustomer((await ctx.params).id, req.nextUrl.searchParams.get("cascade") === "true");
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return handleError(err);
  }
}
