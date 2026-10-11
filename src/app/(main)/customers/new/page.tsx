"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import CustomerForm, { emptyCustomer } from "@/components/CustomerForm";
import { PageHeader } from "@/components/ui";
import { customersApi } from "@/lib/store";
import { today, uid } from "@/lib/utils";

export default function NewCustomerPage() {
  const router = useRouter();
  const [initial] = useState(() => emptyCustomer(uid("c"), today()));
  const [saving, setSaving] = useState(false);
  return (
    <div>
      <PageHeader title="客戶資料建檔" subtitle="拍下名片即可自動帶入，或直接手動填寫" back="/customers" />
      <CustomerForm
        initial={initial}
        saving={saving}
        onCancel={() => router.push("/customers")}
        onSubmit={async (c) => {
          setSaving(true);
          try {
            await customersApi.save(c);
            router.push(`/customers/${c.id}`);
          } catch (e) {
            alert(`儲存失敗：${e instanceof Error ? e.message : e}`);
            setSaving(false);
          }
        }}
      />
    </div>
  );
}
