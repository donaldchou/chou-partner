"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import CustomerForm from "@/components/CustomerForm";
import CustomerPicker from "@/components/CustomerPicker";
import { OrderStatusBadge, PayStatusBadge, ReviewBadge } from "@/components/OrderBadges";
import { Badge, Button, Card, Empty, LinkButton, Modal, NotFound, PageHeader, SectionTitle, Spinner } from "@/components/ui";
import { itemsText } from "@/lib/calc";
import { customersApi, type CustomerWithOrders } from "@/lib/store";
import type { Customer } from "@/lib/types";
import { useFetch } from "@/lib/use-fetch";
import { formatDate, money } from "@/lib/utils";

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: c, error, loading, set, reload } = useFetch(`customer:${id}`, () => customersApi.get(id));
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [merging, setMerging] = useState(false);

  if (error) return <NotFound back="/customers" />;
  if (!c || (loading && !c)) return <Spinner />;

  if (editing)
    return (
      <div>
        <PageHeader title="編輯客戶資料" />
        <CustomerForm
          initial={c}
          saving={saving}
          onCancel={() => setEditing(false)}
          onSubmit={async (nc) => {
            setSaving(true);
            try {
              const saved = await customersApi.save(nc);
              set({ ...c, ...saved });
              setEditing(false);
            } catch (e) {
              alert(`儲存失敗：${e instanceof Error ? e.message : e}`);
            } finally {
              setSaving(false);
            }
          }}
        />
      </div>
    );

  async function remove(cust: CustomerWithOrders) {
    const n = cust.orders.length;
    if (!confirm(n ? `「${cust.name}」有 ${n} 張訂單，刪除客戶會連訂單一起刪除，確定嗎？` : `確定刪除客戶「${cust.name}」？`)) return;
    try {
      await customersApi.remove(cust.id, n > 0);
      router.push("/customers");
    } catch (e) {
      alert(`刪除失敗：${e instanceof Error ? e.message : e}`);
    }
  }

  return (
    <div>
      <PageHeader
        title={c.name}
        subtitle={c.company || "個人客戶"}
        back="/customers"
        actions={
          <>
            <Button variant="secondary" onClick={() => setMerging(true)}>
              合併重複客戶
            </Button>
            <Button variant="secondary" onClick={() => setEditing(true)}>
              編輯資料
            </Button>
            <LinkButton href={`/orders/new?customer=${c.id}`}>＋ 新增訂單</LinkButton>
          </>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="訂單數" value={`${c.stats.orderCount} 筆`} />
        <Stat label="累計金額" value={money(c.stats.totalSpent)} strong />
        <Stat label="第一次購買" value={formatDate(c.stats.firstOrderAt) || "-"} />
        <Stat label="最近購買" value={formatDate(c.stats.lastOrderAt) || "-"} sub={c.stats.lastProduct} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[340px_1fr]">
        <div className="space-y-4">
          <Card>
            <SectionTitle>基本資料</SectionTitle>
            <div className="mb-3 flex flex-wrap gap-1.5">
              {c.sources.map((s) => (
                <Badge key={s}>{s}</Badge>
              ))}
              {c.tags.map((t) => (
                <Badge key={t} color={t === "回購客" ? "green" : "purple"}>
                  {t}
                </Badge>
              ))}
            </div>
            <dl className="space-y-2 text-sm">
              <Row label="電話">
                {c.phones.map((p) => (
                  <div key={p.digits}>
                    <a href={`tel:${p.digits}`} className="text-brand-700">
                      {p.number}
                    </a>
                    <span className="ml-1 text-xs text-slate-400">{p.type}</span>
                  </div>
                ))}
              </Row>
              <Row label="職稱">{c.title}</Row>
              <Row label="性別">{c.gender === "F" ? "女" : c.gender === "M" ? "男" : ""}</Row>
              <Row label="Email">{c.emails.join("、")}</Row>
              <Row label="LINE">{c.lineName}</Row>
              <Row label="地址">
                {c.addresses.map((a, i) => (
                  <div key={i} className={i ? "mt-1 text-slate-500" : ""}>
                    {a.zip && `${a.zip} `}
                    {a.address}
                  </div>
                ))}
              </Row>
              <Row label="建檔日">{formatDate(c.createdAt)}</Row>
              <Row label="備註">{c.note}</Row>
            </dl>
          </Card>
          {c.cardImage && (
            <Card>
              <SectionTitle>名片</SectionTitle>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={c.cardImage} alt="名片" className="w-full rounded-lg border border-slate-200" />
            </Card>
          )}
          <Button variant="danger" className="w-full" onClick={() => remove(c)}>
            刪除客戶
          </Button>
        </div>

        <Card>
          <SectionTitle>歷年訂購紀錄</SectionTitle>
          {c.orders.length === 0 ? (
            <Empty>尚無訂購紀錄</Empty>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-slate-500">
                    <th className="py-2 pr-3 font-medium">日期</th>
                    <th className="py-2 pr-3 font-medium">訂單</th>
                    <th className="py-2 pr-3 font-medium">品項規格</th>
                    <th className="py-2 pr-3 font-medium">收件</th>
                    <th className="py-2 pr-3 text-right font-medium">金額</th>
                    <th className="py-2 font-medium">狀態</th>
                  </tr>
                </thead>
                <tbody>
                  {c.orders.map((o) => (
                    <tr key={o.id} className="border-b border-slate-100 align-top hover:bg-slate-50">
                      <td className="whitespace-nowrap py-2 pr-3 text-slate-500">{formatDate(o.orderedAt)}</td>
                      <td className="whitespace-nowrap py-2 pr-3">
                        <Link href={`/orders/${o.id}`} className="text-brand-700 hover:underline">
                          {o.orderNo}
                        </Link>
                        <div className="text-xs text-slate-400">{o.channel}</div>
                      </td>
                      <td className="py-2 pr-3 text-slate-700">{itemsText(o.items) || "（未填品項）"}</td>
                      <td className="py-2 pr-3 text-xs text-slate-500">
                        {o.shipments.length > 1
                          ? `${o.shipments.length} 個地址`
                          : o.shipments[0]?.recipient.name !== c.name
                            ? o.shipments[0]?.recipient.name
                            : ""}
                      </td>
                      <td className="whitespace-nowrap py-2 pr-3 text-right">{money(o.amounts.total)}</td>
                      <td className="space-x-1 whitespace-nowrap py-2">
                        <OrderStatusBadge status={o.status} />
                        <PayStatusBadge status={o.payment.status} />
                        {o.legacy?.needsReview && <ReviewBadge />}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {merging && (
        <Modal open onClose={() => setMerging(false)} title={`把重複的客戶併入「${c.name}」`}>
          <p className="mb-3 text-sm text-slate-600">
            選擇另一位其實是同一人的客戶：電話、地址、Email、標籤會合併到「{c.name}」，訂單也會移過來，原本那筆客戶資料會刪除。
          </p>
          <CustomerPicker
            exclude={c.id}
            onPick={async (other: Customer) => {
              if (!confirm(`確定把「${other.name}」（${other.stats.orderCount} 筆訂單）併入「${c.name}」？`)) return;
              try {
                set(await customersApi.merge(c.id, other.id));
                setMerging(false);
              } catch (e) {
                alert(`合併失敗：${e instanceof Error ? e.message : e}`);
                reload();
              }
            }}
          />
        </Modal>
      )}
    </div>
  );
}

function Stat({ label, value, sub, strong }: { label: string; value: React.ReactNode; sub?: string; strong?: boolean }) {
  return (
    <Card className="p-4">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={strong ? "mt-1 text-xl font-bold text-brand-800" : "mt-1 font-semibold text-slate-800"}>{value}</div>
      {sub && <div className="truncate text-xs text-slate-400">{sub}</div>}
    </Card>
  );
}

function Row({ label, children }: { label: string; children?: React.ReactNode }) {
  const empty = children === undefined || children === "" || (Array.isArray(children) && children.length === 0);
  return (
    <div className="flex gap-3">
      <dt className="w-12 shrink-0 text-slate-400">{label}</dt>
      <dd className="min-w-0 text-slate-700">{empty ? "-" : children}</dd>
    </div>
  );
}
