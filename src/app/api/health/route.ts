import mongoose from "mongoose";
import { connection, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";

/** GET /api/health 檢查資料庫連線 */
export async function GET() {
  // 每次請求都即時讀資料庫，不要在 build 時預先產生
  await connection();
  try {
    await connectDB();
    await mongoose.connection.db!.admin().ping();
    return NextResponse.json({ ok: true, db: mongoose.connection.name });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 503 });
  }
}
