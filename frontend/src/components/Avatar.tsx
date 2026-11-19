import clsx from "clsx";
import { initials } from "@/lib/format";

const COLORS = [
  "from-mint-500/30 to-azure-500/20 text-mint-200",
  "from-azure-500/30 to-violet-500/20 text-azure-400",
  "from-amber-500/30 to-coral-500/20 text-amber-400",
  "from-coral-500/30 to-fuchsia-500/20 text-coral-400",
  "from-emerald-500/30 to-teal-500/20 text-emerald-300",
];

function colorFor(name: string) {
  let hash = 0;
  for (let index = 0; index < name.length; index += 1) {
    hash = name.charCodeAt(index) + ((hash << 5) - hash);
  }
  return COLORS[Math.abs(hash) % COLORS.length];
}

export function Avatar({
  name,
  size = "md",
  className,
}: {
  name: string;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}) {
  const dimensions = {
    xs: "h-[22px] w-[22px] text-[8px]",
    sm: "h-7 w-7 text-[9px]",
    md: "h-[34px] w-[34px] text-[10px]",
    lg: "h-11 w-11 text-[13px]",
  }[size];

  return (
    <span
      className={clsx(
        "inline-flex shrink-0 items-center justify-center rounded-full border border-white/10 bg-gradient-to-br font-semibold tracking-wide",
        colorFor(name),
        dimensions,
        className,
      )}
      title={name}
    >
      {initials(name)}
    </span>
  );
}
