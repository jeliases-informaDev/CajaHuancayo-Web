import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { ApiError, clearToken, getToken, request, setToken } from "./api";

type User = { id: string; username: string; rol: string; nombres?: string; apellidos?: string };
type AuthValue = {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<any>;
  verifyMfa: (challengeToken: string, code: string, enroll?: boolean) => Promise<void>;
  logout: () => Promise<void>;
};

const Context = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const ensureAdmin = (account: any) => {
    if (account?.rol !== "ADMINISTRADOR") {
      throw new Error("Este panel es exclusivo para administradores.");
    }
  };

  useEffect(() => {
    (async () => {
      const token = getToken();
      if (!token) { setLoading(false); return; }
      try {
        const data: any = await request("/api/auth/me");
        ensureAdmin(data.user);
        setUser(data.user);
      } catch {
        clearToken();
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const value = useMemo<AuthValue>(() => ({
    user, loading,
    login: async (username, password) => {
      const data: any = await request("/api/auth/login", { method: "POST", body: JSON.stringify({ username, password }) });
      if (!data.mfaRequired && !data.mfaEnrollmentRequired) {
        ensureAdmin(data.user);
        setToken(data.token);
        setUser(data.user);
      }
      return data;
    },
    verifyMfa: async (challengeToken, code, enroll = false) => {
      const data: any = await request(
        enroll ? "/api/auth/mfa/enroll/confirm" : "/api/auth/mfa/verify",
        { method: "POST", body: JSON.stringify({ challengeToken, code }) },
      );
      ensureAdmin(data.user);
      setToken(data.token);
      setUser(data.user);
    },
    logout: async () => {
      try { await request("/api/auth/logout", { method: "POST" }); } catch (e) { if (!(e instanceof ApiError)) {/* ignore network errors on logout */} }
      clearToken();
      setUser(null);
    },
  }), [user, loading]);

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export const useAuth = () => {
  const context = useContext(Context);
  if (!context) throw new Error("AuthProvider requerido");
  return context;
};
