"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import GroupBuyForm from "@/components/GroupBuyForm";
import ItemsEditor from "@/components/ItemsEditor";
import ShippingPanel from "@/components/ShippingPanel";
import { Badge, Button, Card, Empty, Input, Loading, NotFound, PageHeader, SectionTitle, Tabs, Textarea } from "@/components/ui";
import { groupBuyQty, groupBuyTotal } from "@/lib/calc";
import { actions, useAppState, useLoaded } from "@/lib/store";
import type { GroupBuy } from "@/lib/types";
import { formatDate, money, today, uid } from "@/lib/utils";

type Tab = "items" | "notes" | "shipping" | "info";

export default function GroupBuyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const loaded = useLoaded();
  const g = useAppState().groupBuys.find((x) => x.id === id);
  const [tab, setTab] = useState<Tab>("items");

  if (!loaded) return <Loading />;
  if (!g) return <NotFound back="/group-buys" />;

  return (
    <div>
      <PageHeader
        title={g.name}
        back="/group-buys"
        subtitle={`${g.contactName}・${g.phone}${g.lineName ? `・LINE ${g.lineName}` : ""}・${formatDate(g.startDate)} ~ ${formatDate(g.endDate)}`}
        actions={
          <Button
            variant="danger"
            onClick={() => {
              if (confirm(`刪除團購「${g.name}」？`)) {
                actions.deleteGroupBuy(g.id);
                router.push("/group-buys");
              }
            }}
          >
            刪除
          </Button>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          label="狀態"
          value={<Badge color={g.status === "進行中" ? "green" : g.status === "洽談中" ? "amber" : "gray"}>{g.status}</Badge>}
        />
        <Stat label="總件數" value={`${groupBuyQty(g)} 件`} />
        <Stat label="總金額" value={money(groupBuyTotal(g))} strong />
        <Stat label="宅配單" value={g.shippingMode === "provided" ? "業者提供" : "平台產生"} />
      </div>

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "items", label: "品項與金額", count: g.items.length },
          { value: "notes", label: "合作內容紀錄", count: g.coopNotes.length },
          { value: "shipping", label: "宅配單", count: g.backups.length },
          { value: "info", label: "基本資料" },
        ]}
      />

      {tab === "items" && (
        <Card>
          <SectionTitle right={<span className="text-xs text-slate-400">修改後自動儲存</span>}>團購品項、時間與價格</SectionTitle>
          <ItemsEditor items={g.items} onChange={(items) => actions.saveGroupBuy({ ...g, items })} />
        </Card>
      )}
      {tab === "notes" && <CoopNotes g={g} />}
      {tab === "shipping" && <ShippingPanel g={g} />}
      {tab === "info" && (
        <div>
          <GroupBuyForm
            key={g.id}
            initial={g}
            showCard
            onSubmit={(ng) => {
              actions.saveGroupBuy(ng);
              alert("已儲存");
            }}
          />
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, strong }: { label: string; value: React.ReactNode; strong?: boolean }) {
  return (
    <Card className="p-4">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={strong ? "mt-1 text-xl font-bold text-brand-800" : "mt-1 font-semibold text-slate-800"}>{value}</div>
    </Card>
  );
}

function CoopNotes({ g }: { g: GroupBuy }) {
  const [date, setDate] = useState(today());
  const [content, setContent] = useState("");
  const notes = [...g.coopNotes].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_1.4fr]">
      <Card>
        <SectionTitle>新增紀錄</SectionTitle>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!content.trim()) return;
            actions.saveGroupBuy({ ...g, coopNotes: [...g.coopNotes, { id: uid("n"), date, content: content.trim() }] });
            setContent("");
          }}
        >
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <Textarea
            rows={5}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="議價結果、出貨時程、分潤方式、特殊要求…"
          />
          <Button type="submit" className="w-full">
            新增
          </Button>
        </form>
      </Card>
      <Card>
        <SectionTitle>合作歷程</SectionTitle>
        {notes.length === 0 ? (
          <Empty>尚無紀錄</Empty>
        ) : (
          <ol className="relative space-y-4 border-l-2 border-brand-200 pl-5">
            {notes.map((n) => (
              <li key={n.id} className="relative">
                <span className="absolute -left-[27px] top-1 h-3 w-3 rounded-full bg-brand-500 ring-4 ring-white" />
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-brand-700">{formatDate(n.date)}</span>
                  <button
                    className="text-xs text-slate-400 hover:text-red-600"
                    onClick={() =>
                      confirm("刪除這筆紀錄？") && actions.saveGroupBuy({ ...g, coopNotes: g.coopNotes.filter((x) => x.id !== n.id) })
                    }
                  >
                    刪除
                  </button>
                </div>
                <p className="mt-0.5 whitespace-pre-wrap text-sm text-slate-700">{n.content}</p>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </div>
  );
}
