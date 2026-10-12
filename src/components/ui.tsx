"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, X } from "lucide-react";
import { useCanEdit } from "@/lib/store";
import { cn } from "@/lib/utils";
import { UnlockTimer } from "./unlock";

export function PageHeader({
  title,
  subtitle,
  back,
  actions,
  info,
  unlockTimer = true,
}: {
  title: string;
  subtitle?: string;
  back?: string;
  /** 新增、編輯、刪除等按鈕：只有管理者看得到 */
  actions?: React.ReactNode;
  /** 狀態標籤等資訊：所有人都看得到 */
  info?: React.ReactNode;
  /** 標題旁顯示驗證碼解鎖倒數（後台管理頁有自己的解鎖區塊，設為 false） */
  unlockTimer?: boolean;
}) {
  const canEdit = useCanEdit();
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        {back && (
          <Link href={back} className="mb-1 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-brand-700">
            <ArrowLeft size={15} /> 返回
          </Link>
        )}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
          {unlockTimer && <UnlockTimer />}
        </div>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {(info || (actions && canEdit)) && (
        <div className="flex flex-wrap items-center gap-2">
          {info}
          {canEdit && actions}
        </div>
      )}
    </div>
  );
}
export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  // 外部有指定內距（例如 p-0、p-4）時不加預設的 p-5，避免兩個 class 互相衝突
  const pad = /(^|\s)p-\d/.test(className ?? "") ? "" : "p-5";
  return (
    <div className={cn("rounded-2xl border border-slate-200/80 bg-white shadow-sm shadow-slate-200/60", pad, className)}>{children}</div>
  );
}

export function SectionTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <h2 className="text-base font-semibold text-slate-800">{children}</h2>
      {right}
    </div>
  );
}

type Variant = "primary" | "secondary" | "danger" | "dangerSolid" | "ghost";
const variants: Record<Variant, string> = {
  primary: "bg-brand-600 text-white shadow-sm hover:bg-brand-700 disabled:bg-brand-300",
  secondary: "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:text-slate-400",
  danger: "border border-red-200 bg-white text-red-600 hover:bg-red-50",
  dangerSolid: "bg-red-600 text-white shadow-sm hover:bg-red-700 disabled:bg-red-300",
  ghost: "text-slate-600 hover:bg-slate-100",
};

export function Button({
  variant = "primary",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type="button"
      {...props}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed",
        variants[variant],
        className,
      )}
    />
  );
}

export function LinkButton({
  href,
  variant = "primary",
  className,
  children,
}: {
  href: string;
  variant?: Variant;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors",
        variants[variant],
        className,
      )}
    >
      {children}
    </Link>
  );
}

// 外部有指定寬度（例如 w-auto、w-44）時不加 w-full
const widthOf = (className?: string) => (/(^|\s)(sm:|md:|lg:)?w-/.test(className ?? "") ? "" : "w-full");
const inputCls =
  "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20";

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(inputCls, widthOf(props.className), props.className)} />;
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={3} {...props} className={cn(inputCls, "w-full", props.className)} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cn(inputCls, widthOf(props.className), props.className)} />;
}

export function Field({
  label,
  required,
  hint,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1 block text-sm font-medium text-slate-700">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-400">{hint}</span>}
    </label>
  );
}

const badgeColors = {
  green: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  amber: "bg-amber-50 text-amber-700 ring-amber-600/20",
  red: "bg-red-50 text-red-700 ring-red-600/20",
  blue: "bg-sky-50 text-sky-700 ring-sky-600/20",
  gray: "bg-slate-100 text-slate-600 ring-slate-500/20",
  purple: "bg-violet-50 text-violet-700 ring-violet-600/20",
};

export function Badge({ color = "gray", children }: { color?: keyof typeof badgeColors; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
        badgeColors[color],
      )}
    >
      {children}
    </span>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white/60 p-10 text-center text-sm text-slate-500">{children}</div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  wide,
  footer,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  wide?: boolean;
  /** 底部按鈕列（取消／確認等） */
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 print:static print:block print:bg-white print:p-0">
      <div className={cn("my-8 w-full rounded-2xl bg-white shadow-xl print:my-0 print:shadow-none", wide ? "max-w-4xl" : "max-w-lg")}>
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3 print:hidden">
          <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-500 hover:bg-slate-100" aria-label="關閉">
            <X size={20} />
          </button>
        </div>
        <div className="p-5 print:p-0">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50/60 px-5 py-3 print:hidden">{footer}</div>
        )}
      </div>
    </div>
  );
}

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: { value: T; label: string; count?: number }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="mb-5 flex gap-1 overflow-x-auto rounded-xl bg-slate-200/60 p-1">
      {tabs.map((t) => (
        <button
          key={t.value}
          onClick={() => onChange(t.value)}
          className={cn(
            "whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-colors",
            value === t.value ? "bg-white text-brand-700 shadow-sm" : "text-slate-600 hover:text-slate-900",
          )}
        >
          {t.label}
          {t.count !== undefined && <span className="ml-1.5 text-xs text-slate-400">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function Table({ head, children }: { head: React.ReactNode[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200/80 bg-white shadow-sm shadow-slate-200/60">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="bg-slate-50 text-xs text-slate-500">
          <tr>
            {head.map((h, i) => (
              <th key={i} className="whitespace-nowrap px-4 py-3 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">{children}</tbody>
      </table>
    </div>
  );
}

export function Td({ children, className, colSpan }: { children?: React.ReactNode; className?: string; colSpan?: number }) {
  return (
    <td colSpan={colSpan} className={cn("px-4 py-3 align-middle", className || "text-slate-700")}>
      {children}
    </td>
  );
}

export function Loading() {
  return <div className="py-20 text-center text-sm text-slate-400">載入中…</div>;
}

export function NotFound({ back }: { back: string }) {
  return (
    <div className="py-20 text-center">
      <p className="text-slate-500">找不到這筆資料</p>
      <Link href={back} className="mt-3 inline-block text-sm text-brand-700 hover:underline">
        ← 返回列表
      </Link>
    </div>
  );
}

export function DemoNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
      <span className="font-semibold">展示模式：</span>
      {children}
    </p>
  );
}

/** 分頁：« 上一頁　第 3 / 120 頁（共 2,380 筆）　下一頁 » */
export function Pagination({
  page,
  limit,
  total,
  onChange,
}: {
  page: number;
  limit: number;
  total: number;
  onChange: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / limit));
  if (total <= limit) return null;
  return (
    <div className="mt-4 flex flex-wrap items-center justify-center gap-3 text-sm text-slate-600">
      <Button variant="secondary" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        <ChevronLeft size={16} /> 上一頁
      </Button>
      <span>
        第 {page} / {pages} 頁（共 {total.toLocaleString()} 筆）
      </span>
      <Button variant="secondary" disabled={page >= pages} onClick={() => onChange(page + 1)}>
        下一頁 <ChevronRight size={16} />
      </Button>
    </div>
  );
}

/** 輸入停下來一段時間才更新（搜尋框用，避免每打一個字就查一次） */
export function useDebounced<T>(value: T, ms = 350) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/** 載入中的區塊 */
export function Spinner({ text = "載入中…" }: { text?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-400">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
      {text}
    </div>
  );
}
