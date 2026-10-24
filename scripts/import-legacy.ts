/**
 * 匯入歷年訂單（舊網站 MDB + 電話訂單 Word）
 *
 *   npm run import:legacy -- --dry-run          只解析、顯示統計，不寫入
 *   npm run import:legacy                       寫入 MongoDB（重複執行不會產生重複訂單）
 *   npm run import:legacy -- --dir 其他資料夾    預設 db_test_file（底下要有 mdb/、word/）
 *   npm run import:legacy -- --skip-word        只匯入 MDB，不處理 Word
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import mongoose from "mongoose";

// 讀 .env.local（檔案開頭可能有 BOM）
for (const line of readFileSync(".env.local", "utf8").replace(/^﻿/, "").split(/\r?\n/)) {
  const m = /^\s*(\w+)\s*=\s*(.*)$/.exec(line);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^"|"$/g, "");
}

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const skipWord = args.includes("--skip-word");
const dir = args.includes("--dir") ? args[args.indexOf("--dir") + 1] : "db_test_file";

async function main() {
  const { EXCLUDED_MDB, parseMdb } = await import("../src/lib/legacy/mdb");
  const { parseWordOrders } = await import("../src/lib/legacy/word");
  const { importOrders, importProducts, loadPriceLookup, priceLookupFrom } = await import("../src/lib/legacy/importer");
  const { connectDB } = await import("../src/lib/mongodb");
  type ImportOrder = import("../src/lib/legacy/types").ImportOrder;

  const tally = (list: { reason: string; count: number }[], into: Map<string, number>) =>
    list.forEach((s) => into.set(s.reason, (into.get(s.reason) ?? 0) + s.count));

  // ---------- MDB：依檔案時間由舊到新讀，重複的訂單保留較新檔案的版本 ----------
  const mdbDir = path.join(dir, "mdb");
  const mdbFiles = readdirSync(mdbDir)
    .filter((f) => /\.mdb/i.test(f) && !EXCLUDED_MDB.some((re) => re.test(f)))
    .sort((a, b) => statSync(path.join(mdbDir, a)).mtimeMs - statSync(path.join(mdbDir, b)).mtimeMs);
  const mdbOrders: ImportOrder[] = [];
  const products: import("../src/lib/types").Product[] = [];
  const mdbSkipped = new Map<string, number>();
  for (const f of mdbFiles) {
    const r = parseMdb(readFileSync(path.join(mdbDir, f)), f);
    mdbOrders.push(...r.orders);
    products.push(...r.products);
    tally(r.skipped, mdbSkipped);
  }
  const uniqueMdb = new Set(mdbOrders.map((o) => o.legacy.key)).size;
  console.log(`\n【MDB】${mdbFiles.length} 個檔案，讀到 ${mdbOrders.length} 筆，去重後 ${uniqueMdb} 筆訂單`);
  mdbSkipped.forEach((n, r) => console.log(`  排除：${r} ${n}`));

  if (!dryRun) {
    await connectDB();
    console.log(`  產品 ${await importProducts(products)} 項`);
    const s = await importOrders(mdbOrders, (m) => console.log("  " + m));
    console.log(
      `  ✔ 新增訂單 ${s.orders.created}（已存在 ${s.orders.existing}），新增客戶 ${s.customers.created}，更新客戶 ${s.customers.updated}`,
    );
  }

  if (skipWord) {
    console.log(dryRun ? "\n（--dry-run：沒有寫入資料庫）" : "\n（--skip-word：沒有處理 Word）");
    await mongoose.disconnect();
    return;
  }

  // ---------- Word ----------
  const wordDir = path.join(dir, "word");
  const priceOf = dryRun ? priceLookupFrom(products) : await loadPriceLookup();
  const wordOrders: ImportOrder[] = [];
  const reasons = new Map<string, number>();
  for (const f of readdirSync(wordDir).filter((f) => /\.docx$/i.test(f) && !f.startsWith("~$"))) {
    const r = await parseWordOrders(readFileSync(path.join(wordDir, f)), f, priceOf);
    const review = r.orders.filter((o) => o.legacy.needsReview).length;
    console.log(
      `\n【Word】${f}：${r.orders.length} 筆，待確認 ${review} 筆${r.skipped.length ? `，略過空白段落 ${r.skipped[0].count}` : ""}`,
    );
    r.orders.forEach((o) =>
      o.legacy.reviewReasons?.forEach((x) => reasons.set(x.replace(/：.*/, ""), (reasons.get(x.replace(/：.*/, "")) ?? 0) + 1)),
    );
    wordOrders.push(...r.orders);
  }
  console.log(
    "  待確認原因：" +
      [...reasons]
        .sort((a, b) => b[1] - a[1])
        .map(([k, v]) => `${k} ${v}`)
        .join("、"),
  );

  if (!dryRun) {
    const s = await importOrders(wordOrders, (m) => console.log("  " + m));
    console.log(
      `  ✔ 新增訂單 ${s.orders.created}（已存在 ${s.orders.existing}，待確認 ${s.orders.needsReview}），新增客戶 ${s.customers.created}，更新客戶 ${s.customers.updated}`,
    );
    await mongoose.disconnect();
  } else {
    console.log("\n（--dry-run：沒有寫入資料庫）");
  }
}

main().catch(async (e) => {
  console.error(e);
  await mongoose.disconnect();
  process.exit(1);
});
