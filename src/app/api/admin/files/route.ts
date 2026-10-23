import { connection, NextResponse } from "next/server";
import { handleError } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { deleteFiles, scanFiles } from "@/lib/storage";
import { requireUnlocked } from "@/lib/unlock";

/**
 * GET /api/admin/files  比對 ll3 主機上的檔案和資料庫
 * 回傳 { total, totalBytes, used, unused: [沒被資料用到的檔案（recent = 24 小時內上傳，先不刪）] }
 */
export async function GET() {
  await connection();
  try {
    await requireAdmin();
    const files = await scanFiles();
    return NextResponse.json({
      total: files.length,
      totalBytes: files.reduce((s, f) => s + f.size, 0),
      used: files.filter((f) => f.used).length,
      unused: files.filter((f) => !f.used).sort((a, b) => a.time.localeCompare(b.time)),
    });
  } catch (err) {
    return handleError(err);
  }
}

/** DELETE /api/admin/files  刪除未使用而且超過 24 小時的檔案（伺服器重新比對，不採用前端給的清單） */
export async function DELETE() {
  try {
    await requireUnlocked(await requireAdmin());
    const targets = (await scanFiles()).filter((f) => !f.used && !f.recent);
    const failed = await deleteFiles(targets.map((f) => f.url));
    return NextResponse.json({ deleted: targets.length - failed, failed });
  } catch (err) {
    return handleError(err);
  }
}
