"use client";

import Link from "next/link";
import { useState } from "react";
import { Card, Empty, Input, LinkButton, PageHeader } from "@/components/ui";
import { useAppState } from "@/lib/store";

export default function AgenciesPage() {
  const { agencies, bookings } = useAppState();
  const [kw, setKw] = useState("");
  const list = agencies.filter((a) =>
    [a.name, a.contactName, a.phone, ...a.people.flatMap((p) => [p.name, p.phone, p.lineName])]
      .filter(Boolean)
      .join(" ")
      .includes(kw.trim()),
  );

  return (
    <div>
      <PageHeader
        title="旅行社管理"
        subtitle="管理合作旅行社與其領隊、司機"
        actions={<LinkButton href="/tours/agencies/new">＋ 新增旅行社</LinkButton>}
      />
      <Input value={kw} onChange={(e) => setKw(e.target.value)} placeholder="搜尋旅行社、領隊、司機姓名或電話" className="mb-5" />

      {list.length === 0 ? (
        <Empty>沒有符合的旅行社</Empty>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {list.map((a) => {
            const bs = bookings.filter((b) => b.agencyId === a.id);
            const leaders = a.people.filter((p) => p.role === "領隊");
            const drivers = a.people.filter((p) => p.role === "司機");
            return (
              <Link key={a.id} href={`/tours/agencies/${a.id}`}>
                <Card className="h-full transition hover:border-brand-300 hover:shadow">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-lg font-semibold text-slate-800">{a.name}</div>
                      <div className="text-sm text-slate-500">
                        {a.contactName && `${a.contactName}・`}
                        {a.phone}
                      </div>
                    </div>
                    <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs text-brand-700">{bs.length} 次預約</span>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <div className="text-xs text-slate-400">領隊 {leaders.length} 位</div>
                      <div className="truncate text-slate-700">{leaders.map((p) => p.name).join("、") || "-"}</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-400">司機 {drivers.length} 位</div>
                      <div className="truncate text-slate-700">{drivers.map((p) => p.name).join("、") || "-"}</div>
                    </div>
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
