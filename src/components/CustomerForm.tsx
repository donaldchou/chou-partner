"use client";

import { useState } from "react";
import type { Customer } from "@/lib/types";
import BusinessCardCapture from "./BusinessCardCapture";
import { Button, Card, Field, Input, Textarea } from "./ui";

export default function CustomerForm({
  initial,
  onSubmit,
  onCancel,
}: {
  initial: Customer;
  onSubmit: (c: Customer) => void;
  onCancel: () => void;
}) {
  const [c, setC] = useState(initial);
  const set = <K extends keyof Customer>(k: K, v: Customer[K]) => setC((p) => ({ ...p, [k]: v }));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(c);
      }}
      className="space-y-5"
    >
      {/* 寬螢幕：名片在左、欄位在右 */}
      <div className="grid gap-5 lg:grid-cols-[minmax(300px,380px)_1fr] lg:items-start">
        <BusinessCardCapture
          image={c.cardImage}
          onImage={(img) => set("cardImage", img)}
          onRecognized={(r) =>
            setC((p) => ({
              ...p,
              company: r.company,
              name: r.name,
              title: r.title,
              phone: r.phone,
              email: r.email,
              address: r.address,
              lineName: r.lineName,
              source: "名片",
            }))
          }
        />

        <Card>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="公司名稱" hint="個人客戶可留空">
              <Input value={c.company} onChange={(e) => set("company", e.target.value)} />
            </Field>
            <Field label="客戶姓名" required>
              <Input required value={c.name} onChange={(e) => set("name", e.target.value)} />
            </Field>
            <Field label="職稱">
              <Input value={c.title ?? ""} onChange={(e) => set("title", e.target.value)} />
            </Field>
            <Field label="電話" required>
              <Input required type="tel" value={c.phone} onChange={(e) => set("phone", e.target.value)} />
            </Field>
            <Field label="Email">
              <Input type="email" value={c.email ?? ""} onChange={(e) => set("email", e.target.value)} />
            </Field>
            <Field label="LINE 名稱">
              <Input value={c.lineName ?? ""} onChange={(e) => set("lineName", e.target.value)} />
            </Field>
            <Field label="地址" className="sm:col-span-2">
              <Input value={c.address} onChange={(e) => set("address", e.target.value)} />
            </Field>
            <Field label="備註" className="sm:col-span-2">
              <Textarea
                value={c.note ?? ""}
                onChange={(e) => set("note", e.target.value)}
                placeholder="例如：每年中秋固定訂購、偏好的規格…"
              />
            </Field>
          </div>
        </Card>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel}>
          取消
        </Button>
        <Button type="submit">儲存客戶</Button>
      </div>
    </form>
  );
}
