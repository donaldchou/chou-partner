"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { Badge, Button, Card, PageHeader, Tabs } from "@/components/ui";
import { itemsText } from "@/lib/calc";
import { api } from "@/lib/store";
import type { OrderItem } from "@/lib/types";
import { formatDate, money } from "@/lib/utils";

type Kind = "mdb" | "word";

interface ParseResult {
  file: string;
  total: number;
  existing: number;
  fresh: number;
  needsReview: number;
  products: number;
  skipped: { reason: string; count: number }[];
  preview: {
    key: string;
    orderNo: string;
    channel: string;
    orderedAt: string;
    buyer: { name: string; phone: string };
    address: string;
    shipments: number;
    items: OrderItem[];
    total: number;
    needsReview: boolean;
    reasons: string[];
  }[];
}

interface CommitResult {
  orders: { created: number; existing: number; needsReview: number };
  customers: { created: number; updated: number };
  products: number;
}

const INFO: Record<Kind, { title: string; accept: string; desc: string }> = {
  mdb: {
    title: "舊網站 MDB 匯入",
    accept: ".mdb",
    desc: "上傳舊網站（水蜜桃、甜柿、bigfarm）的 Access 資料庫，讀取訂單主檔、明細、產品與速達託運資料。同一張訂單出現在多個檔案時只會匯入一次。",
  },
  word: {
    title: "電話訂單 Word 匯入",
    accept: ".docx",
    desc: "上傳一整季的電話／LINE 訂單（每筆用「-----」分隔）。檔名要有日期（例如「訂單 20250526.docx」）用來判斷年份。規則解析不確定的訂單會標記「待確認」，匯入後到「待確認訂單」對照原文修正。",
  },
};

export default function ImportPage() {
  const [kind, setKind] = useState<Kind>("mdb");
  const [file, setFile] = useState<File | null>(null);
  const [step, setStep] = useState<"pick" | "parsing" | "preview" | "importing" | "done">("pick");
  const [parsed, setParsed] = useState<ParseResult | null>(null);
  const [result, setResult] = useState<CommitResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const info = INFO[kind];

  function reset(k: Kind = kind) {
    setKind(k);
    setFile(null);
    setStep("pick");
    setParsed(null);
    setResult(null);
  }

  const form = () => {
    const f = new FormData();
    f.append("file", file!);
    f.append("kind", kind);
    return f;
  };

  async function parse() {
    setStep("parsing");
    try {
      setParsed(await api<ParseResult>("/api/import/parse", { method: "POST", body: form() }));
      setStep("preview");
    } catch (e) {
      alert(`解析失敗：${e instanceof Error ? e.message : e}`);
      setStep("pick");
    }
  }

  async function commit() {
    setStep("importing");
    try {
      setResult(await api<CommitResult>("/api/import/commit", { method: "POST", body: form() }));
      setStep("done");
    } catch (e) {
      alert(`匯入失敗：${e instanceof Error ? e.message : e}`);
      setStep("preview");
    }
  }

  return (
    <div>
      <PageHeader
        title="歷史訂購紀錄匯入"
        subtitle="把舊網站資料庫或電話訂單 Word 匯入平台；重複匯入同一個檔案不會產生重複訂單"
        back="/customers"
      />

      <Tabs
        value={kind}
        onChange={(k) => reset(k)}
        tabs={[
          { value: "mdb", label: "🗄️ 舊網站 MDB" },
          { value: "word", label: "📄 電話訂單 Word" },
        ]}
      />

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
              <span>點此選擇檔案（{info.accept}，4MB 以內）</span>
            )}
          </button>
          <div className="mt-4 flex justify-end">
            <Button onClick={parse} disabled={!file}>
              解析檔案
            </Button>
          </div>
        </Card>
      )}

      {(step === "parsing" || step === "importing") && (
        <Card className="py-16 text-center">
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
          <p className="text-slate-600">{step === "parsing" ? `正在解析 ${file?.name}…` : "正在寫入資料庫、合併客戶…"}</p>
        </Card>
      )}

      {step === "preview" && parsed && (
        <Card>
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="檔案裡的訂單" value={parsed.total} />
            <Stat label="已經匯入過（略過）" value={parsed.existing} />
            <Stat label="這次會新增" value={parsed.fresh} strong />
            <Stat label="其中待確認" value={parsed.needsReview} warn={parsed.needsReview > 0} />
          </div>
          {parsed.skipped.length > 0 && (
            <p className="mb-3 text-xs text-slate-500">排除：{parsed.skipped.map((s) => `${s.reason} ${s.count} 筆`).join("、")}</p>
          )}
          {parsed.fresh === 0 ? (
            <p className="py-6 text-center text-slate-500">這個檔案的訂單都已經匯入過了。</p>
          ) : (
            <>
              <p className="mb-2 text-sm text-slate-500">預覽前 {parsed.preview.length} 筆：</p>
              <div className="max-h-[55vh] overflow-auto rounded-lg border border-slate-200">
                <table className="w-full min-w-[820px] text-sm">
                  <thead className="sticky top-0 bg-slate-50 text-left text-xs text-slate-500">
                    <tr>
                      <th className="px-3 py-2 font-medium">日期</th>
                      <th className="px-3 py-2 font-medium">訂購人</th>
                      <th className="px-3 py-2 font-medium">品項</th>
                      <th className="px-3 py-2 font-medium">收件</th>
                      <th className="px-3 py-2 text-right font-medium">金額</th>
                      <th className="px-3 py-2 font-medium">待確認原因</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {parsed.preview.map((r) => (
                      <tr key={r.key} className="align-top">
                        <td className="whitespace-nowrap px-3 py-2 text-slate-500">{formatDate(r.orderedAt)}</td>
                        <td className="px-3 py-2">
                          <div className="font-medium text-slate-800">{r.buyer.name || <span className="text-red-500">缺姓名</span>}</div>
                          <div className="text-xs text-slate-500">{r.buyer.phone || <span className="text-red-500">缺電話</span>}</div>
                        </td>
                        <td className="px-3 py-2 text-slate-700">
                          {itemsText(r.items) || <span className="text-red-500">看不出品項</span>}
                        </td>
                        <td className="px-3 py-2 text-xs text-slate-500">{r.shipments > 1 ? `${r.shipments} 個地址` : r.address}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-right">{money(r.total)}</td>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap gap-1">
                            {r.reasons
                              .filter((x) => !x.startsWith("提示"))
                              .map((x) => (
                                <Badge key={x} color="red">
                                  {x}
                                </Badge>
                              ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => reset()}>
              重新選檔
            </Button>
            <Button disabled={parsed.fresh === 0} onClick={commit}>
              匯入 {parsed.fresh} 筆訂單
            </Button>
          </div>
        </Card>
      )}

      {step === "done" && result && (
        <Card className="py-12 text-center">
          <div className="text-4xl">✅</div>
          <h2 className="mt-2 text-lg font-semibold text-slate-800">匯入完成</h2>
          <p className="mt-1 text-slate-600">
            新增訂單 {result.orders.created} 筆（略過已匯入 {result.orders.existing} 筆）、新增客戶 {result.customers.created}{" "}
            位、合併到既有客戶 {result.customers.updated} 位{result.products > 0 && `、更新產品 ${result.products} 項`}
          </p>
          <div className="mt-5 flex justify-center gap-2">
            <Button variant="secondary" onClick={() => reset()}>
              繼續匯入
            </Button>
            {result.orders.needsReview > 0 && (
              <Link href="/orders?review=1" className="rounded-lg bg-red-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-red-700">
                確認 {result.orders.needsReview} 筆待確認訂單
              </Link>
            )}
            <Link href="/customers" className="rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-brand-700">
              前往客戶查詢
            </Link>
          </div>
        </Card>
      )}
    </div>
  );
}

function Stat({ label, value, strong, warn }: { label: string; value: number; strong?: boolean; warn?: boolean }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div
        className={
          strong ? "text-2xl font-bold text-brand-800" : warn ? "text-2xl font-bold text-red-600" : "text-2xl font-semibold text-slate-700"
        }
      >
        {value.toLocaleString()}
      </div>
    </div>
  );
}
