import { NextResponse, type NextRequest } from "next/server";
import { HttpError, handleError, readJson } from "@/lib/api";
import { requireUser, requireAdmin } from "@/lib/auth";
import { isCollection } from "@/lib/collections";
import { createDoc, listDocs } from "@/lib/repo";

type Ctx = RouteContext<"/api/[collection]">;

async function nameOf(ctx: Ctx) {
  const { collection } = await ctx.params;
  if (!isCollection(collection)) throw new HttpError(404, `沒有 ${collection} 這個資料集合`);
  return collection;
}

/** GET /api/<collection>?q=關鍵字&from=YYYY-MM-DD&to=YYYY-MM-DD&欄位=值 */
export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    await requireUser();
    return NextResponse.json(await listDocs(await nameOf(ctx), req.nextUrl.searchParams));
  } catch (err) {
    return handleError(err);
  }
}

/** POST /api/<collection> 新增一筆 */
export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    await requireAdmin();
    const name = await nameOf(ctx);
    return NextResponse.json(await createDoc(name, await readJson(req)), { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}
