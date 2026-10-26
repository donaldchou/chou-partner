"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import type { CompanyInfo } from "@/lib/types";
import { BusinessCardMultiCapture } from "./BusinessCardCapture";
import { Button, Card, Field, Input, Textarea } from "./ui";

/**
 * 旅行社、遊覽車公司、團購業者共用的公司資料表單；label 是畫面上的稱呼。
 * extra：放在網站欄位前的額外欄位（例如團購業者的類型、社群連結）
 */
export default function AgencyForm<T extends CompanyInfo>({
  initial,
  label = "旅行社",
  notePlaceholder = "例如：客群特性、習慣到場時段…",
  phoneRequired = true,
  extra,
  onSubmit,
  onCancel,
}: {
  initial: T;
  label?: string;
  notePlaceholder?: string;
  /** 社群團購主常沒有公開電話，可設為 false */
  phoneRequired?: boolean;
  extra?: (a: T, patch: (p: Partial<T>) => void) => React.ReactNode;
  onSubmit: (a: T) => void;
  onCancel: () => void;
}) {
  const [a, setA] = useState<T>(initial);
  const patch = (p: Partial<T>) => setA((prev) => ({ ...prev, ...p }));
  const set = <K extends keyof CompanyInfo>(k: K, v: CompanyInfo[K]) => setA((p) => ({ ...p, [k]: v }));
  // 舊資料只有一張 cardImage
  const cardImages = a.cardImages?.length ? a.cardImages : a.cardImage ? [a.cardImage] : [];
  const otherPhones = a.otherPhones ?? [];

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        // 空白的其他電話不存
        onSubmit({ ...a, otherPhones: otherPhones.map((p) => p.trim()).filter(Boolean) });
      }}
    >
      {/* 寬螢幕：名片在左、欄位在右 */}
      <div className="grid gap-5 lg:grid-cols-[minmax(300px,380px)_1fr] lg:items-start">
        <BusinessCardMultiCapture
          images={cardImages}
          selected={a.cardImage}
          // 使用者要求：上傳名片只存照片，不自動辨識（要辨識自己按按鈕）
          autoRecognize={false}
          onChange={(imgs, sel) => setA((p) => ({ ...p, cardImages: imgs, cardImage: sel ?? "" }))}
          onRecognized={(r) =>
            setA((p) => ({ ...p, name: r.company, contactName: r.name, phone: r.phone, address: r.address, lineName: r.lineName }))
          }
        />
        <Card>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={`${label}名稱`} required className="sm:col-span-2">
              <Input required value={a.name} onChange={(e) => set("name", e.target.value)} />
            </Field>
            <Field label="聯絡窗口">
              <Input value={a.contactName ?? ""} onChange={(e) => set("contactName", e.target.value)} />
            </Field>
            <Field label="電話" required={phoneRequired}>
              <Input required={phoneRequired} type="tel" value={a.phone} onChange={(e) => set("phone", e.target.value)} />
            </Field>
            <div className="space-y-2 sm:col-span-2">
              {otherPhones.map((p, i) => (
                <Field key={i} label={`其他電話 ${i + 1}`}>
                  <div className="flex gap-2">
                    <Input
                      type="tel"
                      autoFocus={!p}
                      value={p}
                      onChange={(e) => set("otherPhones", otherPhones.map((x, j) => (j === i ? e.target.value : x)))}
                    />
                    <Button
                      variant="ghost"
                      className="shrink-0 px-2.5 text-red-600"
                      aria-label={`刪除其他電話 ${i + 1}`}
                      onClick={() => set("otherPhones", otherPhones.filter((_, j) => j !== i))}
                    >
                      <X size={16} />
                    </Button>
                  </div>
                </Field>
              ))}
              <Button variant="secondary" onClick={() => set("otherPhones", [...otherPhones, ""])}>
                <Plus size={16} /> 新增電話
              </Button>
            </div>
            <Field label="LINE 名稱">
              <Input value={a.lineName ?? ""} onChange={(e) => set("lineName", e.target.value)} />
            </Field>
            <Field label="地址">
              <Input value={a.address ?? ""} onChange={(e) => set("address", e.target.value)} />
            </Field>
            {extra?.(a, patch)}
            <Field label="網站" className="sm:col-span-2">
              <Input type="url" placeholder="https://" value={a.website ?? ""} onChange={(e) => set("website", e.target.value)} />
            </Field>
            <Field label="備註" className="sm:col-span-2">
              <Textarea value={a.note ?? ""} onChange={(e) => set("note", e.target.value)} placeholder={notePlaceholder} />
            </Field>
          </div>
        </Card>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel}>
          取消
        </Button>
        <Button type="submit">儲存{label}</Button>
      </div>
    </form>
  );
}
