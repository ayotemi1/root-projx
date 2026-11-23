import { clearMediaSession } from "@/lib/supporter-publishing";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import * as api from "@/lib/api";
import type { ApiUser } from "@/lib/api";

const TOKEN_KEY = "rootprojx_token";

interface AuthContextValue {
  user: ApiUser | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<ApiUser>;
  register: (data: {
    name: string;
    email: string;
    phone?: string;
    password: string;
    accountType: string;
    orgName?: string;
    country?: string;
    registrationNumber?: string;
  }) => Promise<string>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);
export const OrganisationAccessProvider = AuthContext.Provider;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<ApiUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  /** Token of the signed-in subject, updated synchronously; stale async responses compare against it. */
  const activeToken = useRef<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem(TOKEN_KEY);
    if (!saved) { setIsLoading(false); return; }
    api.getMe(saved)
      .then((me) => {
        if (activeToken.current !== null || localStorage.getItem(TOKEN_KEY) !== saved) return;
        activeToken.current = saved; setToken(saved); setUser(me);
      })
      .catch(() => {
        if (activeToken.current === null && localStorage.getItem(TOKEN_KEY) === saved) localStorage.removeItem(TOKEN_KEY);
      })
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.login(email, password);
    localStorage.setItem(TOKEN_KEY, res.token);
    activeToken.current = res.token;
    setToken(res.token);
    setUser(res.user);
    return res.user;
  }, []);

  const register = useCallback(
    async (data: {
      name: string;
      email: string;
      phone?: string;
      password: string;
      accountType: string;
      orgName?: string;
      country?: string;
      registrationNumber?: string;
    }) => {
      const res = await api.register(data);
      localStorage.setItem(TOKEN_KEY, res.token);
      activeToken.current = res.token;
      setToken(res.token);
      setUser(res.user);
      return res.token;
    },
    [],
  );

  const logout = useCallback(async () => {
    if (activeToken.current === token) activeToken.current = null;
    clearMediaSession(token);
    if (token) {
      try { await api.logout(token); } catch { /* ignore */ }
    }
    // A newer login during the logout request must not be signed out.
    if (activeToken.current !== null && activeToken.current !== token) return;
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  }, [token]);

  const refreshUser = useCallback(async () => {
    if (!token) return;
    try {
      const me = await api.getMe(token);
      if (activeToken.current !== token) return; // stale: subject changed
      setUser(me);
    } catch {
      if (activeToken.current !== token) return;
      await logout();
    }
  }, [token, logout]);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAuthenticated: !!token && !!user,
        login,
        register,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
