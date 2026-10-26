"use client";

import { Citrus } from "lucide-react";
import { actions } from "@/lib/store";
import type { Agency, AgencyStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "./ui";

/** 舊資料沒有 status＝配合中 */
export const agencyStatus = (a: Agency): AgencyStatus => a.status ?? "配合中";

/** 縣市：有填用填的，否則從地址開頭推算（臺→台，對齊 COUNTIES） */
export const agencyCity = (a: Agency) =>
  a.city || (/^(.{2}[市縣])/.exec((a.address ?? "").replace(/^臺/, "台"))?.[1] ?? "");

/** 滑鼠移上去的說明：依發展觀光條例第 27 條、旅行業管理規則的業務範圍（營業範圍：綜合＞甲種＞乙種） */
export const LICENSE_HELP: Record<string, string> = {
  綜合: "綜合旅行社（營業範圍最大）：可經營國內、國外旅遊與來台旅客接待；甲種、乙種能做的都能做，還可以把旅遊行程委託甲種、乙種旅行社代為招攬（批售、合團）。",
  甲種: "甲種旅行社：可經營國內、國外旅遊，可自行組團出國、代辦出國手續；但不能把行程委託其他旅行社代為招攬（不能批售、合團）。",
  乙種: "乙種旅行社（營業範圍最小）：只能經營國人在國內的旅遊業務，不能辦出國旅遊，也不能接待外國旅客來台。",
};

/** 三種旅行社的差別，給篩選選單旁的說明圖示用 */
export const LICENSE_HELP_ALL = Object.values(LICENSE_HELP).join("\n\n");

/** 綜合／甲種／乙種 標籤；滑鼠移上去顯示這類旅行社能做什麼 */
export function LicenseBadge({ license }: { license?: string }) {
  if (!license) return null;
  return (
    <span
      title={LICENSE_HELP[license]}
      className={cn(
        "cursor-help",
        "rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        license === "乙種" ? "bg-sky-50 text-sky-700 ring-sky-600/20" : "bg-slate-100 text-slate-600 ring-slate-500/20",
      )}
    >
      {license}
    </span>
  );
}

/** 網路上查到這家旅行社有採果行程：醒目的橘色標籤 */
export function FruitTourBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-accent-500 px-2.5 py-0.5 text-xs font-semibold text-white shadow-sm",
        className,
      )}
    >
      <Citrus size={13} /> 有採果行程
    </span>
  );
}

export function AgencyStatusBadge({ agency }: { agency: Agency }) {
  const s = agencyStatus(agency);
  return (
    <span
      className={cn(
        "rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
        s === "配合中" ? "bg-emerald-50 text-emerald-700 ring-emerald-600/20" : "bg-amber-50 text-amber-800 ring-amber-600/20",
      )}
    >
      {s}
    </span>
  );
}

/** 待聯絡 → 配合中（聯絡完成、有意願配合）；配合中可改回待聯絡 */
export function AgencyStatusButton({ agency, className }: { agency: Agency; className?: string }) {
  const toActive = agencyStatus(agency) === "待聯絡";
  return (
    <Button
      variant={toActive ? "primary" : "secondary"}
      className={className}
      onClick={(e) => {
        // 可能放在連結卡片裡：只切換，不跳頁
        e.preventDefault();
        e.stopPropagation();
        const msg = toActive
          ? `「${agency.name}」聯絡完成、有意願配合，轉到「配合中」？`
          : `把「${agency.name}」改回「待聯絡」？`;
        if (confirm(msg)) actions.saveAgency({ ...agency, status: toActive ? "配合中" : "待聯絡" });
      }}
    >
      {toActive ? "✓ 轉為配合中" : "改回待聯絡"}
    </Button>
  );
}
