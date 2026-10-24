"use client";

import { Plus, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { CUSTOMER_SOURCES } from "@/lib/enums";
import { useAppState } from "@/lib/store";
import type { Customer, CustomerSource, Phone } from "@/lib/types";
import { cn } from "@/lib/utils";
import BusinessCardCapture from "./BusinessCardCapture";
import { Button, Card, Field, Input, SectionTitle, Select, Textarea } from "./ui";

const digits = (s: string) => s.replace(/\D/g, "");
const phoneType = (n: string): Phone["type"] => (digits(n).startsWith("09") ? "手機" : "市話");

export function emptyCustomer(id: string, today: string): Customer {
  return {
    id,
    name: "",
    company: "",
    title: "",
    gender: "",
    phones: [{ number: "", digits: "", type: "手機" }],
    emails: [],
    lineName: "",
    addresses: [{ zip: "", address: "" }],
    sources: [],
    tags: [],
    stats: { orderCount: 0, totalSpent: 0, firstOrderAt: "", lastOrderAt: "", lastProduct: "" },
    cardImage: "",
    note: "",
    createdAt: today,
  };
}

export default function CustomerForm({
  initial,
  saving,
  onSubmit,
  onCancel,
}: {
  initial: Customer;
  saving?: boolean;
  onSubmit: (c: Customer) => void;
  onCancel: () => void;
}) {
  const [c, setC] = useState(() => ({
    ...initial,
    phones: initial.phones.length ? initial.phones : [{ number: "", digits: "", type: "手機" as const }],
    addresses: initial.addresses.length ? initial.addresses : [{ zip: "", address: "" }],
  }));
  const { customerTags } = useAppState();
  const [tagText, setTagText] = useState(initial.tags.join("、"));
  const set = <K extends keyof Customer>(k: K, v: Customer[K]) => setC((p) => ({ ...p, [k]: v }));
  const tagList = tagText.split(/[、,，\s]+/).filter(Boolean);
  // 快速按鈕和文字框是同一份標籤：按一下加入或移除
  const toggleTag = (t: string) =>
    setTagText((tagList.includes(t) ? tagList.filter((x) => x !== t) : [...tagList, t]).join("、"));

  function submit() {
    const phones = c.phones.filter((p) => digits(p.number)).map((p) => ({ ...p, digits: digits(p.number) }));
    if (!phones.length) return alert("請至少填一支電話");
    onSubmit({
      ...c,
      name: c.name.trim(),
      phones,
      emails: c.emails.map((e) => e.trim()).filter(Boolean),
      addresses: c.addresses.filter((a) => a.address.trim()),
      tags: [...new Set(tagList)],
    });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="space-y-5"
    >
      {/* 寬螢幕：名片在左、欄位在右 */}
      <div className="grid gap-5 lg:grid-cols-[minmax(300px,380px)_1fr] lg:items-start">
        <BusinessCardCapture
          image={c.cardImage}
          onImage={(img) => set("cardImage", img ?? "")}
          onRecognized={(r) =>
            setC((p) => ({
              ...p,
              company: r.company || p.company,
              name: r.name || p.name,
              title: r.title || p.title,
              phones: r.phone
                ? [{ number: r.phone, digits: digits(r.phone), type: phoneType(r.phone) }, ...p.phones.filter((x) => x.number)]
                : p.phones,
              emails: r.email ? [r.email, ...p.emails] : p.emails,
              addresses: r.address ? [{ zip: "", address: r.address }, ...p.addresses.filter((x) => x.address)] : p.addresses,
              lineName: r.lineName || p.lineName,
              sources: p.sources.includes("名片") ? p.sources : [...p.sources, "名片"],
            }))
          }
        />

        <div className="space-y-5">
          <Card>
            <SectionTitle>基本資料</SectionTitle>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="客戶姓名" required>
                <Input required value={c.name} onChange={(e) => set("name", e.target.value)} />
              </Field>
              <Field label="公司名稱" hint="個人客戶可留空">
                <Input value={c.company} onChange={(e) => set("company", e.target.value)} />
              </Field>
              <Field label="職稱">
                <Input value={c.title ?? ""} onChange={(e) => set("title", e.target.value)} />
              </Field>
              <Field label="性別">
                <Select value={c.gender} onChange={(e) => set("gender", e.target.value as Customer["gender"])}>
                  <option value="">未填</option>
                  <option value="F">女</option>
                  <option value="M">男</option>
                </Select>
              </Field>
              <Field label="LINE 名稱">
                <Input value={c.lineName ?? ""} onChange={(e) => set("lineName", e.target.value)} />
              </Field>
              <Field label="Email" hint="多個用逗號分隔">
                <Input value={c.emails.join(", ")} onChange={(e) => set("emails", e.target.value.split(/[,，]\s*/))} />
              </Field>
            </div>
          </Card>

          <Card>
            <SectionTitle
              right={
                <Button variant="ghost" onClick={() => set("phones", [...c.phones, { number: "", digits: "", type: "手機" }])}>
                  <Plus size={16} /> 加電話
                </Button>
              }
            >
              電話
            </SectionTitle>
            <div className="space-y-2">
              {c.phones.map((p, i) => (
                <div key={i} className="flex gap-2">
                  <Select
                    className="w-24 shrink-0"
                    value={p.type}
                    onChange={(e) =>
                      set(
                        "phones",
                        c.phones.map((x, j) => (j === i ? { ...x, type: e.target.value as Phone["type"] } : x)),
                      )
                    }
                  >
                    <option>手機</option>
                    <option>市話</option>
                  </Select>
                  <Input
                    type="tel"
                    placeholder="0912-345-678"
                    value={p.number}
                    onChange={(e) =>
                      set(
                        "phones",
                        c.phones.map((x, j) => (j === i ? { ...x, number: e.target.value, type: phoneType(e.target.value) } : x)),
                      )
                    }
                  />
                  <Button
                    variant="ghost"
                    disabled={c.phones.length === 1}
                    onClick={() =>
                      set(
                        "phones",
                        c.phones.filter((_, j) => j !== i),
                      )
                    }
                  >
                    <X size={16} />
                  </Button>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <SectionTitle
              right={
                <Button variant="ghost" onClick={() => set("addresses", [...c.addresses, { zip: "", address: "" }])}>
                  <Plus size={16} /> 加地址
                </Button>
              }
            >
              地址
            </SectionTitle>
            <div className="space-y-2">
              {c.addresses.map((a, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    className="w-24 shrink-0"
                    placeholder="郵遞區號"
                    value={a.zip}
                    onChange={(e) =>
                      set(
                        "addresses",
                        c.addresses.map((x, j) => (j === i ? { ...x, zip: e.target.value } : x)),
                      )
                    }
                  />
                  <Input
                    placeholder="地址"
                    value={a.address}
                    onChange={(e) =>
                      set(
                        "addresses",
                        c.addresses.map((x, j) => (j === i ? { ...x, address: e.target.value } : x)),
                      )
                    }
                  />
                  <Button
                    variant="ghost"
                    disabled={c.addresses.length === 1}
                    onClick={() =>
                      set(
                        "addresses",
                        c.addresses.filter((_, j) => j !== i),
                      )
                    }
                  >
                    <X size={16} />
                  </Button>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <SectionTitle>來源與備註</SectionTitle>
            <div className="mb-4 flex flex-wrap gap-2">
              {CUSTOMER_SOURCES.map((s) => {
                const on = c.sources.includes(s);
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => set("sources", on ? c.sources.filter((x) => x !== s) : [...c.sources, s as CustomerSource])}
                    className={cn(
                      "rounded-full border px-3 py-1 text-sm",
                      on ? "border-brand-600 bg-brand-600 text-white" : "border-slate-300 bg-white text-slate-600 hover:border-brand-400",
                    )}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
            <div className="grid gap-4">
              {/* 不用 <Field>：它是 <label>，點標題會觸發裡面的第一個按鈕 */}
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-700">標籤</span>
                  <Link href="/customers/tags" target="_blank" className="text-xs text-brand-700 hover:underline">
                    管理標籤
                  </Link>
                </div>
                <div className="mb-2 flex flex-wrap gap-2">
                  {customerTags.map(({ name: t }) => {
                    const on = tagList.includes(t);
                    return (
                      <button
                        key={t}
                        type="button"
                        aria-pressed={on}
                        onClick={() => toggleTag(t)}
                        className={cn(
                          "rounded-full border px-3 py-1 text-sm",
                          on ? "border-accent-500 bg-accent-500 text-white" : "border-slate-300 bg-white text-slate-600 hover:border-accent-400",
                        )}
                      >
                        {t}
                      </button>
                    );
                  })}
                </div>
                <Input aria-label="標籤" value={tagText} onChange={(e) => setTagText(e.target.value)} />
                <span className="mt-1 block text-xs text-slate-400">
                  點選上方按鈕（可複選），或用頓號、空白分隔自行輸入，例如：企業客戶、甜柿客。「回購客」會依訂單自動標記
                </span>
              </div>
              <Field label="備註">
                <Textarea
                  value={c.note ?? ""}
                  onChange={(e) => set("note", e.target.value)}
                  placeholder="例如：每年中秋固定訂購、偏好的規格…"
                />
              </Field>
            </div>
          </Card>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel}>
          取消
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "儲存中…" : "儲存客戶"}
        </Button>
      </div>
    </form>
  );
}
