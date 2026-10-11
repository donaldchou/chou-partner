"use client";

import { api } from "./store";

export interface UploadedFile {
  url: string;
  name: string;
  size: number;
  contentType: string;
}

/** 上傳檔案到 Vercel Blob（經過 /api/upload），回傳檔案網址，存進資料後會寫入 MongoDB */
export function uploadFile(file: Blob, folder: string, name = file instanceof File ? file.name : "file") {
  const form = new FormData();
  form.append("file", file, name);
  form.append("folder", folder);
  return api<UploadedFile>("/api/upload", { method: "POST", body: form });
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
