"use client";

import { useState } from "react";
import type { GroupBuy, GroupBuyStatus, ShippingMode } from "@/lib/types";
import { cn } from "@/lib/utils";
import BusinessCardCapture from "./BusinessCardCapture";
import { Button, Card, Field, Input, SectionTitle, Select } from "./ui";

export const SHIPPING_MODES: { v: ShippingMode; title: string; desc: string }[] = [
  { v: "provided", title: "業者提供宅配單", desc: "團購業者自行提供宅配單檔案，平台負責備份" },
  { v: "generate", title: "業者未提供宅配單", desc: "依業者給的寄送資訊，由平台產生宅配單並備份" },
];

export default function GroupBuyForm({
  initial,
  showCard,
  children,
  onSubmit,
  onCancel,
}: {
  initial: GroupBuy;
  showCard?: boolean;
  children?: (g: GroupBuy, setG: React.Dispatch<React.SetStateAction<GroupBuy>>) => React.ReactNode;
  onSubmit: (g: GroupBuy) => void;
  onCancel?: () => void;
}) {
  const [g, setG] = useState(initial);
  const set = <K extends keyof GroupBuy>(k: K, v: GroupBuy[K]) => setG((p) => ({ ...p, [k]: v }));

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(g);
      }}
    >
      {/* 寬螢幕：名片在左、欄位在右 */}
      <div className={cn("grid gap-5 lg:items-start", showCard && "lg:grid-cols-[minmax(300px,380px)_1fr]")}>
        {showCard && (
          <BusinessCardCapture
            image={g.cardImage}
            onImage={(img) => set("cardImage", img)}
            onRecognized={(r) =>
              setG((p) => ({
                ...p,
                name: p.name || `${r.company} 團購`,
                contactName: r.name,
                phone: r.phone,
                address: r.address,
                lineName: r.lineName,
              }))
            }
          />
        )}

        <div className="space-y-5">
          <Card>
            <SectionTitle>團購資訊</SectionTitle>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="團購名稱" required className="sm:col-span-2">
                <Input required placeholder="例：好媽咪團購 10 月甜柿團" value={g.name} onChange={(e) => set("name", e.target.value)} />
              </Field>
              <Field label="開團日期" required>
                <Input type="date" required value={g.startDate} onChange={(e) => set("startDate", e.target.value)} />
              </Field>
              <Field label="結團日期" required>
                <Input type="date" required value={g.endDate} onChange={(e) => set("endDate", e.target.value)} />
              </Field>
              <Field label="狀態">
                <Select value={g.status} onChange={(e) => set("status", e.target.value as GroupBuyStatus)}>
                  <option>洽談中</option>
                  <option>進行中</option>
                  <option>已出貨</option>
                  <option>已結案</option>
                </Select>
              </Field>
            </div>
          </Card>

          <Card>
            <SectionTitle>聯絡者</SectionTitle>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="聯絡者姓名" required>
                <Input required value={g.contactName} onChange={(e) => set("contactName", e.target.value)} />
              </Field>
              <Field label="電話" required>
                <Input required type="tel" value={g.phone} onChange={(e) => set("phone", e.target.value)} />
              </Field>
              <Field label="LINE 名稱">
                <Input value={g.lineName ?? ""} onChange={(e) => set("lineName", e.target.value)} />
              </Field>
              <Field label="地址">
                <Input value={g.address} onChange={(e) => set("address", e.target.value)} />
              </Field>
            </div>
          </Card>
        </div>
      </div>

      <Card>
        <SectionTitle>宅配單處理方式</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2">
          {SHIPPING_MODES.map((m) => (
            <button
              key={m.v}
              type="button"
              onClick={() => set("shippingMode", m.v)}
              className={cn(
                "rounded-lg border-2 p-3 text-left",
                g.shippingMode === m.v ? "border-brand-500 bg-brand-50" : "border-slate-200 hover:bg-slate-50",
              )}
            >
              <div className="font-medium text-slate-800">
                {g.shippingMode === m.v ? "◉" : "○"} {m.title}
              </div>
              <div className="mt-0.5 text-xs text-slate-500">{m.desc}</div>
            </button>
          ))}
        </div>
      </Card>

      {children?.(g, setG)}

      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button variant="secondary" onClick={onCancel}>
            取消
          </Button>
        )}
        <Button type="submit">儲存</Button>
      </div>
    </form>
  );
}
