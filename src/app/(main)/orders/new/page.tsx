"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import OrderForm, { emptyOrder } from "@/components/OrderForm";
import { PageHeader, Spinner } from "@/components/ui";
import { customersApi, ordersApi } from "@/lib/store";
import { useFetch } from "@/lib/use-fetch";
import { nowStr, uid } from "@/lib/utils";

function NewOrder() {
  const router = useRouter();
  const customerId = useSearchParams().get("customer") ?? "";
  const { data: customer, loading } = useFetch(`new-order:${customerId}`, () =>
    customerId ? customersApi.get(customerId) : Promise.resolve(null),
  );
  const [initial] = useState(() => emptyOrder(uid("o"), nowStr()));
  const [saving, setSaving] = useState(false);

  if (loading) return <Spinner />;

  // 從客戶頁進來：直接帶入客戶與第一個收件地址
  const phone = customer?.phones.find((p) => p.type === "手機")?.number ?? customer?.phones[0]?.number ?? "";
  const start = customer
    ? {
        ...initial,
        customerId: customer.id,
        buyer: { ...initial.buyer, name: customer.name, phone, email: customer.emails[0] ?? "" },
        shipments: [
          {
            ...initial.shipments[0],
            recipient: {
              name: customer.name,
              phone,
              phone2: "",
              zip: customer.addresses[0]?.zip ?? "",
              address: customer.addresses[0]?.address ?? "",
            },
          },
        ],
      }
    : initial;

  return (
    <OrderForm
      initial={start}
      customer={customer ?? null}
      saving={saving}
      submitLabel="建立訂單"
      onCancel={() => router.back()}
      onSubmit={async (o) => {
        setSaving(true);
        try {
          const saved = await ordersApi.save(o);
          router.push(`/orders/${saved.id}`);
        } catch (e) {
          alert(`儲存失敗：${e instanceof Error ? e.message : e}`);
          setSaving(false);
        }
      }}
    />
  );
}

export default function NewOrderPage() {
  return (
    <div>
      <PageHeader title="新增訂單" subtitle="電話、LINE、現場訂單都在這裡建立" back="/orders" />
      <Suspense fallback={<Spinner />}>
        <NewOrder />
      </Suspense>
    </div>
  );
}
