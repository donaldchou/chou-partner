import { HttpError } from "./api";

type Part = { text: string } | { inlineData: { mimeType: string; data: string } };

// 3.6-flash 偶爾會 503 high demand，失敗時改用 3.5-flash-lite
const MODELS = [process.env.GEMINI_MODEL || "gemini-3.6-flash", "gemini-3.5-flash-lite"];

export const hasGemini = () => !!process.env.GEMINI_API_KEY;

/** 呼叫 Gemini，依 schema 回傳 JSON；沒有設定 GEMINI_API_KEY 時回傳 null（呼叫端改用替代方案） */
export async function geminiJson<T>(parts: Part[], schema: object): Promise<T | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;

  let lastError = "";
  for (const model of MODELS) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          contents: [{ role: "user", parts }],
          generationConfig: { responseMimeType: "application/json", responseSchema: schema, temperature: 0 },
        }),
        signal: AbortSignal.timeout(60_000),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        lastError = data?.error?.message ?? `HTTP ${res.status}`;
        continue;
      }
      const text: string = data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? "";
      return JSON.parse(text) as T;
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
    }
  }
  throw new HttpError(502, `AI 辨識失敗：${lastError}`);
}
