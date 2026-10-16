import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import QRCode from "qrcode";
import { useAuth } from "../AuthContext";
import { request } from "../api";
import { Icon, Marca } from "../components/icons";
import { useTheme } from "../lib/theme";

const PRUEBAS = [
  { icon: "seguimiento", titulo: "Ubicación contrastada", texto: "La posición de cada visita se compara con el domicilio de la base y se detecta el GPS simulado." },
  { icon: "huella", titulo: "Evidencia con huella", texto: "Las fotografías se toman solo con la cámara de la app y cada una guarda su huella digital." },
  { icon: "firma", titulo: "Ficha firmada por el cliente", texto: "Del archivo de origen a la ficha cerrada, cada paso queda registrado y no se puede editar." },
];

export default function LoginPage() {
  const { login, verifyMfa } = useAuth();
  const navigate = useNavigate();
  const [tema, fijarTema] = useTheme();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [challenge, setChallenge] = useState("");
  const [enroll, setEnroll] = useState(false);
  const [secret, setSecret] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

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

  const siguienteTema = () => fijarTema(tema === "dark" ? "light" : tema === "light" ? "auto" : "dark");

  return (
    <div className="login-screen">
      <section className="login-hero" aria-hidden="true">
        <div className="mesh" />
        <svg className="routes" viewBox="0 0 800 900" preserveAspectRatio="xMidYMid slice" focusable="false">
          <defs><linearGradient id="rg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ff7ac8" /><stop offset="1" stopColor="#8ea2ff" /></linearGradient></defs>
          <path className="r" d="M-20 700 C 120 620, 180 760, 320 640 S 520 470, 640 520 S 760 380, 840 300" />
          <path className="r" d="M60 120 C 200 180, 240 80, 380 180 S 560 330, 700 250" style={{ animationDuration: "42s" }} />
          <g transform="translate(320 640)"><circle className="h" r="9" /><circle className="p" r="4.5" /></g>
          <g transform="translate(640 520)"><circle className="h" r="9" style={{ animationDelay: "1.1s" }} /><circle className="p" r="4.5" /></g>
          <g transform="translate(380 180)"><circle className="h" r="9" style={{ animationDelay: "2s" }} /><circle className="p" r="4.5" /></g>
        </svg>
        <div className="brand">
          <Marca size={40} />
          <div><b translate="no">Auditoría de Visitas</b><span>Caja Huancayo</span></div>
        </div>
        <div>
          <h2>Cada visita, <em>comprobada</em> en campo.</h2>
          <ul>
            {PRUEBAS.map((p) => (
              <li key={p.titulo}>
                <span className="ic"><Icon name={p.icon} size={20} /></span>
                <div><b>{p.titulo}</b><span>{p.texto}</span></div>
              </li>
            ))}
          </ul>
        </div>
        <small>Acceso exclusivo para personal autorizado de Informa Perú y Caja Huancayo.</small>
      </section>

      <div className="login-panel">
        <button type="button" className="iconbtn login-theme" onClick={siguienteTema} aria-label={`Tema: ${tema === "auto" ? "del sistema" : tema === "dark" ? "oscuro" : "claro"}. Cambiar`} title="Cambiar el tema">
          <Icon name={tema === "dark" ? "luna" : tema === "light" ? "sol" : "auto"} size={17} />
        </button>
        <form className="login-card" onSubmit={submit}>
          <div className="login-mobile-brand"><Marca size={38} /><div><b translate="no">Auditoría de Visitas</b><span>Caja Huancayo</span></div></div>
          <h1 className="login-title">{challenge ? "Verificación en dos pasos" : "Iniciar sesión"}</h1>
          <p className="login-sub">
            {challenge ? "Confirma tu identidad para continuar." : "Ingresa con tu usuario del panel de administración."}
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
          {error ? <div role="alert" className="error-box">{error}</div> : null}
          <button type="submit" className="btn" disabled={busy}>{busy ? "Validando…" : challenge ? "Verificar acceso" : "Ingresar"}</button>
          <div className="login-foot"><a href="/privacidad">Política de privacidad</a><span>Soporte: serviciosdigitales@informaperu.com</span></div>
        </form>
      </div>
    </div>
  );
}
