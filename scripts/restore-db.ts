/**
 * 從 npm run backup 產生的備份檔還原。預設還原到另一個資料庫 chou-partner-restore，不碰正式資料。
 *
 *   npm run restore -- <備份檔.jsonl.gz>                       → 還原到 chou-partner-restore
 *   npm run restore -- <備份檔.jsonl.gz> --to <資料庫名稱>      → 還原到指定的資料庫
 *   加上 --drop                                               → 目標 collection 已有資料時先刪掉再還原
 *
 * 目標 collection 已有資料又沒加 --drop 時，什麼都不做就結束。
 * 要覆蓋正式資料庫（MONGODB_URI 那個）必須同時加 --drop --yes-overwrite-live。
 */
import { createReadStream, readFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { createGunzip } from "node:zlib";
import mongoose from "mongoose";

for (const line of readFileSync(".env.local", "utf8").replace(/^﻿/, "").split(/\r?\n/)) {
  const m = /^\s*(\w+)\s*=\s*(.*)$/.exec(line);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^"|"$/g, "");
}

const { EJSON } = mongoose.mongo.BSON;
const BATCH = 1000;

type Header = {
  database: string;
  createdAt: string;
  collections: { name: string; indexes: Record<string, unknown>[] }[];
};

function argValue(name: string) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function readLines(file: string) {
  return createInterface({ input: createReadStream(file).pipe(createGunzip()), crlfDelay: Infinity });
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("請在 .env.local 設定 MONGODB_URI");
  const file = process.argv[2];
  if (!file || file.startsWith("--")) throw new Error("用法：npm run restore -- <備份檔.jsonl.gz> [--to 資料庫名稱] [--drop]");
  const drop = process.argv.includes("--drop");

  let header: Header | undefined;
  for await (const line of readLines(file)) {
    header = JSON.parse(line);
    break;
  }
  if (!header?.collections) throw new Error("這不是 npm run backup 產生的備份檔");

  await mongoose.connect(uri);
  const liveName = mongoose.connection.db!.databaseName;
  const target = argValue("--to") ?? `${header.database}-restore`;
  if (target === liveName && !(drop && process.argv.includes("--yes-overwrite-live"))) {
    throw new Error(`${target} 是正式資料庫；確定要覆蓋請同時加上 --drop --yes-overwrite-live`);
  }
  const db = mongoose.connection.getClient().db(target);
  console.log(`還原 ${file}（${header.createdAt}）→ 資料庫 ${target}`);

  // 先全部檢查過再動手，避免還原到一半才發現衝突
  if (!drop) {
    const busy: string[] = [];
    for (const c of header.collections) {
      if (await db.collection(c.name).estimatedDocumentCount()) busy.push(c.name);
    }
    if (busy.length) throw new Error(`目標已有資料：${busy.join("、")}。要覆蓋請加上 --drop`);
  }
  for (const c of header.collections) {
    if (drop) await db.collection(c.name).drop().catch(() => {});
    await db.createCollection(c.name).catch(() => {});
  }

  let counts: Record<string, number> | undefined;
  let current = "";
  let batch: mongoose.mongo.Document[] = [];
  const flush = async () => {
    if (batch.length) await db.collection(current).insertMany(batch);
    batch = [];
  };
  let first = true;
  for await (const line of readLines(file)) {
    if (first || !line) {
      first = false;
      continue;
    }
    if (line.startsWith('{"counts"')) {
      counts = JSON.parse(line).counts;
      break;
    }
    const rec = EJSON.parse(line, { relaxed: false }) as { c: string; d: mongoose.mongo.Document };
    if (rec.c !== current || batch.length >= BATCH) {
      await flush();
      current = rec.c;
    }
    batch.push(rec.d);
  }
  await flush();

  for (const c of header.collections) {
    const coll = db.collection(c.name);
    const indexes = c.indexes
      .filter((ix) => ix.name !== "_id_")
      .map(({ v: _v, ns: _ns, ...ix }) => ix as unknown as mongoose.mongo.IndexDescription);
    if (indexes.length) await coll.createIndexes(indexes);

    const count = await coll.countDocuments();
    const ok = counts !== undefined && count === counts[c.name];
    console.log(`  ${c.name.padEnd(20)} ${String(count).padStart(7)} 筆 ${ok || !counts ? "" : `⚠ 備份裡是 ${counts[c.name]} 筆`}`);
    if (!ok) process.exitCode = 1;
  }
  if (!counts) console.log("⚠ 備份檔缺少結尾，可能不完整");
  console.log(process.exitCode ? "完成，但有問題，請檢查上面的訊息" : "完成，筆數全部相符");
}

main()
  .catch((e) => {
    console.error("還原失敗：", e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
