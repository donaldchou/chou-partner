import { NextResponse, type NextRequest } from "next/server";
import { handleError } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { listRows } from "@/lib/admin-data";

type Ctx = RouteContext<"/api/admin/data/[collection]">;

/** GET /api/admin/data/<collection>?q=&page= 列表（每頁 50 筆） */
export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    await requireAdmin();
    return NextResponse.json(await listRows((await ctx.params).collection, req.nextUrl.searchParams));
  } catch (err) {
    return handleError(err);
  }
}
