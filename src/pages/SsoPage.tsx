import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext";
import { request } from "../api";
import { Marca } from "../components/icons";

// Entrada con la cuenta Sulotec (cuenta.sulotec.com, OpenID Connect con PKCE). Sin «code» en la dirección arma el reto PKCE y manda a
// Keycloak; con «code» lo canjea en la API por la sesión del panel. Quien ya tenía sesión en sulotec.com no escribe nada: el botón de
// «Mis productos» la trae aquí y entra directo, con su empresa y su rol de siempre.
const CLAVE = "ch_sso_pkce";
const VIGENCIA_MS = 10 * 60_000;
const b64url = (bytes: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const aleatorio = (n: number) => b64url(crypto.getRandomValues(new Uint8Array(n)));
const sha256 = async (texto: string) => b64url(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto)));
const redirectUri = () => `${location.origin}/sso`;

export default function SsoPage() {
  const { loginSso } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState("");

  useEffect(() => {
    const q = new URLSearchParams(location.search);
    (async () => {
      try {
        if (q.get("error")) throw new Error("Cancelaste el inicio de sesión en Sulotec o no se pudo completar.");
        const code = q.get("code");
        if (code) {
          let guardado: { verificador: string; state: string; creado: number } | null = null;
          try { guardado = JSON.parse(sessionStorage.getItem(CLAVE) || "null"); sessionStorage.removeItem(CLAVE); } catch { /* sin almacenamiento */ }
          if (!guardado || guardado.state !== q.get("state") || guardado.creado < Date.now() - VIGENCIA_MS) {
            throw new Error("El enlace de inicio de sesión no es válido o ya se usó. Vuelve a intentarlo.");
          }
          await loginSso(code, guardado.verificador, redirectUri());
          navigate("/", { replace: true });
          return;
        }
        const cfg: any = await request("/api/auth/sso/config");
        if (!cfg.activo) throw new Error("El inicio de sesión con la cuenta Sulotec no está habilitado en este servidor.");
        const verificador = aleatorio(48);
        const state = aleatorio(16);
        try { sessionStorage.setItem(CLAVE, JSON.stringify({ verificador, state, creado: Date.now() })); }
        catch { throw new Error("Tu navegador bloquea el almacenamiento de sesión. Entra con usuario y contraseña."); }
        const p = new URLSearchParams({
          client_id: cfg.clientId, response_type: "code", scope: "openid profile email", redirect_uri: redirectUri(), state,
          code_challenge: await sha256(verificador), code_challenge_method: "S256",
        });
        location.assign(`${cfg.issuer}/protocol/openid-connect/auth?${p}`);
      } catch (e: any) {
        setError(e.message || "No se pudo iniciar sesión con Sulotec.");
      }
    })();
  }, []);

  return (
    <div className="login-screen solo-panel">
      <div className="login-panel">
        <div className="login-card" role="status" aria-live="polite">
          <div className="login-mobile-brand" style={{ display: "flex" }}><Marca size={38} /><div><b translate="no">Auditoría de Visitas</b><span>Sulotec</span></div></div>
          <h1 className="login-title">{error ? "No se pudo entrar" : "Entrando con tu cuenta Sulotec…"}</h1>
          {error ? (
            <>
              <div role="alert" className="error-box">{error}</div>
              <p className="login-sub"><Link to="/login">Entrar con usuario y contraseña</Link> · <a href="https://sulotec.com/mis-productos">Volver a Sulotec</a></p>
            </>
          ) : <p className="login-sub">Un momento: estamos confirmando tu identidad con cuenta.sulotec.com.</p>}
        </div>
      </div>
    </div>
  );
}
