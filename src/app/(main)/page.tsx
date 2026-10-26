"use client";

import Link from "next/link";
import { AlertTriangle, Banknote, CalendarPlus, ClipboardList, IdCard, ListOrdered, Search, ShoppingBag, Users } from "lucide-react";
import { Badge, Card, Empty, PageHeader, SectionTitle } from "@/components/ui";
import type { PageKey } from "@/lib/page-access";
import { statsApi, useAppState, useCanEdit, useCanSee } from "@/lib/store";
import { useFetch } from "@/lib/use-fetch";
import { formatDateTime, money, today, weekday } from "@/lib/utils";
import { groupBuyTotal } from "@/lib/calc";

// admin：新增類的捷徑只給管理者；page：一般使用者要有這個頁面的權限才顯示
const QUICK: { href: string; icon: typeof Search; label: string; desc: string; tint: string; page: PageKey; admin?: boolean }[] = [
  { href: "/customers/new", icon: IdCard, label: "名片建檔", desc: "拍名片新增客戶", tint: "bg-brand-100 text-brand-700", page: "customers", admin: true },
  { href: "/customers", icon: Search, label: "客戶查詢", desc: "找客戶、看訂購紀錄", tint: "bg-violet-100 text-violet-700", page: "customers" },
  { href: "/orders/new", icon: ListOrdered, label: "新增訂單", desc: "電話／LINE 訂單", tint: "bg-sky-100 text-sky-700", page: "orders", admin: true },
  { href: "/tours/bookings/new", icon: CalendarPlus, label: "新增採果預約", desc: "旅行社團體預約", tint: "bg-accent-100 text-accent-600", page: "bookings", admin: true },
  { href: "/group-buys/new", icon: ShoppingBag, label: "新增團購", desc: "建立團購合作", tint: "bg-emerald-100 text-emerald-700", page: "gbList", admin: true },
];

export default function Dashboard() {
  const { agencies, bookings, groupBuys } = useAppState();
  // 依後台「頁面權限」只顯示看得到的區塊
  const canSee = useCanSee();
  const canEdit = useCanEdit();
  const quick = QUICK.filter((q) => canSee(q.page) && (!q.admin || canEdit));
  const { data: s } = useFetch("stats", () => statsApi.get());
  const current = s?.bySeason.find((x) => x.season === s.season);
  const now = today();

  const upcoming = bookings
    .filter((b) => b.status === "已預約" && b.datetime.slice(0, 10) >= now)
    .sort((a, b) => a.datetime.localeCompare(b.datetime));
  const activeGb = groupBuys.filter((g) => g.status === "洽談中" || g.status === "進行中");

  const stats = [
    {
      page: "customers" as PageKey,
      label: "客戶總數",
      value: s?.customers.toLocaleString() ?? "…",
      unit: `回購客 ${s?.repeatCustomers.toLocaleString() ?? "…"} 位・疑似無效 ${s?.suspectCustomers.toLocaleString() ?? "…"} 位待確認`,
      href: "/customers",
      icon: Users,
    },
    {
      page: "orders" as PageKey,
      label: `${s?.season ?? ""} 產季營收`,
      value: current ? money(current.amount) : "…",
      unit: `${current?.orders.toLocaleString() ?? "…"} 張訂單`,
      href: `/orders?season=${s?.season ?? ""}`,
      icon: Banknote,
    },
    {
      page: "orders" as PageKey,
      label: "待處理訂單",
      value: s?.pendingOrders.toLocaleString() ?? "…",
      unit: `待匯款 ${s?.unpaidOrders ?? "…"} 張`,
      href: "/orders",
      icon: ClipboardList,
    },
    {
      page: "orders" as PageKey,
      label: "待確認的匯入訂單",
      value: s?.needsReview.toLocaleString() ?? "…",
      unit: "對照原文核對",
      href: "/orders?review=1",
      icon: AlertTriangle,
    },
  ].filter((x) => canSee(x.page));

  return (
    <div>
      <PageHeader title="早安，今天的農場概況" subtitle={`${now.replaceAll("-", "/")}（${weekday(now)}）`} />

      {stats.length > 0 && (
        <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {stats.map((s) => (
            <Link key={s.label} href={s.href}>
              <Card className="transition hover:border-brand-300 hover:shadow">
                <div className="flex items-center justify-between text-sm text-slate-500">
                  {s.label}
                  <s.icon size={20} className="text-brand-500" />
                </div>
                <div className="mt-1 whitespace-nowrap text-2xl font-bold text-slate-900 xl:text-3xl">{s.value}</div>
                <div className="text-xs text-slate-400">{s.unit}</div>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {quick.length > 0 && (
        <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-5">
          {quick.map((q) => (
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
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        {canSee("orders") && (
          <Card>
            <SectionTitle
              right={
                <Link href="/orders" className="text-sm text-brand-700 hover:underline">
                  訂單 →
                </Link>
              }
            >
              📈 各產季訂單
            </SectionTitle>
            {!s ? (
              <Empty>載入中…</Empty>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-400">
                    <th className="pb-1 font-medium">產季</th>
                    <th className="pb-1 text-right font-medium">訂單</th>
                    <th className="pb-1 text-right font-medium">營收</th>
                  </tr>
                </thead>
                <tbody>
                  {[...s.bySeason]
                    .reverse()
                    .slice(0, 8)
                    .map((r) => (
                      <tr key={r.season} className="border-t border-slate-100">
                        <td className="py-1.5">
                          <Link href={`/orders?season=${r.season}`} className="text-brand-700 hover:underline">
                            {r.season}
                          </Link>
                        </td>
                        <td className="py-1.5 text-right text-slate-600">{r.orders.toLocaleString()}</td>
                        <td className="py-1.5 text-right font-medium text-slate-800">{money(r.amount)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            )}
            {s && s.byChannel.length > 0 && (
              <p className="mt-3 text-xs text-slate-500">
                {s.season} 各通路：{s.byChannel.map((c) => `${c.channel} ${c.orders}`).join("、")}
              </p>
            )}
          </Card>
        )}

        {canSee("bookings") && (
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
                            {formatDateTime(b.datetime)}（{weekday(b.datetime)}）・領隊 {leader?.name ?? "-"}{b.plate && `・${b.plate}`}
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
        )}

        {canSee("gbList") && (
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
        )}
      </div>
    </div>
  );
}
