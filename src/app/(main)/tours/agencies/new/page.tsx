"use client";

import { useRouter } from "next/navigation";
import AgencyForm from "@/components/AgencyForm";
import { PageHeader } from "@/components/ui";
import { actions } from "@/lib/store";
import { today, uid } from "@/lib/utils";

export default function NewAgencyPage() {
  const router = useRouter();
  return (
    <div>
      <PageHeader title="新增旅行社" subtitle="拍下旅行社名片快速建檔，儲存後再加入領隊與司機" back="/tours/agencies" />
      <AgencyForm
        initial={{ id: uid("a"), name: "", phone: "", createdAt: today(), people: [] }}
        onCancel={() => router.push("/tours/agencies")}
        onSubmit={(a) => {
          actions.saveAgency(a);
          router.push(`/tours/agencies/${a.id}`);
        }}
      />
    </div>
  );
}
