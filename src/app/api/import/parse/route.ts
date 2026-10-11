import { NextResponse } from "next/server";
import { HttpError, handleError, readFile } from "@/lib/api";
import { markExisting, parseDocx, parseMdb } from "@/lib/importer";

const PREVIEW_LIMIT = 5000;

/**
 * POST /api/import/parse（multipart：file、kind = word | mdb、table = MDB 資料表名稱，可省略）
 * 解析檔案、標記既有客戶，回傳預覽列；不會寫入資料庫。
 */
export async function POST(req: Request) {
  try {
    const { form, buffer } = await readFile(req, "file", 50 * 1024 * 1024);
    const kind = form.get("kind");

    let result: { rows: Awaited<ReturnType<typeof parseDocx>>["rows"]; ai?: boolean; tables?: unknown; table?: string };
    if (kind === "word") result = await parseDocx(buffer);
    else if (kind === "mdb") result = parseMdb(buffer, (form.get("table") as string | null) || undefined);
    else throw new HttpError(400, "kind 必須是 word 或 mdb");

    const total = result.rows.length;
    const rows = await markExisting(result.rows.slice(0, PREVIEW_LIMIT));
    return NextResponse.json({ ...result, rows, total, truncated: total > PREVIEW_LIMIT });
  } catch (err) {
    return handleError(err);
  }
}
