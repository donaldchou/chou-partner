"use client";

import Link from "next/link";
import { useEffect } from "react";
import { ArrowLeft, X } from "lucide-react";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  subtitle,
  back,
  actions,
}: {
  title: string;
  subtitle?: string;
  back?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        {back && (
          <Link href={back} className="mb-1 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-brand-700">
            <ArrowLeft size={15} /> 返回
          </Link>
        )}
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-200/60", className)}>{children}</div>
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

type Variant = "primary" | "secondary" | "danger" | "ghost";
const variants: Record<Variant, string> = {
  primary: "bg-brand-600 text-white shadow-sm hover:bg-brand-700 disabled:bg-brand-300",
  secondary: "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:text-slate-400",
  danger: "border border-red-200 bg-white text-red-600 hover:bg-red-50",
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

const inputCls =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20";

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(inputCls, props.className)} />;
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={3} {...props} className={cn(inputCls, props.className)} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cn(inputCls, props.className)} />;
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
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  wide?: boolean;
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
