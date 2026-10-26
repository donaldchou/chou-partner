"use client";

import { useState } from "react";
import type { Agency } from "@/lib/types";
import { BusinessCardMultiCapture } from "./BusinessCardCapture";
import { Button, Card, Field, Input, Textarea } from "./ui";

export default function AgencyForm({
  initial,
  onSubmit,
  onCancel,
}: {
  initial: Agency;
  onSubmit: (a: Agency) => void;
  onCancel: () => void;
}) {
  const [a, setA] = useState(initial);
  const set = <K extends keyof Agency>(k: K, v: Agency[K]) => setA((p) => ({ ...p, [k]: v }));
  // 舊資料只有一張 cardImage
  const cardImages = a.cardImages?.length ? a.cardImages : a.cardImage ? [a.cardImage] : [];

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(a);
      }}
    >
      {/* 寬螢幕：名片在左、欄位在右 */}
      <div className="grid gap-5 lg:grid-cols-[minmax(300px,380px)_1fr] lg:items-start">
        <BusinessCardMultiCapture
          images={cardImages}
          selected={a.cardImage}
          onChange={(imgs, sel) => setA((p) => ({ ...p, cardImages: imgs, cardImage: sel ?? "" }))}
          onRecognized={(r) =>
            setA((p) => ({ ...p, name: r.company, contactName: r.name, phone: r.phone, address: r.address, lineName: r.lineName }))
          }
        />
        <Card>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="旅行社名稱" required className="sm:col-span-2">
              <Input required value={a.name} onChange={(e) => set("name", e.target.value)} />
            </Field>
            <Field label="聯絡窗口">
              <Input value={a.contactName ?? ""} onChange={(e) => set("contactName", e.target.value)} />
            </Field>
            <Field label="電話" required>
              <Input required type="tel" value={a.phone} onChange={(e) => set("phone", e.target.value)} />
            </Field>
            <Field label="LINE 名稱">
              <Input value={a.lineName ?? ""} onChange={(e) => set("lineName", e.target.value)} />
            </Field>
            <Field label="地址">
              <Input value={a.address ?? ""} onChange={(e) => set("address", e.target.value)} />
            </Field>
            <Field label="備註" className="sm:col-span-2">
              <Textarea value={a.note ?? ""} onChange={(e) => set("note", e.target.value)} placeholder="例如：客群特性、習慣到場時段…" />
            </Field>
          </div>
        </Card>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel}>
          取消
        </Button>
        <Button type="submit">儲存旅行社</Button>
      </div>
    </form>
  );
}
