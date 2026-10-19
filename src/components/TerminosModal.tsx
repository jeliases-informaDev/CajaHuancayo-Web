import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { request } from "../api";
import { useAuth } from "../AuthContext";
import { Icon } from "./icons";
import "../terminos.css";

// Términos y condiciones de la empresa: el servidor manda el texto vigente y su versión; aquí se leen hasta el final, se marca la
// casilla y se registra la aceptación (quién, cuándo, desde el panel). Rechazar cierra la sesión.
type Terminos = { version: string; titulo: string; subtitulo: string; secciones: { titulo: string; texto: string }[]; aceptado: boolean; exento: boolean };

export default function TerminosModal({ onAceptado }: { onAceptado: () => void }) {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [terminos, setTerminos] = useState<Terminos | null>(null);
  const [error, setError] = useState("");
  const [leido, setLeido] = useState(false);
  const [acepto, setAcepto] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const cuerpo = useRef<HTMLDivElement>(null);

  useEffect(() => {
    request<any>("/api/terminos").then((r) => setTerminos(r.data)).catch((e: any) => setError(e.message || "No se pudieron cargar los términos."));
  }, []);

  // Si el texto cabe sin desplazarse ya está leído; si no, la casilla se habilita al llegar al final.
  const revisar = () => {
    const el = cuerpo.current;
    if (el && el.scrollHeight - el.scrollTop - el.clientHeight <= 12) setLeido(true);
  };
  useEffect(() => { if (terminos) requestAnimationFrame(revisar); }, [terminos]);

  const rechazar = async () => { await logout(); navigate("/login", { replace: true }); };
  const aceptar = async () => {
    if (!terminos) return;
    setEnviando(true); setError("");
    try {
      await request("/api/terminos/aceptar", { method: "POST", body: JSON.stringify({ version: terminos.version }) });
      onAceptado();
    } catch (e: any) { setError(e.message || "No se pudo registrar la aceptación."); setEnviando(false); }
  };

  return createPortal(
    <>
      <div className="drawer-overlay" aria-hidden="true" />
      <div className="modal terminos" role="dialog" aria-modal="true" aria-labelledby="terminos-titulo">
        <div className="modal-head terminos-head">
          <span className="terminos-ic" aria-hidden="true"><Icon name="ficha" size={22} /></span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 id="terminos-titulo">{terminos?.titulo ?? "Términos y condiciones"}</h2>
            <p className="subtle">{terminos?.subtitulo ?? "Léelos y acéptalos para empezar a usar la aplicación."}</p>
          </div>
          {terminos ? <span className="subtle terminos-version">Versión {terminos.version}</span> : null}
        </div>
        <div className="modal-body">
          {error ? <div role="alert" className="error-box">{error}</div> : null}
          <div className="terminos-texto" ref={cuerpo} onScroll={revisar} tabIndex={0} aria-label="Texto de los términos y condiciones">
            {terminos ? terminos.secciones.map((s, i) => (
              <section key={s.titulo}><h3>{i + 1}. {s.titulo}</h3><p>{s.texto}</p></section>
            )) : <p className="subtle" style={{ margin: 0 }}>Cargando…</p>}
          </div>
          <p className="subtle terminos-hint" aria-live="polite">{leido ? "Ya puedes marcar la casilla." : "Desplázate hasta el final para continuar."}</p>
          <label className={`check-inline terminos-check${leido ? "" : " off"}`}>
            <input type="checkbox" checked={acepto} disabled={!leido} onChange={(e) => setAcepto(e.target.checked)} />
            <span>He leído y acepto los términos y condiciones y la <a href="/privacidad" target="_blank" rel="noreferrer">política de privacidad</a></span>
          </label>
        </div>
        <div className="modal-foot">
          <button type="button" className="btn ghost" onClick={rechazar} disabled={enviando}>Rechazar y salir</button>
          <button type="button" className="btn" onClick={aceptar} disabled={!acepto || enviando || !terminos}>{enviando ? "Guardando…" : "Aceptar y continuar"}</button>
        </div>
      </div>
    </>,
    document.body,
  );
}
