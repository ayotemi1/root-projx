import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

import * as api from "@/lib/api";
import type { ApiUser } from "@/lib/api";

const TOKEN_KEY = "@rootprojx/token";

interface AuthContextValue {
  user: ApiUser | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: {
    name: string;
    email: string;
    phone?: string;
    password: string;
    accountType: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<ApiUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // On mount — restore persisted token
  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(TOKEN_KEY);
        if (saved) {
          const me = await api.getMe(saved);
          setToken(saved);
          setUser(me);
        }
      } catch {
        await AsyncStorage.removeItem(TOKEN_KEY);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.login(email, password);
    await AsyncStorage.setItem(TOKEN_KEY, res.token);
    setToken(res.token);
    setUser(res.user);
  }, []);

  const register = useCallback(
    async (data: {
      name: string;
      email: string;
      phone?: string;
      password: string;
      accountType: string;
    }) => {
      const res = await api.register(data);
      await AsyncStorage.setItem(TOKEN_KEY, res.token);
      setToken(res.token);
      setUser(res.user);
    },
    [],
  );

  const logout = useCallback(async () => {
    if (token) {
      try {
        await api.logout(token);
      } catch {
        // ignore
      }
    }
    await AsyncStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  }, [token]);

  const refreshUser = useCallback(async () => {
    if (!token) return;
    try {
      const me = await api.getMe(token);
      setUser(me);
    } catch {
      // token expired
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
