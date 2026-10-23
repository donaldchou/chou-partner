"use client";

import { api } from "./store";

export interface UploadedFile {
  url: string;
  name: string;
  size: number;
  contentType: string;
}

/** 上傳、下載都分段，每段 3MB（Vercel 請求／回應上限約 4.5MB，同 /api/file 的 FILE_PART） */
const FILE_PART = 3 * 1024 * 1024;

/**
 * 上傳檔案到 ll3 主機（經過 /api/upload，大檔案分段送），回傳檔案網址（"ll3:..."），存進資料後會寫入 MongoDB。
 * 顯示照片用 photoSrc()，開啟檔案用 openStoredFile()。
 */
export async function uploadFile(
  file: Blob,
  folder: string,
  name = file instanceof File ? file.name : "file",
  onProgress?: (ratio: number) => void,
) {
  const uploadId = [...crypto.getRandomValues(new Uint8Array(12))].map((b) => b.toString(16).padStart(2, "0")).join("");
  const parts = Math.max(1, Math.ceil(file.size / FILE_PART));
  let result = { url: "", name, size: file.size, contentType: file.type } as UploadedFile;
  for (let i = 0; i < parts; i++) {
    const form = new FormData();
    form.append("file", file.slice(i * FILE_PART, (i + 1) * FILE_PART), "part");
    form.append("uploadId", uploadId);
    form.append("index", String(i));
    form.append("last", i === parts - 1 ? "1" : "0");
    form.append("name", name);
    form.append("size", String(file.size));
    form.append("folder", folder);
    result = await api<UploadedFile>("/api/upload", { method: "POST", body: form });
    onProgress?.((i + 1) / parts);
  }
  return result;
}

/** 把 MongoDB 裡的檔案網址轉成 <img> 可用的網址（ll3 主機的檔案要經過 /api/photo） */
export const photoSrc = (url: string) => (url.startsWith("ll3:") ? `/api/photo?url=${encodeURIComponent(url)}` : url);

/** 分段讀取 ll3 主機上的檔案，組成一個 Blob */
async function fetchStoredFile(url: string): Promise<Blob> {
  const parts: Blob[] = [];
  let got = 0;
  let type = "";
  for (let i = 0; ; i++) {
    const res = await fetch(`/api/file?url=${encodeURIComponent(url)}&part=${i}`);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error ?? `讀取檔案失敗（HTTP ${res.status}）`);
    }
    type = res.headers.get("content-type") ?? "";
    const total = Number(res.headers.get("x-file-size") ?? 0);
    const b = await res.blob();
    parts.push(b);
    got += b.size;
    if (!b.size || got >= total) break;
  }
  return new Blob(parts, { type });
}

/** 開啟檔案：PDF／圖片開新分頁，其他（Excel、CSV、Word…）以原始檔名下載 */
export async function openStoredFile(url: string, name: string) {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const view = ["pdf", "jpg", "jpeg", "png", "webp", "gif"].includes(ext);
  // 要在點擊當下開視窗，等下載完才開會被擋
  const win = view ? window.open("", "_blank") : null;
  if (win) win.document.title = `讀取中… ${name}`;
  try {
    const href = URL.createObjectURL(await fetchStoredFile(url));
    if (win) win.location.href = href;
    else {
      const a = document.createElement("a");
      a.href = href;
      a.download = name;
      a.click();
    }
    setTimeout(() => URL.revokeObjectURL(href), 60_000);
  } catch (err) {
    win?.close();
    alert(err instanceof Error ? err.message : String(err));
  }
}

/** 圖片先在瀏覽器壓縮（長邊 max px、JPEG），再上傳 */
export async function uploadImage(file: File, folder: string, max = 1280, quality = 0.8) {
  const blob = await resizeImage(file, max, quality);
  return uploadFile(blob, folder, file.name.replace(/\.\w+$/, "") + ".jpg");
}

function resizeImage(file: File, max: number, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const src = URL.createObjectURL(file);
    img.onerror = () => {
      URL.revokeObjectURL(src);
      reject(new Error("無法讀取圖片"));
    };
    img.onload = () => {
      URL.revokeObjectURL(src);
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("圖片壓縮失敗"))), "image/jpeg", quality);
    };
    img.src = src;
  });
}
