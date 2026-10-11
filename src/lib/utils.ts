export function uid(prefix = "id") {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

export function today() {
  const d = new Date();
  return toDateStr(d);
}

export function toDateStr(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function nowStr() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${toDateStr(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatDateTime(s: string) {
  if (!s) return "";
  const [date, time] = s.split("T");
  return time ? `${date.replaceAll("-", "/")} ${time.slice(0, 5)}` : date.replaceAll("-", "/");
}

export function formatDate(s: string) {
  return s ? s.slice(0, 10).replaceAll("-", "/") : "";
}

const WEEK = ["日", "一", "二", "三", "四", "五", "六"];
export function weekday(dateStr: string) {
  return `週${WEEK[new Date(dateStr.slice(0, 10) + "T00:00").getDay()]}`;
}

export function money(n: number) {
  return `NT$ ${Math.round(n).toLocaleString("zh-TW")}`;
}

export function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

export function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export function downloadText(filename: string, text: string, mime = "text/csv;charset=utf-8") {
  const blob = new Blob(["﻿" + text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function toCsv(rows: (string | number)[][]) {
  return rows.map((r) => r.map((c) => `"${String(c ?? "").replaceAll('"', '""')}"`).join(",")).join("\r\n");
}

export { COUNTIES } from "./enums";

// 宅配單寄件人資料（正式版移到系統設定）
export const FARM = { name: "周家農場", phone: "（寄件電話）", address: "（寄件地址）" };

export const PRODUCTS = ["甜柿", "水蜜桃", "蜜蘋果", "高接梨", "柿餅", "水果禮盒"];
