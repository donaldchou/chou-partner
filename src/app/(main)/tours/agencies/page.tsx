"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { CircleHelp, LayoutGrid, List } from "lucide-react";
import {
  agencyCity,
  AgencyStatusBadge,
  AgencyStatusButton,
  agencyStatus,
  FruitTourBadge,
  LICENSE_HELP,
  LICENSE_HELP_ALL,
  LicenseBadge,
} from "@/components/AgencyStatus";
import { Card, Empty, Input, LinkButton, PageHeader, Select, Table, Tabs, Td } from "@/components/ui";
import { AGENCY_LICENSES, AGENCY_STATUSES, COUNTIES } from "@/lib/enums";
import { usePersistentState } from "@/lib/persist";
import { useAppState, useCanEdit } from "@/lib/store";
import type { Agency, AgencyStatus, Booking } from "@/lib/types";
import { cn } from "@/lib/utils";

type View = "card" | "list";
type Tab = "全部" | AgencyStatus;
/** 這一頁的所有設定都記在瀏覽器，F5 重新整理不會還原 */
const DEFAULTS = { tab: "配合中" as Tab, view: "card" as View, city: "", license: "", fruitOnly: false, kw: "" };

export default function AgenciesPage() {
  const { agencies, bookings } = useAppState();
  const canEdit = useCanEdit();
  const [s, set] = usePersistentState("chou-partner:agencies-page", DEFAULTS);
  const { tab, view, city, license, fruitOnly, kw } = s;

  const inTab = (st: Tab) => (st === "全部" ? agencies : agencies.filter((a) => agencyStatus(a) === st));
  // 縣市選項：這個分頁裡有的縣市，依 COUNTIES 的北到南順序
  const cities: string[] = COUNTIES.filter((c) => inTab(tab).some((a) => agencyCity(a) === c));
  const list = inTab(tab).filter(
    (a) =>
      (!fruitOnly || !!a.fruitTour) &&
      (!city || agencyCity(a) === city) &&
      (!license || (a.license ?? "") === license) &&
      [a.name, a.contactName, a.phone, ...(a.otherPhones ?? []), a.address, ...a.people.flatMap((p) => [p.name, p.phone, p.lineName])]
        .filter(Boolean)
        .join(" ")
        .includes(kw.trim()),
  );
  // 全部：依配合中、待聯絡、無意願排；待聯絡：有採果行程的排前面
  if (tab === "全部") list.sort((x, y) => AGENCY_STATUSES.indexOf(agencyStatus(x)) - AGENCY_STATUSES.indexOf(agencyStatus(y)));
  if (tab === "待聯絡") list.sort((x, y) => Number(!!y.fruitTour) - Number(!!x.fruitTour));
  const filtering = !!(city || license || fruitOnly || kw.trim());

  return (
    <div>
      <PageHeader
        title="旅行社管理"
        subtitle="管理合作旅行社與其領隊、司機；待聯絡名單聯絡後可轉為洽談中、配合中或無意願"
        actions={<LinkButton href="/tours/agencies/new">＋ 新增旅行社</LinkButton>}
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
          placeholder="搜尋旅行社、地址、領隊、司機姓名或電話"
          className="min-w-48 flex-1"
        />
        <Select value={city} onChange={(e) => set({ city: e.target.value })} className="w-auto" aria-label="縣市">
          <option value="">全部縣市</option>
          {/* 記住的縣市在這個分頁沒有資料時也保留選項，避免選單顯示錯誤 */}
          {(city && !cities.includes(city) ? [city, ...cities] : cities).map((c) => (
            <option key={c}>{c}</option>
          ))}
        </Select>
        <div className="flex items-center gap-1">
          <Select
            value={license}
            onChange={(e) => set({ license: e.target.value })}
            className="w-auto"
            aria-label="旅行社種類"
            title={license ? LICENSE_HELP[license] : LICENSE_HELP_ALL}
          >
            <option value="">全部種類</option>
            {AGENCY_LICENSES.map((l) => (
              <option key={l} value={l} title={LICENSE_HELP[l]}>
                {l}旅行社{l === "乙種" ? "（只做國內）" : ""}
              </option>
            ))}
          </Select>
          <span title={LICENSE_HELP_ALL} aria-label="三種旅行社的差別" className="cursor-help text-slate-400 hover:text-brand-600">
            <CircleHelp size={18} />
          </span>
        </div>
        <label className="flex shrink-0 items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={fruitOnly} onChange={(e) => set({ fruitOnly: e.target.checked })} className="h-4 w-4" />
          只看有採果行程
        </label>
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-500">
          共 {list.length} 間
          {filtering && (
            <button
              type="button"
              onClick={() => set({ city: "", license: "", fruitOnly: false, kw: "" })}
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
        <Empty>沒有符合的旅行社</Empty>
      ) : view === "list" ? (
        <AgencyTable list={list} bookings={bookings} tab={tab} canEdit={canEdit} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {list.map((a) => (
            <AgencyCard key={a.id} a={a} bookings={bookings} canEdit={canEdit} showStatus={tab === "全部"} />
          ))}
        </div>
      )}
    </div>
  );
}

function AgencyCard({ a, bookings, canEdit, showStatus }: { a: Agency; bookings: Booking[]; canEdit: boolean; showStatus: boolean }) {
  const bs = bookings.filter((b) => b.agencyId === a.id);
  const leaders = a.people.filter((p) => p.role === "領隊");
  const drivers = a.people.filter((p) => p.role === "司機");
  // 待聯絡、無意願都還不是合作對象：顯示採果行程與狀態按鈕
  const pending = agencyStatus(a) !== "配合中";
  return (
    <Link href={`/tours/agencies/${a.id}`}>
      <Card className={cn("flex h-full flex-col transition hover:border-brand-300 hover:shadow", agencyStatus(a) === "無意願" && "opacity-75")}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-lg font-semibold text-slate-800">{a.name}</div>
            {(showStatus || a.license || agencyCity(a)) && (
              <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                {showStatus && <AgencyStatusBadge agency={a} />}
                <LicenseBadge license={a.license} />
                {agencyCity(a) && <span className="text-xs text-slate-500">{agencyCity(a)}</span>}
              </div>
            )}
            <div className="text-sm text-slate-500">
              {a.contactName && `${a.contactName}・`}
              {[a.phone, ...(a.otherPhones ?? [])].join("・")}
            </div>
            {pending && a.address && <div className="truncate text-xs text-slate-400">{a.address}</div>}
          </div>
          {pending ? (
            a.fruitTour && <FruitTourBadge className="shrink-0" />
          ) : (
            <span className="shrink-0 rounded-full bg-brand-50 px-2.5 py-1 text-xs text-brand-700">{bs.length} 次預約</span>
          )}
        </div>
        {pending ? (
          <>
            {a.fruitTour && <p className="mt-3 line-clamp-2 text-sm text-accent-600">{a.fruitTour}</p>}
            {canEdit && (
              <div className="mt-4">
                <AgencyStatusButton agency={a} allowDecline />
              </div>
            )}
          </>
        ) : (
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
        )}
      </Card>
    </Link>
  );
}

/** 清單：一列一間，點整列進總覽 */
function AgencyTable({ list, bookings, tab, canEdit }: { list: Agency[]; bookings: Booking[]; tab: Tab; canEdit: boolean }) {
  const router = useRouter();
  // 配合中看領隊／司機與預約；其他分頁（含全部）看採果行程與狀態按鈕
  const pending = tab !== "配合中";
  const head = ["旅行社", ...(tab === "全部" ? ["狀態"] : []), "種類", "縣市", "電話", pending ? "採果行程" : "領隊／司機", pending ? "" : "預約"];
  return (
    <Table head={head}>
      {list.map((a) => {
        const leaders = a.people.filter((p) => p.role === "領隊").length;
        const drivers = a.people.filter((p) => p.role === "司機").length;
        return (
          <tr key={a.id} onClick={() => router.push(`/tours/agencies/${a.id}`)} className="cursor-pointer transition-colors hover:bg-brand-100">
            <Td>
              <Link href={`/tours/agencies/${a.id}`} className="font-medium text-slate-800 hover:text-brand-700">
                {a.name}
              </Link>
              {a.contactName && <div className="text-xs text-slate-500">{a.contactName}</div>}
            </Td>
            {tab === "全部" && (
              <Td>
                <AgencyStatusBadge agency={a} />
              </Td>
            )}
            <Td>
              <LicenseBadge license={a.license} />
            </Td>
            <Td className="whitespace-nowrap text-slate-600">{agencyCity(a) || "-"}</Td>
            <Td className="whitespace-nowrap text-slate-700">
              {[a.phone, ...(a.otherPhones ?? [])].map((p) => (
                <div key={p}>{p}</div>
              ))}
            </Td>
            {pending ? (
              <>
                <Td className="max-w-md">
                  {a.fruitTour ? (
                    <div className="flex items-start gap-2">
                      <FruitTourBadge className="shrink-0" />
                      <span className="line-clamp-2 text-xs text-accent-600">{a.fruitTour}</span>
                    </div>
                  ) : (
                    <span className="text-slate-300">-</span>
                  )}
                </Td>
                <Td className="whitespace-nowrap text-right">
                  {canEdit && <AgencyStatusButton agency={a} allowDecline compact />}
                </Td>
              </>
            ) : (
              <>
                <Td className="whitespace-nowrap text-slate-600">
                  領隊 {leaders}・司機 {drivers}
                </Td>
                <Td className="whitespace-nowrap text-slate-600">{bookings.filter((b) => b.agencyId === a.id).length} 次</Td>
              </>
            )}
          </tr>
        );
      })}
    </Table>
  );
}
