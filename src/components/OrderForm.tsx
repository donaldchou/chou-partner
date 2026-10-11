"use client";

import Link from "next/link";
import { Copy, Plus, X } from "lucide-react";
import { useState } from "react";
import { boxes, orderAmounts } from "@/lib/calc";
import { DELIVERY_SLOTS, ORDER_CHANNELS, ORDER_STATUSES, PAYMENT_METHODS, PAYMENT_STATUSES, SHIPMENT_STATUSES } from "@/lib/enums";
import { useAppState } from "@/lib/store";
import type { Customer, Order, OrderItem, Shipment } from "@/lib/types";
import { cn, money, uid } from "@/lib/utils";
import CustomerPicker from "./CustomerPicker";
import { Badge, Button, Card, Field, Input, SectionTitle, Select, Textarea } from "./ui";

const PRODUCT_NAMES = ["水蜜桃", "甜柿", "蜜蘋果", "甘露", "李子", "水蜜桃乾", "果醬", "柿餅"];

export function emptyOrder(id: string, now: string): Order {
  return {
    id,
    orderNo: "",
    channel: "電話",
    brand: "",
    season: Number(now.slice(0, 4)),
    customerId: "",
    buyer: { name: "", phone: "", phone2: "", email: "", gender: "" },
    referrer: "",
    orderedAt: now,
    items: [],
    extras: [],
    shipments: [emptyShipment("s1")],
    payment: { method: "", status: "未付款", codFee: 0, paidAmount: 0, paidAt: "", reports: [] },
    amounts: { items: 0, extras: 0, codFee: 0, shipping: 0, adjust: 0, total: 0 },
    status: "新訂單",
    processedAt: "",
    note: "",
    internalNote: "",
  };
}

function emptyShipment(id: string): Shipment {
  return {
    id,
    recipient: { name: "", phone: "", phone2: "", zip: "", address: "" },
    items: [],
    deliverySlot: "",
    requestedShipDate: "",
    shippedAt: "",
    carrier: "",
    packages: [],
    status: "待出貨",
  };
}

const num = (v: string) => (v === "" ? 0 : Number(v));

export default function OrderForm({
  initial,
  customer: initialCustomer,
  saving,
  onSubmit,
  onCancel,
  submitLabel = "儲存訂單",
  extraActions,
}: {
  initial: Order;
  customer: Customer | null;
  saving?: boolean;
  onSubmit: (o: Order) => void;
  onCancel: () => void;
  submitLabel?: string;
  extraActions?: (o: Order) => React.ReactNode;
}) {
  const { products } = useAppState();
  const [o, setO] = useState(initial);
  const [customer, setCustomer] = useState(initialCustomer);
  const set = <K extends keyof Order>(k: K, v: Order[K]) => setO((p) => ({ ...p, [k]: v }));
  const amounts = orderAmounts(o);

  // 本產季價格：依品項 + 粒數找網站售價，方便快速帶入
  const seasonPrice = (product: string, spec: string) => {
    const pieces = Number(/(\d+)/.exec(spec)?.[1]);
    const p = products.find((x) => x.category === product && x.pieces === pieces && x.brand !== "bigfarm");
    const prices = p?.prices ?? [];
    return prices.find((x) => x.season === o.season)?.salePrice ?? prices.at(-1)?.salePrice;
  };
  const quickSpecs = [...new Set(products.filter((p) => p.active && p.brand !== "bigfarm").map((p) => `${p.category}|${p.spec}`))];

  const setItem = (i: number, patch: Partial<OrderItem>) =>
    set(
      "items",
      o.items.map((x, j) => (j === i ? { ...x, ...patch } : x)),
    );
  const setShipment = (i: number, patch: Partial<Shipment>) =>
    set(
      "shipments",
      o.shipments.map((x, j) => (j === i ? { ...x, ...patch } : x)),
    );

  function pickCustomer(c: Customer) {
    setCustomer(c);
    const phone = c.phones.find((p) => p.type === "手機")?.number ?? c.phones[0]?.number ?? "";
    setO((p) => ({
      ...p,
      customerId: c.id,
      buyer: { ...p.buyer, name: c.name, phone, email: c.emails[0] ?? "" },
      shipments: p.shipments.map((s, k) =>
        k === 0 && !s.recipient.address
          ? { ...s, recipient: { name: c.name, phone, phone2: "", zip: c.addresses[0]?.zip ?? "", address: c.addresses[0]?.address ?? "" } }
          : s,
      ),
    }));
  }

  const legacy = o.legacy;
  const itemBoxes = boxes(o.items);
  const shipBoxes = o.shipments.reduce((s, x) => s + boxes(x.items), 0);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!o.customerId) return alert("請選擇客戶");
        onSubmit({ ...o, amounts });
      }}
      className={cn("grid gap-5", legacy?.rawText && "xl:grid-cols-[1fr_380px]")}
    >
      <div className="min-w-0 space-y-5">
        {/* 客戶 */}
        <Card>
          <SectionTitle>客戶（訂購人／付款人）</SectionTitle>
          {customer ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <Link href={`/customers/${customer.id}`} className="font-semibold text-brand-700 hover:underline">
                  {customer.name}
                </Link>
                {customer.company && <span className="ml-2 text-sm text-slate-500">{customer.company}</span>}
                <span className="ml-2 text-sm text-slate-500">{customer.phones.map((p) => p.number).join("、")}</span>
                <div className="text-xs text-slate-400">
                  {customer.stats.orderCount} 筆訂單・累計 {money(customer.stats.totalSpent)}
                </div>
              </div>
              <Button variant="ghost" onClick={() => setCustomer(null)}>
                更換客戶
              </Button>
            </div>
          ) : (
            <div>
              <CustomerPicker onPick={pickCustomer} />
              <p className="mt-2 text-xs text-slate-500">
                找不到？先到
                <Link href="/customers/new" className="mx-1 text-brand-700 hover:underline" target="_blank">
                  客戶建檔
                </Link>
                新增客戶，再回來搜尋。
              </p>
            </div>
          )}
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <Field label="訂購人姓名（這張訂單）">
              <Input value={o.buyer.name} onChange={(e) => set("buyer", { ...o.buyer, name: e.target.value })} />
            </Field>
            <Field label="訂購人電話">
              <Input value={o.buyer.phone} onChange={(e) => set("buyer", { ...o.buyer, phone: e.target.value })} />
            </Field>
            <Field label="代訂／介紹人">
              <Input value={o.referrer ?? ""} onChange={(e) => set("referrer", e.target.value)} placeholder="例如：○○指送" />
            </Field>
          </div>
        </Card>

        {/* 訂單資訊 */}
        <Card>
          <SectionTitle right={o.orderNo ? <Badge>{o.orderNo}</Badge> : <span className="text-xs text-slate-400">儲存後自動編號</span>}>
            訂單資訊
          </SectionTitle>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="通路">
              <Select value={o.channel} onChange={(e) => set("channel", e.target.value as Order["channel"])}>
                {ORDER_CHANNELS.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </Select>
            </Field>
            <Field label="產季">
              <Input type="number" value={o.season} onChange={(e) => set("season", num(e.target.value))} />
            </Field>
            <Field label="下單時間">
              <Input type="datetime-local" value={o.orderedAt} onChange={(e) => set("orderedAt", e.target.value)} />
            </Field>
            <Field label="訂單狀態">
              <Select value={o.status} onChange={(e) => set("status", e.target.value as Order["status"])}>
                {ORDER_STATUSES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </Select>
            </Field>
          </div>
        </Card>

        {/* 品項 */}
        <Card>
          <SectionTitle
            right={
              <Button
                variant="ghost"
                onClick={() => set("items", [...o.items, { product: "水蜜桃", spec: "", qty: 1, unitPrice: 0, subtotal: 0 }])}
              >
                <Plus size={16} /> 加品項
              </Button>
            }
          >
            品項（共 {itemBoxes} 盒）
          </SectionTitle>
          {quickSpecs.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-1.5">
              <span className="text-xs leading-6 text-slate-400">快速加入：</span>
              {quickSpecs.map((k) => {
                const [product, spec] = k.split("|");
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() =>
                      set("items", [...o.items, { product, spec, qty: 1, unitPrice: seasonPrice(product, spec) ?? 0, subtotal: 0 }])
                    }
                    className="rounded-full border border-slate-300 px-2.5 py-0.5 text-xs text-slate-600 hover:border-brand-400 hover:text-brand-700"
                  >
                    {product} {spec}
                  </button>
                );
              })}
            </div>
          )}
          <datalist id="order-products">
            {PRODUCT_NAMES.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
          <div className="space-y-2">
            {o.items.map((it, i) => (
              <div
                key={i}
                className="grid grid-cols-2 items-center gap-2 rounded-lg bg-slate-50 p-2 sm:grid-cols-[1fr_1fr_80px_100px_100px_36px]"
              >
                <Input
                  list="order-products"
                  placeholder="品項"
                  value={it.product}
                  onChange={(e) => setItem(i, { product: e.target.value })}
                />
                <Input placeholder="規格，如 8粒裝" value={it.spec} onChange={(e) => setItem(i, { spec: e.target.value })} />
                <Input
                  type="number"
                  min={0}
                  placeholder="盒數"
                  value={it.qty || ""}
                  onChange={(e) => setItem(i, { qty: num(e.target.value) })}
                />
                <Input
                  type="number"
                  min={0}
                  placeholder="單價"
                  value={it.unitPrice || ""}
                  onChange={(e) => setItem(i, { unitPrice: num(e.target.value) })}
                />
                <span className="text-right text-sm text-slate-700">{money(it.qty * it.unitPrice)}</span>
                <button
                  type="button"
                  onClick={() =>
                    set(
                      "items",
                      o.items.filter((_, j) => j !== i),
                    )
                  }
                  className="text-slate-400 hover:text-red-600"
                  aria-label="刪除"
                >
                  <X size={16} />
                </button>
              </div>
            ))}
            {o.items.length === 0 && <p className="text-sm text-slate-400">尚未加入品項</p>}
          </div>

          <div className="mt-4 border-t border-slate-100 pt-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium text-slate-700">加購（水蜜桃乾、果醬…）</span>
              <Button variant="ghost" onClick={() => set("extras", [...o.extras, { name: "", desc: "", amount: 0 }])}>
                <Plus size={16} /> 加購
              </Button>
            </div>
            {o.extras.map((x, i) => (
              <div key={i} className="mb-2 grid grid-cols-[1fr_1fr_110px_36px] items-center gap-2">
                <Input
                  placeholder="品項"
                  value={x.name}
                  onChange={(e) =>
                    set(
                      "extras",
                      o.extras.map((y, j) => (j === i ? { ...y, name: e.target.value } : y)),
                    )
                  }
                />
                <Input
                  placeholder="說明，如 黃肉 3包"
                  value={x.desc ?? ""}
                  onChange={(e) =>
                    set(
                      "extras",
                      o.extras.map((y, j) => (j === i ? { ...y, desc: e.target.value } : y)),
                    )
                  }
                />
                <Input
                  type="number"
                  placeholder="金額"
                  value={x.amount || ""}
                  onChange={(e) =>
                    set(
                      "extras",
                      o.extras.map((y, j) => (j === i ? { ...y, amount: num(e.target.value) } : y)),
                    )
                  }
                />
                <button
                  type="button"
                  onClick={() =>
                    set(
                      "extras",
                      o.extras.filter((_, j) => j !== i),
                    )
                  }
                  className="text-slate-400 hover:text-red-600"
                  aria-label="刪除"
                >
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
        </Card>

        {/* 收件人 */}
        <Card>
          <SectionTitle
            right={
              <Button variant="ghost" onClick={() => set("shipments", [...o.shipments, emptyShipment(uid("s"))])}>
                <Plus size={16} /> 加收件人
              </Button>
            }
          >
            收件人與出貨（{o.shipments.length} 個地址
            {o.shipments.length > 1 && shipBoxes !== itemBoxes && (
              <span className="text-amber-600">
                ，分配 {shipBoxes}／{itemBoxes} 盒
              </span>
            )}
            ）
          </SectionTitle>
          <div className="space-y-4">
            {o.shipments.map((s, i) => (
              <div key={s.id} className="rounded-xl border border-slate-200 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-700">收件人 {i + 1}</span>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      onClick={() =>
                        setShipment(i, {
                          recipient: {
                            ...s.recipient,
                            name: o.buyer.name,
                            phone: o.buyer.phone,
                            zip: customer?.addresses[0]?.zip ?? s.recipient.zip,
                            address: customer?.addresses[0]?.address ?? s.recipient.address,
                          },
                        })
                      }
                    >
                      <Copy size={14} /> 同訂購人
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => setShipment(i, { items: o.items.map((x) => ({ product: x.product, spec: x.spec, qty: x.qty })) })}
                    >
                      帶入全部品項
                    </Button>
                    {o.shipments.length > 1 && (
                      <Button
                        variant="ghost"
                        className="text-red-600"
                        onClick={() =>
                          set(
                            "shipments",
                            o.shipments.filter((_, j) => j !== i),
                          )
                        }
                      >
                        <X size={14} />
                      </Button>
                    )}
                  </div>
                </div>
                <div className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr]">
                  <Input
                    placeholder="收件人"
                    value={s.recipient.name}
                    onChange={(e) => setShipment(i, { recipient: { ...s.recipient, name: e.target.value } })}
                  />
                  <Input
                    placeholder="電話"
                    value={s.recipient.phone}
                    onChange={(e) => setShipment(i, { recipient: { ...s.recipient, phone: e.target.value } })}
                  />
                  <Input
                    placeholder="電話 2"
                    value={s.recipient.phone2 ?? ""}
                    onChange={(e) => setShipment(i, { recipient: { ...s.recipient, phone2: e.target.value } })}
                  />
                </div>
                <div className="mt-2 grid grid-cols-[90px_1fr] gap-2">
                  <Input
                    placeholder="郵遞區號"
                    value={s.recipient.zip ?? ""}
                    onChange={(e) => setShipment(i, { recipient: { ...s.recipient, zip: e.target.value } })}
                  />
                  <Input
                    placeholder="地址"
                    value={s.recipient.address}
                    onChange={(e) => setShipment(i, { recipient: { ...s.recipient, address: e.target.value } })}
                  />
                </div>
                <div className="mt-2 space-y-1.5">
                  {s.items.map((it, k) => (
                    <div key={k} className="grid grid-cols-[1fr_1fr_80px_36px] gap-2">
                      <Input
                        list="order-products"
                        placeholder="品項"
                        value={it.product ?? ""}
                        onChange={(e) =>
                          setShipment(i, { items: s.items.map((y, j) => (j === k ? { ...y, product: e.target.value } : y)) })
                        }
                      />
                      <Input
                        placeholder="規格"
                        value={it.spec}
                        onChange={(e) => setShipment(i, { items: s.items.map((y, j) => (j === k ? { ...y, spec: e.target.value } : y)) })}
                      />
                      <Input
                        type="number"
                        placeholder="盒數"
                        value={it.qty || ""}
                        onChange={(e) =>
                          setShipment(i, { items: s.items.map((y, j) => (j === k ? { ...y, qty: num(e.target.value) } : y)) })
                        }
                      />
                      <button
                        type="button"
                        onClick={() => setShipment(i, { items: s.items.filter((_, j) => j !== k) })}
                        className="text-slate-400 hover:text-red-600"
                        aria-label="刪除"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setShipment(i, { items: [...s.items, { product: o.items[0]?.product ?? "水蜜桃", spec: "", qty: 1 }] })}
                    className="text-xs text-brand-700 hover:underline"
                  >
                    ＋ 這個地址寄的品項
                  </button>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-4">
                  <Field label="預計寄出">
                    <Input
                      type="date"
                      value={s.requestedShipDate ?? ""}
                      onChange={(e) => setShipment(i, { requestedShipDate: e.target.value })}
                    />
                  </Field>
                  <Field label="到貨時段">
                    <Select
                      value={s.deliverySlot ?? ""}
                      onChange={(e) => setShipment(i, { deliverySlot: e.target.value as Shipment["deliverySlot"] })}
                    >
                      {DELIVERY_SLOTS.map((d) => (
                        <option key={d} value={d}>
                          {d || "不指定"}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="出貨狀態">
                    <Select value={s.status} onChange={(e) => setShipment(i, { status: e.target.value as Shipment["status"] })}>
                      {SHIPMENT_STATUSES.map((d) => (
                        <option key={d}>{d}</option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="託運單號">
                    <Input
                      value={s.packages.map((p) => p.trackingNo).join(", ")}
                      onChange={(e) =>
                        setShipment(i, {
                          packages: e.target.value
                            .split(/[,，\s]+/)
                            .filter(Boolean)
                            .map((trackingNo, k) => ({ ...(s.packages[k] ?? { boxes: 0 }), trackingNo })),
                        })
                      }
                      placeholder="多個用逗號分隔"
                    />
                  </Field>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* 付款與金額 */}
        <Card>
          <SectionTitle>付款與金額</SectionTitle>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="付款方式">
              <Select
                value={o.payment.method}
                onChange={(e) => set("payment", { ...o.payment, method: e.target.value as Order["payment"]["method"] })}
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m || "未填"}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="付款狀態">
              <Select
                value={o.payment.status}
                onChange={(e) => set("payment", { ...o.payment, status: e.target.value as Order["payment"]["status"] })}
              >
                {PAYMENT_STATUSES.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </Select>
            </Field>
            <Field label="已收金額">
              <Input
                type="number"
                value={o.payment.paidAmount || ""}
                onChange={(e) => set("payment", { ...o.payment, paidAmount: num(e.target.value) })}
              />
            </Field>
            <Field label="貨到付款手續費">
              <Input
                type="number"
                value={o.payment.codFee || ""}
                onChange={(e) => set("payment", { ...o.payment, codFee: num(e.target.value) })}
              />
            </Field>
            <Field label="運費">
              <Input
                type="number"
                value={o.amounts.shipping || ""}
                onChange={(e) => set("amounts", { ...o.amounts, shipping: num(e.target.value) })}
              />
            </Field>
            <Field label="調整（折扣為負數）">
              <Input
                type="number"
                value={o.amounts.adjust || ""}
                onChange={(e) => set("amounts", { ...o.amounts, adjust: num(e.target.value) })}
              />
            </Field>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-end gap-x-4 gap-y-1 rounded-lg bg-brand-50 px-4 py-3 text-sm text-slate-600">
            <span>品項 {money(amounts.items)}</span>
            {amounts.extras !== 0 && <span>加購 {money(amounts.extras)}</span>}
            {amounts.codFee !== 0 && <span>手續費 {money(amounts.codFee)}</span>}
            {amounts.shipping !== 0 && <span>運費 {money(amounts.shipping)}</span>}
            {amounts.adjust !== 0 && <span>調整 {money(amounts.adjust)}</span>}
            <span className="text-base">
              總金額 <span className="text-xl font-bold text-brand-800">{money(amounts.total)}</span>
            </span>
          </div>
        </Card>

        <Card>
          <SectionTitle>備註</SectionTitle>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="客戶備註">
              <Textarea value={o.note ?? ""} onChange={(e) => set("note", e.target.value)} />
            </Field>
            <Field label="內部備註（客戶看不到）">
              <Textarea value={o.internalNote ?? ""} onChange={(e) => set("internalNote", e.target.value)} />
            </Field>
          </div>
        </Card>

        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={onCancel}>
            取消
          </Button>
          {extraActions?.(o)}
          <Button type="submit" disabled={saving}>
            {saving ? "儲存中…" : submitLabel}
          </Button>
        </div>
      </div>

      {/* 匯入的原文：對照確認 */}
      {legacy?.rawText !== undefined && legacy.rawText !== "" && (
        <aside className="xl:sticky xl:top-4 xl:self-start">
          <Card className={legacy.needsReview ? "border-red-200" : ""}>
            <SectionTitle>匯入原文</SectionTitle>
            <p className="mb-2 text-xs text-slate-500">
              {legacy.file}・{legacy.parsedBy === "ai" ? "AI 解析" : "規則解析"}
            </p>
            {(legacy.reviewReasons?.length ?? 0) > 0 && (
              <div className="mb-3 flex flex-wrap gap-1">
                {legacy.reviewReasons!.map((r) => (
                  <Badge key={r} color={r.startsWith("提示") ? "gray" : "red"}>
                    {r.replace(/^提示：/, "")}
                  </Badge>
                ))}
              </div>
            )}
            <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-3 font-sans text-sm leading-relaxed text-slate-700">
              {legacy.rawText}
            </pre>
            <label className="mt-3 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={!legacy.needsReview}
                onChange={(e) => set("legacy", { ...legacy, needsReview: !e.target.checked })}
                className="h-4 w-4"
              />
              已核對，資料正確
            </label>
          </Card>
        </aside>
      )}
    </form>
  );
}
