"use client";

import Link from "next/link";
import { useState } from "react";
import { Card, Empty, Input, LinkButton, PageHeader } from "@/components/ui";
import { useAppState } from "@/lib/store";

export default function BusCompaniesPage() {
  const { busCompanies, bookings } = useAppState();
  const [kw, setKw] = useState("");
  const list = busCompanies.filter((c) =>
    [c.name, c.contactName, c.phone, ...(c.otherPhones ?? []), ...c.people.flatMap((p) => [p.name, p.phone, p.lineName])]
      .filter(Boolean)
      .join(" ")
      .includes(kw.trim()),
  );

  return (
    <div>
      <PageHeader
        title="遊覽車管理"
        subtitle="管理配合的遊覽車公司與其司機"
        actions={<LinkButton href="/tours/bus-companies/new">＋ 新增遊覽車公司</LinkButton>}
      />
      <Input value={kw} onChange={(e) => setKw(e.target.value)} placeholder="搜尋遊覽車公司、司機姓名或電話" className="mb-5" />

      {list.length === 0 ? (
        <Empty>{busCompanies.length ? "沒有符合的遊覽車公司" : "尚未建立遊覽車公司"}</Empty>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {list.map((c) => {
            const bs = bookings.filter((b) => b.busCompanyId === c.id);
            return (
              <Link key={c.id} href={`/tours/bus-companies/${c.id}`}>
                <Card className="h-full transition hover:border-brand-300 hover:shadow">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-lg font-semibold text-slate-800">{c.name}</div>
                      <div className="text-sm text-slate-500">
                        {c.contactName && `${c.contactName}・`}
                        {[c.phone, ...(c.otherPhones ?? [])].join("・")}
                      </div>
                    </div>
                    <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs text-brand-700">{bs.length} 次預約</span>
                  </div>
                  <div className="mt-4 text-sm">
                    <div className="text-xs text-slate-400">司機 {c.people.length} 位</div>
                    <div className="truncate text-slate-700">{c.people.map((p) => p.name).join("、") || "-"}</div>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
