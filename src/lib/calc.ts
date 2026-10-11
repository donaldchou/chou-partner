import type { Customer, GroupBuy, Order } from "./types";

export function orderTotal(o: Order) {
  return o.items.reduce((s, i) => s + i.qty * i.unitPrice, 0);
}

export function customerTotal(c: Customer) {
  return c.orders.reduce((s, o) => s + orderTotal(o), 0);
}

export function groupBuyTotal(g: GroupBuy) {
  return g.items.reduce((s, i) => s + i.qty * i.price, 0);
}

export function groupBuyQty(g: GroupBuy) {
  return g.items.reduce((s, i) => s + i.qty, 0);
}
