"use client";

import { useRef, useState } from "react";
import { uploadImage } from "@/lib/upload";

/** 多張照片上傳（領隊、司機用） */
export default function PhotoUploader({ photos, onChange }: { photos: string[]; onChange: (p: string[]) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function add(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    const results = await Promise.allSettled(Array.from(files).map((f) => uploadImage(f, "people", 1024)));
    setBusy(false);
    const urls = results.flatMap((r) => (r.status === "fulfilled" ? [r.value.url] : []));
    if (urls.length) onChange([...photos, ...urls]);
    const failed = results.length - urls.length;
    if (failed) alert(`${failed} 張照片上傳失敗`);
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {photos.map((p, i) => (
          <div key={i} className="group relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={p}
              alt={`照片 ${i + 1}`}
              onClick={() => setPreview(p)}
              className="h-20 w-20 cursor-zoom-in rounded-lg border border-slate-200 object-cover"
            />
            <button
              type="button"
              onClick={() => onChange(photos.filter((_, j) => j !== i))}
              className="absolute -right-1.5 -top-1.5 hidden h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white group-hover:flex"
              aria-label="刪除照片"
            >
              ✕
            </button>
          </div>
        ))}
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className="disabled:cursor-wait flex h-20 w-20 flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 text-slate-400 hover:border-brand-400 hover:text-brand-600"
        >
          <span className="text-xl">＋</span>
          <span className="text-xs">{busy ? "上傳中…" : "加照片"}</span>
        </button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          add(e.target.files);
          e.target.value = "";
        }}
      />
      {preview && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4" onClick={() => setPreview(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="預覽" className="max-h-full max-w-full rounded-lg" />
        </div>
      )}
    </div>
  );
}

export function PhotoStrip({ photos }: { photos: string[] }) {
  const [preview, setPreview] = useState<string | null>(null);
  if (!photos.length) return <span className="text-xs text-slate-400">尚無照片</span>;
  return (
    <>
      <div className="flex flex-wrap gap-1.5">
        {photos.map((p, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={i}
            src={p}
            alt=""
            onClick={() => setPreview(p)}
            className="h-12 w-12 cursor-zoom-in rounded-md border border-slate-200 object-cover"
          />
        ))}
      </div>
      {preview && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4" onClick={() => setPreview(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="預覽" className="max-h-full max-w-full rounded-lg" />
        </div>
      )}
    </>
  );
}
