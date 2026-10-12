import { NextResponse, type NextRequest } from "next/server";
import { handleError, readJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { requireEditor } from "@/lib/unlock";
import { createOrder, listOrders } from "@/lib/orders-repo";

/** GET /api/orders?q=&season=&channel=&status=&brand=&payStatus=&review=1&customerId=&sort=new|old&page=&limit= */
export async function GET(req: NextRequest) {
  try {
    await requireUser();
    return NextResponse.json(await listOrders(req.nextUrl.searchParams));
  } catch (err) {
    return handleError(err);
  }
}

/** POST /api/orders 新增訂單（沒帶 orderNo 時自動編號） */
export async function POST(req: NextRequest) {
  try {
    // 新增、修改、刪除都要驗證碼
    await requireEditor();
    return NextResponse.json(await createOrder(await readJson(req)), { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}
