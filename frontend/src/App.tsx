import type { ReactNode } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { LogoMark } from "@/components/Logo";
import { LoginPage } from "@/pages/Login";
import { DashboardPage } from "@/pages/Dashboard";
import { QueuePage } from "@/pages/Queue";
import { CaseDetailPage } from "@/pages/CaseDetail";
import { TransactionsPage } from "@/pages/Transactions";
import { RulesPage } from "@/pages/Rules";
import { UsersPage } from "@/pages/Users";
import { AuditPage } from "@/pages/Audit";
import { SettingsPage } from "@/pages/Settings";
import { ForbiddenPage, NotFoundPage } from "@/pages/NotFound";

function BootSplash() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <div className="animate-pulse-soft">
        <LogoMark size={42} />
      </div>
      <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-slate-600">Đang kiểm tra phiên…</p>
    </div>
  );
}

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, booting } = useAuth();
  const location = useLocation();
  if (booting) return <BootSplash />;
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  return <>{children}</>;
}

function RequireAdmin({ children }: { children: ReactNode }) {
  const { isAdmin } = useAuth();
  if (!isAdmin) return <ForbiddenPage />;
  return <>{children}</>;
}

export default function App() {
  const { user, booting } = useAuth();

  return (
    <Routes>
      <Route
        path="/login"
        element={booting ? <BootSplash /> : user ? <Navigate to="/" replace /> : <LoginPage />}
      />
      <Route
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="queue" element={<QueuePage />} />
        <Route path="transactions" element={<TransactionsPage />} />
        <Route path="cases/:id" element={<CaseDetailPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route
          path="rules"
          element={
            <RequireAdmin>
              <RulesPage />
            </RequireAdmin>
          }
        />
        <Route
          path="users"
          element={
            <RequireAdmin>
              <UsersPage />
            </RequireAdmin>
          }
        />
        <Route
          path="audit"
          element={
            <RequireAdmin>
              <AuditPage />
            </RequireAdmin>
          }
        />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
