import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
        <h1 className="text-[22px] font-semibold tracking-tight text-white sm:text-[25px]">{title}</h1>
        {subtitle && <p className="mt-1.5 max-w-2xl text-[12.5px] leading-relaxed text-slate-400">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  accent = "mint",
  trend,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon: LucideIcon;
  accent?: "mint" | "amber" | "coral" | "azure";
  trend?: { value: number; label?: string };
}) {
  const accents = {
    mint: "border-mint-400/15 bg-mint-500/[0.07] text-mint-300",
    amber: "border-amber-400/15 bg-amber-500/[0.07] text-amber-400",
    coral: "border-coral-400/15 bg-coral-500/[0.07] text-coral-400",
    azure: "border-azure-400/15 bg-azure-500/[0.07] text-azure-400",
  }[accent];

  return (
    <div className="panel panel-hover relative overflow-hidden p-5">
      <div className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-white/[0.02] blur-2xl" />
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11.5px] font-medium text-slate-400">{label}</p>
        <span className={`flex h-8 w-8 items-center justify-center rounded-lg border ${accents}`}>
          <Icon size={14} />
        </span>
      </div>
      <p className="kpi-value mt-3">{value}</p>
      <div className="mt-2 flex items-center gap-2 text-[10.5px] text-slate-500">
        {trend && (
          <span
            className={
              trend.value >= 0
                ? "rounded border border-mint-400/20 bg-mint-500/10 px-1.5 py-0.5 font-mono text-mint-300"
                : "rounded border border-coral-400/20 bg-coral-500/10 px-1.5 py-0.5 font-mono text-coral-400"
            }
          >
            {trend.value >= 0 ? "+" : ""}
            {trend.value.toFixed(1).replace(".", ",")}%
          </span>
        )}
        {hint}
      </div>
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] text-slate-500">
        <Icon size={20} />
      </div>
      <p className="text-[14px] font-medium text-slate-200">{title}</p>
      {description && <p className="mt-1.5 max-w-sm text-[12px] leading-relaxed text-slate-500">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl border border-coral-400/20 bg-coral-500/10 text-coral-400">
        <AlertTriangle size={18} />
      </div>
      <p className="text-[13px] font-medium text-slate-200">Không tải được dữ liệu</p>
      <p className="mt-1 max-w-md text-[11.5px] text-slate-500">{message || "Kiểm tra kết nối API rồi thử lại."}</p>
      {onRetry && (
        <button className="btn-ghost btn-sm mt-4" onClick={onRetry}>
          <RefreshCw size={13} /> Thử lại
        </button>
      )}
    </div>
  );
}

export function SkeletonRows({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="flex items-center gap-4">
          <div className="skeleton h-8 w-8 rounded-full" />
          <div className="skeleton h-3 flex-1" />
          <div className="skeleton h-3 w-24" />
          <div className="skeleton h-6 w-16" />
        </div>
      ))}
    </div>
  );
}
