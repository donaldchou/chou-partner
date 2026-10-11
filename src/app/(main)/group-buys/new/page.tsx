"use client";

import { useRouter } from "next/navigation";
import GroupBuyForm from "@/components/GroupBuyForm";
import ItemsEditor from "@/components/ItemsEditor";
import { Card, PageHeader, SectionTitle } from "@/components/ui";
import { actions } from "@/lib/store";
import { today, uid } from "@/lib/utils";

export default function NewGroupBuyPage() {
  const router = useRouter();
  return (
    <div>
      <PageHeader title="新增團購" subtitle="拍下團購業者名片快速建檔" back="/group-buys" />
      <GroupBuyForm
        showCard
        initial={{
          id: uid("g"),
          name: "",
          contactName: "",
          phone: "",
          address: "",
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
        onCancel={() => router.push("/group-buys")}
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
    </div>
  );
}
