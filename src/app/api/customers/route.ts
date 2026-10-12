import { NextResponse, type NextRequest } from "next/server";
import { handleError, readJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { requireEditor } from "@/lib/unlock";
import { createCustomer, customerCounts, listCustomers } from "@/lib/customers-repo";

/**
 * GET /api/customers?q=關鍵字&source=&tag=&status=|suspect|invalid|all&sort=recent|orders|spent|name|created&page=&limit=&withOrders=1
 * withCounts=1：另外回傳各狀態的客戶數（有效／疑似無效／無效）
 */
export async function GET(req: NextRequest) {
  try {
    await requireUser();
    const params = req.nextUrl.searchParams;
    const [list, counts] = await Promise.all([
      listCustomers(params),
      params.get("withCounts") === "1" ? customerCounts() : undefined,
    ]);
    return NextResponse.json({ ...list, counts });
  } catch (err) {
    return handleError(err);
  }
}

/** POST /api/customers 新增客戶 */
export async function POST(req: NextRequest) {
  try {
    // 新增、修改、刪除都要驗證碼
    await requireEditor();
    return NextResponse.json(await createCustomer(await readJson(req)), { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}
