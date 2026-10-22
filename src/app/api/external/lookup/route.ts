import { connection, NextResponse, type NextRequest } from "next/server";
import { handleError } from "@/lib/api";
import { corsHeaders, externalLookup, requireApiKey } from "@/lib/external-lookup";

/**
 * GET /api/external/lookup?q=姓名或電話
 * 給甜柿訂購系統查詢訂購者／收件者（不用登入，header 帶 x-api-key 或 x-api-token，見 external-lookup.ts）
 */
export async function GET(req: NextRequest) {
  await connection();
  let res: NextResponse;
  try {
    requireApiKey(req);
    const data = await externalLookup(req.nextUrl.searchParams.get("q") ?? "");
    res = NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    res = handleError(err);
  }
  for (const [k, v] of Object.entries(corsHeaders(req))) res.headers.set(k, v);
  return res;
}

/** 瀏覽器跨網域呼叫前的預檢 */
export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req) });
}
