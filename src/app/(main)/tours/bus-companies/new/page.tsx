"use client";

import { useRouter } from "next/navigation";
import AgencyForm from "@/components/AgencyForm";
import { PageHeader } from "@/components/ui";
import { actions } from "@/lib/store";
import { today, uid } from "@/lib/utils";

export default function NewBusCompanyPage() {
  const router = useRouter();
  return (
    <div>
      <PageHeader title="新增遊覽車公司" subtitle="拍下遊覽車公司名片快速建檔，儲存後再加入司機" back="/tours/bus-companies" />
      <AgencyForm
        label="遊覽車公司"
        notePlaceholder="例如：車型、座位數、配合方式…"
        initial={{ id: uid("bus"), name: "", phone: "", createdAt: today(), people: [] }}
        onCancel={() => router.push("/tours/bus-companies")}
        onSubmit={(c) => {
          actions.saveBusCompany(c);
          router.push(`/tours/bus-companies/${c.id}`);
        }}
      />
    </div>
  );
}
