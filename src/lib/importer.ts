import mammoth from "mammoth";
import MDBReader from "mdb-reader";
import { CustomerModel } from "@/models/customer";
import { digitsOf } from "@/models/_shared";
import { HttpError } from "./api";
import { geminiJson, hasGemini } from "./gemini";
import { connectDB } from "./mongodb";
import type { Customer, CustomerSource, Order } from "./types";
import { today, toDateStr, uid } from "./utils";

/** 匯入預覽的一列：一位客戶的一筆訂購（一項產品） */
export interface ImportRow {
  key: string;
  company: string;
  name: string;
  phone: string;
  address: string;
  date: string;
  product: string;
  spec: string;
  qty: number;
  unitPrice: number;
  /** 電話相同的既有客戶，匯入時會合併 */
  existingId?: string;
  existingName?: string;
}

type Field = Exclude<keyof ImportRow, "key" | "existingId" | "existingName"> | "amount";

/** 欄位標題的常見寫法（舊系統、Word 表格） */
const ALIASES: Record<Field, string[]> = {
  name: ["客戶姓名", "姓名", "客戶", "訂購人", "聯絡人", "收件人", "name", "customer"],
  company: ["公司名稱", "公司", "單位", "company"],
  phone: ["聯絡電話", "電話", "手機", "行動電話", "tel", "phone", "mobile"],
  address: ["收件地址", "地址", "住址", "address", "addr"],
  date: ["訂購日期", "訂單日期", "下單日期", "日期", "date"],
  product: ["產品名稱", "產品", "品名", "商品", "品項", "product", "item"],
  spec: ["規格", "包裝", "spec"],
  qty: ["數量", "件數", "盒數", "qty", "quantity"],
  unitPrice: ["單價", "售價", "價格", "price"],
  amount: ["金額", "總價", "小計", "合計", "total", "amount"],
};

const norm = (s: string) => s.toLowerCase().replace(/\s|_|-/g, "");

/** 每個欄位標題對應到哪個欄位：用最長的別名比對，避免「客戶電話」被當成姓名 */
export function mapHeaders(headers: string[]): Partial<Record<Field, number>> {
  const map: Partial<Record<Field, number>> = {};
  headers.forEach((h, i) => {
    const nh = norm(h);
    let best: { field: Field; len: number } | null = null;
    for (const [field, aliases] of Object.entries(ALIASES) as [Field, string[]][]) {
      for (const a of aliases) {
        if (nh.includes(norm(a)) && (!best || a.length > best.len)) best = { field, len: a.length };
      }
    }
    if (best && map[best.field] === undefined) map[best.field] = i;
  });
  return map;
}

/** 各種日期寫法 → YYYY-MM-DD；民國年（三位數以下）自動加 1911 */
export function normalizeDate(v: unknown): string {
  if (v instanceof Date && !isNaN(v.getTime())) return toDateStr(v);
  const s = String(v ?? "").trim();
  let m = /^(\d{2,4})[/.\-年](\d{1,2})[/.\-月](\d{1,2})/.exec(s);
  if (!m) m = /^(\d{4})(\d{2})(\d{2})$/.exec(s);
  if (!m) return "";
  let y = Number(m[1]);
  if (y < 1000) y += 1911;
  return `${y}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
}

const num = (v: unknown) => {
  const n = Number(String(v ?? "").replace(/[,\s$元NT]/g, ""));
  return Number.isFinite(n) ? n : 0;
};
const text = (v: unknown) => (v instanceof Date ? toDateStr(v) : String(v ?? "").trim());

/** 表格（標題列 + 資料列）→ 匯入列；沒有姓名也沒有電話的列略過 */
export function rowsFromTable(headers: string[], data: unknown[][]): ImportRow[] {
  const map = mapHeaders(headers);
  const get = (row: unknown[], f: Field) => (map[f] === undefined ? undefined : row[map[f]!]);
  return data
    .map((row): ImportRow => {
      const qty = num(get(row, "qty")) || 1;
      const amount = num(get(row, "amount"));
      return {
        key: uid("r"),
        company: text(get(row, "company")),
        name: text(get(row, "name")),
        phone: text(get(row, "phone")),
        address: text(get(row, "address")),
        date: normalizeDate(get(row, "date")),
        product: text(get(row, "product")),
        spec: text(get(row, "spec")),
        qty,
        unitPrice: num(get(row, "unitPrice")) || (amount ? Math.round(amount / qty) : 0),
      };
    })
    .filter((r) => r.name || r.phone);
}

/* ---------------- Word ---------------- */

const stripTags = (html: string) =>
  html
    .replace(/<br\s*\/?>/g, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();

function tablesFromHtml(html: string): string[][][] {
  return [...html.matchAll(/<table[^>]*>([\s\S]*?)<\/table>/g)].map((t) =>
    [...t[1].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map((r) =>
      [...r[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map((c) => stripTags(c[1])),
    ),
  );
}

const AI_ROW_SCHEMA = {
  type: "OBJECT",
  properties: {
    rows: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: Object.fromEntries(
          ["company", "name", "phone", "address", "date", "product", "spec", "qty", "unitPrice"].map((k) => [
            k,
            { type: k === "qty" || k === "unitPrice" ? "NUMBER" : "STRING" },
          ]),
        ),
        required: ["name", "phone", "product"],
      },
    },
  },
  required: ["rows"],
};

/** .docx：先找表格；沒有表格時（段落式紀錄）交給 AI 整理 */
export async function parseDocx(buffer: Buffer): Promise<{ rows: ImportRow[]; ai: boolean }> {
  let html: string;
  try {
    html = (await mammoth.convertToHtml({ buffer })).value;
  } catch {
    throw new HttpError(400, "無法讀取 Word 檔，請確認是 .docx 格式（舊版 .doc 請先用 Word 另存成 .docx）");
  }

  const rows = tablesFromHtml(html).flatMap((t) => (t.length > 1 ? rowsFromTable(t[0], t.slice(1)) : []));
  if (rows.length) return { rows, ai: false };

  const raw = (await mammoth.extractRawText({ buffer })).value.trim();
  if (!raw) throw new HttpError(400, "Word 檔沒有內容");
  if (!hasGemini()) {
    throw new HttpError(
      422,
      "這份 Word 沒有表格，需要 AI 整理文字內容：請在 .env.local 設定 GEMINI_API_KEY，或把紀錄整理成表格（第一列為欄位名稱）",
    );
  }
  const result = await geminiJson<{ rows: Omit<ImportRow, "key">[] }>(
    [
      {
        text: `以下是農場過去用 Word 記錄的客戶訂購資料。請整理成 rows 陣列，每一列是一位客戶的一項訂購產品：
company 公司、name 姓名、phone 電話、address 地址、date 訂購日期（YYYY-MM-DD，民國年請換算成西元）、product 產品、spec 規格、qty 數量、unitPrice 單價。
沒有寫的欄位用空字串或 0，不要自行編造。\n\n${raw.slice(0, 60_000)}`,
      },
    ],
    AI_ROW_SCHEMA,
  );
  return {
    rows: (result?.rows ?? []).map((r) => ({
      ...r,
      key: uid("r"),
      date: normalizeDate(r.date),
      qty: num(r.qty) || 1,
      unitPrice: num(r.unitPrice),
    })),
    ai: true,
  };
}

/* ---------------- Access MDB ---------------- */

export interface MdbTable {
  name: string;
  rowCount: number;
  /** 認得的欄位數，越高越像客戶訂單資料表 */
  score: number;
}

export function parseMdb(buffer: Buffer, tableName?: string): { rows: ImportRow[]; tables: MdbTable[]; table: string } {
  let reader: MDBReader;
  try {
    reader = new MDBReader(buffer);
  } catch {
    throw new HttpError(400, "無法讀取 MDB 檔，請確認是 Access 資料庫（.mdb / .accdb）");
  }
  const tables: MdbTable[] = reader.getTableNames().map((name) => {
    const t = reader.getTable(name);
    const map = mapHeaders(t.getColumnNames());
    const score = Object.keys(map).length + (map.name !== undefined || map.phone !== undefined ? 3 : 0);
    return { name, rowCount: t.rowCount, score };
  });
  tables.sort((a, b) => b.score - a.score);

  const table = tableName ?? tables[0]?.name;
  if (!table || !tables.some((t) => t.name === table)) throw new HttpError(400, "MDB 檔裡找不到資料表");
  const t = reader.getTable(table);
  const headers = t.getColumnNames();
  const data = t.getData().map((r) => headers.map((h) => r[h]));
  return { rows: rowsFromTable(headers, data), tables, table };
}

/* ---------------- 比對與寫入 ---------------- */

/** 標記電話相同的既有客戶 */
export async function markExisting(rows: ImportRow[]) {
  await connectDB();
  const digits = [...new Set(rows.map((r) => digitsOf(r.phone)).filter(Boolean))];
  const found = (await CustomerModel.find({ phoneDigits: { $in: digits } })
    .select("_id name phoneDigits")
    .lean()) as unknown as { _id: string; name: string; phoneDigits: string }[];
  const byPhone = new Map(found.map((c) => [c.phoneDigits, c]));
  return rows.map((r) => {
    const c = byPhone.get(digitsOf(r.phone));
    return c ? { ...r, existingId: c._id, existingName: c.name } : r;
  });
}

const orderKey = (date: string, i: { product: string; spec: string; qty: number }) => `${date}|${i.product}|${i.spec}|${i.qty}`;

/**
 * 寫入匯入資料：電話相同的合併到既有客戶，其餘依電話（沒有電話時依姓名）建立新客戶。
 * 同一位客戶已有相同日期、產品、規格、數量的訂購紀錄就略過，重複匯入同一個檔案不會重複。
 */
export async function commitImport(rows: ImportRow[], source: CustomerSource) {
  await connectDB();
  const groups = new Map<string, ImportRow[]>();
  for (const r of rows) {
    if (!r.name && !r.phone) continue;
    const k = digitsOf(r.phone) || `name:${r.name}`;
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }

  let newCustomers = 0;
  let merged = 0;
  let orders = 0;
  let skipped = 0;

  for (const [k, list] of groups) {
    const first = list[0];
    const doc = k.startsWith("name:") ? await CustomerModel.findOne({ name: first.name }) : await CustomerModel.findOne({ phoneDigits: k });
    const existing = (doc?.get("orders") as Order[] | undefined) ?? [];
    const seen = new Set(existing.flatMap((o) => o.items.map((i) => orderKey(o.date, i))));

    const newOrders: Order[] = [];
    for (const r of list) {
      const item = { product: r.product || "（未填產品）", spec: r.spec, qty: r.qty || 1, unitPrice: r.unitPrice };
      const date = r.date || today();
      if (seen.has(orderKey(date, item))) {
        skipped++;
        continue;
      }
      seen.add(orderKey(date, item));
      newOrders.push({ id: uid("o"), date, items: [item] });
    }
    orders += newOrders.length;

    if (doc) {
      if (!newOrders.length) continue;
      doc.set("orders", [...existing, ...newOrders]);
      // 舊資料缺的欄位順便補上
      for (const f of ["company", "address"] as const) if (!doc.get(f) && first[f]) doc.set(f, first[f]);
      await doc.save();
      merged++;
    } else {
      const c: Omit<Customer, "id"> & { _id: string } = {
        _id: uid("c"),
        company: first.company,
        name: first.name || "（未填姓名）",
        phone: first.phone || "（未填電話）",
        address: first.address,
        source,
        createdAt: today(),
        orders: newOrders,
      };
      await CustomerModel.create(c);
      newCustomers++;
    }
  }
  return { newCustomers, merged, orders, skipped };
}
