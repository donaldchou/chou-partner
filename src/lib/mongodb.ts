import mongoose from "mongoose";

type MongooseCache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

// Next.js dev 模式會 hot reload，用 global 快取連線避免重複建立
const globalForMongoose = globalThis as typeof globalThis & {
  _mongooseCache?: MongooseCache;
};

const cache: MongooseCache = globalForMongoose._mongooseCache ?? {
  conn: null,
  promise: null,
};
globalForMongoose._mongooseCache = cache;

/** 取得共用的 MongoDB 連線，所有 API 在存取資料前先呼叫這個函式。 */
export async function connectDB() {
  if (cache.conn) return cache.conn;

  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("請在 .env.local 設定 MONGODB_URI");

  if (!cache.promise) {
    cache.promise = mongoose.connect(uri, { bufferCommands: false });
  }

  try {
    cache.conn = await cache.promise;
  } catch (err) {
    // 連線失敗時清掉快取，下一次請求才會重新連線
    cache.promise = null;
    throw err;
  }
  return cache.conn;
}
