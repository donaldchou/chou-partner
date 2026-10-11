"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useState, useSyncExternalStore } from "react";
import {
  Bus,
  ChevronsLeft,
  ChevronsRight,
  Citrus,
  FileUp,
  LayoutDashboard,
  ListOrdered,
  Menu,
  PackagePlus,
  RefreshCw,
  Search,
  CalendarClock,
  UserPlus,
  X,
} from "lucide-react";
import { reload, useDBStatus } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Loading } from "./ui";

const NAV = [
  { group: "總覽", items: [{ href: "/", label: "儀表板", icon: LayoutDashboard }] },
  {
    group: "客戶管理",
    items: [
      { href: "/customers", label: "客戶查詢", icon: Search },
      { href: "/customers/new", label: "客戶建檔", icon: UserPlus },
      { href: "/customers/import", label: "歷史紀錄匯入", icon: FileUp },
    ],
  },
  {
    group: "遊覽車管理",
    items: [
      { href: "/tours/bookings", label: "採果預約", icon: CalendarClock },
      { href: "/tours/agencies", label: "旅行社資料", icon: Bus },
    ],
  },
  {
    group: "團購管理",
    items: [
      { href: "/group-buys", label: "團購列表", icon: ListOrdered },
      { href: "/group-buys/new", label: "新增團購", icon: PackagePlus },
    ],
  },
];

/* ---------------- 側邊選單收合狀態，記在這台電腦的瀏覽器 ---------------- */
const COLLAPSE_KEY = "chou-partner-sidebar-collapsed";
const collapseListeners = new Set<() => void>();
let memoryCollapsed: boolean | null = null;

function readCollapsed() {
  if (memoryCollapsed !== null) return memoryCollapsed;
  try {
    return localStorage.getItem(COLLAPSE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeCollapsed(v: boolean) {
  try {
    localStorage.setItem(COLLAPSE_KEY, v ? "1" : "0");
  } catch {
    // 無法儲存（例如無痕模式）時，只在這次瀏覽有效
  }
  memoryCollapsed = v;
  collapseListeners.forEach((l) => l());
}

function useCollapsed(): [boolean, (v: boolean) => void] {
  const collapsed = useSyncExternalStore(
    (l) => {
      collapseListeners.add(l);
      return () => collapseListeners.delete(l);
    },
    readCollapsed,
    () => false,
  );
  return [collapsed, writeCollapsed];
}

/** 選單中最符合目前網址的項目（例如 /customers/c1 → 客戶查詢，/customers/new → 客戶建檔） */
function activeHref(pathname: string) {
  const matches = NAV.flatMap((g) => g.items.map((it) => it.href)).filter((href) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/"),
  );
  return matches.sort((a, b) => b.length - a.length)[0];
}

function NavItems({ pathname, mini, onNavigate }: { pathname: string; mini: boolean; onNavigate: () => void }) {
  const current = activeHref(pathname);
  return NAV.map((g) => (
    <div key={g.group}>
      {mini ? (
        <div className="mx-2 mb-2 border-t border-slate-200" />
      ) : (
        <div className="px-3 pb-1 text-sm font-semibold tracking-wider text-slate-400">{g.group}</div>
      )}
      {g.items.map((it) => {
        const active = it.href === current;
        return (
          <Link
            key={it.href}
            href={it.href}
            onClick={onNavigate}
            title={mini ? it.label : undefined}
            aria-label={mini ? it.label : undefined}
            className={cn(
              "mb-0.5 flex items-center gap-3 rounded-xl py-2.5 text-[1.05rem] transition-colors",
              mini ? "justify-center px-0" : "px-3",
              active
                ? "bg-brand-500 font-semibold text-white shadow-sm shadow-brand-500/30"
                : "text-slate-600 hover:bg-brand-50 hover:text-brand-700",
            )}
          >
            <it.icon size={21} className="shrink-0" />
            {!mini && <span className="truncate">{it.label}</span>}
          </Link>
        );
      })}
    </div>
  ));
}

// usePathname 在 Cache Components 下需要 Suspense，預渲染時先顯示無選取狀態的選單
function ActiveNavItems(props: { mini: boolean; onNavigate: () => void }) {
  return <NavItems pathname={usePathname()} {...props} />;
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  // 只有桌機的浮動選單會收合；手機用抽屜
  const [collapsed, setCollapsed] = useCollapsed();
  const close = () => setOpen(false);

  const nav = (mini: boolean) => (
    <nav className="flex h-full flex-col">
      <div className={cn("flex items-center gap-2.5 py-5", mini ? "justify-center px-2" : "px-5")}>
        <Link
          href="/"
          onClick={close}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-accent-400 to-accent-500 text-white shadow-md shadow-accent-500/30"
          aria-label="回到儀表板"
        >
          <Citrus size={24} />
        </Link>
        {!mini && (
          <div className="min-w-0">
            <div className="truncate text-lg font-bold leading-tight text-slate-800">周家夥伴平台</div>
            <div className="text-sm text-slate-400">CHOU Partner</div>
          </div>
        )}
      </div>
      <div
        className={cn("flex-1 space-y-4 overflow-y-auto overflow-x-hidden pb-4", mini ? "px-2" : "px-3")}
        style={{ scrollbarWidth: "thin" }}
      >
        <Suspense fallback={<NavItems pathname="" mini={mini} onNavigate={close} />}>
          <ActiveNavItems mini={mini} onNavigate={close} />
        </Suspense>
      </div>
      <div className="border-t border-slate-200 p-3">
        <DBIndicator mini={mini} />
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen">
      {/* 桌機：浮動、圓角的選單，可收合成只剩圖示 */}
      <aside
        className={cn(
          "fixed inset-y-3 left-3 z-30 hidden rounded-2xl border border-slate-200/70 bg-white shadow-xl shadow-slate-300/40 transition-[width] duration-200 lg:block print:hidden",
          collapsed ? "w-18" : "w-64",
        )}
      >
        {nav(collapsed)}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3.5 top-8 flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-md hover:text-brand-600"
          aria-label={collapsed ? "展開選單" : "收合選單"}
          title={collapsed ? "展開選單" : "收合選單"}
        >
          {collapsed ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
        </button>
      </aside>

      {/* 手機抽屜 */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden print:hidden">
          <div className="absolute inset-0 bg-slate-900/30" onClick={close} />
          <aside className="absolute inset-y-0 left-0 w-72 bg-white shadow-xl">
            <button onClick={close} className="absolute right-3 top-7 text-slate-500" aria-label="關閉選單">
              <X size={22} />
            </button>
            {nav(false)}
          </aside>
        </div>
      )}

      <div className={cn("transition-[padding] duration-200 print:pl-0", collapsed ? "lg:pl-24" : "lg:pl-70")}>
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-slate-200 bg-white/90 px-3 py-3 backdrop-blur lg:hidden print:hidden">
          <button onClick={() => setOpen(true)} aria-label="開啟選單" className="text-slate-700">
            <Menu size={24} />
          </button>
          <Citrus size={20} className="text-accent-500" />
          <span className="text-lg font-semibold text-slate-800">周家夥伴平台</span>
        </header>
        {/* 內容用滿寬度，左右只留少量空白 */}
        <main className="px-3 py-4 sm:px-4 lg:py-5 lg:pr-5 print:p-0">
          <DBStatusBanner />
          <Suspense fallback={<Loading />}>{children}</Suspense>
        </main>
      </div>
    </div>
  );
}

/** 選單底部的資料庫連線狀態 */
function DBIndicator({ mini }: { mini: boolean }) {
  const { status } = useDBStatus();
  const [color, label] =
    status === "ready"
      ? ["bg-emerald-500", "資料庫已連線"]
      : status === "error"
        ? ["bg-red-500", "資料庫連線失敗"]
        : ["bg-amber-400", "連線中…"];
  return (
    <div title={label} className={cn("flex items-center gap-2.5 py-1.5 text-sm text-slate-400", mini ? "justify-center" : "px-3")}>
      <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", color)} />
      {!mini && label}
    </div>
  );
}

function DBStatusBanner() {
  const { status, error } = useDBStatus();
  if (status === "loading" || status === "idle") {
    return (
      <div className="mb-4 flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-sm text-slate-500 shadow-sm print:hidden">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
        正在從資料庫載入資料…
      </div>
    );
  }
  if (status === "error") {
    return (
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 print:hidden">
        <span>無法連線到資料庫：{error}</span>
        <button
          onClick={() => void reload()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1 text-white hover:bg-red-700"
        >
          <RefreshCw size={14} /> 重試
        </button>
      </div>
    );
  }
  return null;
}
