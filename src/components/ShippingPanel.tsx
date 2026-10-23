"use client";

import { useRef, useState } from "react";
import { actions } from "@/lib/store";
import { openStoredFile, uploadFile } from "@/lib/upload";
import type { GroupBuy, Recipient, ShippingBackup } from "@/lib/types";
import { downloadText, FARM, formatDate, formatDateTime, nowStr, toCsv, uid } from "@/lib/utils";
import { SHIPPING_MODES } from "./GroupBuyForm";
import { Badge, Button, Card, Empty, Field, Input, Modal, SectionTitle, Textarea } from "./ui";

export default function ShippingPanel({ g }: { g: GroupBuy }) {
  const save = (patch: Partial<GroupBuy>) => actions.saveGroupBuy({ ...g, ...patch });
  const [printing, setPrinting] = useState<ShippingBackup | null>(null);

  return (
    <div className="space-y-5">
      <Card className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm text-slate-500">目前處理方式</div>
          <div className="font-semibold text-slate-800">{SHIPPING_MODES.find((m) => m.v === g.shippingMode)?.title}</div>
        </div>
        <Button variant="secondary" onClick={() => save({ shippingMode: g.shippingMode === "provided" ? "generate" : "provided" })}>
          切換為「{SHIPPING_MODES.find((m) => m.v !== g.shippingMode)?.title}」
        </Button>
      </Card>

      {g.shippingMode === "provided" ? (
        <UploadBox onUploaded={(bs) => save({ backups: [...bs, ...g.backups] })} />
      ) : (
        <RecipientsEditor g={g} save={save} onGenerated={(b) => setPrinting(b)} />
      )}

      <Card>
        <SectionTitle>📁 宅配單備份紀錄</SectionTitle>
        {g.backups.length === 0 ? (
          <Empty>尚無備份</Empty>
        ) : (
          <ul className="divide-y divide-slate-100">
            {g.backups.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                <div>
                  <div className="font-medium text-slate-800">{b.fileName}</div>
                  <div className="text-xs text-slate-500">
                    {formatDateTime(b.createdAt)}
                    {b.count !== undefined && `・${b.count} 件`}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge color={b.kind === "業者提供" ? "purple" : "blue"}>{b.kind}</Badge>
                  {b.rows ? (
                    <>
                      <Button variant="ghost" onClick={() => setPrinting(b)}>
                        檢視 / 列印
                      </Button>
                      <Button variant="ghost" onClick={() => downloadCsv(g, b)}>
                        下載 CSV
                      </Button>
                    </>
                  ) : b.fileUrl ? (
                    <Button variant="ghost" onClick={() => openStoredFile(b.fileUrl!, b.fileName)}>
                      下載
                    </Button>
                  ) : (
                    <span className="px-3.5 text-xs text-slate-400">（無檔案）</span>
                  )}
                  <button
                    className="text-xs text-slate-400 hover:text-red-600"
                    onClick={() => confirm("刪除這筆備份？") && save({ backups: g.backups.filter((x) => x.id !== b.id) })}
                  >
                    刪除
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {printing && <LabelsPreview g={g} backup={printing} onClose={() => setPrinting(null)} />}
    </div>
  );
}

function UploadBox({ onUploaded }: { onUploaded: (b: ShippingBackup[]) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function upload(files: File[]) {
    if (!files.length) return;
    setBusy(true);
    const results = await Promise.allSettled(files.map((f) => uploadFile(f, "shipping")));
    setBusy(false);
    const backups = results.flatMap((r) =>
      r.status === "fulfilled"
        ? [{ id: uid("s"), kind: "業者提供" as const, fileName: r.value.name, fileUrl: r.value.url, createdAt: nowStr() }]
        : [],
    );
    if (backups.length) onUploaded(backups);
    const failed = results.find((r): r is PromiseRejectedResult => r.status === "rejected");
    if (failed) alert(`有檔案上傳失敗：${failed.reason instanceof Error ? failed.reason.message : failed.reason}`);
  }
  return (
    <Card>
      <SectionTitle>⬆️ 上傳業者提供的宅配單</SectionTitle>
      <input
        ref={ref}
        type="file"
        multiple
        accept=".xlsx,.xls,.csv,.pdf,image/*"
        className="hidden"
        onChange={(e) => {
          void upload(Array.from(e.target.files ?? []));
          e.target.value = "";
        }}
      />
      <button
        disabled={busy}
        onClick={() => ref.current?.click()}
        className="flex w-full flex-col items-center gap-1 rounded-xl border-2 border-dashed border-slate-300 py-8 text-slate-500 hover:border-brand-400 hover:text-brand-700 disabled:cursor-wait"
      >
        <span className="text-3xl">📄</span>
        <span>{busy ? "上傳中…" : "點此選擇檔案（Excel、CSV、PDF 或照片，可多選，單檔 30MB 以內）"}</span>
      </button>
    </Card>
  );
}

const emptyRecipient = (g: GroupBuy): Recipient => ({
  id: uid("r"),
  name: "",
  phone: "",
  address: "",
  content: g.items[0] ? `${g.items[0].product} ${g.items[0].spec}`.trim() : "",
  qty: 1,
});

function RecipientsEditor({
  g,
  save,
  onGenerated,
}: {
  g: GroupBuy;
  save: (patch: Partial<GroupBuy>) => void;
  onGenerated: (b: ShippingBackup) => void;
}) {
  const [editing, setEditing] = useState<Recipient | null>(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const totalQty = g.recipients.reduce((s, r) => s + r.qty, 0);

  function generate() {
    const ts = nowStr();
    const b: ShippingBackup = {
      id: uid("s"),
      kind: "系統產生",
      fileName: `${g.name}_宅配單_${ts.replace(/[-:T]/g, "").slice(0, 12)}.csv`,
      createdAt: ts,
      count: g.recipients.length,
      rows: g.recipients,
    };
    save({ backups: [b, ...g.backups] });
    onGenerated(b);
  }

  return (
    <Card>
      <SectionTitle
        right={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setPasteOpen(true)}>
              📋 貼上寄送資訊
            </Button>
            <Button variant="secondary" onClick={() => setEditing(emptyRecipient(g))}>
              ＋ 新增收件人
            </Button>
          </div>
        }
      >
        📮 寄送資訊（{g.recipients.length} 筆，{totalQty} 件）
      </SectionTitle>

      {g.recipients.length === 0 ? (
        <Empty>請新增收件人，或直接貼上業者提供的寄送資訊</Empty>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="py-2 pr-3 font-medium">收件人</th>
                <th className="py-2 pr-3 font-medium">電話</th>
                <th className="py-2 pr-3 font-medium">地址</th>
                <th className="py-2 pr-3 font-medium">內容物</th>
                <th className="py-2 pr-3 text-right font-medium">數量</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {g.recipients.map((r) => (
                <tr key={r.id} className="border-b border-slate-100">
                  <td className="py-2 pr-3 font-medium text-slate-800">{r.name}</td>
                  <td className="py-2 pr-3">{r.phone}</td>
                  <td className="py-2 pr-3 text-slate-600">
                    {r.address}
                    {r.note && <div className="text-xs text-amber-700">備註：{r.note}</div>}
                  </td>
                  <td className="py-2 pr-3">{r.content}</td>
                  <td className="py-2 pr-3 text-right">{r.qty}</td>
                  <td className="whitespace-nowrap py-2 text-right">
                    <button className="mr-2 text-xs text-brand-700 hover:underline" onClick={() => setEditing(r)}>
                      編輯
                    </button>
                    <button
                      className="text-xs text-slate-400 hover:text-red-600"
                      onClick={() => save({ recipients: g.recipients.filter((x) => x.id !== r.id) })}
                    >
                      刪除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4 flex justify-end">
        <Button disabled={g.recipients.length === 0} onClick={generate}>
          🖨️ 產生宅配單並備份
        </Button>
      </div>

      {editing && (
        <RecipientModal
          r={editing}
          onClose={() => setEditing(null)}
          onSave={(r) => {
            const exists = g.recipients.some((x) => x.id === r.id);
            save({ recipients: exists ? g.recipients.map((x) => (x.id === r.id ? r : x)) : [...g.recipients, r] });
            setEditing(null);
          }}
        />
      )}
      {pasteOpen && (
        <PasteModal
          g={g}
          onClose={() => setPasteOpen(false)}
          onImport={(rs) => {
            save({ recipients: [...g.recipients, ...rs] });
            setPasteOpen(false);
          }}
        />
      )}
    </Card>
  );
}

function RecipientModal({ r: initial, onClose, onSave }: { r: Recipient; onClose: () => void; onSave: (r: Recipient) => void }) {
  const [r, setR] = useState(initial);
  return (
    <Modal open onClose={onClose} title="收件人資料">
      <form
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          onSave(r);
        }}
      >
        <Field label="收件人" required>
          <Input required autoFocus value={r.name} onChange={(e) => setR({ ...r, name: e.target.value })} />
        </Field>
        <Field label="電話" required>
          <Input required value={r.phone} onChange={(e) => setR({ ...r, phone: e.target.value })} />
        </Field>
        <Field label="地址" required className="sm:col-span-2">
          <Input required value={r.address} onChange={(e) => setR({ ...r, address: e.target.value })} />
        </Field>
        <Field label="內容物">
          <Input value={r.content} onChange={(e) => setR({ ...r, content: e.target.value })} />
        </Field>
        <Field label="數量">
          <Input type="number" min={1} value={r.qty} onChange={(e) => setR({ ...r, qty: Number(e.target.value) })} />
        </Field>
        <Field label="備註" className="sm:col-span-2">
          <Input value={r.note ?? ""} onChange={(e) => setR({ ...r, note: e.target.value })} placeholder="例如：指定時段、易碎…" />
        </Field>
        <div className="flex justify-end gap-2 sm:col-span-2">
          <Button variant="secondary" onClick={onClose}>
            取消
          </Button>
          <Button type="submit">儲存</Button>
        </div>
      </form>
    </Modal>
  );
}

/** 把業者用 LINE / Excel 傳來的名單直接貼上，一行一筆 */
function PasteModal({ g, onClose, onImport }: { g: GroupBuy; onClose: () => void; onImport: (rs: Recipient[]) => void }) {
  const [text, setText] = useState("");
  const parsed: Recipient[] = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const [name = "", phone = "", address = "", content = "", qty = "1", note = ""] = line.split(/\t|,|，/).map((s) => s.trim());
      return { ...emptyRecipient(g), name, phone, address, ...(content && { content }), qty: Number(qty) || 1, note };
    });

  return (
    <Modal open onClose={onClose} title="貼上寄送資訊" wide>
      <p className="mb-2 text-sm text-slate-600">
        一行一位收件人，欄位用逗號或 Tab 分隔（可直接從 Excel 複製）：
        <span className="font-mono text-slate-800">姓名, 電話, 地址, 內容物, 數量, 備註</span>
      </p>
      <Textarea
        rows={6}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={
          "陳大文, 0912-111-222, 台南市中西區民生路 1 號, 柿餅 12 入禮盒, 2\n吳小美, 0933-222-333, 台南市安平區安平路 8 號, 柿餅 12 入禮盒, 1, 晚上送"
        }
        className="font-mono"
      />
      {parsed.length > 0 && (
        <div className="mt-3 max-h-56 overflow-auto rounded-lg border border-slate-200">
          <table className="w-full text-sm">
            <tbody>
              {parsed.map((r) => (
                <tr key={r.id} className="border-b border-slate-100">
                  <td className="px-2 py-1.5 font-medium">{r.name || <span className="text-red-500">缺姓名</span>}</td>
                  <td className="px-2 py-1.5">{r.phone || <span className="text-red-500">缺電話</span>}</td>
                  <td className="px-2 py-1.5">{r.address || <span className="text-red-500">缺地址</span>}</td>
                  <td className="px-2 py-1.5">{r.content}</td>
                  <td className="px-2 py-1.5 text-right">× {r.qty}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          取消
        </Button>
        <Button disabled={parsed.length === 0} onClick={() => onImport(parsed)}>
          加入 {parsed.length} 筆
        </Button>
      </div>
    </Modal>
  );
}

function downloadCsv(g: GroupBuy, b: ShippingBackup) {
  const rows = b.rows ?? [];
  downloadText(
    b.fileName,
    toCsv([
      ["單號", "收件人", "電話", "地址", "內容物", "數量", "備註", "寄件人", "寄件電話", "寄件地址"],
      ...rows.map((r, i) => [
        serial(b, i),
        r.name,
        r.phone,
        r.address,
        r.content,
        r.qty,
        r.note ?? "",
        FARM.name,
        FARM.phone,
        FARM.address,
      ]),
    ]),
  );
}

function serial(b: ShippingBackup, i: number) {
  return `CP${b.createdAt.replace(/[-:T]/g, "").slice(2, 12)}${String(i + 1).padStart(3, "0")}`;
}

function LabelsPreview({ g, backup, onClose }: { g: GroupBuy; backup: ShippingBackup; onClose: () => void }) {
  const rows = backup.rows ?? [];
  return (
    <Modal open onClose={onClose} title={`宅配單預覽（${rows.length} 張）`} wide>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 print:hidden">
        <p className="text-sm text-brand-700">✓ 已備份為「{backup.fileName}」</p>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => downloadCsv(g, backup)}>
            下載 CSV
          </Button>
          <Button onClick={() => window.print()}>列印</Button>
        </div>
      </div>
      <div className="print-area grid gap-3 sm:grid-cols-2 print:grid-cols-2">
        {rows.map((r, i) => (
          <div key={r.id} className="break-inside-avoid rounded-lg border-2 border-slate-800 p-3 text-sm text-black">
            <div className="flex items-center justify-between border-b border-slate-400 pb-1.5">
              <span className="font-bold">宅配託運單</span>
              <span className="font-mono text-xs">{serial(backup, i)}</span>
            </div>
            <div className="mt-2">
              <div className="text-xs text-slate-500">收件人</div>
              <div className="text-lg font-bold">
                {r.name}
                <span className="ml-2 text-base font-normal">{r.phone}</span>
              </div>
              <div className="font-medium">{r.address}</div>
            </div>
            <div className="mt-2 grid grid-cols-[1fr_auto] gap-2 border-t border-dashed border-slate-400 pt-2">
              <div>
                <span className="text-xs text-slate-500">內容物 </span>
                {r.content}
              </div>
              <div className="font-bold">× {r.qty}</div>
            </div>
            {r.note && <div className="mt-1 text-xs">備註：{r.note}</div>}
            <div className="mt-2 border-t border-slate-400 pt-1.5 text-xs">
              寄件人：{FARM.name} {FARM.phone}・{FARM.address}
              <div className="flex justify-between text-slate-500">
                <span>{g.name}</span>
                <span>出貨日 {formatDate(backup.createdAt)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}
