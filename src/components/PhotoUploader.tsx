"use client";

import { useEffect, useRef, useState } from "react";
import { discardUpload, photoSrc, uploadImage } from "@/lib/upload";

/** 多張照片上傳（領隊、司機、採果方案用） */
export default function PhotoUploader({
  photos,
  onChange,
  folder = "people",
}: {
  photos: string[];
  onChange: (p: string[]) => void;
  folder?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function add(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    const results = await Promise.allSettled(Array.from(files).map((f) => uploadImage(f, folder, 1024)));
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
              src={photoSrc(p)}
              alt={`照片 ${i + 1}`}
              onClick={() => setPreview(p)}
              className="h-20 w-20 cursor-zoom-in rounded-lg border border-slate-200 object-cover"
            />
            <button
              type="button"
              onClick={() => {
                discardUpload(p);
                onChange(photos.filter((_, j) => j !== i));
              }}
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
          <img src={photoSrc(preview)} alt="預覽" className="max-h-full max-w-full rounded-lg" />
        </div>
      )}
    </div>
  );
}

// 可能放在連結卡片裡：點照片只開預覽，不要跳頁
const stop = (e: React.SyntheticEvent) => {
  e.preventDefault();
  e.stopPropagation();
};

/** 縮圖列；max 設定後只顯示前幾張，最後一張蓋上「+N」，點開可左右切換全部照片 */
export function PhotoStrip({ photos, max, size = "h-12 w-12" }: { photos: string[]; max?: number; size?: string }) {
  const [index, setIndex] = useState<number | null>(null);
  if (!photos.length) return <span className="text-xs text-slate-400">尚無照片</span>;
  const shown = max && photos.length > max ? photos.slice(0, max) : photos;
  const more = photos.length - shown.length;
  return (
    <>
      <div className="flex flex-wrap gap-1.5">
        {shown.map((p, i) => (
          <button
            key={i}
            type="button"
            onClick={(e) => {
              stop(e);
              setIndex(i);
            }}
            className={`relative ${size} shrink-0 cursor-zoom-in overflow-hidden rounded-md border border-slate-200`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photoSrc(p)} alt="" className="h-full w-full object-cover" />
            {more > 0 && i === shown.length - 1 && (
              <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-sm font-semibold text-white sm:text-lg">
                +{more}
              </span>
            )}
          </button>
        ))}
      </div>
      {index !== null && <Lightbox photos={photos} index={index} onIndex={setIndex} onClose={() => setIndex(null)} />}
    </>
  );
}

/** 單張大縮圖，點了放大；放大後可以切換同一組 photos 的其他照片，多張時右下角顯示張數 */
export function PhotoThumb({ src, photos, className = "h-28 w-28" }: { src?: string; photos?: string[]; className?: string }) {
  const [index, setIndex] = useState<number | null>(null);
  if (!src) return null;
  const list = photos?.length ? photos : [src];
  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          stop(e);
          setIndex(Math.max(0, list.indexOf(src)));
        }}
        className="relative block shrink-0 cursor-zoom-in"
        aria-label={list.length > 1 ? `檢視照片（共 ${list.length} 張）` : "檢視照片"}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photoSrc(src)} alt="" className={`${className} rounded-lg border border-slate-200 object-cover`} />
        {list.length > 1 && (
          <span className="absolute -bottom-1 -right-1 rounded-full bg-slate-700 px-1.5 text-[11px] leading-5 text-white">{list.length}</span>
        )}
      </button>
      {index !== null && <Lightbox photos={list} index={index} onIndex={setIndex} onClose={() => setIndex(null)} />}
    </>
  );
}

/** 全螢幕看照片：左右按鈕、鍵盤方向鍵、手機左右滑動切換 */
function Lightbox({
  photos,
  index,
  onIndex,
  onClose,
}: {
  photos: string[];
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
}) {
  const n = photos.length;
  const go = (d: number) => onIndex((index + d + n) % n);
  const touchX = useRef<number | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") onIndex((index - 1 + n) % n);
      else if (e.key === "ArrowRight") onIndex((index + 1) % n);
      else if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, n, onIndex, onClose]);

  const arrow = "absolute top-1/2 -translate-y-1/2 flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-2xl text-white hover:bg-white/30";
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-4"
      onClick={(e) => {
        stop(e);
        onClose();
      }}
      onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touchX.current === null) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        touchX.current = null;
        if (Math.abs(dx) > 40) go(dx > 0 ? -1 : 1);
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={photoSrc(photos[index])} alt="預覽" className="max-h-full max-w-full rounded-lg" onClick={stop} />
      {n > 1 && (
        <>
          <button
            type="button"
            aria-label="上一張"
            className={`${arrow} left-3`}
            onClick={(e) => {
              stop(e);
              go(-1);
            }}
          >
            ‹
          </button>
          <button
            type="button"
            aria-label="下一張"
            className={`${arrow} right-3`}
            onClick={(e) => {
              stop(e);
              go(1);
            }}
          >
            ›
          </button>
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-sm text-white">
            {index + 1} / {n}
          </div>
        </>
      )}
      <button
        type="button"
        aria-label="關閉"
        className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-lg text-white hover:bg-white/30"
        onClick={(e) => {
          stop(e);
          onClose();
        }}
      >
        ✕
      </button>
    </div>
  );
}
