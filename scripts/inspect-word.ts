/** 開發用：列出 Word 解析結果中某種待確認原因的原文，用來改進規則。npx tsx scripts/inspect-word.ts <檔案> <原因> [筆數] */
import { readFileSync } from "node:fs";
import path from "node:path";

async function main() {
  const [file, reason, n = "8"] = process.argv.slice(2);
  const { parseWordOrders } = await import("../src/lib/legacy/word");
  const r = await parseWordOrders(readFileSync(file), path.basename(file));
  const hits = r.orders
    .filter((o) => (reason === "OK" ? !o.legacy.needsReview : o.legacy.reviewReasons?.some((x) => x.includes(reason))))
    .filter((_, i) => reason !== "OK" || i % 37 === 3);
  console.log(`${hits.length} 筆符合「${reason}」`);
  for (const o of hits.slice(0, Number(n))) {
    console.log(
      `\n--- ${o.orderNo} ${o.channel} 付款:${o.payment.method}/${o.payment.status} 寄:${o.shipments[0].requestedShipDate} 運費:${o.amounts.shipping} 調整:${o.amounts.adjust} 地址:${o.shipments[0].recipient.address}  品項：${o.items.map((i) => `${i.product}${i.spec}x${i.qty}@${i.unitPrice}`).join(", ") || "無"}  收件人：${o.shipments.map((s) => s.recipient.name || "?").join("/")}`,
    );
    console.log(
      o.legacy
        .rawText!.replace(/\d{3}(?=\d{3}\b)/g, "***")
        .split("\n")
        .map((l) => "    " + l)
        .join("\n"),
    );
  }
}
main();
