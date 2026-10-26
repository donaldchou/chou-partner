"use client";

import { COUNTIES, GROUP_BUYER_KINDS } from "@/lib/enums";
import type { GroupBuyer, GroupBuyerKind } from "@/lib/types";
import { Field, Select, Textarea } from "./ui";

/** 團購業者專用欄位，放進 AgencyForm 的 extra */
export default function GroupBuyerFields({ b, patch }: { b: GroupBuyer; patch: (p: Partial<GroupBuyer>) => void }) {
  return (
    <>
      <Field label="業者類型">
        <Select value={b.kind ?? ""} onChange={(e) => patch({ kind: (e.target.value || undefined) as GroupBuyerKind | undefined })}>
          <option value="">未分類</option>
          {GROUP_BUYER_KINDS.map((k) => (
            <option key={k}>{k}</option>
          ))}
        </Select>
      </Field>
      <Field label="縣市">
        <Select value={b.city ?? ""} onChange={(e) => patch({ city: e.target.value })}>
          <option value="">未填（依地址判斷）</option>
          {COUNTIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </Select>
      </Field>
      <Field label="社群連結（粉專、IG、LINE 社群…一行一個）" className="sm:col-span-2">
        <Textarea
          rows={3}
          value={(b.links ?? []).join("\n")}
          onChange={(e) => patch({ links: e.target.value.split("\n") })}
          placeholder="https://www.facebook.com/…"
        />
      </Field>
      <Field label="水果團購（有賣過水果／生鮮團購的說明或網址）" className="sm:col-span-2">
        <Textarea rows={2} value={b.fruitDeal ?? ""} onChange={(e) => patch({ fruitDeal: e.target.value })} />
      </Field>
    </>
  );
}

/** 業者類型標籤 */
export function KindBadge({ kind }: { kind?: string }) {
  if (!kind) return null;
  return (
    <span className="whitespace-nowrap rounded-full bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-700 ring-1 ring-inset ring-violet-600/20">
      {kind}
    </span>
  );
}

/** 顯示用的連結文字：LINE 社群、FB 粉專顯示名稱，其他去掉 https://www. */
export const shortLink = (u: string) => {
  if (u.includes("openchat.line.me")) return "LINE 社群";
  if (/facebook\.com/.test(u)) return "Facebook 粉專";
  if (/instagram\.com/.test(u)) return "Instagram";
  return u.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
};

/** 存檔前整理：去掉空白的連結 */
export const cleanBuyer = (b: GroupBuyer): GroupBuyer => ({ ...b, links: (b.links ?? []).map((l) => l.trim()).filter(Boolean) });
