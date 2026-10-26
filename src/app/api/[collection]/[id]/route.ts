import { NextResponse, type NextRequest } from "next/server";
import { HttpError, handleError, readJson } from "@/lib/api";
import { requirePage } from "@/lib/access";
import { COLLECTION_PAGES, PAGE_KEYS } from "@/lib/page-access";
import { requireEditor } from "@/lib/unlock";
import { isCollection } from "@/lib/collections";
import { deleteDoc, getDoc, saveDoc } from "@/lib/repo";

type Ctx = RouteContext<"/api/[collection]/[id]">;

async function paramsOf(ctx: Ctx) {
  const { collection, id } = await ctx.params;
  if (!isCollection(collection)) throw new HttpError(404, `沒有 ${collection} 這個資料集合`);
  return { name: collection, id };
}

/** GET /api/<collection>/<id> */
export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const { name, id } = await paramsOf(ctx);
    // 沒列在 COLLECTION_PAGES 的集合（產品、標籤）：有任何一個頁面的權限就可以讀
    await requirePage(...(COLLECTION_PAGES[name] ?? PAGE_KEYS));
    return NextResponse.json(await getDoc(name, id));
  } catch (err) {
    return handleError(err);
  }
}

/** PUT /api/<collection>/<id> 整筆儲存（不存在時建立） */
export async function PUT(req: NextRequest, ctx: Ctx) {
  try {
    // 新增、修改、刪除都要驗證碼
    await requireEditor();
    const { name, id } = await paramsOf(ctx);
    const { doc, created } = await saveDoc(name, id, await readJson(req));
    return NextResponse.json(doc, { status: created ? 201 : 200 });
  } catch (err) {
    return handleError(err);
  }
}

/** DELETE /api/<collection>/<id>?cascade=true */
export async function DELETE(req: NextRequest, ctx: Ctx) {
  try {
    // 新增、修改、刪除都要驗證碼
    await requireEditor();
    const { name, id } = await paramsOf(ctx);
    await deleteDoc(name, id, req.nextUrl.searchParams.get("cascade") === "true");
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return handleError(err);
  }
}
