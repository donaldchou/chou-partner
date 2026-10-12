import { connection, NextResponse } from "next/server";
import { handleError } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { collectionCounts } from "@/lib/admin-data";

/** GET /api/admin/data 各資料集合的筆數 */
export async function GET() {
  await connection();
  try {
    await requireAdmin();
    return NextResponse.json(await collectionCounts());
  } catch (err) {
    return handleError(err);
  }
}
