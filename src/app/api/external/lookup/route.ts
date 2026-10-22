import { connection, NextResponse, type NextRequest } from "next/server";
import { handleError } from "@/lib/api";
import { externalLookup, requireApiKey } from "@/lib/external-lookup";

/**
 * GET /api/external/lookup?q=姓名或電話
 * 給甜柿訂購系統查詢訂購者／收件者（不用登入，header 帶 x-api-key）
 */
export async function GET(req: NextRequest) {
  await connection();
  try {
    requireApiKey(req);
    const data = await externalLookup(req.nextUrl.searchParams.get("q") ?? "");
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return handleError(err);
  }
}
