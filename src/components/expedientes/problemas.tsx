import { useState, type ReactNode } from "react";
import { descargarArchivo } from "../../api";
import { Icon } from "../icons";
import { ADVERTENCIAS } from "../../lib/format";
import type { ResultadoCarga } from "./pastillas";

// Piezas que comparten la validación de «Cargar archivo» y el detalle del «Historial de cargas»: el resumen en cifras, el aviso de lo que pasó, la tabla
// «Qué debes corregir» (fila del archivo, campo, problema y qué corregir) y el reporte de errores en CSV.

export type Linea = { hoja?: string; fila?: number; codigo?: string; campo?: string; problema?: string; corregir?: string; resultado: string; motivo?: string; advertencias?: string[] };
export type Carga = {
  id_importacion: string; archivo: string; simulacion: boolean; estado: string; resultado: ResultadoCarga; fase?: string | null; formato?: string | null; actor?: string | null; fecha_creacion: string;
  procesadas: number; insertadas: number; actualizadas: number; omitidas: number; errores: number; advertencias?: Record<string, number> | null;
  detalle_error?: Linea[] | null; errores_listados?: number; errores_truncados?: boolean; archivo_repetido?: { fecha_creacion: string } | null;
};

export const num = (n: number) => n.toLocaleString("es-PE");
export const lineasDeError = (c: Pick<Carga, "detalle_error">) => (c.detalle_error || []).filter((d) => d.resultado === "ERROR");
export const validasDe = (c: Pick<Carga, "procesadas" | "errores">) => Math.max(0, c.procesadas - c.errores);
export const filasConError = (n: number) => `${num(n)} ${n === 1 ? "fila con error" : "filas con errores"}`;
export const FORMATOS: Record<string, string> = { CORE_262: "Base del core", SIMPLE: "Plantilla simple" };

// Las cuatro cifras de arriba: filas detectadas, válidas, con errores e importadas.
export function Cifras({ carga, importadas }: { carga: Carga; importadas: number }) {
  const items = [
    { n: carga.procesadas, et: "Filas detectadas", mal: false }, { n: validasDe(carga), et: "Válidas", mal: false },
    { n: carga.errores, et: "Con errores", mal: carga.errores > 0 }, { n: importadas, et: "Importadas", mal: false },
  ];
  return (
    <dl className="ex-cifras">
      {items.map((x) => <div key={x.et} className={x.mal ? "mal" : undefined}><dt>{x.et}</dt><dd>{num(x.n)}</dd></div>)}
    </dl>
  );
}

// Franja de color con un título y su explicación (rojo: no se guardó nada; verde: listo o hecho; azul: informativo).
export function Franja({ tono, titulo, children }: { tono: "mal" | "ok" | "info"; titulo: string; children?: ReactNode }) {
  return (
    <div className={`ex-franja ${tono}`} role={tono === "mal" ? "alert" : "status"}>
      <Icon name={tono === "mal" ? "alertaCirculo" : tono === "ok" ? "ok" : "info"} size={18} />
      <div><b>{titulo}</b>{children ? <p>{children}</p> : null}</div>
    </div>
  );
}

// «Qué debes corregir»: una línea por problema. Con varias hojas (la base del core trae OTROS y CONSUMO) se dice de cuál es cada fila.
export function TablaProblemas({ lineas, titulo = "Qué debes corregir" }: { lineas: Linea[]; titulo?: string }) {
  if (!lineas.length) return null;
  const variasHojas = new Set(lineas.map((l) => l.hoja).filter(Boolean)).size > 1;
  return (
    <section className="ex-problemas" aria-label={titulo}>
      <h3>{titulo}</h3>
      <div className="ex-tabla-caja">
        <table>
          <caption className="sr-only">{titulo}: una línea por problema</caption>
          <thead><tr><th scope="col">Fila del archivo</th><th scope="col">Campo</th><th scope="col">Problema</th><th scope="col">Qué corregir</th></tr></thead>
          <tbody>
            {lineas.map((l, i) => (
              <tr key={i}>
                <td>{l.fila ?? "—"}{variasHojas && l.hoja ? <small>{l.hoja}</small> : null}</td>
                <td>{l.campo || "—"}</td>
                <td className="mal">{l.problema || l.motivo}</td>
                <td>{l.corregir || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// Si hay más filas con error que líneas guardadas se dice (en pantalla y en el reporte): nada se corta en silencio.
export function NotaTope({ carga }: { carga: Carga }) {
  if (!carga.errores_truncados) return null;
  return <p className="ex-nota-tope">Se muestran las primeras {num(carga.errores_listados || 0)} de {num(carga.errores)} filas con error. Corrige estas y vuelve a validar el archivo para ver las demás.</p>;
}

// Avisos de calidad del dato (no bloquean): cuántas filas traen cada uno.
export function AvisosDeCalidad({ avisos }: { avisos?: Record<string, number> | null }) {
  const lista = Object.entries(avisos || {}).filter(([, n]) => n > 0) as [string, number][];
  if (!lista.length) return null;
  return (
    <div className="ex-calidad" role="status">
      <b>Avisos de calidad del dato</b> <span>(no impiden importar)</span>
      <ul>{lista.map(([codigo, n]) => <li key={codigo}><b>{num(n)}</b> {n === 1 ? "fila" : "filas"}: {ADVERTENCIAS[codigo] || codigo}</li>)}</ul>
    </div>
  );
}

// «Descargar reporte de errores»: CSV con BOM para abrirlo directo en Excel.
export function BotonReporte({ carga, className = "ex-enlace" }: { carga: Carga; className?: string }) {
  const [bajando, setBajando] = useState(false);
  const [error, setError] = useState("");
  const bajar = async () => {
    setBajando(true); setError("");
    try {
      const nombre = carga.archivo.replace(/\.[^.]+$/, "").replace(/[^A-Za-z0-9._-]+/g, "_").slice(0, 60) || "carga";
      await descargarArchivo(`/api/expedientes/importaciones/${carga.id_importacion}/reporte-errores`, `errores-${nombre}.csv`);
    } catch (e: any) { setError(e?.message || "No se pudo descargar el reporte."); } finally { setBajando(false); }
  };
  return (
    <span className="ex-reporte">
      <button type="button" className={className} onClick={bajar} disabled={bajando}><Icon name="descargar" size={16} />{bajando ? "Descargando…" : "Descargar reporte de errores"}</button>
      {error ? <span role="alert" className="ex-error-chico">{error}</span> : null}
    </span>
  );
}
