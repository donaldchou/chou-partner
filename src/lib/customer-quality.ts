import { CustomerModel } from "@/models/customer";
import type { Customer } from "./types";

/**
 * 疑似無效客戶：自動挑出資料可疑的客戶，讓管理者逐筆確認（標記無效，或確認正常）。
 * 已標記無效、或已確認正常（suspectChecked）的客戶不會再出現在清單裡。
 */

type Data = Record<string, unknown>;

const JUNK_NAME = /^[\d\s\-_.。,，!?？*#/\\()（）+]+$|^.$/;
const TEST_NAME = /測試|test|asdf|qwer/i;
const BAD_PHONE = /^(\d)\1{5,}$|^\d{1,7}$|^0?9?12345678/;

/** 出現在兩位以上客戶的電話（多半是同一人重複建檔，或共用市話、測試電話） */
export async function sharedPhones(): Promise<string[]> {
  const rows = await CustomerModel.aggregate<{ _id: string }>([
    { $match: { invalid: null } },
    { $unwind: "$phones" },
    { $group: { _id: "$phones.digits", n: { $sum: 1 } } },
    { $match: { n: { $gt: 1 }, _id: { $ne: "" } } },
  ]);
  return rows.map((r) => r._id);
}

/** 疑似無效客戶的查詢條件 */
export async function suspectFilter(): Promise<Data> {
  return {
    invalid: null,
    suspectChecked: { $ne: true },
    $or: [
      { name: JUNK_NAME },
      { name: TEST_NAME },
      { phones: { $size: 0 } },
      { "phones.digits": BAD_PHONE },
      { "phones.digits": { $in: await sharedPhones() } },
    ],
  };
}

/** 這位客戶為什麼可疑（列表與詳細頁顯示用） */
export function suspectReasons(c: Pick<Customer, "name" | "phones">, shared: Set<string>): string[] {
  const reasons: string[] = [];
  const nameDigits = c.name.replace(/\D/g, "");
  if (JUNK_NAME.test(c.name)) reasons.push(nameDigits.length >= 8 ? "姓名是電話號碼（缺姓名）" : "姓名是數字或符號");
  if (TEST_NAME.test(c.name)) reasons.push("姓名像測試資料");
  if (!c.phones.length) reasons.push("沒有電話");
  if (c.phones.some((p) => BAD_PHONE.test(p.digits))) reasons.push("電話號碼異常");
  if (c.phones.some((p) => shared.has(p.digits))) reasons.push("電話與其他客戶重複");
  return reasons;
}

/** 單一客戶：只查他的電話有沒有和別人重複 */
export async function suspectReasonsOf(c: Customer & { invalid?: unknown; suspectChecked?: boolean }) {
  if (c.invalid || c.suspectChecked) return [];
  const digits = c.phones.map((p) => p.digits).filter(Boolean);
  const others = digits.length
    ? await CustomerModel.distinct("phones.digits", { _id: { $ne: c.id }, invalid: null, "phones.digits": { $in: digits } })
    : [];
  return suspectReasons(c, new Set((others as string[]).filter((d) => digits.includes(d))));
}
