import { NextResponse } from "next/server";
import { HttpError, handleError, readJson } from "@/lib/api";
import { commitImport, type ImportRow } from "@/lib/importer";

/** POST /api/import/commit { source: "Word匯入" | "MDB匯入", rows: ImportRow[] } → 匯入結果統計 */
export async function POST(req: Request) {
  try {
    const { source, rows } = await readJson(req);
    if (source !== "Word匯入" && source !== "MDB匯入") throw new HttpError(400, "source 必須是 Word匯入 或 MDB匯入");
    if (!Array.isArray(rows) || !rows.length) throw new HttpError(400, "沒有要匯入的資料");
    return NextResponse.json(await commitImport(rows as ImportRow[], source));
  } catch (err) {
    return handleError(err);
  }
}
