"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import GroupBuyForm from "@/components/GroupBuyForm";
import ItemsEditor from "@/components/ItemsEditor";
import { Card, Loading, PageHeader, SectionTitle } from "@/components/ui";
import { actions, useAppState, useLoaded } from "@/lib/store";
import { today, uid } from "@/lib/utils";

function NewGroupBuy() {
  const router = useRouter();
  const loaded = useLoaded();
  const { groupBuyers } = useAppState();
  // 從團購業者頁按「新增團購」：?buyer= 帶入業者與聯絡資料
  const buyerId = useSearchParams().get("buyer") ?? "";
  const b = groupBuyers.find((x) => x.id === buyerId);
  if (buyerId && !loaded) return <Loading />;

  return (
    <GroupBuyForm
      key={b?.id ?? "none"}
      showCard
      initial={{
        id: uid("g"),
        buyerId: b?.id,
        name: b ? `${b.name} ` : "",
        contactName: b?.contactName || b?.name || "",
        phone: b?.phone ?? "",
        address: b?.address ?? "",
        lineName: b?.lineName,
        startDate: today(),
        endDate: "",
        status: "洽談中",
        items: [{ id: uid("gi"), product: "甜柿", spec: "", price: 0, qty: 0 }],
        coopNotes: [],
        shippingMode: "provided",
        recipients: [],
        backups: [],
        createdAt: today(),
      }}
      onCancel={() => router.push(b ? `/group-buys/buyers/${b.id}` : "/group-buys")}
      onSubmit={(g) => {
        actions.saveGroupBuy(g);
        router.push(`/group-buys/${g.id}`);
      }}
    >
      {(g, setG) => (
        <Card>
          <SectionTitle>團購品項與價格</SectionTitle>
          <ItemsEditor items={g.items} onChange={(items) => setG((p) => ({ ...p, items }))} />
        </Card>
      )}
    </GroupBuyForm>
  );
}

export default function NewGroupBuyPage() {
  return (
    <div>
      <PageHeader title="新增團購" subtitle="選擇團購業者，或拍下業者名片快速建檔" back="/group-buys" />
      <Suspense fallback={<Loading />}>
        <NewGroupBuy />
      </Suspense>
    </div>
  );
}
