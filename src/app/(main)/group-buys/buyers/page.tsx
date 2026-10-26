"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { LayoutGrid, List } from "lucide-react";
import { agencyCity, AgencyStatusBadge, AgencyStatusButton, agencyStatus, FruitTourBadge } from "@/components/AgencyStatus";
import { KindBadge, shortLink } from "@/components/GroupBuyerFields";
import { Card, Empty, Input, LinkButton, PageHeader, Select, Table, Tabs, Td } from "@/components/ui";
import { groupBuyTotal } from "@/lib/calc";
import { AGENCY_STATUSES, COUNTIES, GROUP_BUYER_KINDS } from "@/lib/enums";
import { usePersistentState } from "@/lib/persist";
import { actions, useAppState, useCanEdit } from "@/lib/store";
import type { AgencyStatus, GroupBuy, GroupBuyer } from "@/lib/types";
import { cn, money } from "@/lib/utils";

type View = "card" | "list";
type Tab = "全部" | AgencyStatus;
/** 這一頁的所有設定都記在瀏覽器，F5 重新整理不會還原 */
const DEFAULTS = { tab: "配合中" as Tab, view: "card" as View, city: "", kind: "", fruitOnly: false, kw: "" };

const saveBuyer = (b: GroupBuyer) => actions.saveGroupBuyer(b);

export default function GroupBuyersPage() {
  const { groupBuyers, groupBuys } = useAppState();
  const canEdit = useCanEdit();
  const [s, set] = usePersistentState("chou-partner:group-buyers-page", DEFAULTS);
  const { tab, view, city, kind, fruitOnly, kw } = s;

  const inTab = (st: Tab) => (st === "全部" ? groupBuyers : groupBuyers.filter((b) => agencyStatus(b) === st));
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
  // 全部：依配合中、洽談中、待聯絡、無意願排；待聯絡：有水果團購的排前面
  if (tab === "全部") list.sort((x, y) => AGENCY_STATUSES.indexOf(agencyStatus(x)) - AGENCY_STATUSES.indexOf(agencyStatus(y)));
  if (tab === "待聯絡") list.sort((x, y) => Number(!!y.fruitDeal) - Number(!!x.fruitDeal));
  const filtering = !!(city || kind || fruitOnly || kw.trim());

  return (
    <div>
      <PageHeader
        title="團購管理"
        subtitle="管理團購業者與他們開的團；待聯絡名單聯絡後可轉為洽談中、配合中或無意願"
        actions={<LinkButton href="/group-buys/buyers/new">＋ 新增團購業者</LinkButton>}
      />

      <Tabs
        value={tab}
        onChange={(v) => set({ tab: v })}
        tabs={(["全部", ...AGENCY_STATUSES] as Tab[]).map((t) => ({ value: t, label: t, count: inTab(t).length }))}
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
        <BuyerTable list={list} groupBuys={groupBuys} tab={tab} canEdit={canEdit} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {list.map((b) => (
            <BuyerCard key={b.id} b={b} groupBuys={groupBuys} canEdit={canEdit} showStatus={tab === "全部"} />
          ))}
        </div>
      )}
    </div>
  );
}

const contactLine = (b: GroupBuyer) => [b.phone, ...(b.otherPhones ?? [])].filter(Boolean).join("・");

function BuyerCard({ b, groupBuys, canEdit, showStatus }: { b: GroupBuyer; groupBuys: GroupBuy[]; canEdit: boolean; showStatus: boolean }) {
  const gs = groupBuys.filter((g) => g.buyerId === b.id);
  // 洽談中、待聯絡、無意願都還不是合作對象：顯示水果團購與狀態按鈕
  const pending = agencyStatus(b) !== "配合中";
  const link = b.website || b.links?.[0];
  return (
    <Link href={`/group-buys/buyers/${b.id}`}>
      <Card className={cn("flex h-full flex-col transition hover:border-brand-300 hover:shadow", agencyStatus(b) === "無意願" && "opacity-75")}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-lg font-semibold text-slate-800">{b.name}</div>
            <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
              {showStatus && <AgencyStatusBadge agency={b} />}
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
            {canEdit && (
              <div className="mt-4">
                <AgencyStatusButton agency={b} onSave={saveBuyer} allowDecline />
              </div>
            )}
          </>
        ) : (
          <div className="mt-4 text-sm text-slate-600">累計團購金額 {money(gs.reduce((sum, g) => sum + groupBuyTotal(g), 0))}</div>
        )}
      </Card>
    </Link>
  );
}

/** 清單：一列一家，點整列進總覽 */
function BuyerTable({ list, groupBuys, tab, canEdit }: { list: GroupBuyer[]; groupBuys: GroupBuy[]; tab: Tab; canEdit: boolean }) {
  const router = useRouter();
  // 配合中看團購次數與金額；其他分頁（含全部）看水果團購與狀態按鈕
  const pending = tab !== "配合中";
  // 類型與縣市合成一欄，讓狀態按鈕放得下
  const head = ["團購業者", ...(tab === "全部" ? ["狀態"] : []), "類型／縣市", "聯絡方式", pending ? "水果團購" : "團購", ""];
  return (
    <Table head={head}>
      {list.map((b) => {
        const gs = groupBuys.filter((g) => g.buyerId === b.id);
        const link = b.website || b.links?.[0];
        return (
          <tr key={b.id} onClick={() => router.push(`/group-buys/buyers/${b.id}`)} className="cursor-pointer transition-colors hover:bg-brand-100">
            <Td>
              <Link href={`/group-buys/buyers/${b.id}`} className="font-medium text-slate-800 hover:text-brand-700">
                {b.name}
              </Link>
              {b.contactName && <div className="text-xs text-slate-500">{b.contactName}</div>}
            </Td>
            {tab === "全部" && (
              <Td>
                <AgencyStatusBadge agency={b} />
              </Td>
            )}
            <Td>
              <KindBadge kind={b.kind} />
              {agencyCity(b) && <div className="mt-1 whitespace-nowrap text-xs text-slate-500">{agencyCity(b)}</div>}
            </Td>
            <Td className="max-w-[12rem] text-slate-700">
              {[b.phone, ...(b.otherPhones ?? [])].filter(Boolean).map((p) => (
                <div key={p} className="whitespace-nowrap">
                  {p}
                </div>
              ))}
              {link && <div className="truncate text-xs text-brand-700">{shortLink(link)}</div>}
            </Td>
            {pending ? (
              <Td className="whitespace-nowrap">
                {/* 欄位多、空間小：只放標籤，說明放在滑鼠提示 */}
                {b.fruitDeal ? (
                  <span title={b.fruitDeal} className="cursor-help">
                    <FruitTourBadge label="有水果團購" />
                  </span>
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
              {pending && canEdit && <AgencyStatusButton agency={b} onSave={saveBuyer} allowDecline compact />}
            </Td>
          </tr>
        );
      })}
    </Table>
  );
}
