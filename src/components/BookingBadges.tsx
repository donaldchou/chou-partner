import type { BookingStatus, BuyingPower } from "@/lib/types";
import { Badge } from "./ui";

export function BookingStatusBadge({ status }: { status: BookingStatus }) {
  return <Badge color={status === "已預約" ? "blue" : status === "已到場" ? "green" : "gray"}>{status}</Badge>;
}

export function BuyingPowerBadge({ level }: { level: BuyingPower }) {
  return <Badge color={level === "高" ? "green" : level === "中" ? "amber" : "gray"}>購買力 {level}</Badge>;
}
