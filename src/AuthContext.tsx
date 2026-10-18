import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { ApiError, clearToken, getEmpresaElegida, getToken, request, setEmpresaElegida, setToken } from "./api";
import { aplicarColorMarca } from "./marca";

type User = { id: string; username: string; rol: string; nombres?: string; apellidos?: string; empresa_id?: string | null };
// La empresa de la cuenta (o la elegida por el administrador universal): nombre, marca y reglas que ve el panel.
export type Empresa = { id: string; nombre: string; nombre_corto: string; slug: string; prefijo?: string | null; marca: { nombre?: string; producto?: string; color?: string; logo_url?: string }; reglas: { geocerca_radio_m: number; precision_maxima_m: number; formatos_importacion?: string[] } };
type AuthValue = {
  user: User | null;
  empresa: Empresa | null;
  empresaElegida: string | null;
  elegirEmpresa: (id: string | null) => void;
  loading: boolean;
  login: (username: string, password: string) => Promise<any>;
  loginSso: (code: string, codeVerifier: string, redirectUri: string) => Promise<void>;
  verifyMfa: (challengeToken: string, code: string, enroll?: boolean) => Promise<void>;
  logout: () => Promise<void>;
};

const Context = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [empresaElegida, setEmpresaElegidaEstado] = useState<string | null>(() => getEmpresaElegida());
  const [loading, setLoading] = useState(true);

  // El panel web es para Administrador (control total) y Supervisor/Auditor de Agencia
  // (mapa en vivo, banco de clientes, evidencias y fichas). El Auditor de Campo opera
  // exclusivamente desde la app móvil (el backend ya rechaza su login aquí).
  const ensureAccesoWeb = (account: any) => {
    if (account?.rol !== "ADMINISTRADOR" && account?.rol !== "SUPERVISOR" && account?.rol !== "UNIVERSAL") {
      throw new Error("Este panel es para administradores y supervisores.");
    }
  };

  useEffect(() => {
    (async () => {
      const token = getToken();
      if (!token) { setLoading(false); return; }
      try {
        const data: any = await request("/api/auth/me");
        ensureAccesoWeb(data.user);
        setUser(data.user);
        setEmpresa(data.empresa || null);
      } catch {
        clearToken();
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // El color de la marca de la empresa tiñe el panel (y se recalcula si cambia el tema claro/oscuro).
  useEffect(() => {
    const aplicar = () => aplicarColorMarca(empresa?.marca?.color);
    aplicar();
    const observador = new MutationObserver(aplicar);
    observador.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observador.disconnect();
  }, [empresa]);

  // Al entrar o cambiar de empresa se vuelve a pedir la sesión: trae la empresa (nombre, marca, reglas) que corresponde.
  const refrescarEmpresa = async () => {
    try { const data: any = await request("/api/auth/me"); setEmpresa(data.empresa || null); } catch { setEmpresa(null); }
  };
  const elegirEmpresa = (id: string | null) => { setEmpresaElegida(id); setEmpresaElegidaEstado(id); refrescarEmpresa(); };

  const value = useMemo<AuthValue>(() => ({
    user, empresa, empresaElegida, elegirEmpresa, loading,
    login: async (username, password) => {
      const data: any = await request("/api/auth/login", { method: "POST", body: JSON.stringify({ username, password }) });
      if (!data.mfaRequired && !data.mfaEnrollmentRequired) {
        ensureAccesoWeb(data.user);
        setToken(data.token);
        setUser(data.user);
        if (data.user?.rol !== "UNIVERSAL") setEmpresaElegida(null); // una cuenta de empresa nunca elige empresa
        await refrescarEmpresa();
      }
      return data;
    },
    // Con la cuenta Sulotec: Keycloak ya verificó a la persona (y su segundo factor); la API devuelve la sesión del panel.
    loginSso: async (code, codeVerifier, redirectUri) => {
      const data: any = await request("/api/auth/sso", { method: "POST", body: JSON.stringify({ code, codeVerifier, redirectUri }) });
      ensureAccesoWeb(data.user);
      setToken(data.token);
      setUser(data.user);
      if (data.user?.rol !== "UNIVERSAL") setEmpresaElegida(null);
      await refrescarEmpresa();
    },
    verifyMfa: async (challengeToken, code, enroll = false) => {
      const data: any = await request(
        enroll ? "/api/auth/mfa/enroll/confirm" : "/api/auth/mfa/verify",
        { method: "POST", body: JSON.stringify({ challengeToken, code }) },
      );
      ensureAccesoWeb(data.user);
      setToken(data.token);
      setUser(data.user);
      if (data.user?.rol !== "UNIVERSAL") setEmpresaElegida(null);
      await refrescarEmpresa();
    },
    logout: async () => {
      try { await request("/api/auth/logout", { method: "POST" }); } catch (e) { if (!(e instanceof ApiError)) {/* ignore network errors on logout */} }
      clearToken();
      setUser(null);
      setEmpresa(null);
    },
  }), [user, empresa, empresaElegida, loading]);

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export const useAuth = () => {
  const context = useContext(Context);
  if (!context) throw new Error("AuthProvider requerido");
  return context;
};
