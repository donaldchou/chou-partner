import mongoose from "mongoose";
import { NextResponse } from "next/server";

/** 把 MongoDB 文件轉成前端格式：_id → id */
export function toClient<T = Record<string, unknown>>(doc: unknown): T {
  const { _id, ...rest } = doc as { _id: string } & Record<string, unknown>;
  return { id: _id, ...rest } as T;
}

/** 從前端資料移除 id / _id，避免覆寫主鍵 */
export function fromClient(body: Record<string, unknown>) {
  const rest = { ...body };
  delete rest.id;
  delete rest._id;
  return rest;
}

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public extra?: Record<string, unknown>,
  ) {
    super(message);
  }
}

/** 統一處理錯誤：驗證錯誤回 400，其他回 500 */
export function handleError(err: unknown) {
  if (err instanceof HttpError) {
    return NextResponse.json({ error: err.message, ...err.extra }, { status: err.status });
  }
  if (err instanceof mongoose.Error.ValidationError) {
    const messages = Object.values(err.errors).map((e) => {
      if (e.kind === "enum") return `${e.path} 的值不正確（${String(e.value)}）`;
      return e.message;
    });
    return NextResponse.json({ error: [...new Set(messages)].join("；"), fields: Object.keys(err.errors) }, { status: 400 });
  }
  if (err instanceof mongoose.Error.CastError) {
    return NextResponse.json({ error: `欄位格式錯誤：${err.path}` }, { status: 400 });
  }
  if (err instanceof SyntaxError) {
    return NextResponse.json({ error: "JSON 格式錯誤" }, { status: 400 });
  }
  console.error(err);
  const message = err instanceof Error ? err.message : "伺服器錯誤";
  return NextResponse.json({ error: message }, { status: 500 });
}

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  const body = await req.json();
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new HttpError(400, "請傳入 JSON 物件");
  }
  return body as Record<string, unknown>;
}

/** 讀取 multipart 表單裡的檔案欄位 */
export async function readFile(req: Request, field = "file", maxBytes = 10 * 1024 * 1024) {
  const form = await req.formData().catch(() => {
    throw new HttpError(400, "請用 multipart/form-data 上傳檔案");
  });
  const file = form.get(field);
  if (!(file instanceof File)) throw new HttpError(400, `缺少檔案欄位「${field}」`);
  if (file.size === 0) throw new HttpError(400, "檔案是空的");
  if (file.size > maxBytes) throw new HttpError(413, `檔案太大，上限 ${Math.round(maxBytes / 1024 / 1024)}MB`);
  return { file, form, buffer: Buffer.from(await file.arrayBuffer()) };
}
