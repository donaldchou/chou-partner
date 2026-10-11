"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { Badge, Button, Card, DemoNote, Field, PageHeader, Select, Tabs } from "@/components/ui";
import type { ImportRow, MdbTable } from "@/lib/importer";
import { api, reload } from "@/lib/store";
import type { CustomerSource } from "@/lib/types";
import { money } from "@/lib/utils";

type Kind = "word" | "mdb";

interface ParseResult {
  rows: ImportRow[];
  total: number;
  truncated: boolean;
  ai?: boolean;
  tables?: MdbTable[];
  table?: string;
}

const INFO: Record<Kind, { title: string; accept: string; desc: string; source: CustomerSource }> = {
  word: {
    title: "Word 紀錄匯入",
    accept: ".docx",
    desc: "上傳過去用 Word 記錄的客戶訂購單（.docx）。有表格時依欄位名稱（姓名、電話、地址、日期、產品、規格、數量、單價…）讀取；沒有表格的段落式紀錄會交給 AI 整理。",
    source: "Word匯入",
  },
  mdb: {
    title: "網站 MDB 資料匯入",
    accept: ".mdb,.accdb",
    desc: "上傳舊網站的 Access 資料庫（.mdb），系統會自動找出最像客戶訂單的資料表，也可以手動切換資料表。",
    source: "MDB匯入",
  },
};

export default function ImportPage() {
  const [kind, setKind] = useState<Kind>("word");
  const [file, setFile] = useState<File | null>(null);
  const [step, setStep] = useState<"pick" | "parsing" | "preview" | "importing" | "done">("pick");
  const [parsed, setParsed] = useState<ParseResult | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [result, setResult] = useState({ newCustomers: 0, merged: 0, orders: 0, skipped: 0 });
  const inputRef = useRef<HTMLInputElement>(null);
  const info = INFO[kind];
  const rows = parsed?.rows ?? [];

  function reset(k: Kind = kind) {
    setKind(k);
    setFile(null);
    setStep("pick");
    setParsed(null);
  }

  async function parse(table?: string) {
    if (!file) return;
    setStep("parsing");
    const form = new FormData();
    form.append("file", file);
    form.append("kind", kind);
    if (table) form.append("table", table);
    try {
      const r = await api<ParseResult>("/api/import/parse", { method: "POST", body: form });
      setParsed(r);
      setSelected(new Set(r.rows.map((x) => x.key)));
      setStep("preview");
    } catch (e) {
      alert(`解析失敗：${e instanceof Error ? e.message : e}`);
      setStep("pick");
    }
  }

  async function doImport() {
    setStep("importing");
    try {
      const r = await api<typeof result>("/api/import/commit", {
        method: "POST",
        body: JSON.stringify({ source: info.source, rows: rows.filter((x) => selected.has(x.key)) }),
      });
      setResult(r);
      setStep("done");
      void reload();
    } catch (e) {
      alert(`匯入失敗：${e instanceof Error ? e.message : e}`);
      setStep("preview");
    }
  }

  return (
    <div>
      <PageHeader title="歷史訂購紀錄匯入" subtitle="把過去的 Word 紀錄或舊網站資料庫匯入平台" back="/customers" />

      <Tabs
        value={kind}
        onChange={(k) => reset(k)}
        tabs={[
          { value: "word", label: "📄 Word 紀錄匯入" },
          { value: "mdb", label: "🗄️ 網站 MDB 資料匯入" },
        ]}
      />

      <Stepper step={step} />

      {step === "pick" && (
        <Card>
          <h2 className="font-semibold text-slate-800">{info.title}</h2>
          <p className="mt-1 text-sm text-slate-500">{info.desc}</p>
          <input
            ref={inputRef}
            type="file"
            accept={info.accept}
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <button
            onClick={() => inputRef.current?.click()}
            className="mt-4 flex w-full flex-col items-center gap-1 rounded-xl border-2 border-dashed border-slate-300 py-10 text-slate-500 hover:border-brand-400 hover:text-brand-700"
          >
            <span className="text-3xl">⬆️</span>
            {file ? (
              <span className="font-medium text-slate-800">
                {file.name}（{(file.size / 1024).toFixed(0)} KB）
              </span>
            ) : (
              <span>點此選擇檔案（{info.accept}）</span>
            )}
          </button>
          <div className="mt-4 flex justify-end">
            <Button onClick={() => parse()} disabled={!file}>
              開始解析
            </Button>
          </div>
        </Card>
      )}

      {(step === "parsing" || step === "importing") && (
        <Card className="py-16 text-center">
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
          <p className="text-slate-600">{step === "parsing" ? `正在解析 ${file?.name}…` : "正在寫入資料庫…"}</p>
        </Card>
      )}

      {step === "preview" && parsed && (
        <Card>
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-semibold text-slate-800">
                解析結果預覽：共 {parsed.total} 筆，已勾選 {selected.size} 筆
              </h2>
              <p className="text-xs text-slate-500">電話相同的會合併到既有客戶；同一客戶相同日期、產品、規格、數量的紀錄會略過，不會重複</p>
            </div>
            {parsed.tables && (
              <Field label="資料表" className="w-64">
                <Select value={parsed.table} onChange={(e) => parse(e.target.value)}>
                  {parsed.tables.map((t) => (
                    <option key={t.name} value={t.name}>
                      {t.name}（{t.rowCount} 筆）
                    </option>
                  ))}
                </Select>
              </Field>
            )}
          </div>
          {parsed.ai && (
            <div className="mb-3">
              <DemoNote>這份 Word 沒有表格，內容由 AI 整理，請仔細確認每一筆再匯入。</DemoNote>
            </div>
          )}
          {parsed.truncated && (
            <p className="mb-3 text-sm text-amber-700">
              資料超過 {rows.length} 筆，只顯示並匯入前 {rows.length} 筆；請分批匯入。
            </p>
          )}
          {rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">
              找不到客戶資料。請確認檔案裡有「姓名」或「電話」欄位{parsed.tables && "，或切換其他資料表"}。
            </p>
          ) : (
            <div className="max-h-[60vh] overflow-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="sticky top-0 bg-white">
                  <tr className="border-b border-slate-200 text-left text-slate-500">
                    <th className="py-2 pr-2">
                      <input
                        type="checkbox"
                        checked={selected.size === rows.length}
                        onChange={(e) => setSelected(new Set(e.target.checked ? rows.map((r) => r.key) : []))}
                      />
                    </th>
                    <th className="py-2 pr-3 font-medium">狀態</th>
                    <th className="py-2 pr-3 font-medium">客戶</th>
                    <th className="py-2 pr-3 font-medium">電話 / 地址</th>
                    <th className="py-2 pr-3 font-medium">日期</th>
                    <th className="py-2 pr-3 font-medium">產品規格</th>
                    <th className="py-2 text-right font-medium">金額</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.key} className="border-b border-slate-100 align-top">
                      <td className="py-2 pr-2">
                        <input
                          type="checkbox"
                          checked={selected.has(r.key)}
                          onChange={(e) => {
                            const s = new Set(selected);
                            if (e.target.checked) s.add(r.key);
                            else s.delete(r.key);
                            setSelected(s);
                          }}
                        />
                      </td>
                      <td className="py-2 pr-3">
                        {r.existingId ? <Badge color="blue">合併：{r.existingName}</Badge> : <Badge color="green">新客戶</Badge>}
                      </td>
                      <td className="py-2 pr-3">
                        <div className="font-medium text-slate-800">{r.name || <span className="text-red-500">缺姓名</span>}</div>
                        <div className="text-xs text-slate-500">{r.company}</div>
                      </td>
                      <td className="py-2 pr-3 text-slate-600">
                        <div>{r.phone || <span className="text-red-500">缺電話</span>}</div>
                        <div className="text-xs text-slate-400">{r.address}</div>
                      </td>
                      <td className="py-2 pr-3 text-slate-600">{r.date || <span className="text-amber-600">無日期</span>}</td>
                      <td className="py-2 pr-3">
                        {r.product || "-"} <span className="text-slate-500">{r.spec}</span> × {r.qty}
                      </td>
                      <td className="py-2 text-right">{money(r.qty * r.unitPrice)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => reset()}>
              重新選檔
            </Button>
            <Button disabled={selected.size === 0} onClick={doImport}>
              確認匯入 {selected.size} 筆
            </Button>
          </div>
        </Card>
      )}

      {step === "done" && (
        <Card className="py-12 text-center">
          <div className="text-4xl">✅</div>
          <h2 className="mt-2 text-lg font-semibold text-slate-800">匯入完成</h2>
          <p className="mt-1 text-slate-600">
            新增客戶 {result.newCustomers} 位、合併既有客戶 {result.merged} 位、匯入訂購紀錄 {result.orders} 筆
            {result.skipped > 0 && `（略過重複 ${result.skipped} 筆）`}
          </p>
          <div className="mt-5 flex justify-center gap-2">
            <Button variant="secondary" onClick={() => reset()}>
              繼續匯入
            </Button>
            <Link href="/customers" className="rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-brand-700">
              前往客戶查詢
            </Link>
          </div>
        </Card>
      )}
    </div>
  );
}

function Stepper({ step }: { step: string }) {
  const steps = [
    { k: ["pick"], label: "1. 選擇檔案" },
    { k: ["parsing", "preview", "importing"], label: "2. 解析與確認" },
    { k: ["done"], label: "3. 完成" },
  ];
  const cur = steps.findIndex((s) => s.k.includes(step));
  return (
    <ol className="mb-5 flex gap-2 text-sm">
      {steps.map((s, i) => (
        <li
          key={s.label}
          className={`flex-1 rounded-lg px-3 py-2 text-center ${
            i === cur ? "bg-brand-600 text-white" : i < cur ? "bg-brand-100 text-brand-800" : "bg-slate-100 text-slate-400"
          }`}
        >
          {s.label}
        </li>
      ))}
    </ol>
  );
}
