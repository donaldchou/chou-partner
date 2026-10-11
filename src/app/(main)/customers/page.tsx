"use client";

import Link from "next/link";
import { Search } from "lucide-react";
import { useState } from "react";
import { Badge, Card, Empty, Input, LinkButton, PageHeader, Pagination, Select, Spinner, useDebounced } from "@/components/ui";
import { itemsText } from "@/lib/calc";
import { CUSTOMER_SOURCES } from "@/lib/enums";
import { customersApi, type OrderBrief } from "@/lib/store";
import type { Customer } from "@/lib/types";
import { useFetch } from "@/lib/use-fetch";
import { formatDate, money } from "@/lib/utils";

const SORTS = [
  { v: "recent", label: "最近購買" },
  { v: "orders", label: "訂單數最多" },
  { v: "spent", label: "累計金額最高" },
  { v: "created", label: "最新建檔" },
  { v: "name", label: "姓名" },
];

export default function CustomersPage() {
  const [kw, setKw] = useState("");
  const [sort, setSort] = useState("recent");
  const [source, setSource] = useState("");
  const [page, setPage] = useState(1);
  const q = useDebounced(kw.trim());
  const params = { q, sort, source, page, limit: 20, withOrders: 1 };
  const { data, loading, error } = useFetch(JSON.stringify(params), () => customersApi.list(params));

  const reset =
    <T,>(fn: (v: T) => void) =>
    (v: T) => {
      fn(v);
      setPage(1);
    };

  return (
    <div>
      <PageHeader
        title="客戶資料查詢"
        subtitle="可用姓名、公司、電話、地址、LINE，或買過的品項規格查詢（例如「甜柿 台中」）"
        actions={
          <>
            <LinkButton href="/customers/import" variant="secondary">
              匯入歷史紀錄
            </LinkButton>
            <LinkButton href="/customers/new">＋ 新增客戶</LinkButton>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative min-w-64 flex-1">
          <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            autoFocus
            value={kw}
            onChange={(e) => reset(setKw)(e.target.value)}
            placeholder="輸入關鍵字，例如：王小明、0912、台中、甜柿 8粒…"
            className="py-3 pl-10 text-base"
          />
        </div>
        <Select className="w-auto" value={source} onChange={(e) => reset(setSource)(e.target.value)}>
          <option value="">全部來源</option>
          {CUSTOMER_SOURCES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </Select>
        <Select className="w-auto" value={sort} onChange={(e) => reset(setSort)(e.target.value)}>
          {SORTS.map((s) => (
            <option key={s.v} value={s.v}>
              {s.label}
            </option>
          ))}
        </Select>
      </div>

      {error && <p className="mb-3 text-sm text-red-600">查詢失敗：{error}</p>}
      {data && (
        <p className="mb-3 text-sm text-slate-500">
          共 {data.total.toLocaleString()} 位客戶{loading && "（更新中…）"}
        </p>
      )}

      {!data ? (
        <Spinner />
      ) : data.items.length === 0 ? (
        <Empty>找不到符合「{q}」的客戶</Empty>
      ) : (
        <div className={loading ? "space-y-3 opacity-60" : "space-y-3"}>
          {data.items.map((c) => (
            <CustomerResult key={c.id} c={c} />
          ))}
        </div>
      )}
      {data && <Pagination page={page} limit={data.limit} total={data.total} onChange={setPage} />}
    </div>
  );
}

const statusColor = { 新訂單: "blue", 處理中: "amber", 已出貨: "green", 已完成: "green", 已取消: "gray" } as const;

function CustomerResult({ c }: { c: Customer & { orders?: OrderBrief[] } }) {
  const [open, setOpen] = useState(false);
  const orders = c.orders ?? [];
  const shown = open ? orders : orders.slice(0, 3);
  const address = c.addresses[0];

  return (
    <Card className="p-0">
      <div className="grid gap-4 p-5 md:grid-cols-[1fr_1.4fr]">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/customers/${c.id}`} className="text-lg font-semibold text-slate-800 hover:text-brand-700">
              {c.name}
            </Link>
            {c.title && <span className="text-sm text-slate-500">{c.title}</span>}
            {c.tags.includes("回購客") && <Badge color="green">回購客</Badge>}
            {c.sources.map((s) => (
              <Badge key={s} color="gray">
                {s}
              </Badge>
            ))}
          </div>
          <div className="mt-0.5 text-sm font-medium text-slate-600">{c.company || "個人客戶"}</div>
          <dl className="mt-3 space-y-1 text-sm">
            <div className="flex gap-2">
              <dt className="w-10 shrink-0 text-slate-400">電話</dt>
              <dd className="flex flex-wrap gap-x-3">
                {c.phones.map((p) => (
                  <a key={p.digits} href={`tel:${p.digits}`} className="text-brand-700 hover:underline">
                    {p.number}
                  </a>
                ))}
              </dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-10 shrink-0 text-slate-400">地址</dt>
              <dd className="text-slate-700">
                {address ? `${address.zip ? address.zip + " " : ""}${address.address}` : "-"}
                {c.addresses.length > 1 && <span className="ml-1 text-xs text-slate-400">（另有 {c.addresses.length - 1} 個地址）</span>}
              </dd>
            </div>
            {c.lineName && (
              <div className="flex gap-2">
                <dt className="w-10 shrink-0 text-slate-400">LINE</dt>
                <dd className="text-slate-700">{c.lineName}</dd>
              </div>
            )}
          </dl>
        </div>

        <div className="rounded-lg bg-slate-50 p-3">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-medium text-slate-700">歷年訂購紀錄（{c.stats.orderCount} 筆）</span>
            <span className="text-slate-500">累計 {money(c.stats.totalSpent)}</span>
          </div>
          {orders.length === 0 ? (
            <p className="text-sm text-slate-400">尚無訂購紀錄</p>
          ) : (
            <ul className="space-y-1.5">
              {shown.map((o) => (
                <li key={o.id}>
                  <Link
                    href={`/orders/${o.id}`}
                    className="block rounded-md bg-white px-3 py-2 text-sm ring-1 ring-slate-200 hover:ring-brand-300"
                  >
                    <div className="flex items-center justify-between gap-2 text-xs text-slate-400">
                      <span>
                        {formatDate(o.orderedAt)}・{o.channel}・{o.orderNo}
                      </span>
                      <span className="flex items-center gap-2">
                        {o.status !== "已出貨" && <Badge color={statusColor[o.status]}>{o.status}</Badge>}
                        {money(o.amounts.total)}
                      </span>
                    </div>
                    <div className="text-slate-700">{itemsText(o.items) || "（未填品項）"}</div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {orders.length > 3 && (
            <button onClick={() => setOpen(!open)} className="mt-2 text-xs text-brand-700 hover:underline">
              {open ? "收合" : `顯示全部 ${orders.length} 筆`}
            </button>
          )}
        </div>
      </div>
    </Card>
  );
}
