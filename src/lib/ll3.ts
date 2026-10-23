import { createHmac } from "node:crypto";
import { HttpError } from "./api";

/**
 * ll3 主機的檔案 API（http://www.ll3.com.tw/platform/file_api_partner.asp，原始碼在 chou-suda-print\platform_change_code，
 * 與 chou-platform 的 file_api.asp 相同，只有金鑰和資料夾不同）。
 * 檔案存在主機的 /platform/chou_partner/<folder>/<name>，MongoDB 存 "ll3:<folder>/<name>"。
 * 每個請求都用共用金鑰簽章：HMAC-SHA256(LL3_FILE_KEY, a|p|id|n|size|ts)，ts 是 UTC 秒數，10 分鐘內有效。
 */
export const LL3_FILE_API = "http://www.ll3.com.tw/platform/file_api_partner.asp";

/** 主機的 ASP 一次只收約 200KB，檔案要切成小塊送 */
export const LL3_CHUNK = 150_000;
export const LL3_PREFIX = "ll3:";
export const LL3_PATH = /^[a-z0-9-]{1,40}\/[A-Za-z0-9_-]{1,100}\.[a-z0-9]{1,5}$/;

export const isLl3Url = (v: unknown): v is string =>
  typeof v === "string" && v.startsWith(LL3_PREFIX) && LL3_PATH.test(v.slice(LL3_PREFIX.length));

function key() {
  const k = process.env.LL3_FILE_KEY;
  if (!k) throw new Error("請在 .env.local 設定 LL3_FILE_KEY（同 file_api_partner.asp 的 FILE_API_KEY）");
  return k;
}

type Params = { p?: string; id?: string; n?: number; size?: number };

function signedUrl(a: string, { p = "", id = "", n, size }: Params, extra: Record<string, string> = {}) {
  const ts = String(Math.floor(Date.now() / 1000));
  const ns = n === undefined ? "" : String(n);
  const ss = size === undefined ? "" : String(size);
  const sig = createHmac("sha256", key()).update([a, p, id, ns, ss, ts].join("|")).digest("hex");
  return `${LL3_FILE_API}?${new URLSearchParams({ a, p, id, n: ns, size: ss, ts, sig, ...extra })}`;
}

type Reply = { ok: boolean; status?: number; error?: string };

/** 主機的錯誤一律是 HTTP 200 + {ok:false,status,error}（IIS 會把 4xx/5xx 換成自己的錯誤頁） */
function replyError(res: Response, data: Reply | null) {
  const status = data?.status ?? res.status;
  return new HttpError(status === 404 ? 404 : 502, `ll3 檔案主機錯誤（${status}）：${data?.error ?? "回應不是 JSON"}`);
}

async function send(url: string, init?: RequestInit) {
  try {
    return await fetch(url, { cache: "no-store", ...init });
  } catch (err) {
    throw new HttpError(502, `連不上 ll3 檔案主機：${err instanceof Error ? err.message : err}`);
  }
}

/** 呼叫回傳 JSON 的動作，失敗丟 HttpError（502：主機有問題） */
async function call<T>(a: string, params: Params, init?: RequestInit): Promise<T> {
  const res = await send(signedUrl(a, params), init);
  const data = (await res.json().catch(() => null)) as (Reply & T) | null;
  if (!res.ok || !data?.ok) throw replyError(res, data);
  return data;
}

/** 送出一塊（n：塊號，合併時依塊號排序，可以不連續） */
export const ll3Put = (id: string, n: number, bytes: Uint8Array) =>
  call<{ bytes: number }>("put", { id, n }, {
    method: "POST",
    headers: { "Content-Type": "application/octet-stream" },
    body: bytes as BodyInit,
  });

/** 把上傳 id 的所有塊依序合併成 path，主機會核對總大小 */
export const ll3Done = (id: string, path: string, size: number) => call<{ size: number }>("done", { id, p: path, size });

export const ll3Delete = (path: string) => call<object>("del", { p: path });

/** 主機上所有檔案（不含 _tmp），t 是最後修改時間（UTC 秒數） */
export const ll3List = async () => (await call<{ files: { p: string; size: number; t: number }[] }>("list", {})).files;

/** 同時送出的塊數：Vercel 在美國，每塊往返台灣約 0.7 秒，一塊一塊送太慢 */
const PARALLEL = 4;

/** 把一段資料切成 LL3_CHUNK 大小送出（同時送 PARALLEL 塊），塊號從 firstN 開始 */
export async function ll3PutAll(id: string, bytes: Uint8Array, firstN = 0) {
  const count = Math.ceil(bytes.length / LL3_CHUNK);
  let next = 0;
  const worker = async () => {
    while (next < count) {
      const k = next++;
      await ll3Put(id, firstN + k, bytes.subarray(k * LL3_CHUNK, (k + 1) * LL3_CHUNK));
    }
  };
  await Promise.all(Array.from({ length: Math.min(PARALLEL, count) }, worker));
}

/** 讀檔（可指定範圍）。回傳主機的 Response，body 直接轉給瀏覽器 */
export async function ll3Get(path: string, range?: { offset: number; length: number }) {
  const extra: Record<string, string> = range ? { o: String(range.offset), l: String(range.length) } : {};
  const res = await send(signedUrl("get", { p: path }, extra));
  // 檔案不會是 JSON（.json 不在允許的副檔名裡），回 JSON 就是錯誤
  if (!res.ok || !res.body || res.headers.get("content-type")?.startsWith("application/json")) {
    const data = (await res.json().catch(() => null)) as Reply | null;
    if ((data?.status ?? res.status) === 404) throw new HttpError(404, "找不到檔案");
    throw replyError(res, data);
  }
  return res;
}
