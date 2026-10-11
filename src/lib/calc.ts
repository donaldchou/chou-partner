import type { GroupBuy, Order, OrderItem } from "./types";

export function groupBuyTotal(g: GroupBuy) {
  return g.items.reduce((s, i) => s + i.qty * i.price, 0);
}

export function groupBuyQty(g: GroupBuy) {
  return g.items.reduce((s, i) => s + i.qty, 0);
}

/** 前端即時計算（與後端 pre-validate 的規則相同） */
export function orderAmounts(o: Pick<Order, "items" | "extras" | "payment" | "amounts">) {
  const items = o.items.reduce((s, i) => s + Math.round((i.qty || 0) * (i.unitPrice || 0)), 0);
  const extras = o.extras.reduce((s, e) => s + (e.amount || 0), 0);
  const codFee = o.payment.codFee || 0;
  return { ...o.amounts, items, extras, codFee, total: items + extras + codFee + (o.amounts.shipping || 0) + (o.amounts.adjust || 0) };
}

/** 「水蜜桃 8粒裝 ×2、甜柿 6粒裝 ×1」 */
export function itemsText(items: Pick<OrderItem, "product" | "spec" | "qty">[]) {
  return items.map((i) => `${i.product} ${i.spec} ×${i.qty}`.replace(/\s+/g, " ")).join("、");
}

export const boxes = (items: Pick<OrderItem, "qty">[]) => items.reduce((s, i) => s + (i.qty || 0), 0);
