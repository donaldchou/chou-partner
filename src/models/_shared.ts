import mongoose, { type Model, type Schema } from "mongoose";
import { uid } from "@/lib/utils";

/**
 * 所有文件使用字串 _id（與前端的 id 相同），API 輸出時轉成 `id`。
 * 子文件（訂購紀錄、領隊、品項…）不另外產生 _id，而是保留前端的 `id` 欄位。
 */
export const idField = { type: String, default: () => uid() };

export const sub = { _id: false } as const;

export const str = { type: String, default: "", trim: true };
export const required = (label: string) => ({ type: String, required: [true, `請填寫${label}`] as [true, string], trim: true });
export const ymd = { type: String, default: "", match: [/^$|^\d{4}-\d{2}-\d{2}$/, "日期格式需為 YYYY-MM-DD"] as [RegExp, string] };
export const dateTime = {
  type: String,
  default: "",
  match: [/^$|^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/, "時間格式需為 YYYY-MM-DDTHH:mm"] as [RegExp, string],
};
export const money = { type: Number, default: 0, min: 0 };
/** Vercel Blob 檔案網址（不接受 data: URL，避免文件過大） */
export const fileUrl = { type: String, default: "" };
export const photos = { type: [String], default: [] };

export const digitsOf = (s: unknown) => String(s ?? "").replace(/\D/g, "");

export function defineModel(name: string, schema: Schema, collection: string): Model<unknown> {
  schema.set("versionKey", false);
  // dev 模式 hot reload 後 schema 可能已經改了，要重新註冊，否則新欄位會被當成未知欄位丟掉
  if (mongoose.models[name]) mongoose.deleteModel(name);
  return mongoose.model(name, schema, collection) as unknown as Model<unknown>;
}
