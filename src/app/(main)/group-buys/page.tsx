"use client";

import Link from "next/link";
import { useState } from "react";
import { Badge, Card, Empty, LinkButton, PageHeader, Tabs } from "@/components/ui";
import { groupBuyQty, groupBuyTotal } from "@/lib/calc";
import { useAppState } from "@/lib/store";
import type { GroupBuyStatus } from "@/lib/types";
import { formatDate, money } from "@/lib/utils";

const statusColor = { 洽談中: "amber", 進行中: "green", 已出貨: "blue", 已結案: "gray" } as const;
type Filter = "all" | GroupBuyStatus;

export default function GroupBuysPage() {
  const { groupBuys, groupBuyers } = useAppState();
  const [filter, setFilter] = useState<Filter>("all");
  const list = groupBuys.filter((g) => filter === "all" || g.status === filter);
  const statuses: GroupBuyStatus[] = ["洽談中", "進行中", "已出貨", "已結案"];

  return (
    <div>
      <PageHeader
        title="團購列表"
        subtitle="每一次開團的品項金額、合作紀錄與宅配單；業者資料在「團購管理」"
        actions={<LinkButton href="/group-buys/new">＋ 新增團購</LinkButton>}
      />

      <Tabs
        value={filter}
        onChange={setFilter}
        tabs={[
          { value: "all", label: "全部", count: groupBuys.length },
          ...statuses.map((s) => ({ value: s, label: s, count: groupBuys.filter((g) => g.status === s).length })),
        ]}
      />

      {list.length === 0 ? (
        <Empty>沒有團購資料</Empty>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {list.map((g) => (
            <Link key={g.id} href={`/group-buys/${g.id}`}>
              <Card className="h-full transition hover:border-brand-300 hover:shadow">
                <div className="flex items-start justify-between gap-2">
                  <div className="font-semibold text-slate-800">{g.name}</div>
                  <Badge color={statusColor[g.status]}>{g.status}</Badge>
                </div>
                {g.buyerId && (
                  <div className="text-xs font-medium text-violet-700">
                    {groupBuyers.find((b) => b.id === g.buyerId)?.name ?? "（已刪除的團購業者）"}
                  </div>
                )}
                <div className="mt-1 text-sm text-slate-500">
                  {g.contactName}・{g.phone}
                  {g.lineName && `・LINE ${g.lineName}`}
                </div>
                <div className="text-sm text-slate-500">
                  {formatDate(g.startDate)} ~ {formatDate(g.endDate)}
                </div>
                <div className="mt-4 flex items-end justify-between">
                  <div className="text-xs text-slate-500">
                    {g.items
                      .map((i) => i.product)
                      .filter((v, i, a) => a.indexOf(v) === i)
                      .join("、") || "尚未設定品項"}
                    ・共 {groupBuyQty(g)} 件
                    <div className="mt-1">
                      <Badge color={g.shippingMode === "provided" ? "purple" : "blue"}>
                        {g.shippingMode === "provided" ? "業者提供宅配單" : "平台產生宅配單"}
                      </Badge>
                    </div>
                  </div>
                  <div className="text-lg font-bold text-brand-800">{money(groupBuyTotal(g))}</div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
