"use client";

import { Ban, CheckCircle2, RotateCcw, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { INVALID_REASONS } from "@/lib/enums";
import { alertError, customersApi, useCanEdit, type CustomerWithOrders } from "@/lib/store";
import type { Customer } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";
import { Badge, Button, Field, Modal, Select, Textarea } from "./ui";

/** 列表上的紅色「無效」標籤 */
export function InvalidBadge({ c }: { c: Pick<Customer, "invalid"> }) {
  if (!c.invalid) return null;
  return <Badge color="red">無效・{c.invalid.reason}</Badge>;
}

/** 標記無效：選原因、寫說明 */
export function InvalidModal({
  c,
  onClose,
  onDone,
}: {
  c: Pick<Customer, "id" | "name">;
  onClose: () => void;
  onDone: (saved: CustomerWithOrders) => void;
}) {
  const [reason, setReason] = useState<string>(INVALID_REASONS[0]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      onDone(await customersApi.setStatus(c.id, { invalid: { reason, note } }));
    } catch (err) {
      alertError("標記失敗", err);
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`標記「${c.name}」為無效客戶`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            取消
          </Button>
          <Button type="submit" form="invalid-form" variant="dangerSolid" disabled={busy}>
            {busy ? "標記中…" : "標記為無效"}
          </Button>
        </>
      }
    >
      <form id="invalid-form" onSubmit={submit} className="space-y-4">
        <p className="text-sm text-slate-600">
          標記後客戶查詢預設不顯示、儀表板不計入客戶數；資料與訂單都會保留，隨時可以取消標記。
        </p>
        <Field label="原因" required>
          <Select value={reason} onChange={(e) => setReason(e.target.value)}>
            {INVALID_REASONS.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </Select>
        </Field>
        <Field label="說明">
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="例如：和「王小明」是同一人、電話是空號…" />
        </Field>
      </form>
    </Modal>
  );
}

/**
 * 客戶的無效／疑似無效提示列：
 * 已標記無效 → 紅色，顯示原因與「取消無效標記」；疑似無效 → 黃色，顯示可疑原因與「確認正常」「標記無效」。
 */
export function CustomerStatusBanner({
  c,
  onChange,
  compact,
}: {
  c: Customer;
  onChange: (saved: CustomerWithOrders) => void;
  /** 列表用：較小的版面 */
  compact?: boolean;
}) {
  const canEdit = useCanEdit();
  const [marking, setMarking] = useState(false);
  const [busy, setBusy] = useState(false);

  async function update(body: Parameters<typeof customersApi.setStatus>[1], what: string) {
    setBusy(true);
    try {
      onChange(await customersApi.setStatus(c.id, body));
    } catch (e) {
      alertError(`${what}失敗`, e);
    } finally {
      setBusy(false);
    }
  }

  const pad = compact ? "px-4 py-2.5" : "p-4";
  const modal = marking && (
    <InvalidModal
      c={c}
      onClose={() => setMarking(false)}
      onDone={(saved) => {
        setMarking(false);
        onChange(saved);
      }}
    />
  );

  if (c.invalid) {
    return (
      <div className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 ${pad}`}>
        <div className="flex items-start gap-2.5 text-sm text-red-800">
          <Ban size={18} className="mt-0.5 shrink-0" />
          <div>
            <b>無效客戶：{c.invalid.reason}</b>
            {c.invalid.note && <span>・{c.invalid.note}</span>}
            <div className="text-xs text-red-600/80">
              {formatDateTime(c.invalid.at)} 由 {c.invalid.by || "—"} 標記；客戶查詢預設不顯示、儀表板不計入
            </div>
          </div>
        </div>
        {canEdit && (
          <Button variant="secondary" disabled={busy} onClick={() => update({ invalid: null }, "取消標記")}>
            <RotateCcw size={15} /> 取消無效標記
          </Button>
        )}
      </div>
    );
  }

  if (!c.suspectReasons?.length) return null;
  return (
    <div className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 ${pad}`}>
      <div className="flex items-start gap-2.5 text-sm text-amber-900">
        <TriangleAlert size={18} className="mt-0.5 shrink-0" />
        <div>
          <b>疑似無效：</b>
          {c.suspectReasons.join("、")}
          {!compact && <div className="text-xs text-amber-700">確認後選「正常客戶」就不會再列入疑似無效清單；電話重複的可以先「合併重複客戶」。</div>}
        </div>
      </div>
      {canEdit && (
        <div className="flex gap-2">
          <Button variant="secondary" disabled={busy} onClick={() => update({ suspectChecked: true }, "確認")}>
            <CheckCircle2 size={15} className="text-emerald-600" /> 正常客戶
          </Button>
          <Button variant="danger" disabled={busy} onClick={() => setMarking(true)}>
            <Ban size={15} /> 標記無效
          </Button>
        </div>
      )}
      {modal}
    </div>
  );
}
