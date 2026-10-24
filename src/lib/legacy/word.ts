import mammoth from "mammoth";
import { HttpError } from "../api";
import type { OrderChannel, OrderItem, PaymentMethod, PaymentStatus, Phone, Shipment } from "../types";
import { pad, toNumber, toPhone } from "./normalize";
import type { ImportOrder, ParseResult } from "./types";

/** 產季價格表：查不到單價時，用同產季網站售價估算 */
export type PriceLookup = (product: string, pieces: number, season: number) => number | undefined;

const NUM = "[0-9一ㄧ二兩三四五六七八九十]+";
const PRODUCTS = ["水蜜桃乾", "水蜜桃", "甜柿", "柿餅", "蜜蘋果", "甘露", "李子", "果醬", "高麗菜"];
const MAIN_PIECES = new Set([5, 6, 8, 10, 12]);

const PHONE_RE = /\(?0\d{1,3}\)?[\s-]?\d{3,4}[\s-]?\d{3,4}(?:#\d+)?|09\d{2}[\s-]?\d{3}[\s-]?\d{3}/g;
const LABEL_RE =
  /^(?:\d\.\s*)?(姓名|收件人|寄送人姓名|訂購人|聯絡人|電話|聯絡電話|手機|地址|寄送地址|收件地址|聯絡地址|送貨地點|備註)\s*[:：]?\s*/;
const ADDRESS_RE = /([一-鿿]{1,3}[縣市]).*(路|街|巷|弄|號|村|里|段|鄰)/;
const NOT_NAME =
  /寄|盒|粒|顆|裝|付款|匯款|收款|轉帳|運費|現場|宅配|^line|待|已|一共|費用|\d\s*元|送達|出貨|\d\s*[包箱斤]|[*×=]|\d\s*[xX]\s*\d|更正|改送|以上|備註|合計|總計|共計|水蜜桃|甜柿|柿餅|蜜蘋果|李子|蜜李|果乾|果醬|高麗菜|^(紅|黃|白)色?$|^小翠單$|單$/i;
/** 「谷英歌 (蔡旭昌訂)」「許安豪 (林永銘寄)」「蘇德智 (寄件人吳晟宇)」：括號裡是訂購者，可能接著電話 */
const BUYER_PAREN_RE =
  /[(（]\s*(?:寄件人\s*[:：]?\s*([^()（）\d]{1,12}?)|([^()（）\d]{1,12}?)\s*(?:指送|代訂|寄|訂|送|贈))\s*([^()（）]*)[)）]/;
/** 訂購者自成一行：「陳宥蓁寄（…）0918763260」「寄件人:周進達(TEL:…)」「（訂購人：潘森榮 電話：…）」「曾國展指送」 */
const BUYER_LINE_RES = [
  /^[(（]?\s*(?:訂購人|寄件人)\s*[:：]?\s*([^\s:：,，(（)）\d]{1,20})(.*)$/,
  /^([^\s\d:：,，(（]{1,8}?)(?:指送|代訂)(.*)$/,
  /^([^\s\d:：,，(（]{1,8}?)(?:寄|訂)(?![出送件單購])(.*\d{7,}.*)$/,
  // 段落開頭只寫「電話蔡旭昌訂」「林永銘寄」
  /^(?:電話|LINE|line)?\s*([^\s\d:：,，(（]{2,8}?)(?:寄|訂)()$/,
];
const NOT_BUYER = /補|再|已|請|麻煩|改|待|毀損|星期|電話|姓名|收件|地址|現場|今天|明天|一起|先|幫/;

interface Buyer {
  name: string;
  phones: Phone[];
}

function phonesIn(line: string): Phone[] {
  return [...line.matchAll(PHONE_RE)].map((m) => toPhone(m[0])).filter((p): p is Phone => !!p);
}

function buyerOf(name: string | undefined, rest: string): Buyer | null {
  // 「寄件人：黃寶春寄」「寄件人著名（註明）吳晟宇」
  const n = (name ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^(?:請?註明|著名)/, "")
    .replace(/(?:寄|訂|收)$/, "")
    .trim();
  if (!n || NOT_BUYER.test(n) || !/[一-鿿A-Za-z]/.test(n)) return null;
  return { name: n, phones: phonesIn(rest) };
}

/** 括號裡的訂購者（後面只能接電話，「毀損補寄2盒」這類不算） */
function buyerInParen(line: string): { buyer: Buyer; match: string } | null {
  const m = BUYER_PAREN_RE.exec(line);
  if (!m || m[3].replace(PHONE_RE, "").replace(/TEL[:：]?|[\s:：,，]/gi, "")) return null;
  const buyer = buyerOf(m[1] ?? m[2], m[3]);
  return buyer ? { buyer, match: m[0] } : null;
}

/** 整行都在講訂購者 */
function buyerLine(line: string): Buyer | null {
  for (const re of BUYER_LINE_RES) {
    const m = re.exec(line);
    if (m) return buyerOf(m[1], m[2]);
  }
  return null;
}

/** 地址行裡「號／樓」之後的文字，可能接著寫規格 */
function afterAddress(line: string) {
  const m = /^(.*?(?:號|樓|室)(?:之\d+)?)(.*)$/.exec(line);
  return m && /\d/.test(m[2]) ? m[2] : "";
}

function isAddress(line: string) {
  const l = line.replace(LABEL_RE, "");
  return ADDRESS_RE.test(l) && l.length >= 6 && phonesIn(l).length === 0;
}

function splitAddress(line: string) {
  const l = line.replace(LABEL_RE, "").replace(/^\d\.\s*/, "");
  const zip = /^(\d{3,6})\s*/.exec(l)?.[1] ?? "";
  const rest = l.slice(zip.length).trim();
  const cut = rest.search(/[（(]/);
  return { zip, address: (cut > 0 ? rest.slice(0, cut) : rest).trim(), extra: cut > 0 ? rest.slice(cut) : "" };
}

/** 姓名行：有標籤的直接取；沒有標籤時，取不像規格／付款的短句（同一行的電話、規格先拿掉，例如「巫先生 0979…」「陳美惠5斤×1」） */
function nameOf(line: string): { name: string; buyer?: Buyer } | null {
  if (isAddress(line) || buyerLine(line)) return null;
  const inParen = buyerInParen(line);
  const labeled = /^(?:[一二三四五六七八九十]、|\d\.\s*)?(姓名|收件人|寄送人姓名|聯絡人)\s*[:：]?\s*(.+)$/.exec(
    inParen ? line.replace(inParen.match, " ") : line,
  );
  let text = (labeled ? labeled[2] : inParen ? line.replace(inParen.match, " ") : line)
    .replace(PHONE_RE, " ")
    .replace(/[（(]\s*[)）]/g, "");
  // 姓名後面接著規格：「陳美惠5斤×1」
  text = text
    .replace(/\s*\d+\s*(斤|粒|顆|入|[xX×*]).*$/, "")
    .replace(/[”"、，,:：]+$/g, "")
    .trim();
  if (!labeled && (/\d/.test(text) || NOT_NAME.test(text) || text.length > 20)) return null;
  text = text
    .replace(/[(（][^)）]*[)）]/g, "")
    .replace(/(先生|小姐)?收$/, "$1")
    .replace(/[”"、，,:：\s]+$/g, "")
    .trim();
  if (!text || !/[一-鿿A-Za-z]/.test(text)) return null;
  return { name: text, buyer: inParen?.buyer };
}

interface ParsedItem {
  product: string;
  pieces?: number;
  spec: string;
  qty: number;
  unitPrice?: number;
}

/** 從一行文字找出品項：8粒裝*2盒、6粒的10盒、10x6盒、六粒水蜜桃 5盒*680、一盒10粒裝、李子3盒… */
function itemsIn(line: string, defaultProduct: string): ParsedItem[] {
  const l = line.replace(LABEL_RE, "");
  const product = PRODUCTS.find((p) => l.includes(p) && p !== "水蜜桃乾") ?? defaultProduct;
  const out: ParsedItem[] = [];
  const add = (pieces: number, qty: number, unitPrice?: number) => {
    // 盒數超過 100 多半是把單價誤當成盒數（例如「6粒裝x450」）
    if (pieces > 0 && qty > 0 && qty <= 100) out.push({ product, pieces, spec: `${pieces}粒裝`, qty, unitPrice });
  };

  // 「下量水蜜桃60盒（ㄧ盒12粒裝/300元）」：括號裡是每盒規格與單價
  const perBox = /[一ㄧ]盒\s*(\d+)\s*[粒顆]裝?\s*\/\s*(\d+)\s*元/.exec(l);
  if (perBox) {
    const qty = Number(/(\d+)\s*盒/.exec(l.replace(perBox[0], ""))?.[1]);
    add(Number(perBox[1]), qty || 1, Number(perBox[2]));
    return out;
  }
  // 8粒裝600*4盒、10粒裝550.-x6盒：粒數、單價、盒數
  for (const m of l.matchAll(/(\d{1,2})\s*[粒顆]裝?\s*\$?(\d{3,4})[.\-元]*\s*[*xX×]\s*(\d{1,3})(?!\d)/g))
    add(Number(m[1]), Number(m[3]), Number(m[2]));
  if (out.length) return out;
  // 13盒(8粒裝)x650元
  for (const m of l.matchAll(/(\d{1,3})\s*盒\s*[(（]\s*(\d{1,2})\s*[粒顆]裝?\s*[)）](?:\s*[*xX×]\s*(\d{3,4}))?/g))
    add(Number(m[2]), Number(m[1]), m[3] ? Number(m[3]) : undefined);
  if (out.length) return out;
  // 一盒10粒裝、兩盒八粒的 → 盒數在前
  for (const m of l.matchAll(new RegExp(`(${NUM})\\s*盒\\s*(${NUM})\\s*[粒顆]`, "g"))) add(toNumber(m[2]), toNumber(m[1]));
  if (out.length) return out;
  // 10入2箱
  for (const m of l.matchAll(/(\d{1,2})\s*入\s*(\d{1,3})\s*[箱盒]/g)) add(Number(m[1]), Number(m[2]));
  if (out.length) return out;
  // 5斤×2、（3斤）×1：以重量計的箱子
  for (const m of l.matchAll(/(\d{1,2})\s*斤\s*[)）]?\s*[*xX×]\s*(\d{1,3})(?!\d)/g))
    out.push({ product, spec: `${m[1]}斤`, qty: Number(m[2]) });
  if (out.length) return out;

  // 8粒裝*2盒、6粒的10盒、六粒水蜜桃 5盒*680、8顆裝：1盒
  const re = new RegExp(
    `(${NUM})\\s*[粒顆](?:裝)?(?:的)?\\s*(?:${PRODUCTS.join("|")})?\\s*[*xX×：:，,、]?\\s*(${NUM})\\s*(?:盒|箱)?(?:\\s*[*xX×]\\s*(\\d{3,4}))?`,
    "g",
  );
  for (const m of l.matchAll(re)) add(toNumber(m[1]), toNumber(m[2]), m[3] ? Number(m[3]) : undefined);
  if (out.length) return out;

  // 10x6盒、6*1、甜柿5x4（前面是粒數，後面是盒數；800*4 這種是單價，不算）
  for (const m of l.matchAll(/(?<![\d.])(\d{1,2})\s*[xX*×]\s*(\d{1,3})(?![\d.])/g)) {
    const pieces = Number(m[1]);
    if (MAIN_PIECES.has(pieces)) add(pieces, Number(m[2]));
  }
  if (out.length) return out;

  // 其他品項：李子3盒、水蜜桃乾黃肉的2包、紅色14包
  for (const [p, alias] of [
    ["水蜜桃乾", "水蜜桃乾"],
    ["李子", "李子|蜜李|密李"],
    ["果醬", "果醬"],
    ["高麗菜", "高麗菜"],
    ["柿餅", "柿餅"],
  ]) {
    const m = new RegExp(`(?:${alias})[^\\d一ㄧ二兩三四五六七八九十]{0,6}(${NUM})\\s*(盒|包|箱|串|斤|罐|顆)?`).exec(l);
    if (m && toNumber(m[1]) > 0 && toNumber(m[1]) <= 100) out.push({ product: p, spec: m[2] ?? "", qty: toNumber(m[1]) });
  }
  return out;
}

/**
 * 金額：收集「= 數字」與「付款／合計 數字」；有好幾個候選時（例如一次付好幾張訂單的錢），
 * 取最接近品項金額的那個，沒有品項金額時取最後一個
 */
function totalOf(lines: string[], itemsSum: number): number | undefined {
  const num = (s: string) => Number(s.replace(/,/g, ""));
  const found: number[] = [];
  lines.forEach((l, i) => {
    // 「=」後面換行才寫金額：「650×2+290\n=1590」
    const text = /[=＝]\s*$/.test(l) && lines[i + 1] ? l + lines[i + 1] : l;
    for (const m of text.matchAll(/[=＝]\s*([\d,]{3,})/g)) found.push(num(m[1]));
    const pay = /(?:付款|匯款|收款|轉帳|付清|一共|共計|總計|合計|已收|現場收款|已收到)[^\d]{0,6}([\d,]{3,})(?!\s*[*xX×+])/.exec(l);
    if (pay && !/[=＝]/.test(l)) found.push(num(pay[1]));
  });
  const valid = found.filter((n) => n > 0 && n < 1_000_000);
  if (!valid.length) return undefined;
  if (itemsSum > 0) return valid.reduce((best, n) => (Math.abs(n - itemsSum) < Math.abs(best - itemsSum) ? n : best));
  return valid.at(-1);
}

function paymentOf(text: string, shipped: boolean): { method: PaymentMethod; status: PaymentStatus } {
  const method: PaymentMethod = /貨到/.test(text)
    ? "貨到付款"
    : /ATM|匯款|轉帳|匯/.test(text)
      ? "ATM轉帳"
      : /刷卡|信用卡/.test(text)
        ? "信用卡"
        : /現場|現金/.test(text)
          ? "現金"
          : "";
  let status: PaymentStatus = "未付款";
  if (/(已|有)\s*(收|付|匯|轉)|付清|收到|現場收款|現場已收/.test(text)) status = "已付款";
  else if (/待\s*(匯|付|確認|結清)|未付/.test(text)) status = "待匯款";
  else if (method === "貨到付款" && shipped) status = "貨到收款";
  return { method, status };
}

/** 訂單 20250526.docx → 2025-05-26 */
function fileDate(fileName: string) {
  const m = /(\d{4})(\d{2})(\d{2})/.exec(fileName);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : "";
}

/** 讀取一個電話訂單 Word 檔：依分隔線切開，每一筆用規則解析，解析不確定的標記待確認 */
export async function parseWordOrders(buffer: Buffer, fileName: string, priceOf?: PriceLookup, today = new Date()): Promise<ParseResult> {
  let raw: string;
  try {
    raw = (await mammoth.extractRawText({ buffer })).value;
  } catch {
    throw new HttpError(400, `無法讀取 ${fileName}，請確認是 .docx 格式（舊版 .doc 請先另存成 .docx）`);
  }
  const date = fileDate(fileName);
  if (!date) throw new HttpError(400, `檔名要包含日期，例如「訂單 20250526.docx」，用來判斷產季年份`);
  const year = Number(date.slice(0, 4));
  const todayStr = today.toISOString().slice(0, 10);

  const blocks = raw
    .split(/-{5,}/)
    .map((b) =>
      b
        .split(/\n+/)
        .map((l) => l.replace(/\s+/g, " ").trim())
        .filter(Boolean),
    )
    .filter((b) => b.length > 0);

  const orders: ImportOrder[] = [];
  let skippedEmpty = 0;

  blocks.forEach((lines, index) => {
    const text = lines.join("\n");
    const allPhones = phonesIn(text);
    const addrIdx = lines.map((l, i) => (isAddress(l) ? i : -1)).filter((i) => i >= 0);
    if (!allPhones.length && !addrIdx.length) {
      skippedEmpty++;
      return;
    }

    // 寄出日期（年份取自檔名）
    const shipM = lines
      .map((l) => (isAddress(l) ? null : /(?<![\d/])(\d{1,2})\/(\d{1,2})(?![\d/])/.exec(l)))
      .find((m) => m && Number(m[1]) <= 12 && Number(m[2]) <= 31);
    // 一個檔案是一整個產季（5 月水蜜桃到隔年春天甜柿），月份比檔案早的是隔年
    const fileMonth = Number(date.slice(5, 7));
    const shipMonth = shipM ? Number(shipM[1]) : 0;
    const shipDate = shipM ? `${shipMonth < fileMonth - 1 ? year + 1 : year}-${pad(shipMonth)}-${pad(Number(shipM![2]))}` : "";
    const month = Number((shipDate || date).slice(5, 7));
    const defaultProduct = month >= 9 || month <= 3 ? "甜柿" : "水蜜桃";
    const season = year;

    // 通路與 LINE 名稱
    const lineLine = lines.find((l) => /^line\s*\S/i.test(l));
    const lineName =
      lineLine
        ?.replace(/^line\s*/i, "")
        .replace(/[(（].*$/, "")
        .trim() ?? "";
    const channel: OrderChannel = /^現場$|現場購買|現場收款|現場已/m.test(text) ? "現場" : lineLine ? "LINE" : "電話";

    // 依收件地址切成幾個收件人。
    // 先寫地址再寫姓名的寫法：每個地址就是一位收件人的開始；
    // 先寫姓名的寫法：地址之後出現新的姓名行，就是下一位收件人的開始
    const firstName = lines.findIndex((l) => l !== lineLine && !!nameOf(l));
    const addressFirst = addrIdx.length > 1 && (firstName < 0 || addrIdx[0] < firstName);
    const starts = [0];
    for (let k = 1; k < addrIdx.length; k++) {
      if (addressFirst) {
        starts.push(addrIdx[k]);
        continue;
      }
      let s = addrIdx[k];
      for (let i = addrIdx[k - 1] + 1; i < addrIdx[k]; i++) {
        if (lines[i] !== lineLine && nameOf(lines[i])) {
          s = i;
          break;
        }
      }
      starts.push(s);
    }
    const segments = starts.map((s, k) => lines.slice(s, starts[k + 1] ?? lines.length));

    // 訂購者：獨立一行寫的（通常附電話）優先，其次是收件人姓名後面括號裡的
    const lineBuyer = lines.map(buyerLine).find(Boolean) ?? null;
    const parenBuyers: Buyer[] = [];
    const shipments: Shipment[] = segments.map((seg, k) => {
      const nameHit = seg
        .filter((l) => l !== lineLine && !/^現場$/.test(l))
        .map(nameOf)
        .find(Boolean);
      if (nameHit?.buyer) parenBuyers.push(nameHit.buyer);
      const addrLine = seg.find(isAddress);
      const addr = addrLine ? splitAddress(addrLine) : { zip: "", address: "", extra: "" };
      // 訂購者那一行、括號裡的電話是訂購者的，不算收件人
      const ph = phonesIn(
        seg
          .filter((l) => !buyerLine(l))
          .map((l) => {
            const b = buyerInParen(l);
            return b ? l.replace(b.match, " ") : l;
          })
          .join("\n"),
      );
      const items = seg.flatMap((l) => itemsIn(isAddress(l) ? afterAddress(l) : l, defaultProduct));
      return {
        id: `s${k + 1}`,
        recipient: {
          name: nameHit?.name ?? "",
          phone: ph.find((p) => p.type === "手機")?.number ?? ph[0]?.number ?? "",
          phone2: ph.find((p) => p.type === "市話" && p.number !== ph[0]?.number)?.number ?? "",
          zip: addr.zip,
          address: addr.address,
        },
        items: items.map((i) => ({ product: i.product, spec: i.spec, qty: i.qty })),
        deliverySlot: "",
        requestedShipDate: shipDate,
        shippedAt: "",
        carrier: "",
        packages: [],
        status: shipDate && shipDate < todayStr ? "已出貨" : "待出貨",
      };
    });

    // 訂單品項：各收件人的品項合併（同品項同規格加總）
    const parsed = segments.flatMap((seg) => seg.flatMap((l) => itemsIn(isAddress(l) ? afterAddress(l) : l, defaultProduct)));
    const merged = new Map<string, ParsedItem>();
    for (const it of parsed) {
      const k = `${it.product}|${it.spec}`;
      const cur = merged.get(k);
      merged.set(k, cur ? { ...cur, qty: cur.qty + it.qty, unitPrice: cur.unitPrice ?? it.unitPrice } : { ...it });
    }
    // 「800*4」「1000x2」這種 單價*盒數：盒數相同的品項用這個單價
    const priceHints = [...text.matchAll(/(?<!\d)(\d{3,4})\s*[*xX×]\s*(\d{1,3})(?!\d)/g)].map((m) => ({
      price: Number(m[1]),
      qty: Number(m[2]),
    }));
    let estimated = false;
    const items: OrderItem[] = [...merged.values()].map((it) => {
      // 每個「單價*盒數」只用一次，依出現順序對應品項
      const hint = it.unitPrice ? undefined : priceHints.find((h) => h.qty === it.qty);
      if (hint) priceHints.splice(priceHints.indexOf(hint), 1);
      let unitPrice = it.unitPrice ?? hint?.price;
      if (!unitPrice && it.pieces && priceOf) {
        unitPrice = priceOf(it.product, it.pieces, season);
        if (unitPrice) estimated = true;
      }
      return { product: it.product, spec: it.spec, qty: it.qty, unitPrice: unitPrice ?? 0, subtotal: 0 };
    });

    const itemsSum = items.reduce((s, i) => s + i.qty * i.unitPrice, 0);
    const total = totalOf(lines, itemsSum);
    const diff = total !== undefined ? total - itemsSum : 0;
    const shipped = !!shipDate && shipDate < todayStr;
    const pay = paymentOf(text, shipped);

    const reasons: string[] = [];
    if (!allPhones.length) reasons.push("沒有電話");
    if (!addrIdx.length) reasons.push("沒有地址");
    if (!items.length) reasons.push("看不出品項");
    if (shipments.length > 1) reasons.push(`${shipments.length} 個收件地址`);
    if (total !== undefined && items.length && (diff < 0 || diff > 1000)) reasons.push("金額與品項對不起來");
    // 以下只是提示，不需要人工確認
    if (total === undefined) reasons.push("提示：沒寫金額");
    if (estimated) reasons.push("提示：單價依網站售價估算");

    const first = shipments[0].recipient;
    // 括號寫的訂購者，若另一行有寫同一人的電話就合起來
    const parenBuyer = parenBuyers[0] ?? null;
    let buyer: Buyer | null = parenBuyer ?? lineBuyer;
    if (parenBuyer && lineBuyer && lineBuyer.name === parenBuyer.name)
      buyer = { name: parenBuyer.name, phones: [...parenBuyer.phones, ...lineBuyer.phones] };
    // 只寫了「訂購人：王小明」：收件人就是訂購者本人
    if (buyer && !first.name) first.name = buyer.name;
    const self = !buyer || buyer.name === first.name;
    if (!self) reasons.push(`提示：訂購者 ${buyer!.name}${buyer!.phones.length ? "" : "（沒有電話）"}，收件人 ${first.name || "？"}`);
    if (!first.name) reasons.push("沒有姓名");

    // 收件人就是訂購者時，客戶電話用第一位收件人的（加上訂購者那一行的）
    const recipientPhones = phonesIn(
      segments[0]
        .filter((l) => !buyerLine(l))
        .map((l) => {
          const b = buyerInParen(l);
          return b ? l.replace(b.match, " ") : l;
        })
        .join("\n"),
    );
    const customerPhones = (self ? [...recipientPhones, ...(buyer?.phones ?? [])] : buyer!.phones).filter(
      (p, i, a) => a.findIndex((x) => x.digits === p.digits) === i,
    );
    const used = new Set<string>();
    const consumed = (l: string) =>
      isAddress(l) || l === lineLine || nameOf(l) || phonesIn(l).length || itemsIn(l, defaultProduct).length || /^\d{1,2}\/\d{1,2}/.test(l);
    const note = lines
      .filter((l) => !consumed(l) && !used.has(l) && used.add(l))
      .concat(
        shipments
          .flatMap((s, k) => (segments[k].find(isAddress) ? [splitAddress(segments[k].find(isAddress)!).extra] : []))
          .filter(Boolean),
      )
      .join("；");

    const orderedAt = `${date}T00:00`;
    orders.push({
      orderNo: `T-${season}-${pad(index + 1, 4)}`,
      channel,
      brand: "",
      season,
      buyer: self
        ? { name: first.name, phone: first.phone, phone2: first.phone2 ?? "", email: "", gender: "" }
        : { name: buyer!.name, phone: customerPhones[0]?.number ?? "", phone2: customerPhones[1]?.number ?? "", email: "", gender: "" },
      referrer: "",
      orderedAt,
      items,
      extras: [],
      shipments,
      payment: {
        method: pay.method,
        status: pay.status,
        codFee: 0,
        paidAmount: pay.status === "已付款" && total ? total : 0,
        paidAt: "",
        reports: [],
      },
      amounts: {
        items: 0,
        extras: 0,
        codFee: 0,
        shipping: diff > 0 && diff <= 1000 ? diff : 0,
        adjust: diff < 0 || diff > 1000 ? diff : 0,
        total: 0,
      },
      status: shipped ? "已出貨" : "新訂單",
      processedAt: "",
      note,
      internalNote: "",
      legacy: {
        source: "word",
        file: fileName,
        key: `word:${fileName}:${index}`,
        rawText: text,
        parsedBy: "rule",
        needsReview: reasons.some((r) => !r.startsWith("提示")),
        reviewReasons: reasons,
      },
      customerHint: {
        name: self ? first.name || first.phone || "（未填姓名）" : buyer!.name,
        phones: self ? (customerPhones.length ? customerPhones : allPhones.slice(0, 1)) : customerPhones,
        emails: [],
        lineName,
        // 收件地址是送禮對象的，不是訂購者的
        address: self && first.address ? { zip: first.zip ?? "", address: first.address, lastUsedAt: orderedAt } : undefined,
        matchByName: !self && !customerPhones.length,
        source: channel === "LINE" ? "LINE" : channel === "現場" ? "現場" : "電話",
      },
    });
  });

  return { orders, products: [], skipped: skippedEmpty ? [{ reason: "空白或沒有聯絡資料的段落", count: skippedEmpty }] : [] };
}
