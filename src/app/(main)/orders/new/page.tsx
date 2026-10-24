"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import OrderForm, { emptyOrder } from "@/components/OrderForm";
import { PageHeader, Spinner } from "@/components/ui";
import { alertError, customersApi, ordersApi } from "@/lib/store";
import { useFetch } from "@/lib/use-fetch";
import { nowStr, uid } from "@/lib/utils";

function NewOrder() {
  const router = useRouter();
  const customerId = useSearchParams().get("customer") ?? "";
  const { data: customer, loading } = useFetch(`new-order:${customerId}`, () =>
    customerId ? customersApi.get(customerId) : Promise.resolve(null),
  );
  const [initial, setInitial] = useState(() => emptyOrder(uid("o"), nowStr()));
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
      key={initial.id}
      initial={start}
      customer={customer ?? null}
      saving={saving}
      submitLabel="建立訂單"
      onCancel={() => router.back()}
      onSubmit={async (o) => {
        setSaving(true);
        try {
          const saved = await ordersApi.save(o);
          // 離開的頁面會被保留：換一張新的空白單，回來時才不會改到剛建立的訂單
          setInitial(emptyOrder(uid("o"), nowStr()));
          router.push(`/orders/${saved.id}`);
        } catch (e) {
          alertError("儲存失敗", e);
        } finally {
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
