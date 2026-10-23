"use client";

import { useRef, useState } from "react";
import { Camera, IdCard } from "lucide-react";
import { api } from "@/lib/store";
import { discardUpload, photoSrc, uploadImage } from "@/lib/upload";
import { Button, DemoNote } from "./ui";

export type CardResult = {
  company: string;
  name: string;
  title: string;
  phone: string;
  email: string;
  address: string;
  lineName: string;
};

/** 名片快速登錄：拍照 / 上傳名片 → 辨識 → 自動帶入欄位 */
export default function BusinessCardCapture({
  image,
  onImage,
  onRecognized,
}: {
  image?: string;
  onImage: (url: string | undefined) => void;
  onRecognized: (r: CardResult) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<"" | "upload" | "ocr">("");
  const [done, setDone] = useState(false);
  const [mock, setMock] = useState(false);

  // 拍完 / 選完照片：上傳後直接辨識
  async function pick(file?: File) {
    if (!file) return;
    setDone(false);
    setBusy("upload");
    try {
      const { url } = await uploadImage(file, "cards", 1600, 0.85);
      // 重新拍照：換掉的那張若還沒存進資料就刪掉
      discardUpload(image);
      onImage(url);
      await recognize(url);
    } catch (e) {
      alert(`名片上傳失敗：${e instanceof Error ? e.message : e}`);
    } finally {
      setBusy("");
    }
  }

  async function recognize(url = image) {
    if (!url) return;
    setBusy("ocr");
    try {
      const r = await api<CardResult & { mock: boolean }>("/api/ocr/business-card", {
        method: "POST",
        body: JSON.stringify({ url }),
      });
      onRecognized(r);
      setMock(r.mock);
      setDone(true);
    } catch (e) {
      alert(`名片辨識失敗：${e instanceof Error ? e.message : e}`);
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="rounded-xl border-2 border-dashed border-brand-300 bg-brand-50/50 p-4">
      <div className="mb-3 flex items-center gap-2">
        <IdCard size={22} className="text-brand-600" />
        <span className="font-semibold text-brand-900">名片快速登錄</span>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          pick(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      {image ? (
        <div className="flex flex-col gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photoSrc(image)} alt="名片" className="max-h-56 w-full rounded-lg border border-slate-200 bg-white object-contain" />
          <div className="flex flex-col gap-2">
            <Button onClick={() => recognize()} disabled={!!busy}>
              {busy === "ocr" ? "辨識中…" : done ? "✓ 重新辨識" : "🔍 辨識名片並帶入資料"}
            </Button>
            <Button variant="secondary" disabled={!!busy} onClick={() => inputRef.current?.click()}>
              重新拍照 / 上傳
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                discardUpload(image);
                onImage(undefined);
                setDone(false);
              }}
            >
              移除名片
            </Button>
            {done && <p className="text-xs text-brand-700">已帶入資料欄位，請確認後儲存</p>}
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={!!busy}
          onClick={() => inputRef.current?.click()}
          className="flex w-full flex-col items-center gap-1 rounded-lg bg-white py-6 text-slate-500 hover:text-brand-700 disabled:cursor-wait"
        >
          <Camera size={36} strokeWidth={1.5} />
          <span className="text-sm">{busy === "upload" ? "上傳中…" : busy === "ocr" ? "辨識中…" : "拍攝或上傳名片照片"}</span>
          <span className="text-xs text-slate-400">手機會直接開啟相機</span>
        </button>
      )}

      {mock && (
        <div className="mt-3">
          <DemoNote>尚未設定 GEMINI_API_KEY，帶入的是示範名片資料；設定後會用 AI 辨識實際名片內容。</DemoNote>
        </div>
      )}
    </div>
  );
}
