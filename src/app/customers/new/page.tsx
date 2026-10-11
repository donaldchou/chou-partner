"use client";

import { useRouter } from "next/navigation";
import CustomerForm from "@/components/CustomerForm";
import { PageHeader } from "@/components/ui";
import { actions } from "@/lib/store";
import { today, uid } from "@/lib/utils";

export default function NewCustomerPage() {
  const router = useRouter();
  return (
    <div>
      <PageHeader title="客戶資料建檔" subtitle="拍下名片即可自動帶入，或直接手動填寫" back="/customers" />
      <CustomerForm
        initial={{ id: uid("c"), company: "", name: "", phone: "", address: "", source: "手動", createdAt: today(), orders: [] }}
        onCancel={() => router.push("/customers")}
        onSubmit={(c) => {
          actions.saveCustomer(c);
          router.push(`/customers/${c.id}`);
        }}
      />
    </div>
  );
}
