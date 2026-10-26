import { connection, NextResponse } from "next/server";
import { HttpError, handleError, readJson } from "@/lib/api";
import { requireAdmin, requireUser } from "@/lib/auth";
import { geminiJson, hasGemini } from "@/lib/gemini";
import { isStoredUrl, readStored } from "@/lib/storage";

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

/** GET /api/ocr/business-card → { enabled }：有設定 GEMINI_API_KEY 才能辨識，前端沒有就只存照片、不顯示辨識按鈕 */
export async function GET() {
  await connection();
  try {
    await requireUser();
    return NextResponse.json({ enabled: hasGemini() });
  } catch (err) {
    return handleError(err);
  }
}

/**
 * POST /api/ocr/business-card  { url }（先用 /api/upload 上傳名片到 ll3 主機）
 * 用 Gemini 辨識；沒有設定 GEMINI_API_KEY 時回 503（不回傳假資料，避免誤導）。
 */
export async function POST(req: Request) {
  try {
    await requireAdmin();
    if (!hasGemini()) throw new HttpError(503, "尚未設定 AI 辨識（GEMINI_API_KEY），無法辨識名片，請手動填寫資料");
    const { url } = await readJson(req);
    if (!isStoredUrl(url)) throw new HttpError(400, "請傳入這個平台上傳的名片網址");

    const img = await readStored(url);
    const contentType = img.contentType;
    if (!contentType.startsWith("image/")) throw new HttpError(400, "名片必須是圖片");
    const base64 = Buffer.from(await new Response(img.body).arrayBuffer()).toString("base64");
    const result = await geminiJson<CardFields>([{ text: PROMPT }, { inlineData: { mimeType: contentType, data: base64 } }], SCHEMA);

    if (!result) throw new HttpError(503, "尚未設定 AI 辨識（GEMINI_API_KEY），無法辨識名片，請手動填寫資料");
    const clean = Object.fromEntries(FIELDS.map((k) => [k, String(result[k] ?? "").trim()]));
    return NextResponse.json(clean);
  } catch (err) {
    return handleError(err);
  }
}
