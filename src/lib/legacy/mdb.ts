import MDBReader from "mdb-reader";
import { HttpError } from "../api";
import type { Brand, OrderItem, OrderStatus, Package, PaymentMethod, PaymentStatus, Product } from "../types";
import { decodeEntities, digitsOf, localDateTime, pad, seasonOf, toPhone } from "./normalize";
import type { ImportOrder, ParseResult } from "./types";

type Row = Record<string, unknown>;

const BRAND_CODE: Record<Exclude<Brand, "">, string> = { donald: "BO", kaki: "KA", bigfarm: "BF" };

export function brandOfFile(fileName: string): Exclude<Brand, ""> {
  if (/kaki/i.test(fileName)) return "kaki";
  if (/bigfarm/i.test(fileName)) return "bigfarm";
  return "donald";
}

/** 開站前的測試訂單、與其他檔案完全重複的備份檔，不匯入 */
export const EXCLUDED_MDB = [/^20060331donald_products\.mdb$/i, /^kaki\.mdb\.\d+$/i, /guestbook/i];

const PAY_METHOD: Record<string, PaymentMethod> = { 貨到付款: "貨到付款", 刷卡繳費: "信用卡", 匯款或ATM轉帳: "ATM轉帳" };

const STATUS: Record<string, OrderStatus> = {
  已送出貨品: "已出貨",
  訂購者取消此筆訂單: "已取消",
  "新訂單---等待處理": "新訂單",
  訂單等待處理: "新訂單",
  處理訂單中: "處理中",
};

/** 駭客掃描網站留下的 SQL injection 垃圾資料 */
const JUNK = /('|")\s*(AND|OR|XOR)\b|\bsleep\s*\(|\bSELECT\b|\bwaitfor\b|\|\||\d+\s*[+-]\s*\d+\s*-\s*\d+\s*=|--\s*$/i;

/** 舊產品代碼 → 品項與規格（產品表查不到時使用） */
function specFromSku(sku: string): { product: string; spec: string; pieces: number } | null {
  const bo = /^BO-N00([1-5])$/.exec(sku);
  if (bo) {
    const pieces = [12, 10, 8, 6, 5][Number(bo[1]) - 1];
    return { product: "水蜜桃", spec: `${pieces}粒裝`, pieces };
  }
  const ka = /^KA-N0*(\d+)$/.exec(sku);
  if (ka) return { product: "甜柿", spec: `${Number(ka[1])}粒裝`, pieces: Number(ka[1]) };
  const peach = /^PEACH-0*(\d+)$/.exec(sku);
  if (peach) return { product: "水蜜桃", spec: `${Number(peach[1])}粒裝`, pieces: Number(peach[1]) };
  return null;
}

const stripHtml = (s: unknown) =>
  decodeEntities(s)
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .trim();

/** 讀取一個舊網站 MDB，轉成訂單與產品 */
export function parseMdb(buffer: Buffer, fileName: string): ParseResult {
  let reader: MDBReader;
  try {
    reader = new MDBReader(buffer);
  } catch {
    throw new HttpError(400, `無法讀取 ${fileName}，請確認是 Access 資料庫（.mdb）`);
  }
  const tables = new Set(reader.getTableNames());
  if (!tables.has("Order_Nm") || !tables.has("Order_Ns")) {
    throw new HttpError(400, `${fileName} 不是舊網站的訂單資料庫（找不到 Order_Nm / Order_Ns 資料表）`);
  }
  const read = (t: string): Row[] => (tables.has(t) ? (reader.getTable(t).getData() as Row[]) : []);
  const byOrder = (rows: Row[]) => {
    const m = new Map<number, Row[]>();
    for (const r of rows) m.set(Number(r.orderid), [...(m.get(Number(r.orderid)) ?? []), r]);
    return m;
  };

  const brand = brandOfFile(fileName);
  const orderRows = read("Order_Nm");
  const itemsByOrder = byOrder(read("Order_Ns"));
  const sudaByOrder = byOrder(read("Order_Suda"));
  const extrasByOrder = byOrder(read("Order_Extra"));
  const reportsByOrder = byOrder(read("Pay_Report"));
  const payStatus = new Map(read("Pay_Status").map((r) => [Number(r.orderid), String(r.status)]));
  const shipAdj = new Map(read("Order_ExtraShip").map((r) => [Number(r.orderid), Number(r.ship_adj) || 0]));

  // 產品表：用來把產品代碼轉成品項、規格
  const productRows = read("product");
  const catalog = new Map(productRows.map((p) => [String(p.productid), p]));

  const skipped = new Map<string, number>();
  const skip = (reason: string, n = 1) => skipped.set(reason, (skipped.get(reason) ?? 0) + n);
  const orderIds = new Set(orderRows.map((o) => Number(o.orderid)));
  for (const k of itemsByOrder.keys()) if (!orderIds.has(k)) skip("明細找不到對應訂單（訂單已刪除）", itemsByOrder.get(k)!.length);

  const orders: ImportOrder[] = [];
  let firstSeason = 0;

  for (const o of orderRows) {
    const orderid = Number(o.orderid);
    const orderedAt = localDateTime(o.time);
    const rawMethod = String(o.paymethod ?? "").trim();
    const text = [o.username, o.addr, rawMethod, o.e_mail].map(String).join(" ");
    if (!orderedAt || JUNK.test(text)) {
      skip("攻擊或無效的垃圾訂單");
      continue;
    }

    const items: OrderItem[] = [];
    for (const it of itemsByOrder.get(orderid) ?? []) {
      const sku = String(it.prono ?? "").trim();
      if (!/^[A-Z]+-[A-Z]?\d+$/.test(sku)) {
        skip("無效的明細（產品代碼異常）");
        continue;
      }
      const p = catalog.get(sku);
      const fallback = specFromSku(sku);
      const pieces = Number(/(\d+)\s*粒/.exec(String(p?.productname ?? ""))?.[1]) || fallback?.pieces;
      items.push({
        sku,
        product: String(p?.kind ?? fallback?.product ?? sku),
        spec: pieces ? `${pieces}粒裝` : String(p?.productname ?? ""),
        qty: Number(it.qty) || 0,
        unitPrice: Number(it.dis_price) || 0,
        subtotal: 0,
      });
    }
    if (!items.length) {
      skip("沒有有效明細的訂單");
      continue;
    }

    const season = seasonOf(orderedAt, brand);
    firstSeason ||= season;
    const status = STATUS[String(o.schedule ?? "").trim()] ?? "新訂單";
    const method = PAY_METHOD[rawMethod] ?? "其他";
    const codFee = method === "貨到付款" ? Number(o.paymoney) || 0 : 0;

    let payStatusValue: PaymentStatus = "未付款";
    if (status === "已取消") payStatusValue = "未付款";
    else if (payStatus.get(orderid) === "ok" || method === "信用卡") payStatusValue = "已付款";
    else if (method === "貨到付款") payStatusValue = status === "已出貨" ? "貨到收款" : "未付款";
    else if (method === "ATM轉帳") payStatusValue = status === "已出貨" ? "已付款" : "待匯款";

    const phones = [toPhone(o.phone), toPhone(o.phone2)].filter(
      (p, i, a) => p && a.findIndex((x) => x?.digits === p.digits) === i,
    ) as NonNullable<ReturnType<typeof toPhone>>[];
    const name = decodeEntities(o.username);
    const zip = digitsOf(o.zip).slice(0, 6);
    const address = decodeEntities(o.addr);
    const processedAt = localDateTime(o.processtime);

    const packages: Package[] = (sudaByOrder.get(orderid) ?? []).map((s) => ({
      trackingNo: String(s.obt ?? ""),
      boxes: Number(s.boxes) || 0,
      collectAmount: Number(s.collection) || 0,
      labelUrl: "",
      printedAt: localDateTime(s.printtime),
    }));
    if (!packages.length && o.suda_obt) {
      packages.push({
        trackingNo: String(o.suda_obt),
        boxes: 0,
        collectAmount: 0,
        labelUrl: "",
        printedAt: localDateTime(o.suda_printtime),
      });
    }

    orders.push({
      orderNo: `W-${BRAND_CODE[brand]}-${season}-${pad(orderid, 4)}`,
      channel: "網站",
      brand,
      season,
      buyer: {
        name,
        phone: phones[0]?.number ?? String(o.phone ?? ""),
        phone2: phones[1]?.number ?? "",
        email: String(o.e_mail ?? "")
          .trim()
          .toLowerCase(),
        gender: o.sex === "F" ? "F" : o.sex === "M" || o.sex === "male" ? "M" : "",
      },
      referrer: "",
      orderedAt,
      items,
      extras: (extrasByOrder.get(orderid) ?? []).map((e) => ({
        name: String(e.item_name ?? ""),
        desc: String(e.item_desc ?? ""),
        amount: Number(e.amount) || 0,
      })),
      shipments: [
        {
          id: "s1",
          recipient: { name, phone: phones[0]?.number ?? "", phone2: phones[1]?.number ?? "", zip, address },
          items: items.map((i) => ({ sku: i.sku, product: i.product, spec: i.spec, qty: i.qty })),
          deliverySlot: (["早上08~12點", "中午12~18點", "晚上18~22點"] as const).find((s) => s === o.arrtime) ?? "",
          requestedShipDate: "",
          shippedAt: status === "已出貨" ? processedAt : "",
          carrier: packages.length ? "速達（黑貓）" : "",
          packages,
          status: status === "已出貨" ? "已出貨" : "待出貨",
        },
      ],
      payment: {
        method,
        status: payStatusValue,
        codFee,
        paidAmount: 0,
        paidAt: "",
        reports: (reportsByOrder.get(orderid) ?? []).map((r) => ({
          text: String(r.report_text ?? ""),
          photoUrl: "",
          reportedAt: localDateTime(r.reported),
        })),
      },
      amounts: { items: 0, extras: 0, codFee, shipping: 0, adjust: shipAdj.get(orderid) ?? 0, total: 0 },
      status,
      processedAt,
      note: decodeEntities(o.memo),
      internalNote: method === "其他" ? `原付款方式：${rawMethod}` : "",
      legacy: {
        source: "mdb",
        file: fileName,
        key: `mdb:${brand}:${orderid}:${orderedAt}`,
        parsedBy: "rule",
        // 網站資料是結構化的，只有數量明顯異常（例如 1111 盒）才需要確認
        needsReview: items.some((i) => i.qty > 100),
        reviewReasons: items.some((i) => i.qty > 100) ? ["數量異常（超過 100 盒）"] : [],
      },
      customerHint: {
        name,
        gender: o.sex === "F" ? "F" : o.sex === "M" || o.sex === "male" ? "M" : "",
        phones,
        emails: [
          String(o.e_mail ?? "")
            .trim()
            .toLowerCase(),
        ].filter((e) => /@/.test(e)),
        address: address ? { zip, address, lastUsedAt: orderedAt } : undefined,
        source: "網站",
      },
    });
  }

  // 產品：價格記在這個檔案的產季
  const products: Product[] = productRows
    .filter((p) => /^[A-Z]+-[A-Z]?\d+$/.test(String(p.productid)))
    .map((p) => {
      const sku = String(p.productid);
      const fallback = specFromSku(sku);
      const pieces = Number(/(\d+)\s*粒/.exec(String(p.productname))?.[1]) || fallback?.pieces || undefined;
      const category = String(p.kind ?? fallback?.product ?? "");
      return {
        id: sku,
        brand,
        category,
        name: String(p.productname).includes(category) ? String(p.productname) : `${category}-${p.productname}`,
        spec: pieces ? `${pieces}粒裝` : "",
        pieces,
        weight: stripHtml(p.note02),
        description: stripHtml([p.note01, p.memo].filter(Boolean).join("；")),
        prices: firstSeason ? [{ season: firstSeason, listPrice: Number(p.oriprice) || 0, salePrice: Number(p.newprice) || 0 }] : [],
        active: true,
      };
    });

  return { orders, products, skipped: [...skipped].map(([reason, count]) => ({ reason, count })) };
}
