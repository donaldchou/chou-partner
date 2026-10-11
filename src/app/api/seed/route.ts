import { NextResponse } from "next/server";
import { HttpError, handleError } from "@/lib/api";
import { COLLECTIONS, type CollectionName } from "@/lib/collections";
import { seedData } from "@/lib/mock-data";
import { connectDB } from "@/lib/mongodb";

/** POST /api/seed 放入示範資料；只在資料庫完全沒有資料時可以使用，避免覆蓋真實資料 */
export async function POST() {
  try {
    await connectDB();
    const names = Object.keys(COLLECTIONS) as CollectionName[];
    const counts = await Promise.all(names.map((n) => COLLECTIONS[n].estimatedDocumentCount()));
    if (counts.some((c) => c > 0)) throw new HttpError(409, "資料庫已經有資料，不能放入示範資料");

    for (const n of names) {
      const docs = (seedData[n] as { id: string }[]).map(({ id, ...rest }) => ({ ...rest, _id: id }));
      if (docs.length) await COLLECTIONS[n].insertMany(docs);
    }
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}
