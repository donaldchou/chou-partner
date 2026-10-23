/**
 * 把整個資料庫（MONGODB_URI 指定的那個）備份成一個壓縮檔。備份裡是客戶個資，預設存在專案外面，不會進 git。
 *
 *   npm run backup                    → C:\backup\Personal\AI\chou-partner-backup\chou-partner_YYYYMMDD_HHmm.jsonl.gz
 *   npm run backup -- --out D:\備份   → 改存到別的資料夾（也可設環境變數 BACKUP_DIR）
 *
 * 檔案格式（gzip 壓縮的 JSON Lines，Canonical EJSON，ObjectId／Date 型別原樣保留）：
 *   第一行  {"database", "createdAt", "collections": [{name, indexes}]}
 *   中間    {"c": collection 名稱, "d": 文件}，同一個 collection 的文件連在一起
 *   最後一行 {"counts": {名稱: 筆數}}（缺這行代表檔案不完整）
 * 還原用 npm run restore（見 scripts/restore-db.ts）。
 */
import { createWriteStream, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createGzip } from "node:zlib";
import mongoose from "mongoose";

for (const line of readFileSync(".env.local", "utf8").replace(/^﻿/, "").split(/\r?\n/)) {
  const m = /^\s*(\w+)\s*=\s*(.*)$/.exec(line);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^"|"$/g, "");
}

const DEFAULT_DIR = "C:\\backup\\Personal\\AI\\chou-partner-backup";
const { EJSON } = mongoose.mongo.BSON;

function argValue(name: string) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function stamp(d = new Date()) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`;
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("請在 .env.local 設定 MONGODB_URI");

  await mongoose.connect(uri);
  const db = mongoose.connection.db!;
  const dir = argValue("--out") ?? process.env.BACKUP_DIR ?? DEFAULT_DIR;
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `${db.databaseName}_${stamp()}.jsonl.gz`);
  console.log(`備份 ${db.databaseName} → ${file}`);

  const names = (await db.listCollections({}, { nameOnly: false }).toArray())
    .filter((c) => c.type === "collection" && !c.name.startsWith("system."))
    .map((c) => c.name)
    .sort((a, b) => a.localeCompare(b));
  const collections: { name: string; indexes: mongoose.mongo.Document[] }[] = [];
  for (const name of names) collections.push({ name, indexes: await db.collection(name).listIndexes().toArray() });

  const counts: Record<string, number> = {};
  async function* lines() {
    yield JSON.stringify({ database: db.databaseName, createdAt: new Date().toISOString(), collections }) + "\n";
    for (const name of names) {
      counts[name] = 0;
      for await (const doc of db.collection(name).find({}, { batchSize: 1000 })) {
        counts[name]++;
        yield EJSON.stringify({ c: name, d: doc }, { relaxed: false }) + "\n";
      }
      console.log(`  ${name.padEnd(20)} ${String(counts[name]).padStart(7)} 筆`);
    }
    yield JSON.stringify({ counts }) + "\n";
  }
  await pipeline(Readable.from(lines()), createGzip(), createWriteStream(file));

  const total = Object.values(counts).reduce((s, n) => s + n, 0);
  console.log(`完成：${names.length} 個 collection，共 ${total} 筆`);
}

main()
  .catch((e) => {
    console.error("備份失敗：", e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
