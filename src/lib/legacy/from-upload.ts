import { HttpError } from "../api";
import { parseMdb } from "./mdb";
import { loadPriceLookup } from "./importer";
import type { ParseResult } from "./types";
import { parseWordOrders } from "./word";

export type ImportKind = "mdb" | "word";

/** 平台上傳的檔案 → 解析結果（與命令列匯入共用同一套規則） */
export async function parseUpload(kind: unknown, fileName: string, buffer: Buffer): Promise<ParseResult & { kind: ImportKind }> {
  if (kind === "mdb") {
    if (!/\.(mdb|accdb)$/i.test(fileName)) throw new HttpError(400, "請上傳舊網站的 .mdb 檔");
    return { kind, ...parseMdb(buffer, fileName) };
  }
  if (kind === "word") {
    if (!/\.docx$/i.test(fileName)) throw new HttpError(400, "請上傳 .docx 檔（舊版 .doc 請先用 Word 另存成 .docx）");
    return { kind, ...(await parseWordOrders(buffer, fileName, await loadPriceLookup())) };
  }
  throw new HttpError(400, "kind 必須是 mdb 或 word");
}
