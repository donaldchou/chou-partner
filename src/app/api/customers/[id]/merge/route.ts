import { NextResponse, type NextRequest } from "next/server";
import { HttpError, handleError, readJson } from "@/lib/api";
import { requireEditor } from "@/lib/unlock";
import { mergeCustomers } from "@/lib/customers-repo";

type Ctx = RouteContext<"/api/customers/[id]/merge">;

/** POST /api/customers/<id>/merge { from }：把重複的客戶（from）併進這位客戶，訂單一起移過來 */
export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    // 新增、修改、刪除都要驗證碼
    await requireEditor();
    const { from } = await readJson(req);
    if (typeof from !== "string" || !from) throw new HttpError(400, "請傳入要合併的客戶 id（from）");
    return NextResponse.json(await mergeCustomers((await ctx.params).id, from));
  } catch (err) {
    return handleError(err);
  }
}
