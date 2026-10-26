"use client";

import { Citrus } from "lucide-react";
import { actions } from "@/lib/store";
import type { Agency, AgencyStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "./ui";

// 旅行社、團購業者共用：配合中／待聯絡、縣市、醒目標籤
type Partner = { name: string; status?: AgencyStatus; city?: string; address?: string };

/** 舊資料沒有 status＝配合中 */
export const agencyStatus = (a: Partner): AgencyStatus => a.status ?? "配合中";

/** 縣市：有填用填的，否則從地址開頭推算（臺→台，對齊 COUNTIES） */
export const agencyCity = (a: Partner) =>
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
        "cursor-help whitespace-nowrap",
        "rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        license === "乙種" ? "bg-sky-50 text-sky-700 ring-sky-600/20" : "bg-slate-100 text-slate-600 ring-slate-500/20",
      )}
    >
      {license}
    </span>
  );
}

/** 網路上查到這家旅行社有採果行程（團購業者：有水果團購）：醒目的橘色標籤 */
export function FruitTourBadge({ className, label = "有採果行程" }: { className?: string; label?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-accent-500 px-2.5 py-0.5 text-xs font-semibold text-white shadow-sm",
        className,
      )}
    >
      <Citrus size={13} /> {label}
    </span>
  );
}

export function AgencyStatusBadge({ agency }: { agency: Partner }) {
  const s = agencyStatus(agency);
  return (
    <span
      className={cn(
        "whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
        s === "配合中"
          ? "bg-emerald-50 text-emerald-700 ring-emerald-600/20"
          : s === "洽談中"
            ? "bg-sky-50 text-sky-700 ring-sky-600/20"
            : s === "待聯絡"
              ? "bg-amber-50 text-amber-800 ring-amber-600/20"
              : "bg-slate-100 text-slate-500 ring-slate-500/20",
      )}
    >
      {s}
    </span>
  );
}

/**
 * 狀態切換按鈕。allowDecline（旅行社、團購業者）時：
 * - 待聯絡 → 配合中／洽談中／無意願
 * - 洽談中 → 配合中／無意願／改回待聯絡
 * - 配合中、無意願 → 改回待聯絡
 * 沒有 allowDecline（團購業者）時只有 待聯絡 ⇄ 配合中。onSave 不給時存成旅行社；className 套在每顆按鈕上
 */
export function AgencyStatusButton<T extends Partner>({
  agency,
  className,
  allowDecline = false,
  compact = false,
  onSave = (a) => actions.saveAgency(a as unknown as Agency),
}: {
  agency: T;
  className?: string;
  allowDecline?: boolean;
  /** 清單用：小按鈕、不換行、文字精簡 */
  compact?: boolean;
  onSave?: (a: T) => void;
}) {
  className = cn(compact && "px-2.5 py-1.5 text-xs", className);
  const status = agencyStatus(agency);
  const change = (e: React.MouseEvent, to: AgencyStatus, msg: string) => {
    // 可能放在連結卡片或可點的列裡：只切換，不跳頁
    e.preventDefault();
    e.stopPropagation();
    if (confirm(msg)) onSave({ ...agency, status: to });
  };
  const backToPending = (
    <Button variant="secondary" className={className} onClick={(e) => change(e, "待聯絡", `把「${agency.name}」改回「待聯絡」？`)}>
      改回待聯絡
    </Button>
  );
  if (status === "配合中" || status === "無意願") return backToPending;
  return (
    <span className={cn("inline-flex", compact ? "flex-nowrap gap-1.5" : "flex-wrap gap-2")}>
      <Button className={className} onClick={(e) => change(e, "配合中", `「${agency.name}」談好了、有意願配合，轉到「配合中」？`)}>
        {compact ? "✓ 配合中" : "✓ 轉為配合中"}
      </Button>
      {allowDecline && status === "待聯絡" && (
        <Button
          variant="secondary"
          className={cn("text-sky-700", className)}
          onClick={(e) => change(e, "洽談中", `「${agency.name}」已經聯絡上、正在洽談，轉到「洽談中」？`)}
        >
          💬 洽談中
        </Button>
      )}
      {allowDecline && (
        <Button
          variant="secondary"
          className={cn("text-slate-500", className)}
          onClick={(e) => change(e, "無意願", `「${agency.name}」聯絡過但沒有意願配合，轉到「無意願」？`)}
        >
          ✗ 無意願
        </Button>
      )}
      {status === "洽談中" && backToPending}
    </span>
  );
}
