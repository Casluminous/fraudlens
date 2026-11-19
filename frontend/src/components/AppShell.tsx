import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeftRight,
  Bell,
  ChevronDown,
  LayoutDashboard,
  LogOut,
  Menu,
  ScrollText,
  Search,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import clsx from "clsx";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { roleLabel } from "@/lib/format";
import type { CaseStats } from "@/lib/types";
import { Avatar } from "./Avatar";
import { Brand } from "./Logo";
import { SimulateDialog } from "./SimulateDialog";

const PAGE_META: Record<string, { title: string; parent: string }> = {
  "/": { title: "Tổng quan", parent: "FraudLens" },
  "/queue": { title: "Hàng chờ điều tra", parent: "Vận hành" },
  "/transactions": { title: "Giao dịch", parent: "Vận hành" },
  "/cases": { title: "Chi tiết case", parent: "Vận hành" },
  "/rules": { title: "Rule engine", parent: "Quản trị" },
  "/users": { title: "Người dùng", parent: "Quản trị" },
  "/audit": { title: "Audit trail", parent: "Quản trị" },
  "/settings": { title: "Cấu hình", parent: "Quản trị" },
};

function usePageMeta() {
  const location = useLocation();
  if (location.pathname.startsWith("/cases/")) return { title: "Chi tiết case", parent: "Vận hành" };
  return PAGE_META[location.pathname] ?? { title: "FraudLens", parent: "FraudLens" };
}

function Sidebar({
  open,
  onClose,
  openCases,
}: {
  open: boolean;
  onClose: () => void;
  openCases: number;
}) {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();

  const groups = [
    {
      label: "Tổng quan",
      items: [{ to: "/", label: "Bảng điều khiển", icon: LayoutDashboard, end: true }],
    },
    {
      label: "Điều tra",
      items: [
        { to: "/queue", label: "Hàng chờ", icon: ShieldCheck, badge: openCases },
        { to: "/transactions", label: "Giao dịch", icon: ArrowLeftRight },
      ],
    },
    {
      label: "Quản trị",
      items: [
        { to: "/rules", label: "Rule engine", icon: SlidersHorizontal, adminOnly: true },
        { to: "/users", label: "Người dùng", icon: Users, adminOnly: true },
        { to: "/audit", label: "Audit trail", icon: ScrollText, adminOnly: true },
        { to: "/settings", label: "Cấu hình", icon: Settings2, adminOnly: false },
      ],
    },
  ];

  return (
    <>
      {open && <div className="fixed inset-0 z-40 bg-ink-950/70 backdrop-blur-sm lg:hidden" onClick={onClose} />}
      <aside
        className={clsx(
          "fixed inset-y-0 left-0 z-50 flex w-[252px] flex-col border-r border-white/[0.06] bg-ink-950/95 transition-transform duration-300 lg:translate-x-0 lg:bg-ink-950/50 lg:backdrop-blur-xl",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between px-5 pb-5 pt-6">
          <Link to="/" onClick={onClose}>
            <Brand />
          </Link>
          <button className="icon-btn lg:hidden" onClick={onClose} aria-label="Đóng menu">
            <X size={16} />
          </button>
        </div>

        <nav className="flex-1 space-y-6 overflow-y-auto px-3 pb-4">
          {groups.map((group) => {
            const items = group.items.filter((item) => !("adminOnly" in item && item.adminOnly) || isAdmin);
            if (!items.length) return null;
            return (
              <div key={group.label}>
                <p className="mb-2 px-3 text-[9.5px] font-semibold uppercase tracking-[0.2em] text-slate-600">
                  {group.label}
                </p>
                <div className="space-y-0.5">
                  {items.map((item) => {
                    const Icon = item.icon;
                    return (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        end={"end" in item ? item.end : false}
                        onClick={onClose}
                        className={({ isActive }) =>
                          clsx("sidebar-item", isActive && "sidebar-item-active")
                        }
                      >
                        <Icon size={15} className="shrink-0 opacity-80" />
                        <span className="flex-1">{item.label}</span>
                        {"badge" in item && item.badge ? (
                          <span className="rounded-md border border-coral-400/25 bg-coral-500/10 px-1.5 py-0.5 font-mono text-[9.5px] text-coral-400">
                            {item.badge > 99 ? "99+" : item.badge}
                          </span>
                        ) : null}
                      </NavLink>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        <div className="mx-3 mb-3 rounded-xl border border-mint-400/15 bg-mint-500/[0.045] p-3.5">
          <div className="flex items-center gap-2 text-mint-300">
            <ShieldCheck size={14} />
            <p className="text-[11px] font-semibold">Human-in-the-loop</p>
          </div>
          <p className="mt-1.5 text-[10.5px] leading-relaxed text-slate-500">
            Hệ thống chỉ đề xuất. Mọi kết luận gian lận phải do analyst xác nhận và được ghi vào audit trail.
          </p>
        </div>

        <div className="border-t border-white/[0.06] p-3">
          <button
            className="flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left transition hover:bg-white/[0.04]"
            onClick={() => navigate("/settings")}
          >
            <Avatar name={user?.full_name ?? "?"} size="md" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12px] font-medium text-slate-200">{user?.full_name}</span>
              <span className="block truncate text-[10px] text-slate-500">{roleLabel(user?.role ?? "viewer")}</span>
            </span>
            <ChevronDown size={13} className="text-slate-600" />
          </button>
        </div>
      </aside>
    </>
  );
}

function Topbar({
  onMenu,
  onSimulate,
  openCases,
}: {
  onMenu: () => void;
  onSimulate: () => void;
  openCases: number;
}) {
  const meta = usePageMeta();
  const { user, logout, canEdit, isAdmin } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "/" && document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault();
    if (!query.trim()) return;
    navigate(`/transactions?q=${encodeURIComponent(query.trim())}`);
    setQuery("");
  };

  return (
    <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-ink-950/75 backdrop-blur-xl">
      <div className="mx-auto flex h-[62px] max-w-[1560px] items-center gap-3 px-4 sm:px-6 lg:px-8">
        <button className="icon-btn lg:hidden" onClick={onMenu} aria-label="Mở menu">
          <Menu size={18} />
        </button>

        <div className="hidden min-w-[150px] sm:block">
          <p className="text-[9px] font-medium uppercase tracking-[0.18em] text-slate-600">{meta.parent}</p>
          <p className="text-[12.5px] font-medium text-slate-200">{meta.title}</p>
        </div>

        <form onSubmit={submitSearch} className="relative ml-auto hidden w-full max-w-[330px] md:block">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            ref={searchRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Tìm giao dịch, khách hàng, merchant…"
            className="w-full rounded-xl border border-white/[0.07] bg-white/[0.025] py-2 pl-9 pr-12 text-[11.5px] text-slate-200 outline-none transition placeholder:text-slate-600 focus:border-mint-400/40 focus:bg-white/[0.04]"
          />
          <kbd className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 font-mono text-[9px] text-slate-500">
            /
          </kbd>
        </form>

        <div className="ml-auto flex items-center gap-1.5 md:ml-0">
          {canEdit && (
            <button className="btn-primary btn-sm" onClick={onSimulate}>
              <Sparkles size={13} />
              <span className="hidden sm:inline">Mô phỏng</span>
            </button>
          )}
          <Link to="/queue" className="icon-btn relative" aria-label="Hàng chờ">
            <Bell size={16} />
            {openCases > 0 && (
              <span className="absolute right-1 top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full border border-ink-950 bg-coral-500 px-0.5 font-mono text-[8px] font-bold text-white">
                {openCases > 9 ? "9+" : openCases}
              </span>
            )}
          </Link>

          <div className="relative">
            <button
              className="flex items-center gap-2 rounded-xl py-1 pl-1 pr-1.5 transition hover:bg-white/[0.04]"
              onClick={() => setMenuOpen((value) => !value)}
              aria-label="Tài khoản"
            >
              <Avatar name={user?.full_name ?? "?"} size="sm" />
              <ChevronDown size={12} className="hidden text-slate-500 sm:block" />
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-[46px] z-20 w-60 animate-fade-up rounded-xl border border-white/10 bg-ink-900 p-1.5 shadow-panel">
                  <div className="px-3 py-2.5">
                    <p className="truncate text-[12px] font-medium text-white">{user?.full_name}</p>
                    <p className="truncate text-[10.5px] text-slate-500">{user?.email}</p>
                    <p className="mt-2 inline-flex rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[9.5px] text-slate-400">
                      {roleLabel(user?.role ?? "viewer")}
                    </p>
                  </div>
                  <div className="my-1 h-px bg-white/[0.06]" />
                  <Link
                    to="/settings"
                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-[11.5px] text-slate-300 transition hover:bg-white/[0.05] hover:text-white"
                    onClick={() => setMenuOpen(false)}
                  >
                    <Settings2 size={13} /> Cấu hình & model
                  </Link>
                  {isAdmin && (
                    <Link
                      to="/users"
                      className="flex items-center gap-2 rounded-lg px-3 py-2 text-[11.5px] text-slate-300 transition hover:bg-white/[0.05] hover:text-white"
                      onClick={() => setMenuOpen(false)}
                    >
                      <Users size={13} /> Quản lý người dùng
                    </Link>
                  )}
                  <button
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[11.5px] text-coral-400 transition hover:bg-coral-500/10"
                    onClick={async () => {
                      await logout();
                      navigate("/login");
                    }}
                  >
                    <LogOut size={13} /> Đăng xuất
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

export function AppShell() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [simulateOpen, setSimulateOpen] = useState(false);
  const { user } = useAuth();

  const stats = useQuery({
    queryKey: ["case-stats"],
    queryFn: () => api<CaseStats>("/cases/stats"),
    enabled: Boolean(user),
    refetchInterval: 60_000,
  });

  const openCases =
    (stats.data?.by_status.open ?? 0) + (stats.data?.by_status.in_review ?? 0) + (stats.data?.by_status.awaiting_info ?? 0);

  return (
    <div className="min-h-screen">
      <Sidebar open={mobileOpen} onClose={() => setMobileOpen(false)} openCases={openCases} />
      <div className="lg:pl-[252px]">
        <Topbar onMenu={() => setMobileOpen(true)} onSimulate={() => setSimulateOpen(true)} openCases={openCases} />
        <main className="mx-auto w-full max-w-[1560px] px-4 pb-16 pt-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
      <SimulateDialog open={simulateOpen} onClose={() => setSimulateOpen(false)} />
    </div>
  );
}
