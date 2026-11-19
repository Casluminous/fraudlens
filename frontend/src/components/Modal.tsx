import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import clsx from "clsx";

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open) return null;

  const widths = { sm: "max-w-md", md: "max-w-xl", lg: "max-w-3xl", xl: "max-w-5xl" }[size];

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto p-4 pt-[7vh] sm:p-6 sm:pt-[9vh]">
      <div className="fixed inset-0 animate-fade-in bg-ink-950/80 backdrop-blur-sm" onClick={onClose} />
      <div
        className={clsx(
          "relative w-full animate-fade-up rounded-2xl border border-white/10 bg-ink-900 shadow-panel",
          widths,
        )}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="flex items-start justify-between gap-4 border-b border-white/[0.07] px-6 py-5">
          <div>
            <h2 className="text-[16px] font-semibold text-white">{title}</h2>
            {description && <p className="mt-1 max-w-lg text-[12px] leading-relaxed text-slate-400">{description}</p>}
          </div>
          <button className="icon-btn -mr-1 -mt-1" onClick={onClose} aria-label="Đóng">
            <X size={16} />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-2 border-t border-white/[0.07] px-6 py-4">{footer}</div>
        )}
      </div>
    </div>,
    document.body,
  );
}
