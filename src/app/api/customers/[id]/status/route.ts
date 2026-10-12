import { NextResponse, type NextRequest } from "next/server";
import { handleError, readJson } from "@/lib/api";
import { requireEditor } from "@/lib/unlock";
import { setCustomerStatus } from "@/lib/customers-repo";

type Ctx = RouteContext<"/api/customers/[id]/status">;

/**
 * PATCH /api/customers/<id>/status
 * { invalid: { reason, note } } 標記無效、{ invalid: null } 取消標記、{ suspectChecked: true } 確認是正常客戶
 */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    // 新增、修改、刪除都要驗證碼
    const user = await requireEditor();
    return NextResponse.json(await setCustomerStatus((await ctx.params).id, await readJson(req), user.email));
  } catch (err) {
    return handleError(err);
  }
}
