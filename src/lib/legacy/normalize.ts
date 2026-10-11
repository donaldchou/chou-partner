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
  const text = String(raw ?? "").trim();
  const main = text.split(/#|分機|轉/)[0];
  let d = digitsOf(main);
  if (d.startsWith("886")) d = "0" + d.slice(3);
  if (d.length === 9 && d.startsWith("9")) d = "0" + d; // 漏打開頭的 0
  if (!/^0\d{8,9}$/.test(d)) return null;
  const mobile = d.startsWith("09");
  const number = mobile ? `${d.slice(0, 4)}-${d.slice(4, 7)}-${d.slice(7)}` : formatLandline(d);
  return { number: text.includes("#") ? `${number}#${digitsOf(text.split("#")[1])}` : number, digits: d, type: mobile ? "手機" : "市話" };
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
