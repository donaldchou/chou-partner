"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useState, useSyncExternalStore } from "react";
import {
  AlertTriangle,
  Bus,
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  Citrus,
  FilePlus2,
  FileUp,
  ReceiptText,
  LayoutDashboard,
  ListOrdered,
  LogOut,
  Menu,
  ShieldCheck,
  UserRound,
  PackagePlus,
  RefreshCw,
  Search,
  CalendarClock,
  UserPlus,
  UserX,
  Tags,
  X,
} from "lucide-react";
import { logout, reload, useDBStatus, useMe } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Loading } from "./ui";
import { CodePrompt } from "./unlock";

const NAV = [
  { group: "總覽", items: [{ href: "/", label: "儀表板", icon: LayoutDashboard }] },
  {
    group: "客戶管理",
    items: [
      { href: "/customers", label: "客戶查詢", icon: Search },
      { href: "/customers/new", label: "客戶建檔", icon: UserPlus, admin: true },
      { href: "/customers/import", label: "歷史紀錄匯入", icon: FileUp, admin: true },
      { href: "/customers?status=suspect", label: "疑似無效客戶", icon: UserX, admin: true },
      { href: "/customers/tags", label: "標籤管理", icon: Tags, admin: true },
    ],
  },
  {
    group: "訂單管理",
    items: [
      { href: "/orders", label: "訂單列表", icon: ReceiptText },
      { href: "/orders/new", label: "新增訂單", icon: FilePlus2, admin: true },
      { href: "/orders?review=1", label: "待確認訂單", icon: AlertTriangle, admin: true },
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
      { href: "/group-buys/new", label: "新增團購", icon: PackagePlus, admin: true },
    ],
  },
];

/** 只有管理者看得到的選單 */
const ADMIN_NAV = { group: "系統", items: [{ href: "/admin", label: "後台管理", icon: ShieldCheck, admin: true }] };

type NavItem = { href: string; label: string; icon: typeof Search; admin?: boolean };
type NavGroup = { group: string; items: NavItem[] };

/** 依身分過濾選單：一般使用者看不到新增、匯入與後台 */
function navFor(isAdmin: boolean): NavGroup[] {
  return [...NAV, ADMIN_NAV]
    .map((g) => ({ ...g, items: (g.items as NavItem[]).filter((it) => isAdmin || !it.admin) }))
    .filter((g) => g.items.length);
}

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
  const matches = [...NAV, ADMIN_NAV]
    .flatMap((g) => g.items.map((it) => it.href))
    .filter((href) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/")));
  return matches.sort((a, b) => b.length - a.length)[0];
}

/* ---------------- 選單分組的展開／收合，記在這台電腦的瀏覽器 ---------------- */
const GROUPS_KEY = "chou-partner-nav-closed-groups";
const groupListeners = new Set<() => void>();
let memoryGroups: string | null = null; // JSON 字串，讓 useSyncExternalStore 拿到穩定的值

function readClosedGroups(): string {
  if (memoryGroups !== null) return memoryGroups;
  try {
    return localStorage.getItem(GROUPS_KEY) ?? "[]";
  } catch {
    return "[]";
  }
}

function saveClosedGroups(closed: Set<string>) {
  memoryGroups = JSON.stringify([...closed]);
  try {
    localStorage.setItem(GROUPS_KEY, memoryGroups);
  } catch {
    // 無法儲存（例如無痕模式）時，只在這次瀏覽有效
  }
  groupListeners.forEach((l) => l());
}

function useClosedGroups() {
  const raw = useSyncExternalStore(
    (l) => {
      groupListeners.add(l);
      return () => groupListeners.delete(l);
    },
    readClosedGroups,
    () => "[]",
  );
  let closed: Set<string>;
  try {
    closed = new Set(JSON.parse(raw) as string[]);
  } catch {
    closed = new Set();
  }
  const toggle = (group: string) => {
    const next = new Set(closed);
    if (next.has(group)) next.delete(group);
    else next.add(group);
    saveClosedGroups(next);
  };
  /** 有任何分組展開就全部收合；已經全部收合就全部展開 */
  const toggleAll = (groups: string[]) => saveClosedGroups(groups.every((g) => closed.has(g)) ? new Set() : new Set(groups));
  return { closed, toggle, toggleAll };
}

function NavItems({ pathname, mini, onNavigate }: { pathname: string; mini: boolean; onNavigate: () => void }) {
  const current = activeHref(pathname);
  const isAdmin = useMe()?.role === "admin";
  const { closed, toggle } = useClosedGroups();
  return navFor(isAdmin).map((g) => {
    // 只剩圖示的窄選單不分組收合；收合的分組裡有目前頁面時，標題會亮起來提示
    const open = mini || !closed.has(g.group);
    const hasActive = g.items.some((it) => it.href === current);
    return (
      <div key={g.group}>
        {mini ? (
          <div className="mx-2 mb-2 border-t border-white/10" />
        ) : (
          <button
            type="button"
            onClick={() => toggle(g.group)}
            aria-expanded={open}
            className={cn(
              "flex w-full items-center justify-between rounded-md px-3 pb-1 pt-0.5 text-sm font-semibold tracking-wider hover:text-white",
              !open && hasActive ? "text-brand-200" : "text-brand-200/60",
            )}
          >
            <span>{g.group}</span>
            <span className="flex items-center gap-1.5">
              {!open && <span className="text-xs font-normal">{g.items.length}</span>}
              <ChevronDown size={16} className={cn("transition-transform", !open && "-rotate-90")} />
            </span>
          </button>
        )}
        {open &&
          g.items.map((it) => {
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
                    ? "bg-brand-500 font-semibold text-white shadow-sm shadow-black/20"
                    : "text-brand-50/85 hover:bg-white/10 hover:text-white",
                )}
              >
                <it.icon size={21} className="shrink-0" />
                {!mini && <span className="truncate">{it.label}</span>}
              </Link>
            );
          })}
      </div>
    );
  });
}

// usePathname 在 Cache Components 下需要 Suspense，預渲染時先顯示無選取狀態的選單
function ActiveNavItems(props: { mini: boolean; onNavigate: () => void }) {
  return <NavItems pathname={usePathname()} {...props} />;
}

/** 選單最上面的圖示：寬選單＝全部分組展開／收合；只剩圖示的窄選單＝展開選單 */
function BrandButton({ mini, onExpand }: { mini: boolean; onExpand: () => void }) {
  const isAdmin = useMe()?.role === "admin";
  const { closed, toggleAll } = useClosedGroups();
  const groups = navFor(isAdmin).map((g) => g.group);
  const allClosed = groups.every((g) => closed.has(g));
  const label = mini ? "展開選單" : allClosed ? "全部展開" : "全部收合";
  return (
    <button
      type="button"
      onClick={() => (mini ? onExpand() : toggleAll(groups))}
      title={label}
      aria-label={label}
      className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-xl bg-gradient-to-br from-accent-400 to-accent-500 text-white shadow-md shadow-black/20 transition hover:brightness-110"
    >
      <Citrus size={24} />
    </button>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  // 只有桌機的浮動選單會收合；手機用抽屜
  const [collapsed, setCollapsed] = useCollapsed();
  const close = () => setOpen(false);

  const nav = (mini: boolean) => (
    <nav className="flex h-full flex-col">
      <div className={cn("flex items-center gap-2.5 py-5", mini ? "justify-center px-2" : "px-5")}>
        <BrandButton mini={mini} onExpand={() => setCollapsed(false)} />
        {!mini && (
          <div className="min-w-0">
            <div className="truncate text-lg font-bold leading-tight text-white">CHOU 農場平台</div>
            <div className="text-sm text-brand-200/70">客戶管理系統</div>
          </div>
        )}
      </div>
      <div
        className={cn("flex-1 space-y-4 overflow-y-auto overflow-x-hidden pb-4", mini ? "px-2" : "px-3")}
        style={{ scrollbarWidth: "thin", scrollbarColor: "#1c546c transparent" }}
      >
        <Suspense fallback={<NavItems pathname="" mini={mini} onNavigate={close} />}>
          <ActiveNavItems mini={mini} onNavigate={close} />
        </Suspense>
      </div>
      <div className="border-t border-white/10 p-3">
        <UserBlock mini={mini} />
        <DBIndicator mini={mini} />
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen">
      {/* 桌機：浮動、圓角的深色選單，可收合成只剩圖示 */}
      <aside
        className={cn(
          "fixed inset-y-3 left-3 z-30 hidden rounded-2xl bg-gradient-to-b from-brand-800 to-brand-950 shadow-xl shadow-slate-400/30 transition-[width] duration-200 lg:block print:hidden",
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
          <div className="absolute inset-0 bg-slate-900/40" onClick={close} />
          <aside className="absolute inset-y-0 left-0 w-72 bg-gradient-to-b from-brand-800 to-brand-950 shadow-xl">
            <button onClick={close} className="absolute right-3 top-7 text-brand-100" aria-label="關閉選單">
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
          <span className="text-lg font-semibold text-slate-800">CHOU 農場平台</span>
        </header>
        {/* 內容用滿寬度，左右只留少量空白 */}
        <main className="px-3 py-4 sm:px-4 lg:py-5 lg:pr-5 print:p-0">
          <DBStatusBanner />
          <ReadOnlyBanner />
          <Suspense fallback={<Loading />}>{children}</Suspense>
        </main>
        {/* 新增、修改、刪除時還沒解鎖：跳出驗證碼輸入框 */}
        <CodePrompt />
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
    <div title={label} className={cn("flex items-center gap-2.5 py-1.5 text-sm text-brand-200/60", mini ? "justify-center" : "px-3")}>
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

/** 選單底部：目前登入的人、身分、登出 */
function UserBlock({ mini }: { mini: boolean }) {
  const me = useMe();
  const role = me ? (me.role === "admin" ? "管理者" : "一般使用者（唯讀）") : "";
  return (
    <div className="mb-1 space-y-1">
      <div
        className={cn("flex items-center gap-2.5 py-1 text-brand-50", mini ? "justify-center" : "px-3")}
        title={me ? `${me.email}（${role}）` : undefined}
      >
        <UserRound size={19} className="shrink-0 text-brand-200/70" />
        {!mini && (
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">{me?.name || me?.email || "…"}</div>
            <div className="text-xs text-brand-200/60">{role}</div>
          </div>
        )}
      </div>
      <button
        onClick={() => void logout()}
        title={mini ? "登出" : undefined}
        aria-label="登出"
        className={cn(
          "flex w-full items-center gap-2.5 rounded-xl py-1.5 text-sm text-brand-100/80 hover:bg-white/10 hover:text-white",
          mini ? "justify-center" : "px-3",
        )}
      >
        <LogOut size={17} className="shrink-0" />
        {!mini && "登出"}
      </button>
    </div>
  );
}
/** 一般使用者：提示只能查看 */
function ReadOnlyBanner() {
  const me = useMe();
  if (!me || me.role === "admin") return null;
  return (
    <div className="mb-4 rounded-xl bg-amber-50 px-4 py-2.5 text-sm text-amber-800 print:hidden">
      你的帳號是一般使用者，只能查看資料；需要新增或修改請聯絡管理者。
    </div>
  );
}
