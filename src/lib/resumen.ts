import { useEffect, useState } from "react";
import { request } from "../api";

// El resumen de la muestra lo usan el tablero, el menú lateral (cuántas visitas esperan revisión) y los
// filtros de varias pantallas. Se pide una sola vez y se comparte; se refresca cada minuto mientras haya alguien mirando.
export type Resumen = {
  expedientes: { total: number; por_estado: Record<string, number>; por_tipo: Record<string, number> };
  asignaciones_activas: number;
  visitas: { total: number; por_resultado: Record<string, number>; actividad: { dia: string; total: number }[] };
  auditores: { id: string; nombre: string; zona: string | null; asignadas_activas: number; visitas_30_dias: number }[];
  cola_revision: { id_visita: number; resultado: string; fecha: string; cliente: string; codigo: string; tipo_credito: string; auditor: string; motivos: string[] }[];
};

let cache: Resumen | null = null;
let error = "";
let enVuelo: Promise<void> | null = null;
let ultima = 0;
const oyentes = new Set<() => void>();
const avisar = () => oyentes.forEach((f) => f());

function cargar(forzar = false) {
  if (enVuelo) return enVuelo;
  if (!forzar && cache && Date.now() - ultima < 15000) return Promise.resolve();
  enVuelo = request<{ data: Resumen }>("/api/reportes/resumen")
    .then((r) => { cache = r.data; error = ""; ultima = Date.now(); })
    .catch((e) => { error = e.message || "No se pudo cargar el resumen."; })
    .finally(() => { enVuelo = null; avisar(); });
  return enVuelo;
}

export const refrescarResumen = () => cargar(true);
export const olvidarResumen = () => { cache = null; error = ""; ultima = 0; avisar(); };

export function useResumen(): { resumen: Resumen | null; error: string; refrescar: () => void } {
  const [, forzar] = useState(0);
  useEffect(() => {
    const f = () => forzar((n) => n + 1);
    oyentes.add(f);
    cargar();
    const t = window.setInterval(() => { if (!document.hidden) cargar(true); }, 60000);
    return () => { oyentes.delete(f); window.clearInterval(t); };
  }, []);
  return { resumen: cache, error, refrescar: () => { cargar(true); } };
}
