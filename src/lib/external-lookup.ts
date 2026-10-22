import { createHmac, timingSafeEqual } from "node:crypto";
import { CustomerModel } from "@/models/customer";
import { OrderModel } from "@/models/order";
import { HttpError } from "./api";
import { BRAND_LABELS } from "./enums";
import { connectDB } from "./mongodb";
import { escapeRegex } from "./repo";

function sameText(given: string, expected: string) {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** 通行證有效時間（秒） */
const TOKEN_TTL = 600;

/**
 * 給其他系統（甜柿訂購系統 kaki_order/quick_order.asp）查詢訂購者／收件者用，兩種驗證擇一：
 *  x-api-key：值等於環境變數 EXTERNAL_API_KEY（伺服器對伺服器）
 *  x-api-token：「UTC 秒數.簽章」，簽章＝HMAC-SHA256(EXTERNAL_API_KEY, "lookup:" + 秒數) 的 hex，10 分鐘內有效。
 *    甜柿主機（舊 Windows）連不上 Vercel 的 TLS，改由管理者瀏覽器帶主機簽發的通行證呼叫，金鑰不會傳到瀏覽器
 */
export function requireApiKey(req: Request) {
  const expected = process.env.EXTERNAL_API_KEY ?? "";
  if (!expected) throw new HttpError(503, "尚未設定 EXTERNAL_API_KEY");
  const key = req.headers.get("x-api-key");
  if (key !== null) {
    if (!sameText(key, expected)) throw new HttpError(401, "API key 錯誤");
    return;
  }
  const m = /^(\d{10})\.([0-9a-f]{64})$/.exec(req.headers.get("x-api-token") ?? "");
  if (!m) throw new HttpError(401, "API key 錯誤");
  const sig = createHmac("sha256", expected).update(`lookup:${m[1]}`).digest("hex");
  if (!sameText(m[2], sig)) throw new HttpError(401, "通行證錯誤");
  const age = Math.floor(Date.now() / 1000) - Number(m[1]);
  if (age > TOKEN_TTL || age < -60) throw new HttpError(401, "通行證已過期，請重新整理頁面");
}

/** 允許跨網域呼叫的網頁（甜柿訂購系統） */
const CORS_ORIGINS = ["http://www.ll3.com.tw", "http://ll3.com.tw", "https://www.ll3.com.tw", "https://ll3.com.tw"];

export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  if (!CORS_ORIGINS.includes(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "x-api-token",
    "Access-Control-Max-Age": "600",
    Vary: "Origin",
  };
}

const MAX_ORDERS = 30;
const MAX_CUSTOMERS = 50;

type Lean = Record<string, unknown>;

/**
 * 用姓名或電話查詢：比對客戶（姓名、電話）與訂單（訂購者、收件者的姓名或電話）。
 * 回傳最近的訂單（kind=order），以及查到但這些訂單裡沒有出現的客戶（kind=customer）。
 */
export async function externalLookup(q: string) {
  const term = q.trim();
  if (term.length < 2) throw new HttpError(400, "請輸入至少 2 個字的姓名或電話");
  await connectDB();

  const digits = term.replace(/\D/g, "");
  const isPhone = /^[\d\s\-()+#]+$/.test(term) && digits.length >= 6;
  // 訂單裡的電話有「0970-746-070」這種寫法：數字之間允許任何非數字字元
  const phoneRe = new RegExp(digits.split("").join("\\D*"));
  const nameRe = new RegExp(escapeRegex(term), "i");

  const customers = (await CustomerModel.find(
    isPhone ? { "phones.digits": new RegExp(escapeRegex(digits)) } : { name: nameRe },
  )
    .limit(MAX_CUSTOMERS)
    .lean()) as Lean[];
  const customerIds = customers.map((c) => c._id as string);

  const fieldConds = isPhone
    ? ["buyer.phone", "buyer.phone2", "shipments.recipient.phone", "shipments.recipient.phone2"].map((f) => ({ [f]: phoneRe }))
    : ["buyer.name", "shipments.recipient.name"].map((f) => ({ [f]: nameRe }));
  const orders = (await OrderModel.find({ $or: [...fieldConds, { customerId: { $in: customerIds } }] })
    .sort({ orderedAt: -1 })
    .limit(MAX_ORDERS)
    .select("orderNo channel brand season customerId buyer orderedAt items extras shipments payment amounts note")
    .lean()) as Lean[];

  const names = new Map(customers.map((c) => [c._id as string, c.name as string]));
  const missing = [...new Set(orders.map((o) => o.customerId as string).filter((id) => !names.has(id)))];
  if (missing.length) {
    for (const c of (await CustomerModel.find({ _id: { $in: missing } }).select("name").lean()) as Lean[]) {
      names.set(c._id as string, c.name as string);
    }
  }

  const orderResults = orders.map((o) => {
    const shipments = (o.shipments ?? []) as Lean[];
    const first = shipments[0] ?? {};
    const payment = (o.payment ?? {}) as Lean;
    const amounts = (o.amounts ?? {}) as Lean;
    const brand = (o.brand ?? "") as keyof typeof BRAND_LABELS;
    return {
      kind: "order" as const,
      orderNo: o.orderNo,
      orderedAt: o.orderedAt,
      channel: o.channel,
      brand,
      brandLabel: BRAND_LABELS[brand] ?? "",
      customer: { id: o.customerId, name: names.get(o.customerId as string) ?? "" },
      buyer: o.buyer ?? {},
      recipient: first.recipient ?? {},
      deliverySlot: first.deliverySlot ?? "",
      shipmentCount: shipments.length,
      items: ((o.items ?? []) as Lean[]).map((i) => ({ sku: i.sku, product: i.product, spec: i.spec, qty: i.qty, unitPrice: i.unitPrice })),
      extras: ((o.extras ?? []) as Lean[]).map((e) => ({ name: e.name, desc: e.desc, amount: e.amount })),
      paymentMethod: payment.method ?? "",
      total: amounts.total ?? 0,
      note: o.note ?? "",
    };
  });

  const inOrders = new Set(orders.map((o) => o.customerId as string));
  const customerResults = customers
    .filter((c) => !inOrders.has(c._id as string))
    .map((c) => ({
      kind: "customer" as const,
      customer: {
        id: c._id,
        name: c.name,
        gender: c.gender ?? "",
        phones: ((c.phones ?? []) as Lean[]).map((p) => p.number),
        emails: c.emails ?? [],
        addresses: ((c.addresses ?? []) as Lean[]).map((a) => ({ zip: a.zip ?? "", address: a.address })),
        invalid: !!c.invalid,
      },
    }));

  return { query: term, results: [...orderResults, ...customerResults] };
}
