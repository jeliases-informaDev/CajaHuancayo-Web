import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import QRCode from "qrcode";
import { useAuth } from "../AuthContext";
import { request } from "../api";
import { Button } from "../components/ui";

export default function LoginPage() {
  const { login, verifyMfa } = useAuth();
  const navigate = useNavigate();
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

  return (
    <div className="login-screen">
      <form className="login-card" onSubmit={submit}>
        <h1 className="login-title">{challenge ? "Verificación" : "Panel de Administración"}</h1>
        <p className="login-sub">
          {challenge ? "Confirma tu identidad para continuar." : "Auditoría de Visitas · Caja Huancayo"}
        </p>
        {!challenge ? (
          <>
            <div className="field">
              <label>Usuario</label>
              <input value={username} onChange={(e) => setUsername(e.target.value)} autoCapitalize="none" autoCorrect="off" disabled={busy} />
            </div>
            <div className="field">
              <label>Contraseña</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} disabled={busy} />
            </div>
          </>
        ) : (
          <>
            {secret ? (
              <div className="card" style={{ background: "#eef4ff" }}>
                <p style={{ margin: 0, fontWeight: 800 }}>Configura tu autenticador</p>
                <p style={{ margin: "4px 0 10px", color: "var(--muted)", fontSize: 12 }}>
                  Escanea este código con Google Authenticator, Authy u otra app similar.
                </p>
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt="Código QR para configurar la verificación en dos pasos"
                    width={168}
                    height={168}
                    style={{ display: "block", margin: "0 auto 10px", borderRadius: 10, background: "#fff", padding: 8, border: "1px solid var(--border)" }}
                  />
                ) : null}
                <p style={{ margin: 0, fontSize: 10.5, color: "var(--muted)", textTransform: "uppercase", fontWeight: 800, letterSpacing: 0.4 }}>
                  ¿No puedes escanear? Ingresa esta clave a mano:
                </p>
                <p style={{ margin: "3px 0 0", color: "var(--primary)", fontSize: 12, wordBreak: "break-all", fontWeight: 700 }}>{secret}</p>
              </div>
            ) : null}
            <div className="field">
              <label>Código de 6 dígitos</label>
              <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} maxLength={6} disabled={busy} />
            </div>
          </>
        )}
        {error ? <div className="error-box">{error}</div> : null}
        <Button type="submit" title={busy ? "Validando…" : challenge ? "Verificar acceso" : "Ingresar"} disabled={busy} />
      </form>
    </div>
  );
}
