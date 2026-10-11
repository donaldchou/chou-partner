"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import CustomerForm from "@/components/CustomerForm";
import { Badge, Button, Card, Empty, Field, Input, Loading, Modal, NotFound, PageHeader, SectionTitle, Textarea } from "@/components/ui";
import { customerTotal, orderTotal } from "@/lib/calc";
import { actions, useAppState, useLoaded } from "@/lib/store";
import type { Order, OrderItem } from "@/lib/types";
import { formatDate, money, PRODUCTS, today, uid } from "@/lib/utils";

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const loaded = useLoaded();
  const c = useAppState().customers.find((x) => x.id === id);
  const [editing, setEditing] = useState(false);
  const [orderOpen, setOrderOpen] = useState(false);

  if (!loaded) return <Loading />;
  if (!c) return <NotFound back="/customers" />;

  if (editing)
    return (
      <div>
        <PageHeader title="編輯客戶資料" />
        <CustomerForm
          initial={c}
          onCancel={() => setEditing(false)}
          onSubmit={(nc) => {
            actions.saveCustomer(nc);
            setEditing(false);
          }}
        />
      </div>
    );

  const orders = [...c.orders].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div>
      <PageHeader
        title={c.name}
        subtitle={c.company || "個人客戶"}
        back="/customers"
        actions={
          <>
            <Button variant="secondary" onClick={() => setEditing(true)}>
              編輯資料
            </Button>
            <Button onClick={() => setOrderOpen(true)}>＋ 新增訂購紀錄</Button>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <div className="space-y-4">
          <Card>
            <SectionTitle right={<Badge>{c.source}</Badge>}>基本資料</SectionTitle>
            <dl className="space-y-2 text-sm">
              <Row label="職稱" value={c.title} />
              <Row
                label="電話"
                value={
                  c.phone && (
                    <a href={`tel:${c.phone}`} className="text-brand-700">
                      {c.phone}
                    </a>
                  )
                }
              />
              <Row label="Email" value={c.email} />
              <Row label="LINE" value={c.lineName} />
              <Row label="地址" value={c.address} />
              <Row label="建檔日" value={formatDate(c.createdAt)} />
              <Row label="備註" value={c.note} />
            </dl>
          </Card>
          {c.cardImage && (
            <Card>
              <SectionTitle>名片</SectionTitle>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={c.cardImage} alt="名片" className="w-full rounded-lg border border-slate-200" />
            </Card>
          )}
          <Button
            variant="danger"
            className="w-full"
            onClick={() => {
              if (confirm(`確定刪除客戶「${c.name}」？`)) {
                actions.deleteCustomer(c.id);
                router.push("/customers");
              }
            }}
          >
            刪除客戶
          </Button>
        </div>

        <Card>
          <SectionTitle right={<span className="text-sm text-slate-500">累計 {money(customerTotal(c))}</span>}>歷年訂購紀錄</SectionTitle>
          {orders.length === 0 ? (
            <Empty>尚無訂購紀錄</Empty>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-slate-500">
                    <th className="py-2 pr-3 font-medium">日期</th>
                    <th className="py-2 pr-3 font-medium">產品</th>
                    <th className="py-2 pr-3 font-medium">規格</th>
                    <th className="py-2 pr-3 text-right font-medium">數量</th>
                    <th className="py-2 pr-3 text-right font-medium">單價</th>
                    <th className="py-2 text-right font-medium">小計</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) =>
                    o.items.map((i, k) => (
                      <tr key={`${o.id}-${k}`} className={k === 0 ? "border-t border-slate-100" : ""}>
                        <td className="py-2 pr-3 align-top text-slate-500">{k === 0 && formatDate(o.date)}</td>
                        <td className="py-2 pr-3 font-medium text-slate-800">{i.product}</td>
                        <td className="py-2 pr-3 text-slate-600">{i.spec}</td>
                        <td className="py-2 pr-3 text-right">{i.qty}</td>
                        <td className="py-2 pr-3 text-right">{i.unitPrice.toLocaleString()}</td>
                        <td className="py-2 text-right">{(i.qty * i.unitPrice).toLocaleString()}</td>
                        <td className="py-2 pl-2 text-right align-top">
                          {k === 0 && (
                            <button
                              className="text-xs text-slate-400 hover:text-red-600"
                              onClick={() =>
                                confirm("刪除這筆訂購紀錄？") &&
                                actions.saveCustomer({ ...c, orders: c.orders.filter((x) => x.id !== o.id) })
                              }
                            >
                              刪除
                            </button>
                          )}
                        </td>
                      </tr>
                    )),
                  )}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <OrderModal
        open={orderOpen}
        onClose={() => setOrderOpen(false)}
        onSave={(o) => {
          actions.saveCustomer({ ...c, orders: [...c.orders, o] });
          setOrderOpen(false);
        }}
      />
    </div>
  );
}

function Row({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <dt className="w-12 shrink-0 text-slate-400">{label}</dt>
      <dd className="text-slate-700">{value || "-"}</dd>
    </div>
  );
}

const emptyItem = (): OrderItem => ({ product: PRODUCTS[0], spec: "", qty: 1, unitPrice: 0 });

function OrderModal({ open, onClose, onSave }: { open: boolean; onClose: () => void; onSave: (o: Order) => void }) {
  const [date, setDate] = useState(today());
  const [items, setItems] = useState<OrderItem[]>([emptyItem()]);
  const [note, setNote] = useState("");
  const total = orderTotal({ id: "", date, items });
  const setItem = (idx: number, patch: Partial<OrderItem>) => setItems((prev) => prev.map((x, i) => (i === idx ? { ...x, ...patch } : x)));

  return (
    <Modal open={open} onClose={onClose} title="新增訂購紀錄" wide>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          onSave({ id: uid("o"), date, items, note });
          setItems([emptyItem()]);
          setNote("");
        }}
      >
        <Field label="訂購日期" className="max-w-xs">
          <Input type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <div className="space-y-2">
          {items.map((it, idx) => (
            <div key={idx} className="grid grid-cols-2 gap-2 rounded-lg bg-slate-50 p-2 sm:grid-cols-[1fr_1.5fr_80px_100px_auto]">
              <Input
                list="products"
                placeholder="產品"
                required
                value={it.product}
                onChange={(e) => setItem(idx, { product: e.target.value })}
              />
              <Input placeholder="規格，如 6 粒裝禮盒" required value={it.spec} onChange={(e) => setItem(idx, { spec: e.target.value })} />
              <Input
                type="number"
                min={1}
                placeholder="數量"
                value={it.qty}
                onChange={(e) => setItem(idx, { qty: Number(e.target.value) })}
              />
              <Input
                type="number"
                min={0}
                placeholder="單價"
                value={it.unitPrice}
                onChange={(e) => setItem(idx, { unitPrice: Number(e.target.value) })}
              />
              <Button variant="ghost" disabled={items.length === 1} onClick={() => setItems(items.filter((_, i) => i !== idx))}>
                ✕
              </Button>
            </div>
          ))}
          <datalist id="products">
            {PRODUCTS.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
          <Button variant="secondary" onClick={() => setItems([...items, emptyItem()])}>
            ＋ 加一項產品
          </Button>
        </div>
        <Field label="備註">
          <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        <div className="flex items-center justify-between border-t border-slate-200 pt-4">
          <span className="text-lg font-semibold text-slate-800">合計 {money(total)}</span>
          <Button type="submit">儲存</Button>
        </div>
      </form>
    </Modal>
  );
}
