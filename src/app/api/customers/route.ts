import { NextResponse, type NextRequest } from "next/server";
import { handleError, readJson } from "@/lib/api";
import { createCustomer, listCustomers } from "@/lib/customers-repo";

/** GET /api/customers?q=關鍵字&source=&tag=&sort=recent|orders|spent|name|created&page=&limit=&withOrders=1 */
export async function GET(req: NextRequest) {
  try {
    return NextResponse.json(await listCustomers(req.nextUrl.searchParams));
  } catch (err) {
    return handleError(err);
  }
}

/** POST /api/customers 新增客戶 */
export async function POST(req: NextRequest) {
  try {
    return NextResponse.json(await createCustomer(await readJson(req)), { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}
