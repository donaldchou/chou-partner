"use client";

import type { GroupBuyItem } from "@/lib/types";
import { money, PRODUCTS, uid } from "@/lib/utils";
import { Button, Input } from "./ui";

/** 團購品項：單價 × 數量，自動計算總金額 */
export default function ItemsEditor({ items, onChange }: { items: GroupBuyItem[]; onChange: (items: GroupBuyItem[]) => void }) {
  const setItem = (id: string, patch: Partial<GroupBuyItem>) => onChange(items.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const total = items.reduce((s, i) => s + i.price * i.qty, 0);
  const qty = items.reduce((s, i) => s + i.qty, 0);

  return (
    <div>
      <div className="hidden grid-cols-[1fr_1.4fr_100px_90px_110px_40px] gap-2 px-2 pb-1 text-xs text-slate-500 sm:grid">
        <span>品項</span>
        <span>規格</span>
        <span>團購價</span>
        <span>數量</span>
        <span className="text-right">小計</span>
        <span />
      </div>
      <div className="space-y-2">
        {items.map((it) => (
          <div
            key={it.id}
            className="grid grid-cols-2 items-center gap-2 rounded-lg bg-slate-50 p-2 sm:grid-cols-[1fr_1.4fr_100px_90px_110px_40px]"
          >
            <Input list="gb-products" placeholder="品項" value={it.product} onChange={(e) => setItem(it.id, { product: e.target.value })} />
            <Input placeholder="規格" value={it.spec} onChange={(e) => setItem(it.id, { spec: e.target.value })} />
            <Input
              type="number"
              min={0}
              placeholder="單價"
              value={it.price || ""}
              onChange={(e) => setItem(it.id, { price: Number(e.target.value) })}
            />
            <Input
              type="number"
              min={0}
              placeholder="數量"
              value={it.qty || ""}
              onChange={(e) => setItem(it.id, { qty: Number(e.target.value) })}
            />
            <span className="text-right text-sm font-medium text-slate-700">{money(it.price * it.qty)}</span>
            <button
              type="button"
              onClick={() => onChange(items.filter((x) => x.id !== it.id))}
              className="text-slate-400 hover:text-red-600"
              aria-label="刪除"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
      <datalist id="gb-products">
        {PRODUCTS.map((p) => (
          <option key={p} value={p} />
        ))}
      </datalist>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <Button variant="secondary" onClick={() => onChange([...items, { id: uid("gi"), product: "", spec: "", price: 0, qty: 0 }])}>
          ＋ 加品項
        </Button>
        <div className="rounded-lg bg-brand-50 px-4 py-2 text-right">
          <span className="mr-3 text-sm text-slate-500">共 {qty} 件</span>
          <span className="text-sm text-slate-600">總金額 </span>
          <span className="text-xl font-bold text-brand-800">{money(total)}</span>
        </div>
      </div>
    </div>
  );
}
