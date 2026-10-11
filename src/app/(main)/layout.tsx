import AppShell from "@/components/AppShell";

/** 登入後的頁面都套用側邊選單；登入頁在 (main) 外面，不套用 */
export default function MainLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
