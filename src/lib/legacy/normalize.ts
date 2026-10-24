import type { Phone } from "../types";

/** &#37129; 這類 HTML 字元碼轉回文字（舊網站遇到罕見字會這樣存） */
export function decodeEntities(s: unknown): string {
  return String(s ?? "")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/‎|‏/g, "")
    .trim();
}

export const digitsOf = (s: unknown) => String(s ?? "").replace(/\D/g, "");

/** 台灣電話：手機 09 開頭 10 碼，市話 0 開頭 9–10 碼（不含分機） */
export function toPhone(raw: unknown): Phone | null {
  // 數字旁邊的英文 O 是打錯的 0（O6-24384O8）
  const text = String(raw ?? "")
    .trim()
    .replace(/[Oo](?=[\d\-Oo])|(?<=[\d\-])[Oo]/g, "0");
  const main = text.split(/#|分機|轉/)[0];
  let d = digitsOf(main);
  if (d.startsWith("886")) d = "0" + d.slice(3);
  if (d.length === 9 && d.startsWith("9")) d = "0" + d; // 漏打開頭的 0
  if (!/^0\d{8,9}$/.test(d)) return null;
  const mobile = d.startsWith("09");
  const number = mobile ? `${d.slice(0, 4)}-${d.slice(4, 7)}-${d.slice(7)}` : formatLandline(d);
  return { number: text.includes("#") ? `${number}#${digitsOf(text.split("#")[1])}` : number, digits: d, type: mobile ? "手機" : "市話" };
}

/** 縣市 → 市話區碼、區碼後面的號碼長度 */
const AREAS: { re: RegExp; code: string; lengths: number[] }[] = [
  { re: /[台臺]北|新北|基隆/, code: "02", lengths: [8] },
  { re: /桃園|新竹|宜蘭|花蓮/, code: "03", lengths: [7] },
  { re: /苗栗/, code: "037", lengths: [6] },
  { re: /[台臺]中|彰化/, code: "04", lengths: [7, 8] },
  { re: /南投/, code: "049", lengths: [7] },
  { re: /嘉義|雲林/, code: "05", lengths: [7] },
  { re: /[台臺]南|澎湖/, code: "06", lengths: [7] },
  { re: /高雄/, code: "07", lengths: [7] },
  { re: /屏東/, code: "08", lengths: [7] },
  { re: /[台臺]東/, code: "089", lengths: [6] },
  { re: /金門/, code: "082", lengths: [6] },
  { re: /連江|馬祖/, code: "0836", lengths: [4] },
];

/** 郵遞區號前三碼範圍 → 區碼 */
const ZIP_AREAS: [number, number, string][] = [
  [100, 116, "02"], [200, 208, "02"], [209, 212, "0836"], [220, 253, "02"],
  [260, 272, "03"], [300, 338, "03"], [350, 369, "037"], [400, 439, "04"],
  [500, 530, "04"], [540, 558, "049"], [600, 655, "05"], [700, 745, "06"],
  [800, 852, "07"], [880, 885, "06"], [890, 896, "082"], [900, 947, "08"],
  [950, 966, "089"], [970, 983, "03"],
];

function areaOf(address: string, zip: string) {
  // 地址裡最先出現的縣市（避免「新竹縣…台中路」被當成台中）
  const hit = AREAS.map((a) => ({ a, i: address.search(a.re) }))
    .filter((x) => x.i >= 0)
    .sort((x, y) => x.i - y.i)[0];
  if (hit) return hit.a;
  const z = Number(digitsOf(zip).slice(0, 3));
  const code = ZIP_AREAS.find(([lo, hi]) => z >= lo && z <= hi)?.[2];
  return code ? AREAS.find((a) => a.code === code)! : null;
}

/** 市話漏了區碼（例如 26751498）：依地址、郵遞區號的縣市補上；號碼長度跟該區不符就不補 */
export function withAreaCode(raw: unknown, address: string, zip: string): string | null {
  const text = String(raw ?? "").trim();
  const d = digitsOf(text.split(/#|分機|轉/)[0]);
  if (!d || d.startsWith("0")) return null;
  const area = areaOf(address, zip);
  return area?.lengths.includes(d.length) ? area.code + text : null;
}

function formatLandline(d: string) {
  // 02、04 等兩碼區碼；037、049、082、089 等三碼區碼
  const three = /^(037|049|082|089|0826|0836)/.exec(d)?.[0];
  const area = three ?? d.slice(0, 2);
  return `${area}-${d.slice(area.length)}`;
}

/** mdb-reader 把 Access 的「當地時間」當成 UTC 讀出來，用 UTC 欄位格式化才是原本的時間 */
export function localDateTime(v: unknown): string {
  if (!(v instanceof Date) || isNaN(v.getTime())) return "";
  return v.toISOString().slice(0, 16);
}

export const pad = (n: number, len = 2) => String(n).padStart(len, "0");

const CN_NUM: Record<string, number> = { 一: 1, ㄧ: 1, 二: 2, 兩: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };

/** 「十二」「六」「12」→ 數字 */
export function toNumber(s: string): number {
  if (/^\d+$/.test(s)) return Number(s);
  if (s === "十") return 10;
  const m = /^(十)?([一ㄧ二兩三四五六七八九])?(十)?([一ㄧ二三四五六七八九])?$/.exec(s);
  if (!m) return NaN;
  if (m[1]) return 10 + (m[2] ? CN_NUM[m[2]] : 0);
  if (m[3]) return CN_NUM[m[2]!] * 10 + (m[4] ? CN_NUM[m[4]] : 0);
  return m[2] ? CN_NUM[m[2]] : NaN;
}

/** 甜柿產季跨年（10 月到隔年春天），上半年的甜柿訂單算前一年的產季 */
export function seasonOf(orderedAt: string, brand: string) {
  const y = Number(orderedAt.slice(0, 4));
  const m = Number(orderedAt.slice(5, 7));
  return brand === "kaki" && m <= 6 ? y - 1 : y;
}
