import { connection, NextResponse } from "next/server";
import { handleError } from "@/lib/api";
import { requirePage } from "@/lib/access";
import { dashboardStats } from "@/lib/orders-repo";

/** GET /api/stats 儀表板統計：客戶數、各產季營收、本季各通路、待處理訂單 */
export async function GET() {
  await connection();
  try {
    await requirePage("dashboard");
    return NextResponse.json(await dashboardStats());
  } catch (err) {
    return handleError(err);
  }
}
