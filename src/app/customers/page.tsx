"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge, Card, Empty, Input, LinkButton, PageHeader } from "@/components/ui";
import { customerTotal, orderTotal } from "@/lib/calc";
import { useAppState } from "@/lib/store";
import type { Customer } from "@/lib/types";
import { formatDate, money } from "@/lib/utils";

const sourceColor = { 名片: "green", 手動: "gray", Word匯入: "blue", MDB匯入: "purple" } as const;

function matches(c: Customer, kw: string) {
  const hay = [
    c.company,
    c.name,
    c.title,
    c.phone,
    c.phone.replace(/\D/g, ""),
    c.address,
    c.email,
    c.lineName,
    c.note,
    ...c.orders.flatMap((o) => o.items.flatMap((i) => [i.product, i.spec])),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  // 多個關鍵字用空白分隔，全部符合才算
  return kw
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((k) => hay.includes(k));
}

export default function CustomersPage() {
  const { customers } = useAppState();
  const [kw, setKw] = useState("");

  const list = useMemo(
    () =>
      customers
        .filter((c) => !kw.trim() || matches(c, kw.trim()))
        .sort((a, b) => (b.orders.at(-1)?.date ?? b.createdAt).localeCompare(a.orders.at(-1)?.date ?? a.createdAt)),
    [customers, kw],
  );

  return (
    <div>
      <PageHeader
        title="客戶資料查詢"
        subtitle="可用公司、姓名、電話、地址、產品或規格查詢"
        actions={
          <>
            <LinkButton href="/customers/import" variant="secondary">
              匯入歷史紀錄
            </LinkButton>
            <LinkButton href="/customers/new">＋ 新增客戶</LinkButton>
          </>
        }
      />

      <div className="relative mb-5">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
        <Input
          autoFocus
          value={kw}
          onChange={(e) => setKw(e.target.value)}
          placeholder="輸入關鍵字，例如：林志明、0912、台中、甜柿、禮盒…"
          className="py-3 pl-10 text-base"
        />
      </div>

      <p className="mb-3 text-sm text-slate-500">共 {list.length} 位客戶</p>

      {list.length === 0 ? (
        <Empty>找不到符合「{kw}」的客戶</Empty>
      ) : (
        <div className="space-y-3">
          {list.map((c) => (
            <CustomerResult key={c.id} c={c} />
          ))}
        </div>
      )}
    </div>
  );
}

function CustomerResult({ c }: { c: Customer }) {
  const [open, setOpen] = useState(false);
  const orders = [...c.orders].sort((a, b) => b.date.localeCompare(a.date));
  const shown = open ? orders : orders.slice(0, 2);

  return (
    <Card className="p-0">
      <div className="grid gap-4 p-5 md:grid-cols-[1fr_1.3fr]">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/customers/${c.id}`} className="text-lg font-semibold text-slate-800 hover:text-brand-700">
              {c.name}
            </Link>
            {c.title && <span className="text-sm text-slate-500">{c.title}</span>}
            <Badge color={sourceColor[c.source]}>{c.source}</Badge>
          </div>
          <div className="mt-0.5 text-sm font-medium text-slate-600">{c.company || "個人客戶"}</div>
          <dl className="mt-3 space-y-1 text-sm">
            <div className="flex gap-2">
              <dt className="w-10 shrink-0 text-slate-400">電話</dt>
              <dd>
                <a href={`tel:${c.phone}`} className="text-brand-700 hover:underline">
                  {c.phone}
                </a>
              </dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-10 shrink-0 text-slate-400">地址</dt>
              <dd className="text-slate-700">{c.address || "-"}</dd>
            </div>
            {c.lineName && (
              <div className="flex gap-2">
                <dt className="w-10 shrink-0 text-slate-400">LINE</dt>
                <dd className="text-slate-700">{c.lineName}</dd>
              </div>
            )}
          </dl>
        </div>

        <div className="rounded-lg bg-slate-50 p-3">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-medium text-slate-700">歷年訂購紀錄（{orders.length} 筆）</span>
            <span className="text-slate-500">累計 {money(customerTotal(c))}</span>
          </div>
          {orders.length === 0 ? (
            <p className="text-sm text-slate-400">尚無訂購紀錄</p>
          ) : (
            <ul className="space-y-2">
              {shown.map((o) => (
                <li key={o.id} className="rounded-md bg-white px-3 py-2 text-sm ring-1 ring-slate-200">
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>{formatDate(o.date)}</span>
                    <span>{money(orderTotal(o))}</span>
                  </div>
                  {o.items.map((i, k) => (
                    <div key={k} className="flex justify-between gap-2">
                      <span>
                        <span className="font-medium text-slate-800">{i.product}</span>
                        <span className="ml-1.5 text-slate-500">{i.spec}</span>
                      </span>
                      <span className="shrink-0 text-slate-600">× {i.qty}</span>
                    </div>
                  ))}
                </li>
              ))}
            </ul>
          )}
          {orders.length > 2 && (
            <button onClick={() => setOpen(!open)} className="mt-2 text-xs text-brand-700 hover:underline">
              {open ? "收合" : `顯示全部 ${orders.length} 筆`}
            </button>
          )}
        </div>
      </div>
    </Card>
  );
}
