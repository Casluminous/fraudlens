import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";

type Variant = "success" | "error" | "info";

interface ToastItem {
  id: number;
  message: string;
  title?: string;
  variant: Variant;
}

interface ToastApi {
  push: (message: string, variant?: Variant, title?: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const styles: Record<Variant, string> = {
  success: "border-mint-400/30 bg-mint-500/[0.08] text-mint-200",
  error: "border-coral-400/30 bg-coral-500/[0.08] text-coral-400",
  info: "border-azure-400/30 bg-azure-500/[0.08] text-azure-400",
};

const icons: Record<Variant, typeof Info> = {
  success: CheckCircle2,
  error: AlertTriangle,
  info: Info,
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const counter = useRef(0);

  const push = useCallback((message: string, variant: Variant = "info", title?: string) => {
    const id = ++counter.current;
    setItems((prev) => [...prev.slice(-3), { id, message, variant, title }]);
    window.setTimeout(() => {
      setItems((prev) => prev.filter((item) => item.id !== id));
    }, 4600);
  }, []);

  const value = useMemo(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-5 right-5 z-[100] flex w-[360px] max-w-[calc(100vw-40px)] flex-col gap-2">
        {items.map((item) => {
          const Icon = icons[item.variant];
          return (
            <div
              key={item.id}
              className={`pointer-events-auto flex animate-fade-up items-start gap-3 rounded-xl border px-4 py-3 shadow-panel backdrop-blur-xl ${styles[item.variant]}`}
            >
              <Icon size={16} className="mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                {item.title && <p className="text-[12px] font-semibold text-white">{item.title}</p>}
                <p className="text-[11.5px] leading-relaxed text-slate-300">{item.message}</p>
              </div>
              <button
                className="text-slate-500 transition hover:text-white"
                onClick={() => setItems((prev) => prev.filter((entry) => entry.id !== item.id))}
                aria-label="Đóng"
              >
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast phải nằm trong ToastProvider");
  return context;
}
