"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import CustomerForm, { emptyCustomer } from "@/components/CustomerForm";
import { PageHeader } from "@/components/ui";
import { alertError, customersApi } from "@/lib/store";
import { today, uid } from "@/lib/utils";

export default function NewCustomerPage() {
  const router = useRouter();
  const [initial, setInitial] = useState(() => emptyCustomer(uid("c"), today()));
  const [saving, setSaving] = useState(false);
  return (
    <div>
      <PageHeader title="客戶資料建檔" subtitle="拍下名片即可自動帶入，或直接手動填寫" back="/customers" />
      <CustomerForm
        key={initial.id}
        initial={initial}
        saving={saving}
        onCancel={() => router.push("/customers")}
        onSubmit={async (c) => {
          setSaving(true);
          try {
            await customersApi.save(c);
            // 離開的頁面會被保留：換一張新的空白表單，回來時才不會改到剛建立的客戶
            setInitial(emptyCustomer(uid("c"), today()));
            router.push(`/customers/${c.id}`);
          } catch (e) {
            alertError("儲存失敗", e);
          } finally {
            setSaving(false);
          }
        }}
      />
    </div>
  );
}
