"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Pencil, Share2, Trash2 } from "lucide-react";
import { BookingStatusBadge, BuyingPowerBadge } from "@/components/BookingBadges";
import BookingReferenceCard from "@/components/BookingReferenceCard";
import { PhotoStrip } from "@/components/PhotoUploader";
import { Button, Card, Empty, LinkButton, PageHeader, Tabs } from "@/components/ui";
import { actions, useAppState, useCanEdit } from "@/lib/store";
import type { Booking } from "@/lib/types";
import { formatDate, today, weekday } from "@/lib/utils";

type Filter = "upcoming" | "past" | "cancelled" | "all";

export default function BookingsPage() {
  const { bookings, agencies, busCompanies } = useAppState();
  const [filter, setFilter] = useState<Filter>("upcoming");
  const [card, setCard] = useState<Booking | null>(null);
  const canEdit = useCanEdit();
  const router = useRouter();
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
        actions={<LinkButton href="/tours/bookings/new">＋ 新增採果預約</LinkButton>}
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
                  const bus = busCompanies.find((c) => c.id === b.busCompanyId);
                  const driver = [...(a?.people ?? []), ...(bus?.people ?? [])].find((p) => p.id === b.driverId);
                  const plan = a?.plans?.find((p) => p.id === b.planId);
                  return (
                    <Card key={b.id} className="flex items-stretch p-0 transition hover:border-brand-300">
                      <Link
                        href={`/tours/bookings/${b.id}`}
                        className="grid min-w-0 flex-1 gap-3 p-4 sm:grid-cols-[80px_1fr_auto] sm:items-center"
                      >
                        <div className="text-2xl font-bold text-brand-800">{b.datetime.slice(11, 16)}</div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-slate-800">{a?.name ?? "（已刪除的旅行社）"}</span>
                            <BookingStatusBadge status={b.status} />
                            <BuyingPowerBadge level={b.buyingPower} />
                          </div>
                          <div className="mt-1 text-sm text-slate-500">
                            領隊 {leader ? `${leader.name} ${leader.phone}` : "-"}・遊覽車 {bus?.name ?? "-"}・司機 {driver?.name ?? "-"}・車牌 {b.plate || "-"}
                          </div>
                          <div className="text-sm text-slate-500">
                            客群來自 {b.county || "-"}
                            {b.buyingPowerNote && `・${b.buyingPowerNote}`}
                          </div>
                          {plan && (
                            <div className="mt-2 flex items-start gap-3 rounded-lg bg-slate-50 p-2.5 text-sm">
                              {/* 不撐滿寬度：照片緊接在文字右邊 */}
                              <div className="min-w-0 space-y-1">
                                <div className="font-medium text-slate-700">
                                  🍊 {plan.group && <span className="text-brand-700">{plan.group}・</span>}
                                  {plan.name}
                                </div>
                                {plan.content && <div className="whitespace-pre-line text-slate-600">{plan.content}</div>}
                              </div>
                              {plan.photos.length > 0 && (
                                <div className="shrink-0">
                                  <PhotoStrip photos={plan.photos} max={3} size="h-16 w-16 sm:h-24 sm:w-24" />
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="text-right">
                          <div className="text-xl font-semibold text-slate-800">{b.headcount}</div>
                          <div className="text-xs text-slate-400">人</div>
                        </div>
                      </Link>
                      <div className="flex flex-col items-center justify-center gap-0.5 border-l border-slate-100 px-1 sm:flex-row sm:px-2">
                        <Button variant="ghost" className="px-2.5 text-brand-700" onClick={() => setCard(b)} title="員工參考卡">
                          <Share2 size={16} />
                        </Button>
                        {canEdit && (
                          <>
                            <Button variant="ghost" className="px-2.5" onClick={() => router.push(`/tours/bookings/${b.id}`)} title="編輯">
                              <Pencil size={16} />
                            </Button>
                            <Button
                              variant="ghost"
                              className="px-2.5 text-red-600"
                              title="刪除"
                              onClick={() => confirm(`刪除 ${formatDate(date)} ${a?.name ?? ""} 的預約？`) && actions.deleteBooking(b.id)}
                            >
                              <Trash2 size={16} />
                            </Button>
                          </>
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
      {card && <BookingReferenceCard booking={card} onClose={() => setCard(null)} />}
    </div>
  );
}
