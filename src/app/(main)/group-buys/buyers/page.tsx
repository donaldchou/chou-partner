"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { LayoutGrid, List } from "lucide-react";
import { agencyCity, AgencyStatusButton, agencyStatus, FruitTourBadge } from "@/components/AgencyStatus";
import { KindBadge, shortLink } from "@/components/GroupBuyerFields";
import { Card, Empty, Input, LinkButton, PageHeader, Select, Table, Tabs, Td } from "@/components/ui";
import { groupBuyTotal } from "@/lib/calc";
import { COUNTIES, GROUP_BUYER_KINDS } from "@/lib/enums";
import { usePersistentState } from "@/lib/persist";
import { actions, useAppState, useCanEdit } from "@/lib/store";
import type { AgencyStatus, GroupBuy, GroupBuyer } from "@/lib/types";
import { cn, money } from "@/lib/utils";

type View = "card" | "list";
/** 這一頁的所有設定都記在瀏覽器，F5 重新整理不會還原 */
const DEFAULTS = { tab: "配合中" as AgencyStatus, view: "card" as View, city: "", kind: "", fruitOnly: false, kw: "" };

const saveBuyer = (b: GroupBuyer) => actions.saveGroupBuyer(b);

export default function GroupBuyersPage() {
  const { groupBuyers, groupBuys } = useAppState();
  const canEdit = useCanEdit();
  const [s, set] = usePersistentState("chou-partner:group-buyers-page", DEFAULTS);
  const { tab, view, city, kind, fruitOnly, kw } = s;

  const inTab = (st: AgencyStatus) => groupBuyers.filter((b) => agencyStatus(b) === st);
  const cities: string[] = COUNTIES.filter((c) => inTab(tab).some((b) => agencyCity(b) === c));
  const list = inTab(tab).filter(
    (b) =>
      (!fruitOnly || !!b.fruitDeal) &&
      (!city || agencyCity(b) === city) &&
      (!kind || (b.kind ?? "") === kind) &&
      [b.name, b.contactName, b.phone, ...(b.otherPhones ?? []), b.address, b.lineName, b.website, ...(b.links ?? [])]
        .filter(Boolean)
        .join(" ")
        .includes(kw.trim()),
  );
  // 有水果團購的排前面
  if (tab === "待聯絡") list.sort((x, y) => Number(!!y.fruitDeal) - Number(!!x.fruitDeal));
  const filtering = !!(city || kind || fruitOnly || kw.trim());

  return (
    <div>
      <PageHeader
        title="團購管理"
        subtitle="管理團購業者與他們開的團；待聯絡名單聯絡完成後可轉為配合中"
        actions={<LinkButton href="/group-buys/buyers/new">＋ 新增團購業者</LinkButton>}
      />

      <Tabs
        value={tab}
        onChange={(v) => set({ tab: v })}
        tabs={[
          { value: "配合中", label: "配合中", count: inTab("配合中").length },
          { value: "待聯絡", label: "待聯絡", count: inTab("待聯絡").length },
        ]}
      />

      <div className="mb-3 flex flex-wrap items-center gap-3">
        <Input
          value={kw}
          onChange={(e) => set({ kw: e.target.value })}
          placeholder="搜尋業者名稱、電話、地址或社群連結"
          className="min-w-48 flex-1"
        />
        <Select value={city} onChange={(e) => set({ city: e.target.value })} className="w-auto" aria-label="縣市">
          <option value="">全部縣市</option>
          {(city && !cities.includes(city) ? [city, ...cities] : cities).map((c) => (
            <option key={c}>{c}</option>
          ))}
        </Select>
        <Select value={kind} onChange={(e) => set({ kind: e.target.value })} className="w-auto" aria-label="業者類型">
          <option value="">全部類型</option>
          {GROUP_BUYER_KINDS.map((k) => (
            <option key={k}>{k}</option>
          ))}
        </Select>
        <label className="flex shrink-0 items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={fruitOnly} onChange={(e) => set({ fruitOnly: e.target.checked })} className="h-4 w-4" />
          只看有水果團購
        </label>
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-500">
          共 {list.length} 家
          {filtering && (
            <button
              type="button"
              onClick={() => set({ city: "", kind: "", fruitOnly: false, kw: "" })}
              className="ml-2 text-brand-700 underline underline-offset-2"
            >
              清除篩選
            </button>
          )}
        </p>
        <div className="flex rounded-lg border border-slate-300 bg-white p-0.5" role="group" aria-label="檢視方式">
          {(
            [
              { v: "list", label: "清單", Icon: List },
              { v: "card", label: "卡片", Icon: LayoutGrid },
            ] as const
          ).map(({ v, label, Icon }) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => set({ view: v })}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm",
                view === v ? "bg-brand-600 text-white" : "text-slate-600 hover:bg-slate-100",
              )}
            >
              <Icon size={15} /> {label}
            </button>
          ))}
        </div>
      </div>

      {list.length === 0 ? (
        <Empty>{groupBuyers.length ? "沒有符合的團購業者" : "尚未建立團購業者"}</Empty>
      ) : view === "list" ? (
        <BuyerTable list={list} groupBuys={groupBuys} pending={tab === "待聯絡"} canEdit={canEdit} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {list.map((b) => (
            <BuyerCard key={b.id} b={b} groupBuys={groupBuys} canEdit={canEdit} />
          ))}
        </div>
      )}
    </div>
  );
}

const contactLine = (b: GroupBuyer) => [b.phone, ...(b.otherPhones ?? [])].filter(Boolean).join("・");

function BuyerCard({ b, groupBuys, canEdit }: { b: GroupBuyer; groupBuys: GroupBuy[]; canEdit: boolean }) {
  const gs = groupBuys.filter((g) => g.buyerId === b.id);
  const pending = agencyStatus(b) === "待聯絡";
  const link = b.website || b.links?.[0];
  return (
    <Link href={`/group-buys/buyers/${b.id}`}>
      <Card className="flex h-full flex-col transition hover:border-brand-300 hover:shadow">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-lg font-semibold text-slate-800">{b.name}</div>
            <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
              <KindBadge kind={b.kind} />
              {agencyCity(b) && <span className="text-xs text-slate-500">{agencyCity(b)}</span>}
            </div>
            <div className="text-sm text-slate-500">
              {b.contactName && `${b.contactName}・`}
              {contactLine(b) || (b.lineName ? `LINE：${b.lineName}` : "（無公開電話）")}
            </div>
            {link && <div className="truncate text-xs text-brand-700">{shortLink(link)}</div>}
          </div>
          {pending ? (
            b.fruitDeal && <FruitTourBadge className="shrink-0" label="有水果團購" />
          ) : (
            <span className="shrink-0 rounded-full bg-brand-50 px-2.5 py-1 text-xs text-brand-700">{gs.length} 次團購</span>
          )}
        </div>
        {pending ? (
          <>
            {b.fruitDeal && <p className="mt-3 line-clamp-2 text-sm text-accent-600">{b.fruitDeal}</p>}
            {canEdit && <AgencyStatusButton agency={b} onSave={saveBuyer} className="mt-4 self-start" />}
          </>
        ) : (
          <div className="mt-4 text-sm text-slate-600">累計團購金額 {money(gs.reduce((sum, g) => sum + groupBuyTotal(g), 0))}</div>
        )}
      </Card>
    </Link>
  );
}

/** 清單：一列一家，點整列進總覽 */
function BuyerTable({ list, groupBuys, pending, canEdit }: { list: GroupBuyer[]; groupBuys: GroupBuy[]; pending: boolean; canEdit: boolean }) {
  const router = useRouter();
  return (
    <Table head={["團購業者", "類型", "縣市", "聯絡方式", pending ? "水果團購" : "團購", ""]}>
      {list.map((b) => {
        const gs = groupBuys.filter((g) => g.buyerId === b.id);
        const link = b.website || b.links?.[0];
        return (
          <tr key={b.id} onClick={() => router.push(`/group-buys/buyers/${b.id}`)} className="cursor-pointer hover:bg-slate-50">
            <Td>
              <Link href={`/group-buys/buyers/${b.id}`} className="font-medium text-slate-800 hover:text-brand-700">
                {b.name}
              </Link>
              {b.contactName && <div className="text-xs text-slate-500">{b.contactName}</div>}
            </Td>
            <Td>
              <KindBadge kind={b.kind} />
            </Td>
            <Td className="whitespace-nowrap text-slate-600">{agencyCity(b) || "-"}</Td>
            <Td className="max-w-xs text-slate-700">
              {[b.phone, ...(b.otherPhones ?? [])].filter(Boolean).map((p) => (
                <div key={p} className="whitespace-nowrap">
                  {p}
                </div>
              ))}
              {link && <div className="truncate text-xs text-brand-700">{shortLink(link)}</div>}
            </Td>
            {pending ? (
              <Td className="max-w-md">
                {b.fruitDeal ? (
                  <div className="flex items-start gap-2">
                    <FruitTourBadge className="shrink-0" label="有水果團購" />
                    <span className="line-clamp-2 text-xs text-accent-600">{b.fruitDeal}</span>
                  </div>
                ) : (
                  <span className="text-slate-300">-</span>
                )}
              </Td>
            ) : (
              <Td className="whitespace-nowrap text-slate-600">
                {gs.length} 次・{money(gs.reduce((sum, g) => sum + groupBuyTotal(g), 0))}
              </Td>
            )}
            <Td className="whitespace-nowrap text-right">
              {pending && canEdit && <AgencyStatusButton agency={b} onSave={saveBuyer} className="px-2.5 py-1.5 text-xs" />}
            </Td>
          </tr>
        );
      })}
    </Table>
  );
}
