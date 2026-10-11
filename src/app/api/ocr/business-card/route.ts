import { NextResponse } from "next/server";
import { HttpError, handleError, readJson } from "@/lib/api";
import { geminiJson } from "@/lib/gemini";
import { mockCards } from "@/lib/mock-data";
import { isBlobUrl } from "@/lib/blob";

export type CardFields = {
  company: string;
  name: string;
  title: string;
  phone: string;
  email: string;
  address: string;
  lineName: string;
};

const FIELDS = ["company", "name", "title", "phone", "email", "address", "lineName"] as const;

const SCHEMA = {
  type: "OBJECT",
  properties: Object.fromEntries(FIELDS.map((f) => [f, { type: "STRING" }])),
  required: [...FIELDS],
};

const PROMPT = `這是一張台灣的名片照片。請辨識並以 JSON 回傳：
company 公司或單位名稱、name 姓名（中文優先）、title 職稱、phone 電話（優先手機，格式如 0912-345-678 或 02-2345-6789）、
email、address 地址（完整中文地址）、lineName LINE ID 或名稱。看不到的欄位回傳空字串，不要猜測。`;

/**
 * POST /api/ocr/business-card  { url }（先用 /api/upload 上傳名片到 Vercel Blob）
 * 有設定 GEMINI_API_KEY 時用 AI 辨識；沒有設定時回傳示範資料並標記 mock: true。
 */
export async function POST(req: Request) {
  try {
    const { url } = await readJson(req);
    if (!isBlobUrl(url)) throw new HttpError(400, "請傳入這個平台上傳的名片網址");

    const img = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    if (!img.ok) throw new HttpError(404, "找不到名片圖片");
    const contentType = img.headers.get("content-type") ?? "";
    if (!contentType.startsWith("image/")) throw new HttpError(400, "名片必須是圖片");
    const base64 = Buffer.from(await img.arrayBuffer()).toString("base64");
    const result = await geminiJson<CardFields>([{ text: PROMPT }, { inlineData: { mimeType: contentType, data: base64 } }], SCHEMA);

    if (!result) {
      const mock = mockCards[Math.floor(Math.random() * mockCards.length)];
      return NextResponse.json({ ...mock, mock: true });
    }
    const clean = Object.fromEntries(FIELDS.map((k) => [k, String(result[k] ?? "").trim()]));
    return NextResponse.json({ ...clean, mock: false });
  } catch (err) {
    return handleError(err);
  }
}
