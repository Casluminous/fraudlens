import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { currentUser, login as loginRequest, logout as logoutRequest, refreshSession, setAccessToken } from "./api";
import type { LoginResult, Role, User } from "./types";

interface AuthState {
  user: User | null;
  booting: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  canEdit: boolean;
  isAdmin: boolean;
  hasRole: (...roles: Role[]) => boolean;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await refreshSession();
        if (!result) return;
        const me = await currentUser().catch(() => result.user);
        if (!cancelled) setUser(me);
      } finally {
        if (!cancelled) setBooting(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const handler = () => {
      setAccessToken(null);
      setUser(null);
    };
    window.addEventListener("fraudlens:unauthorized", handler);
    return () => window.removeEventListener("fraudlens:unauthorized", handler);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result: LoginResult = await loginRequest(email, password);
    setUser(result.user);
    return result.user;
  }, []);

  const logout = useCallback(async () => {
    await logoutRequest();
    setUser(null);
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      booting,
      login,
      logout,
      canEdit: user?.role === "admin" || user?.role === "analyst",
      isAdmin: user?.role === "admin",
      hasRole: (...roles: Role[]) => (user ? roles.includes(user.role) : false),
    }),
    [user, booting, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth phải nằm trong AuthProvider");
  return context;
}
