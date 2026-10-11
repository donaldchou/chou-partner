"use client";

import Link from "next/link";
import { Bus, CalendarPlus, ClipboardList, IdCard, Search, ShoppingBag, Truck, Users } from "lucide-react";
import { Badge, Button, Card, Empty, PageHeader, SectionTitle } from "@/components/ui";
import { useState } from "react";
import { loadDemo, useAppState, useLoaded } from "@/lib/store";
import { formatDateTime, money, today, weekday } from "@/lib/utils";
import { groupBuyTotal } from "@/lib/calc";

const QUICK = [
  { href: "/customers/new", icon: IdCard, label: "名片建檔", desc: "拍名片新增客戶", tint: "bg-brand-100 text-brand-700" },
  { href: "/customers", icon: Search, label: "客戶查詢", desc: "找客戶、看訂購紀錄", tint: "bg-violet-100 text-violet-700" },
  { href: "/tours/bookings/new", icon: CalendarPlus, label: "新增採果預約", desc: "旅行社團體預約", tint: "bg-accent-100 text-accent-600" },
  { href: "/group-buys/new", icon: ShoppingBag, label: "新增團購", desc: "建立團購合作", tint: "bg-emerald-100 text-emerald-700" },
];

export default function Dashboard() {
  const { customers, agencies, bookings, groupBuys } = useAppState();
  const now = today();

  const upcoming = bookings
    .filter((b) => b.status === "已預約" && b.datetime.slice(0, 10) >= now)
    .sort((a, b) => a.datetime.localeCompare(b.datetime));
  const activeGb = groupBuys.filter((g) => g.status === "洽談中" || g.status === "進行中");
  const upcomingPeople = upcoming.reduce((s, b) => s + b.headcount, 0);

  const stats = [
    { label: "客戶總數", value: customers.length, unit: "位", href: "/customers", icon: Users },
    { label: "合作旅行社", value: agencies.length, unit: "家", href: "/tours/agencies", icon: Bus },
    { label: "待到場團體", value: upcoming.length, unit: `團 / ${upcomingPeople} 人`, href: "/tours/bookings", icon: ClipboardList },
    { label: "進行中團購", value: activeGb.length, unit: "檔", href: "/group-buys", icon: Truck },
  ];

  return (
    <div>
      <PageHeader title="早安，今天的農場概況" subtitle={`${now.replaceAll("-", "/")}（${weekday(now)}）`} />

      <EmptyDB />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <Link key={s.label} href={s.href}>
            <Card className="transition hover:border-brand-300 hover:shadow">
              <div className="flex items-center justify-between text-sm text-slate-500">
                {s.label}
                <s.icon size={20} className="text-brand-500" />
              </div>
              <div className="mt-1 text-3xl font-bold text-slate-900">{s.value}</div>
              <div className="text-xs text-slate-400">{s.unit}</div>
            </Card>
          </Link>
        ))}
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        {QUICK.map((q) => (
          <Link
            key={q.href}
            href={q.href}
            className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md"
          >
            <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${q.tint}`}>
              <q.icon size={24} />
            </span>
            <span>
              <span className="block font-semibold text-slate-800">{q.label}</span>
              <span className="block text-xs text-slate-500">{q.desc}</span>
            </span>
          </Link>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <SectionTitle
            right={
              <Link href="/tours/bookings" className="text-sm text-brand-700 hover:underline">
                全部 →
              </Link>
            }
          >
            🚌 即將到場的遊覽車
          </SectionTitle>
          {upcoming.length === 0 ? (
            <Empty>近期沒有預約</Empty>
          ) : (
            <ul className="divide-y divide-slate-100">
              {upcoming.slice(0, 5).map((b) => {
                const agency = agencies.find((a) => a.id === b.agencyId);
                const leader = agency?.people.find((p) => p.id === b.leaderId);
                return (
                  <li key={b.id}>
                    <Link href={`/tours/bookings/${b.id}`} className="flex items-center justify-between gap-3 py-3 hover:bg-slate-50">
                      <div>
                        <div className="font-medium text-slate-800">{agency?.name ?? "（未知旅行社）"}</div>
                        <div className="text-xs text-slate-500">
                          {formatDateTime(b.datetime)}（{weekday(b.datetime)}）・領隊 {leader?.name ?? "-"}・{b.plate}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-slate-800">{b.headcount} 人</div>
                        <Badge color={b.buyingPower === "高" ? "green" : b.buyingPower === "中" ? "amber" : "gray"}>
                          購買力{b.buyingPower}
                        </Badge>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card>
          <SectionTitle
            right={
              <Link href="/group-buys" className="text-sm text-brand-700 hover:underline">
                全部 →
              </Link>
            }
          >
            📦 進行中的團購
          </SectionTitle>
          {activeGb.length === 0 ? (
            <Empty>沒有進行中的團購</Empty>
          ) : (
            <ul className="divide-y divide-slate-100">
              {activeGb.map((g) => (
                <li key={g.id}>
                  <Link href={`/group-buys/${g.id}`} className="flex items-center justify-between gap-3 py-3 hover:bg-slate-50">
                    <div>
                      <div className="font-medium text-slate-800">{g.name}</div>
                      <div className="text-xs text-slate-500">
                        {g.contactName}・{g.startDate.replaceAll("-", "/")} ~ {g.endDate.replaceAll("-", "/")}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-slate-800">{money(groupBuyTotal(g))}</div>
                      <Badge color={g.status === "進行中" ? "green" : "amber"}>{g.status}</Badge>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

/** 資料庫還沒有任何資料時，提供一鍵放入示範資料 */
function EmptyDB() {
  const loaded = useLoaded();
  const { customers, agencies, bookings, groupBuys } = useAppState();
  const [busy, setBusy] = useState(false);
  if (!loaded || customers.length + agencies.length + bookings.length + groupBuys.length > 0) return null;
  return (
    <Card className="mb-5 flex flex-wrap items-center justify-between gap-3 border-brand-200 bg-brand-50">
      <div>
        <div className="font-semibold text-slate-800">資料庫目前是空的</div>
        <div className="text-sm text-slate-500">可以直接開始建檔，或先放入示範資料體驗操作流程（之後可以逐筆刪除）。</div>
      </div>
      <Button
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await loadDemo();
          } catch (e) {
            alert(e instanceof Error ? e.message : String(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "載入中…" : "放入示範資料"}
      </Button>
    </Card>
  );
}
