"use client";

import { useRouter } from "next/navigation";
import AgencyForm from "@/components/AgencyForm";
import GroupBuyerFields, { cleanBuyer } from "@/components/GroupBuyerFields";
import { PageHeader } from "@/components/ui";
import { actions } from "@/lib/store";
import type { GroupBuyer } from "@/lib/types";
import { today, uid } from "@/lib/utils";

export default function NewGroupBuyerPage() {
  const router = useRouter();
  return (
    <div>
      <PageHeader title="新增團購業者" subtitle="拍下業者名片快速建檔，儲存後就能在這家業者底下新增團購" back="/group-buys/buyers" />
      <AgencyForm<GroupBuyer>
        label="團購業者"
        phoneRequired={false}
        notePlaceholder="例如：粉絲數、主要客群、合作條件…"
        initial={{ id: uid("gb"), name: "", phone: "", status: "配合中", createdAt: today() }}
        extra={(b, patch) => <GroupBuyerFields b={b} patch={patch} />}
        onCancel={() => router.push("/group-buys/buyers")}
        onSubmit={(b) => {
          actions.saveGroupBuyer(cleanBuyer(b));
          router.push(`/group-buys/buyers/${b.id}`);
        }}
      />
    </div>
  );
}
