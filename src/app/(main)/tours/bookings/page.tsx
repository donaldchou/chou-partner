"use client";

import Link from "next/link";
import { useState } from "react";
import { BookingStatusBadge, BuyingPowerBadge } from "@/components/BookingBadges";
import { Card, Empty, LinkButton, PageHeader, Tabs } from "@/components/ui";
import { useAppState } from "@/lib/store";
import type { Booking } from "@/lib/types";
import { formatDate, today, weekday } from "@/lib/utils";

type Filter = "upcoming" | "past" | "cancelled" | "all";

export default function BookingsPage() {
  const { bookings, agencies } = useAppState();
  const [filter, setFilter] = useState<Filter>("upcoming");
  const now = today();

  const groups: Record<Filter, Booking[]> = {
    upcoming: bookings.filter((b) => b.status === "已預約" && b.datetime.slice(0, 10) >= now),
    past: bookings.filter((b) => b.status === "已到場" || (b.status === "已預約" && b.datetime.slice(0, 10) < now)),
    cancelled: bookings.filter((b) => b.status === "已取消"),
    all: bookings,
  };
  const asc = filter === "upcoming";
  const list = [...groups[filter]].sort((a, b) => (asc ? 1 : -1) * a.datetime.localeCompare(b.datetime));

  // 依日期分組
  const byDate = new Map<string, Booking[]>();
  for (const b of list) {
    const d = b.datetime.slice(0, 10);
    byDate.set(d, [...(byDate.get(d) ?? []), b]);
  }

  return (
    <div>
      <PageHeader
        title="採果時間預約"
        subtitle="旅行社遊覽車團體採果預約"
        actions={<LinkButton href="/tours/bookings/new">＋ 新增預約</LinkButton>}
      />

      <Tabs
        value={filter}
        onChange={setFilter}
        tabs={[
          { value: "upcoming", label: "即將到場", count: groups.upcoming.length },
          { value: "past", label: "已到場 / 過期", count: groups.past.length },
          { value: "cancelled", label: "已取消", count: groups.cancelled.length },
          { value: "all", label: "全部", count: groups.all.length },
        ]}
      />

      {list.length === 0 ? (
        <Empty>沒有預約資料</Empty>
      ) : (
        <div className="space-y-6">
          {[...byDate].map(([date, items]) => (
            <section key={date}>
              <h2 className="mb-2 flex items-baseline gap-2 text-sm font-semibold text-slate-600">
                <span className="text-base text-slate-800">{formatDate(date)}</span>
                <span>{weekday(date)}</span>
                {date === now && <span className="rounded bg-amber-400 px-1.5 text-xs text-amber-950">今天</span>}
                <span className="font-normal text-slate-400">共 {items.reduce((s, b) => s + b.headcount, 0)} 人</span>
              </h2>
              <div className="space-y-2">
                {items.map((b) => {
                  const a = agencies.find((x) => x.id === b.agencyId);
                  const leader = a?.people.find((p) => p.id === b.leaderId);
                  const driver = a?.people.find((p) => p.id === b.driverId);
                  return (
                    <Link key={b.id} href={`/tours/bookings/${b.id}`}>
                      <Card className="grid gap-3 p-4 transition hover:border-brand-300 sm:grid-cols-[80px_1fr_auto] sm:items-center">
                        <div className="text-2xl font-bold text-brand-800">{b.datetime.slice(11, 16)}</div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-slate-800">{a?.name ?? "（已刪除的旅行社）"}</span>
                            <BookingStatusBadge status={b.status} />
                            <BuyingPowerBadge level={b.buyingPower} />
                          </div>
                          <div className="mt-1 text-sm text-slate-500">
                            領隊 {leader ? `${leader.name} ${leader.phone}` : "-"}・司機 {driver?.name ?? "-"}・車牌 {b.plate}
                          </div>
                          <div className="text-sm text-slate-500">
                            客群來自 {b.county}
                            {b.buyingPowerNote && `・${b.buyingPowerNote}`}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xl font-semibold text-slate-800">{b.headcount}</div>
                          <div className="text-xs text-slate-400">人</div>
                        </div>
                      </Card>
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
