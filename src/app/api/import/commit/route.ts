import { NextResponse } from "next/server";
import { handleError, readFile } from "@/lib/api";
import { parseUpload } from "@/lib/legacy/from-upload";
import { importOrders, importProducts } from "@/lib/legacy/importer";

/**
 * POST /api/import/commit（multipart：file、kind = mdb | word）
 * 重新解析並寫入：已匯入過的訂單略過，客戶依電話合併。
 */
export async function POST(req: Request) {
  try {
    const { file, form, buffer } = await readFile(req, "file", 4 * 1024 * 1024);
    const r = await parseUpload(form.get("kind"), file.name, buffer);
    const products = r.products.length ? await importProducts(r.products) : 0;
    const summary = await importOrders(r.orders);
    return NextResponse.json({ ...summary, products, skipped: r.skipped });
  } catch (err) {
    return handleError(err);
  }
}
