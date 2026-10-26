"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Check, IdCard, ImagePlus, X } from "lucide-react";
import { api } from "@/lib/store";
import { discardUpload, photoSrc, uploadImage } from "@/lib/upload";
import { Button } from "./ui";

export type CardResult = {
  company: string;
  name: string;
  title: string;
  phone: string;
  email: string;
  address: string;
  lineName: string;
};

const recognizeCard = (url: string) =>
  api<CardResult>("/api/ocr/business-card", { method: "POST", body: JSON.stringify({ url }) });

/** 伺服器有沒有設定 AI 辨識（GEMINI_API_KEY）；沒有就只存照片，不辨識、不帶入任何資料。查一次後整個頁面共用 */
let ocrCheck: Promise<boolean> | undefined;
function useOcrEnabled() {
  const [enabled, setEnabled] = useState<boolean | undefined>(undefined);
  useEffect(() => {
    ocrCheck ??= api<{ enabled: boolean }>("/api/ocr/business-card")
      .then((r) => r.enabled)
      .catch(() => false);
    let alive = true;
    void ocrCheck.then((v) => alive && setEnabled(v));
    return () => {
      alive = false;
    };
  }, []);
  return enabled;
}

function NoOcrNote() {
  return <p className="mt-3 text-xs text-slate-500">尚未設定 AI 辨識，名片只會存照片，資料請手動填寫。</p>;
}

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
  const ocr = useOcrEnabled();

  // 拍完 / 選完照片：上傳後直接辨識（有設定 AI 辨識時）
  async function pick(file?: File) {
    if (!file) return;
    setDone(false);
    setBusy("upload");
    try {
      const { url } = await uploadImage(file, "cards", 1600, 0.85);
      // 重新拍照：換掉的那張若還沒存進資料就刪掉
      discardUpload(image);
      onImage(url);
      if (ocr) await recognize(url);
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
      onRecognized(await recognizeCard(url));
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
            {ocr && (
              <Button onClick={() => recognize()} disabled={!!busy}>
                {busy === "ocr" ? "辨識中…" : done ? "✓ 重新辨識" : "🔍 辨識名片並帶入資料"}
              </Button>
            )}
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

      {ocr === false && <NoOcrNote />}
    </div>
  );
}

/**
 * 名片快速登錄（多張照片）：拍照 / 一次選多張上傳，全部都會存下來；
 * 點縮圖選一張辨識，選中的那張就是主要名片（selected）。
 */
export function BusinessCardMultiCapture({
  images,
  selected,
  onChange,
  onRecognized,
  autoRecognize = true,
}: {
  images: string[];
  selected?: string;
  onChange: (images: string[], selected: string | undefined) => void;
  onRecognized: (r: CardResult) => void;
  /** false：上傳後不自動辨識（編輯既有資料時，避免蓋掉已填好的欄位），要辨識請按按鈕 */
  autoRecognize?: boolean;
}) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const albumRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState("");
  const [done, setDone] = useState(false);
  const ocr = useOcrEnabled();
  const current = selected && images.includes(selected) ? selected : images[0];

  async function pick(files: File[]) {
    if (!files.length) return;
    const added: string[] = [];
    try {
      for (const [i, file] of files.entries()) {
        setBusy(files.length > 1 ? `上傳中 ${i + 1}/${files.length}…` : "上傳中…");
        added.push((await uploadImage(file, "cards", 1600, 0.85)).url);
      }
    } catch (e) {
      alert(`名片上傳失敗：${e instanceof Error ? e.message : e}`);
    }
    setBusy("");
    if (!added.length) return;
    // 第一次只拍一張：跟以前一樣直接辨識；多張就讓使用者自己選
    const first = !images.length;
    onChange([...images, ...added], current ?? added[0]);
    if (ocr && autoRecognize && first && added.length === 1) await recognize(added[0]);
  }

  async function recognize(url = current) {
    if (!url) return;
    setBusy("辨識中…");
    try {
      onRecognized(await recognizeCard(url));
      setDone(true);
    } catch (e) {
      alert(`名片辨識失敗：${e instanceof Error ? e.message : e}`);
    } finally {
      setBusy("");
    }
  }

  function select(url: string) {
    if (url === current) return;
    onChange(images, url);
    setDone(false);
  }

  function remove(url: string) {
    discardUpload(url);
    const rest = images.filter((u) => u !== url);
    onChange(rest, url === current ? rest[0] : current);
    if (url === current) setDone(false);
  }

  const fileInput = (ref: typeof cameraRef, camera: boolean) => (
    <input
      ref={ref}
      type="file"
      accept="image/*"
      {...(camera ? { capture: "environment" as const } : { multiple: true })}
      className="hidden"
      onChange={(e) => {
        pick([...(e.target.files ?? [])]);
        e.target.value = "";
      }}
    />
  );

  return (
    <div className="rounded-xl border-2 border-dashed border-brand-300 bg-brand-50/50 p-4">
      <div className="mb-3 flex items-center gap-2">
        <IdCard size={22} className="text-brand-600" />
        <span className="font-semibold text-brand-900">名片快速登錄</span>
      </div>
      {images.length > 1 && (
        <p className="-mt-1 mb-3 text-xs text-slate-500">
          共 {images.length} 張，點縮圖選擇{ocr ? "要辨識的照片" : "主要名片"}
        </p>
      )}
      {fileInput(cameraRef, true)}
      {fileInput(albumRef, false)}

      {current ? (
        <div className="flex flex-col gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photoSrc(current)} alt="名片" className="max-h-56 w-full rounded-lg border border-slate-200 bg-white object-contain" />
          {images.length > 1 && (
            <div className="grid grid-cols-4 gap-2">
              {images.map((u) => (
                <div key={u} className="relative">
                  <button
                    type="button"
                    disabled={!!busy}
                    onClick={() => select(u)}
                    className={`block aspect-square w-full overflow-hidden rounded-lg border-2 bg-white ${
                      u === current ? "border-brand-600 ring-2 ring-brand-300" : "border-slate-200 hover:border-brand-400"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photoSrc(u)} alt="名片" className="h-full w-full object-cover" />
                  </button>
                  {u === current && (
                    <span className="pointer-events-none absolute left-1 top-1 rounded-full bg-brand-600 p-0.5 text-white">
                      <Check size={12} />
                    </span>
                  )}
                  <button
                    type="button"
                    disabled={!!busy}
                    onClick={() => remove(u)}
                    aria-label="移除這張"
                    className="absolute right-1 top-1 rounded-full bg-white/90 p-0.5 text-slate-500 shadow hover:text-red-600"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex flex-col gap-2">
            {ocr && (
              <Button onClick={() => recognize()} disabled={!!busy}>
                {busy === "辨識中…" ? busy : done ? "✓ 重新辨識" : images.length > 1 ? "🔍 辨識選取的照片並帶入資料" : "🔍 辨識名片並帶入資料"}
              </Button>
            )}
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" disabled={!!busy} onClick={() => cameraRef.current?.click()}>
                <Camera size={16} /> 再拍一張
              </Button>
              <Button variant="secondary" disabled={!!busy} onClick={() => albumRef.current?.click()}>
                <ImagePlus size={16} /> {busy.startsWith("上傳") ? busy : "從相簿加入"}
              </Button>
            </div>
            {images.length === 1 && (
              <Button variant="ghost" disabled={!!busy} onClick={() => remove(current)}>
                移除名片
              </Button>
            )}
            {done && <p className="text-xs text-brand-700">已帶入資料欄位，請確認後儲存</p>}
          </div>
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            disabled={!!busy}
            onClick={() => cameraRef.current?.click()}
            className="flex w-full flex-col items-center gap-1 rounded-lg bg-white py-6 text-slate-500 hover:text-brand-700 disabled:cursor-wait"
          >
            <Camera size={36} strokeWidth={1.5} />
            <span className="text-sm">{busy || "拍攝名片"}</span>
            <span className="text-xs text-slate-400">手機會直接開啟相機</span>
          </button>
          <button
            type="button"
            disabled={!!busy}
            onClick={() => albumRef.current?.click()}
            className="flex w-full flex-col items-center gap-1 rounded-lg bg-white py-6 text-slate-500 hover:text-brand-700 disabled:cursor-wait"
          >
            <ImagePlus size={36} strokeWidth={1.5} />
            <span className="text-sm">{busy || "上傳照片（可多張）"}</span>
            <span className="text-xs text-slate-400">從相簿或電腦選擇</span>
          </button>
        </div>
      )}

      {ocr === false && <NoOcrNote />}
    </div>
  );
}
