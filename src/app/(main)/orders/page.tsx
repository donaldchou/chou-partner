"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Suspense, useState } from "react";
import { OrderStatusBadge, PayStatusBadge, ReviewBadge } from "@/components/OrderBadges";
import { Card, Empty, Input, LinkButton, PageHeader, Pagination, Select, Spinner, Tabs, useDebounced } from "@/components/ui";
import { itemsText } from "@/lib/calc";
import { BRAND_LABELS, ORDER_CHANNELS, ORDER_STATUSES, PAYMENT_STATUSES } from "@/lib/enums";
import { ordersApi, statsApi } from "@/lib/store";
import { useFetch } from "@/lib/use-fetch";
import { formatDate, money } from "@/lib/utils";

function OrdersList() {
  const router = useRouter();
  const sp = useSearchParams();
  const review = sp.get("review") === "1";
  const [kw, setKw] = useState("");
  const [season, setSeason] = useState(sp.get("season") ?? "");
  const [channel, setChannel] = useState("");
  const [status, setStatus] = useState("");
  const [payStatus, setPayStatus] = useState(sp.get("payStatus") ?? "");
  const [page, setPage] = useState(1);
  const q = useDebounced(kw.trim());

  const params = {
    q,
    season,
    channel,
    status,
    payStatus,
    review: review ? 1 : undefined,
    page,
    limit: 30,
    sort: review ? "old" : undefined,
  };
  const { data, loading, error } = useFetch(JSON.stringify(params), () => ordersApi.list(params));
  const { data: stats } = useFetch("stats", () => statsApi.get());

  const filter =
    <T,>(fn: (v: T) => void) =>
    (v: T) => {
      fn(v);
      setPage(1);
    };

  return (
    <div>
      <PageHeader
        title={review ? "待確認訂單" : "訂單管理"}
        subtitle={review ? "匯入時無法完全確定的訂單，對照原文修正後勾選「已核對」" : "網站、電話、LINE、現場…所有通路的訂單"}
        actions={<LinkButton href="/orders/new">＋ 新增訂單</LinkButton>}
      />

      <Tabs
        value={review ? "review" : "all"}
        onChange={(v) => {
          setPage(1);
          router.replace(v === "review" ? "/orders?review=1" : "/orders");
        }}
        tabs={[
          { value: "all", label: "全部訂單" },
          { value: "review", label: "待確認", count: stats?.needsReview },
        ]}
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative min-w-64 flex-1">
          <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            value={kw}
            onChange={(e) => filter(setKw)(e.target.value)}
            placeholder="訂單編號、姓名、電話、收件地址、託運單號、品項…"
            className="pl-10"
          />
        </div>
        <Select className="w-auto" value={season} onChange={(e) => filter(setSeason)(e.target.value)}>
          <option value="">全部產季</option>
          {(stats?.seasons ?? []).map((s) => (
            <option key={s} value={s}>
              {s} 年
            </option>
          ))}
        </Select>
        <Select className="w-auto" value={channel} onChange={(e) => filter(setChannel)(e.target.value)}>
          <option value="">全部通路</option>
          {ORDER_CHANNELS.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </Select>
        <Select className="w-auto" value={status} onChange={(e) => filter(setStatus)(e.target.value)}>
          <option value="">全部狀態</option>
          {ORDER_STATUSES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </Select>
        <Select className="w-auto" value={payStatus} onChange={(e) => filter(setPayStatus)(e.target.value)}>
          <option value="">全部付款狀態</option>
          {PAYMENT_STATUSES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </Select>
      </div>

      {error && <p className="mb-3 text-sm text-red-600">查詢失敗：{error}</p>}
      {data && (
        <p className="mb-3 text-sm text-slate-500">
          共 {data.total.toLocaleString()} 張訂單・金額合計 {money(data.amount)}
          {loading && "（更新中…）"}
        </p>
      )}

      {!data ? (
        <Spinner />
      ) : data.items.length === 0 ? (
        <Empty>{review ? "沒有待確認的訂單 🎉" : "找不到訂單"}</Empty>
      ) : (
        <Card className={loading ? "overflow-x-auto p-0 opacity-60" : "overflow-x-auto p-0"}>
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-slate-50 text-left text-xs text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">日期／編號</th>
                <th className="px-4 py-3 font-medium">訂購人</th>
                <th className="px-4 py-3 font-medium">品項規格</th>
                <th className="px-4 py-3 font-medium">收件</th>
                <th className="px-4 py-3 text-right font-medium">金額</th>
                <th className="px-4 py-3 font-medium">狀態</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.items.map((o) => (
                <tr key={o.id} className="cursor-pointer align-top hover:bg-brand-50/40" onClick={() => router.push(`/orders/${o.id}`)}>
                  <td className="whitespace-nowrap px-4 py-3">
                    <div className="text-slate-700">{formatDate(o.orderedAt)}</div>
                    <Link href={`/orders/${o.id}`} className="text-xs text-brand-700 hover:underline" onClick={(e) => e.stopPropagation()}>
                      {o.orderNo}
                    </Link>
                    <div className="text-xs text-slate-400">
                      {o.channel}
                      {o.brand && `・${BRAND_LABELS[o.brand]}`}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-800">{o.buyer.name || "（未填）"}</div>
                    <div className="text-xs text-slate-500">{o.buyer.phone}</div>
                    {o.referrer && <div className="text-xs text-violet-600">代訂：{o.referrer}</div>}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{itemsText(o.items) || <span className="text-slate-400">（未填品項）</span>}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {o.shipments.length > 1 ? (
                      <span className="text-amber-700">{o.shipments.length} 個地址</span>
                    ) : (
                      <span className="line-clamp-2">{o.shipments[0]?.recipient.address}</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-medium text-slate-800">{money(o.amounts.total)}</td>
                  <td className="space-y-1 px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      <OrderStatusBadge status={o.status} />
                      <PayStatusBadge status={o.payment.status} />
                      {o.legacy?.needsReview && <ReviewBadge />}
                    </div>
                    {review && (
                      <div className="text-xs text-red-600">{o.legacy?.reviewReasons?.filter((r) => !r.startsWith("提示")).join("、")}</div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      {data && <Pagination page={page} limit={data.limit} total={data.total} onChange={setPage} />}
    </div>
  );
}

export default function OrdersPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <OrdersList />
    </Suspense>
  );
}
