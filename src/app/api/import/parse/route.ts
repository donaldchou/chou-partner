import { NextResponse } from "next/server";
import { handleError, readFile } from "@/lib/api";
import { parseUpload } from "@/lib/legacy/from-upload";
import { connectDB } from "@/lib/mongodb";
import { OrderModel } from "@/models/order";

const PREVIEW = 200;

/**
 * POST /api/import/parse（multipart：file、kind = mdb | word）
 * 解析檔案、檢查哪些已經匯入過，回傳統計與前 200 筆預覽；不會寫入資料庫。
 */
export async function POST(req: Request) {
  try {
    const { file, form, buffer } = await readFile(req, "file", 4 * 1024 * 1024);
    const r = await parseUpload(form.get("kind"), file.name, buffer);
    await connectDB();
    const keys = r.orders.map((o) => o.legacy.key);
    const existing = new Set(
      (
        (await OrderModel.find({ "legacy.key": { $in: keys } })
          .select("legacy.key")
          .lean()) as unknown as { legacy: { key: string } }[]
      ).map((o) => o.legacy.key),
    );
    const fresh = r.orders.filter((o) => !existing.has(o.legacy.key));
    return NextResponse.json({
      kind: r.kind,
      file: file.name,
      total: r.orders.length,
      existing: existing.size,
      fresh: fresh.length,
      needsReview: fresh.filter((o) => o.legacy.needsReview).length,
      skipped: r.skipped,
      products: r.products.length,
      preview: fresh.slice(0, PREVIEW).map((o) => ({
        key: o.legacy.key,
        orderNo: o.orderNo,
        channel: o.channel,
        orderedAt: o.orderedAt,
        buyer: o.buyer,
        address: o.shipments[0]?.recipient.address ?? "",
        shipments: o.shipments.length,
        items: o.items,
        total: o.items.reduce((s, i) => s + i.qty * i.unitPrice, 0) + o.amounts.shipping + o.amounts.adjust + o.payment.codFee,
        needsReview: o.legacy.needsReview,
        reasons: o.legacy.reviewReasons ?? [],
      })),
    });
  } catch (err) {
    return handleError(err);
  }
}
