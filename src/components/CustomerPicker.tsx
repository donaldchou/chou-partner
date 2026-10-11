"use client";

import { Search } from "lucide-react";
import { useState } from "react";
import { customersApi } from "@/lib/store";
import type { Customer } from "@/lib/types";
import { useFetch } from "@/lib/use-fetch";
import { Input, useDebounced } from "./ui";

/** 打字搜尋客戶（姓名、電話、地址…），點選後回傳 */
export default function CustomerPicker({
  onPick,
  exclude,
  placeholder = "輸入姓名或電話搜尋客戶",
}: {
  onPick: (c: Customer) => void;
  exclude?: string;
  placeholder?: string;
}) {
  const [kw, setKw] = useState("");
  const q = useDebounced(kw.trim());
  const { data, loading } = useFetch(`pick:${q}`, () =>
    q ? customersApi.list({ q, limit: 8 }) : Promise.resolve({ items: [], total: 0, page: 1, limit: 8 }),
  );
  const items = (data?.items ?? []).filter((c) => c.id !== exclude);

  return (
    <div>
      <div className="relative">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <Input autoFocus value={kw} onChange={(e) => setKw(e.target.value)} placeholder={placeholder} className="pl-9" />
      </div>
      {q && (
        <ul className="mt-2 max-h-72 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200">
          {loading && !items.length && <li className="px-3 py-2 text-sm text-slate-400">搜尋中…</li>}
          {!loading && !items.length && <li className="px-3 py-2 text-sm text-slate-400">找不到客戶</li>}
          {items.map((c) => (
            <li key={c.id}>
              <button type="button" onClick={() => onPick(c)} className="block w-full px-3 py-2 text-left text-sm hover:bg-brand-50">
                <span className="font-medium text-slate-800">{c.name}</span>
                {c.company && <span className="ml-2 text-slate-500">{c.company}</span>}
                <span className="ml-2 text-slate-500">{c.phones.map((p) => p.number).join("、")}</span>
                <span className="block truncate text-xs text-slate-400">
                  {c.addresses[0]?.address ?? ""}・{c.stats.orderCount} 筆訂單
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
