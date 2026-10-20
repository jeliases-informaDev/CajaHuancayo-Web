import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import QRCode from "qrcode";
import { useAuth } from "../AuthContext";
import { request } from "../api";
import "../login.css";

// Diseño de Figma «LOGIN 5». Lo que se ve en el lado izquierdo (empresa, titular, chips, foto, mapa y puntos de visita) se lee de
// public/marca/login.json, con las posiciones en px de diseño (lienzo de 1440 × 1024): cambiar la imagen o los textos de una
// instalación no requiere tocar código. Si el archivo falta, se usan estos valores.
type Etiqueta = { x: number; y: number; w: number; h: number };
type Punto = { nombre: string; x: number; y: number; tono: string; etiqueta?: Etiqueta };
type MarcaLogin = { empresa: string; producto: string; titular: [string, string, string]; chips: string[]; titulo: string; foto: string; mapa: string; puntos: Punto[] };
const MARCA_DEFECTO: MarcaLogin = {
  empresa: "Caja Huancayo", producto: "Auditoria de Visitas", titular: ["Cada visita,", "comprobada", "en campo"],
  chips: ["Ubicación en tiempo real", "KPI e Información al instante"], titulo: "Inicia Sesion", foto: "/marca/equipo.webp", mapa: "/marca/mapa-peru.webp",
  puntos: [
    { nombre: "La Libertad", x: 492, y: 388, tono: "amarillo", etiqueta: { x: 512, y: 353, w: 80, h: 22 } },
    { nombre: "Lima", x: 580, y: 612, tono: "verde", etiqueta: { x: 580, y: 570, w: 45, h: 21 } },
    { nombre: "Huancayo", x: 687, y: 607, tono: "rojo", etiqueta: { x: 695, y: 621, w: 73, h: 22 } },
  ],
};
const TONOS: Record<string, string> = { amarillo: "#ebe838", verde: "#40e045", rojo: "#e04040", azul: "#3549c6" };
// px de diseño → longitud real (el CSS define --u según el tamaño de la pantalla)
const du = (n: number) => `calc(${n} * var(--u))`;

export default function LoginPage() {
  const { login, verifyMfa } = useAuth();
  const navigate = useNavigate();
  const [marca, setMarca] = useState<MarcaLogin>(MARCA_DEFECTO);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [challenge, setChallenge] = useState("");
  const [enroll, setEnroll] = useState(false);
  const [secret, setSecret] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  // Si el servidor tiene activo el inicio con la cuenta Sulotec, se ofrece como segunda puerta (la misma cuenta de sulotec.com).
  const [ssoActivo, setSsoActivo] = useState(false);
  useEffect(() => { request<any>("/api/auth/sso/config").then((c) => setSsoActivo(Boolean(c?.activo))).catch(() => setSsoActivo(false)); }, []);
  useEffect(() => {
    fetch("/marca/login.json", { cache: "no-cache" })
      .then((r) => (r.ok ? r.json() : null))
      .then((m) => { if (m?.titular?.length === 3 && Array.isArray(m?.puntos)) setMarca({ ...MARCA_DEFECTO, ...m }); })
      .catch(() => {});
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (challenge) {
        if (code.length !== 6) throw new Error("Ingresa los 6 dígitos.");
        await verifyMfa(challenge, code, enroll);
        navigate("/");
      } else {
        const data = await login(username.trim(), password);
        if (data.mfaRequired || data.mfaEnrollmentRequired) {
          setChallenge(data.challengeToken);
          setEnroll(Boolean(data.mfaEnrollmentRequired));
          if (data.mfaEnrollmentRequired) {
            const setup: any = await request("/api/auth/mfa/enroll/setup", {
              method: "POST", body: JSON.stringify({ challengeToken: data.challengeToken }),
            });
            setSecret(setup.secret || "");
            // El QR se genera en el propio navegador a partir del otpauthUri —
            // el secreto de MFA nunca sale hacia un servicio externo.
            if (setup.otpauthUri) {
              try { setQrDataUrl(await QRCode.toDataURL(setup.otpauthUri, { width: 200, margin: 1 })); }
              catch { setQrDataUrl(""); }
            }
          }
        } else {
          navigate("/");
        }
      }
    } catch (e: any) {
      setError(e.message || "No se pudo iniciar sesión");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-screen">
      <section className="login-hero" aria-hidden="true">
        <img className="mapa" src={marca.mapa} alt="" width={776} height={1024} decoding="async" />
        <img className="foto" src={marca.foto} alt="" width={1360} height={1360} decoding="async" fetchPriority="high" />
        {marca.puntos.map((p) => (
          <React.Fragment key={p.nombre}>
            <span className="pin" style={{ left: du(p.x - 17.5), top: du(p.y - 17.5), ["--c" as any]: TONOS[p.tono] || TONOS.azul }} />
            {p.etiqueta ? <span className="pin-etiqueta" style={{ left: du(p.etiqueta.x), top: du(p.etiqueta.y), width: du(p.etiqueta.w), height: du(p.etiqueta.h) }}>{p.nombre}</span> : null}
          </React.Fragment>
        ))}
        <div className="brand">
          <span className="marca-cuadro" />
          <div className="brand-texto"><b translate="no">{marca.producto}</b><span translate="no">{marca.empresa}</span></div>
        </div>
        <h2 className="titular">
          <span className="l1">{marca.titular[0]}</span>
          <span className="l2"><em>{marca.titular[1]}</em><span className="en">{marca.titular[2]}</span></span>
        </h2>
        <div className="chips">{marca.chips.map((c) => <span key={c}>{c}</span>)}</div>
      </section>

      <div className="login-panel">
        <form className="login-card" onSubmit={submit}>
          <div className="login-mobile-brand"><span className="marca-cuadro" /><div><b translate="no">{marca.producto}</b><span translate="no">{marca.empresa}</span></div></div>
          <h1 className={`login-title${challenge ? " paso" : ""}`}>{challenge ? "Verificación en dos pasos" : marca.titulo}</h1>
          <p className="login-sub">
            {challenge ? "Confirma tu identidad para continuar." : "Ingresa con tu usuario del panel de administración"}
          </p>
          {!challenge ? (
            <>
              <div className="field">
                <label htmlFor="login-usuario">Usuario</label>
                <input id="login-usuario" name="username" autoComplete="username" spellCheck={false} required value={username} onChange={(e) => setUsername(e.target.value)} autoCapitalize="none" autoCorrect="off" disabled={busy} />
              </div>
              <div className="field">
                <label htmlFor="login-clave">Contraseña</label>
                <input id="login-clave" name="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} disabled={busy} />
              </div>
            </>
          ) : (
            <>
              {secret ? (
                <div className="callout info" style={{ padding: 16 }}>
                  <p style={{ margin: 0, fontWeight: 600 }}>Configura tu autenticador</p>
                  <p className="subtle" style={{ margin: "4px 0 12px" }}>
                    Escanea este código con Google Authenticator, Authy u otra app similar.
                  </p>
                  {qrDataUrl ? (
                    <img
                      src={qrDataUrl}
                      alt="Código QR para configurar la verificación en dos pasos"
                      width={168}
                      height={168}
                      style={{ display: "block", margin: "0 auto 12px", borderRadius: 12, background: "#fff", padding: 8, border: "1px solid var(--line)" }}
                    />
                  ) : null}
                  <p className="subtle" style={{ margin: 0 }}>¿No puedes escanear? Ingresa esta clave a mano:</p>
                  <p className="code" translate="no" style={{ margin: "4px 0 0", wordBreak: "break-all", fontWeight: 500 }}>{secret}</p>
                </div>
              ) : null}
              <div className="field">
                <label htmlFor="login-codigo">Código de 6 dígitos</label>
                <input id="login-codigo" name="codigo" inputMode="numeric" autoComplete="one-time-code" spellCheck={false} pattern="[0-9]{6}" required value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} maxLength={6} disabled={busy} />
              </div>
            </>
          )}
          <div className="login-slot" aria-live="polite">{error ? <div role="alert" className="error-box">{error}</div> : null}</div>
          <button type="submit" className="login-cta" disabled={busy}>{busy ? "Validando…" : challenge ? "Verificar" : "Ingresar"}</button>
          {ssoActivo && !challenge ? <a className="login-sso" href="/sso">Entrar con mi cuenta Sulotec</a> : null}
          <div className="login-foot">
            <a className="privacidad" href="/privacidad">Política de privacidad</a>
            <a className="soporte" href="mailto:serviciosdigitales@informaperu.com">Soporte: serviciosdigitales@informaperu.com</a>
          </div>
        </form>
      </div>
    </div>
  );
}
