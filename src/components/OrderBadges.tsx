import type { OrderStatus, PaymentStatus } from "@/lib/types";
import { Badge } from "./ui";

const STATUS_COLOR = { 新訂單: "blue", 處理中: "amber", 已出貨: "green", 已完成: "green", 已取消: "gray" } as const;
const PAY_COLOR = { 未付款: "gray", 待匯款: "amber", 已付款: "green", 貨到收款: "green", 部分付款: "amber", 已退款: "red" } as const;

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <Badge color={STATUS_COLOR[status]}>{status}</Badge>;
}

export function PayStatusBadge({ status }: { status: PaymentStatus }) {
  return <Badge color={PAY_COLOR[status]}>{status}</Badge>;
}

export function ReviewBadge() {
  return <Badge color="red">待確認</Badge>;
}
