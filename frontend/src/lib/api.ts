import type { LoginResult, User } from "./types";

const API_BASE = "/api";

let accessToken: string | null = null;
let refreshPromise: Promise<LoginResult | null> | null = null;

export class ApiError extends Error {
  status: number;
  detail: unknown;

  constructor(status: number, detail: unknown) {
    super(typeof detail === "string" ? detail : "Đã có lỗi xảy ra");
    this.status = status;
    this.detail = detail;
  }
}

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

function notifyUnauthorized() {
  window.dispatchEvent(new CustomEvent("fraudlens:unauthorized"));
}

async function parseError(response: Response): Promise<never> {
  let detail: unknown = "Đã có lỗi xảy ra";
  try {
    const payload = await response.json();
    if (payload?.detail) {
      detail = payload.detail;
      if (Array.isArray(detail)) {
        detail = detail
          .map((item) => (typeof item === "object" && item && "msg" in item ? String(item.msg) : String(item)))
          .join("; ");
      }
    }
  } catch {
    // ignore non-json error bodies
  }
  throw new ApiError(response.status, detail);
}

export async function api<T>(path: string, init: RequestInit = {}, allowRetry = true): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);

  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
    credentials: "include",
  });

  if (response.status === 401 && allowRetry && !path.startsWith("/auth/login")) {
    const refreshed = await refreshSession();
    if (refreshed) return api<T>(path, init, false);
    notifyUnauthorized();
  }

  if (!response.ok) return parseError(response);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export async function refreshSession(): Promise<LoginResult | null> {
  if (!refreshPromise) {
    refreshPromise = fetch(`${API_BASE}/auth/refresh`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    })
      .then(async (response) => {
        if (!response.ok) return null;
        const data = (await response.json()) as LoginResult;
        setAccessToken(data.access_token);
        return data;
      })
      .catch(() => null)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

export async function login(email: string, password: string): Promise<LoginResult> {
  const result = await api<LoginResult>(
    "/auth/login",
    { method: "POST", body: JSON.stringify({ email, password }) },
    false,
  );
  setAccessToken(result.access_token);
  return result;
}

export async function logout(): Promise<void> {
  try {
    await api("/auth/logout", { method: "POST" });
  } finally {
    setAccessToken(null);
  }
}

export async function currentUser(): Promise<User> {
  return api<User>("/auth/me");
}
