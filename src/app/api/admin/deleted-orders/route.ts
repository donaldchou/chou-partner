import { connection, NextResponse, type NextRequest } from "next/server";
import { handleError } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { listDeletedOrders } from "@/lib/deleted-orders";

/** GET /api/admin/deleted-orders?q=&page= 已刪除的訂單（新刪的在前） */
export async function GET(req: NextRequest) {
  await connection();
  try {
    await requireAdmin();
    return NextResponse.json(await listDeletedOrders(req.nextUrl.searchParams));
  } catch (err) {
    return handleError(err);
  }
}
