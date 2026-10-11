/**
 * 一次性建立管理者帳號（沒有註冊頁）。密碼從環境變數讀，不會寫進任何檔案。
 *
 * PowerShell：
 *   $env:ADMIN_EMAIL="you@example.com"; $env:ADMIN_PASSWORD="********"; npm run create-admin
 *
 * 帳號已存在時不會覆蓋；忘記密碼時加上 --reset-password 重設（同時確保是管理者）：
 *   npm run create-admin -- --reset-password
 */
import { readFileSync } from "node:fs";
import mongoose from "mongoose";

for (const line of readFileSync(".env.local", "utf8").replace(/^﻿/, "").split(/\r?\n/)) {
  const m = /^\s*(\w+)\s*=\s*(.*)$/.exec(line);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^"|"$/g, "");
}

async function main() {
  const { connectDB } = await import("../src/lib/mongodb");
  const { hashPassword } = await import("../src/lib/auth");
  const { UserModel } = await import("../src/models/user");

  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? "";
  const name = process.env.ADMIN_NAME?.trim() ?? "";
  const reset = process.argv.includes("--reset-password");
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("請設定環境變數 ADMIN_EMAIL");
  if (password.length < 8) throw new Error("請設定環境變數 ADMIN_PASSWORD（至少 8 個字元）");

  await connectDB();
  const existing = await UserModel.findOne({ email });
  if (existing && !reset) {
    console.log(`帳號 ${email} 已經存在，沒有做任何修改。要重設密碼請加上 --reset-password`);
    return;
  }
  const passwordHash = await hashPassword(password);
  if (existing) {
    existing.set({ passwordHash, role: "admin", active: true });
    await existing.save();
    console.log(`已重設 ${email} 的密碼，身分：管理者`);
  } else {
    await UserModel.create({ email, name, passwordHash, role: "admin", active: true });
    console.log(`已建立管理者帳號 ${email}`);
  }
}

main()
  .catch((e) => {
    console.error("失敗：", e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
