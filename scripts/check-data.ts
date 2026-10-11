/** 開發用：匯入後的資料檢查（只輸出統計，不輸出個資）。npx tsx scripts/check-data.ts */
import { readFileSync } from "node:fs";
import mongoose from "mongoose";

for (const line of readFileSync(".env.local", "utf8").replace(/^﻿/, "").split(/\r?\n/)) {
  const m = /^\s*(\w+)\s*=\s*(.*)$/.exec(line);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^"|"$/g, "");
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI!);
  const db = mongoose.connection.db!;
  const orders = db.collection("orders");
  const customers = db.collection("customers");
  console.log(
    "訂單",
    await orders.countDocuments(),
    "客戶",
    await customers.countDocuments(),
    "產品",
    await db.collection("products").countDocuments(),
  );

  const agg = async (pipeline: object[]) => orders.aggregate(pipeline).toArray();
  console.log("\n依產季/通路：");
  for (const r of await agg([
    { $group: { _id: { s: "$season", c: "$channel" }, n: { $sum: 1 }, total: { $sum: "$amounts.total" } } },
    { $sort: { "_id.s": 1 } },
  ]))
    console.log(`  ${r._id.s} ${r._id.c.padEnd(3)} ${String(r.n).padStart(5)} 筆  NT$ ${r.total.toLocaleString()}`);

  console.log("\n下單時段（應集中在白天與晚上）：");
  const hours = await agg([
    { $match: { channel: "網站" } },
    { $group: { _id: { $substr: ["$orderedAt", 11, 2] }, n: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);
  console.log("  " + hours.map((h) => `${h._id}時:${h.n}`).join(" "));

  console.log("\n狀態：", (await agg([{ $group: { _id: "$status", n: { $sum: 1 } } }])).map((r) => `${r._id}=${r.n}`).join(" "));
  console.log(
    "付款：",
    (await agg([{ $group: { _id: { m: "$payment.method", s: "$payment.status" }, n: { $sum: 1 } } }, { $sort: { n: -1 } }]))
      .map((r) => `${r._id.m || "未知"}/${r._id.s}=${r.n}`)
      .join(" "),
  );
  console.log(
    "金額為 0 的訂單：",
    await orders.countDocuments({ "amounts.total": 0 }),
    " 待確認：",
    await orders.countDocuments({ "legacy.needsReview": true }),
  );
  console.log(
    "重複的 legacy.key：",
    (await agg([{ $group: { _id: "$legacy.key", n: { $sum: 1 } } }, { $match: { n: { $gt: 1 } } }])).length,
  );
  console.log(
    "找不到客戶的訂單：",
    (
      await agg([
        { $lookup: { from: "customers", localField: "customerId", foreignField: "_id", as: "c" } },
        { $match: { c: { $size: 0 } } },
        { $count: "n" },
      ])
    )[0]?.n ?? 0,
  );

  const top = await customers
    .find({}, { projection: { "stats.orderCount": 1, "stats.totalSpent": 1, sources: 1, "phones.digits": 1 } })
    .sort({ "stats.orderCount": -1 })
    .limit(5)
    .toArray();
  console.log(
    "\n訂單數最多的客戶：",
    top.map((c) => `${c.stats.orderCount} 筆/NT$${c.stats.totalSpent}/${c.sources.join("+")}/${c.phones.length}支電話`).join("；"),
  );
  console.log(
    "回購客：",
    await customers.countDocuments({ tags: "回購客" }),
    " 有多個通路：",
    await customers.countDocuments({ "sources.1": { $exists: true } }),
  );
  console.log(
    "同一支電話出現在多位客戶：",
    (
      await customers
        .aggregate([
          { $unwind: "$phones" },
          { $group: { _id: "$phones.digits", n: { $sum: 1 } } },
          { $match: { n: { $gt: 1 } } },
          { $count: "n" },
        ])
        .toArray()
    )[0]?.n ?? 0,
  );
  await mongoose.disconnect();
}
main();
