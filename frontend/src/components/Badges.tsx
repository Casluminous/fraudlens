import clsx from "clsx";
import { DECISION_LABELS, PRIORITY_STYLES, RISK_BANDS, ROLE_LABELS, STATUS_LABELS } from "@/lib/format";
import type { Role } from "@/lib/types";

export function RiskBadge({ band, score, className }: { band: string; score?: number; className?: string }) {
  const config = RISK_BANDS[band] ?? RISK_BANDS.low;
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10.5px] font-medium",
        config.text,
        config.bg,
        config.border,
        className,
      )}
    >
      <span className={clsx("h-1.5 w-1.5 rounded-full", config.dot)} />
      {config.label}
      {typeof score === "number" && <span className="font-mono opacity-80">{score.toFixed(0)}</span>}
    </span>
  );
}

export function PriorityBadge({ priority, className }: { priority: string; className?: string }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-md border px-1.5 py-0.5 font-mono text-[10px] font-medium",
        PRIORITY_STYLES[priority] ?? PRIORITY_STYLES.P3,
        className,
      )}
    >
      {priority}
    </span>
  );
}

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const styles: Record<string, string> = {
    open: "border-azure-400/25 bg-azure-500/10 text-azure-400",
    in_review: "border-amber-400/25 bg-amber-500/10 text-amber-400",
    awaiting_info: "border-violet-400/25 bg-violet-500/10 text-violet-300",
    resolved: "border-white/10 bg-white/[0.04] text-slate-400",
  };
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-[10.5px] font-medium",
        styles[status] ?? styles.open,
        className,
      )}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

export function DecisionBadge({ decision, className }: { decision: string | null; className?: string }) {
  if (!decision) {
    return (
      <span className={clsx("inline-flex rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[10.5px] text-slate-500", className)}>
        Chưa kết luận
      </span>
    );
  }
  const styles: Record<string, string> = {
    confirmed_fraud: "border-coral-400/25 bg-coral-500/10 text-coral-400",
    false_positive: "border-mint-400/25 bg-mint-500/10 text-mint-300",
    escalated: "border-amber-400/25 bg-amber-500/10 text-amber-400",
  };
  return (
    <span
      className={clsx(
        "inline-flex rounded-full border px-2.5 py-1 text-[10.5px] font-medium",
        styles[decision] ?? "border-white/10 text-slate-300",
        className,
      )}
    >
      {DECISION_LABELS[decision] ?? decision}
    </span>
  );
}

export function RoleBadge({ role }: { role: Role }) {
  const styles: Record<Role, string> = {
    admin: "border-mint-400/25 bg-mint-500/10 text-mint-300",
    analyst: "border-azure-400/25 bg-azure-500/10 text-azure-400",
    viewer: "border-white/10 bg-white/[0.04] text-slate-400",
  };
  return (
    <span className={clsx("inline-flex rounded-md border px-2 py-0.5 text-[10px] font-medium", styles[role])}>
      {ROLE_LABELS[role]}
    </span>
  );
}
