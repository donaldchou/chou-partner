import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

/** 不用登入就能進的路徑 */
const PUBLIC = ["/login", "/api/auth/login", "/api/auth/logout"];

/**
 * 整個網站都要登入。這裡只驗證 JWT 簽章（不查資料庫），
 * 真正的權限（帳號停用、管理者才能寫入）由各個 API 用 requireUser / requireAdmin 再檢查一次。
 */
export async function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const isApi = pathname.startsWith("/api/");
  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);

  if (PUBLIC.includes(pathname)) {
    // 已登入還開登入頁，直接回首頁
    if (session && pathname === "/login") return NextResponse.redirect(new URL("/", req.url));
    return NextResponse.next();
  }

  if (!session) {
    if (isApi) return NextResponse.json({ error: "請先登入" }, { status: 401 });
    const login = new URL("/login", req.url);
    if (pathname !== "/") login.searchParams.set("next", pathname + search);
    const res = NextResponse.redirect(login);
    // cookie 過期或無效就順便清掉
    if (req.cookies.has(SESSION_COOKIE)) res.cookies.delete(SESSION_COOKIE);
    return res;
  }

  // 後台只給管理者
  if (session.role !== "admin") {
    if (pathname.startsWith("/api/admin/")) return NextResponse.json({ error: "只有管理者可以使用後台" }, { status: 403 });
    if (/^\/admin(\/|$)/.test(pathname)) return NextResponse.redirect(new URL("/", req.url));
  }
  return NextResponse.next();
}

export const config = {
  // 排除 Next.js 內部檔案和 public 裡的靜態檔（有副檔名的）
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.[a-zA-Z0-9]+$).*)"],
};
