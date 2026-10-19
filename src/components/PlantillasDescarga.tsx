import { useState } from "react";
import { descargarArchivo } from "../api";
import { useAuth } from "../AuthContext";
import { Icon } from "./icons";

// Plantillas de Excel para la carga masiva: una por formato que acepta la empresa (CORE_262 = base del core, SIMPLE = columnas mínimas).
// Cada una trae las columnas exactas y 3 filas de ejemplo.

const FORMATOS: Record<string, { titulo: string; detalle: string }> = {
  CORE_262: { titulo: "Base del core (262 columnas)", detalle: "El mismo formato que exporta el core del banco: la ficha completa (cliente, negocio, crédito, evaluación financiera y endeudamiento)." },
  SIMPLE: { titulo: "Plantilla simple (16 columnas)", detalle: "Solo los datos mínimos para asignar y visitar: crédito, cliente, documento, dirección, distrito, asesor y monto." },
};

export default function PlantillasDescarga({ compacto = false, onError }: { compacto?: boolean; onError?: (mensaje: string) => void }) {
  const { empresa } = useAuth();
  const formatos = empresa?.reglas?.formatos_importacion?.length ? empresa.reglas.formatos_importacion : Object.keys(FORMATOS);
  const [descargando, setDescargando] = useState("");
  const [error, setError] = useState("");
  const descargar = async (formato: string) => {
    setDescargando(formato); setError("");
    try { await descargarArchivo("/api/expedientes/plantilla?formato=" + formato, "plantilla-expedientes-" + formato.toLowerCase() + ".xlsx"); }
    catch (e: any) { const m = e.message || "No se pudo descargar la plantilla."; setError(m); onError?.(m); }
    finally { setDescargando(""); }
  };

  if (compacto) {
    return (
      <div className="plantillas-card">
        <b><Icon name="descargar" size={16} /> ¿Aún no tienes el archivo? Descarga la plantilla</b>
        <span className="subtle">Trae las columnas exactas y 3 filas de ejemplo. Llénala y súbela aquí mismo.</span>
        <div className="row" style={{ gap: 8, flexWrap: "wrap", marginTop: 6 }}>
          {formatos.map((f) => (
            <button key={f} type="button" className="btn ghost small" disabled={Boolean(descargando)} onClick={() => descargar(f)}>
              <Icon name="descargar" size={15} />{descargando === f ? "Descargando…" : FORMATOS[f]?.titulo || f}
            </button>
          ))}
        </div>
        {error && !onError ? <div role="alert" className="error-box" style={{ marginTop: 8 }}>{error}</div> : null}
      </div>
    );
  }

  return (
    <>
      {error ? <div role="alert" className="error-box">{error}</div> : null}
      {formatos.map((f) => (
        <div key={f} className="plantillas-card">
          <b>{FORMATOS[f]?.titulo || f}</b>
          <span className="subtle">{FORMATOS[f]?.detalle || "Plantilla de expedientes."}</span>
          <div style={{ marginTop: 8 }}>
            <button type="button" className="btn small" disabled={Boolean(descargando)} onClick={() => descargar(f)}>
              <Icon name="descargar" size={15} />{descargando === f ? "Descargando…" : "Descargar plantilla"}
            </button>
          </div>
        </div>
      ))}
    </>
  );
}
