"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import OrderForm from "@/components/OrderForm";
import { OrderStatusBadge, PayStatusBadge, ReviewBadge } from "@/components/OrderBadges";
import { Button, NotFound, PageHeader, Spinner } from "@/components/ui";
import { alertError, ordersApi } from "@/lib/store";
import type { Order } from "@/lib/types";
import { useFetch } from "@/lib/use-fetch";
import { formatDateTime } from "@/lib/utils";

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data, error } = useFetch(`order:${id}`, () => ordersApi.get(id));
  const [saving, setSaving] = useState(false);

  if (error) return <NotFound back="/orders" />;
  if (!data) return <Spinner />;
  const { customer, ...order } = data;
  const reviewing = !!order.legacy?.needsReview;

  async function save(o: Order, next?: "review") {
    setSaving(true);
    try {
      await ordersApi.save(o);
      if (next === "review") {
        // 下一筆待確認（依時間由舊到新）
        const r = await ordersApi.list({ review: 1, limit: 2, sort: "old" });
        const nextId = r.items.find((x) => x.id !== o.id)?.id;
        router.push(nextId ? `/orders/${nextId}` : "/orders?review=1");
      } else {
        router.back();
      }
    } catch (e) {
      alertError("儲存失敗", e);
    } finally {
      // 離開的頁面會被保留，回來時按鈕不能還停在「儲存中」
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        title={`訂單 ${order.orderNo}`}
        subtitle={`${order.channel}・下單 ${formatDateTime(order.orderedAt)}${order.legacy ? `・匯入自 ${order.legacy.file}` : ""}`}
        back={reviewing ? "/orders?review=1" : "/orders"}
        info={
          <div className="flex items-center gap-1">
            <OrderStatusBadge status={order.status} />
            <PayStatusBadge status={order.payment.status} />
            {reviewing && <ReviewBadge />}
          </div>
        }
        actions={
          <Button
            variant="danger"
            onClick={async () => {
              if (!confirm(`確定刪除訂單 ${order.orderNo}？`)) return;
              await ordersApi.remove(order.id);
              router.push("/orders");
            }}
          >
            刪除
          </Button>
        }
      />
      <OrderForm
        key={order.id}
        initial={order}
        customer={customer}
        saving={saving}
        onCancel={() => router.back()}
        onSubmit={(o) => save(o)}
        extraActions={(o) =>
          reviewing ? (
            <Button
              variant="secondary"
              disabled={saving}
              onClick={() => save({ ...o, legacy: o.legacy && { ...o.legacy, needsReview: false } }, "review")}
            >
              標記已核對並看下一筆
            </Button>
          ) : null
        }
      />
    </div>
  );
}
