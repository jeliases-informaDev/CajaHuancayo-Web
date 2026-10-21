import { useEffect, useState } from "react";
import { getEmpresaElegida, request } from "../api";

// El resumen de la muestra lo usan el tablero, el menú lateral (cuántas visitas esperan revisión) y los
// filtros de varias pantallas. Se pide una sola vez y se comparte; se refresca cada minuto mientras haya alguien mirando.
export type Resumen = {
  expedientes: { total: number; por_estado: Record<string, number>; por_tipo: Record<string, number> };
  asignaciones_activas: number;
  visitas: { total: number; por_resultado: Record<string, number>; actividad: { dia: string; total: number }[]; recientes?: number };
  distritos_visitados?: { distrito: string; visitas: number }[];
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

// Gráfico del Resumen: cada tarjeta dibuja su serie (expedientes cargados, asignaciones hechas, visitas y visitas observadas) por día, semana o mes.
// El servidor cuenta con los días del usuario: se le manda su desfase horario.
export type Periodo = "diario" | "semanal" | "mensual";
export type Metrica = "expedientes" | "asignaciones" | "visitas" | "observados";
export type Actividad = { metrica: Metrica; periodo: Periodo; desde: string; hasta: string; total: number; puntos: { inicio: string; fin: string; total: number }[] };

// Lo ya pedido (por empresa elegida, serie, período y último día): al pasar de una tarjeta a otra, o al volver a una, el gráfico cambia al instante
// y se refresca por detrás. Tiene tope para que no crezca si alguien recorre muchas fechas.
const actividades = new Map<string, { en: number; datos: Actividad }>();
const enVueloAct = new Map<string, Promise<void>>();
const oyentesAct = new Set<() => void>();
const MAX_ACTIVIDADES = 48;
const claveActividad = (m: Metrica, p: Periodo, h: string) => `${getEmpresaElegida() || ""}|${m}|${p}|${h}`;

function pedirActividad(m: Metrica, p: Periodo, h: string) {
  const clave = claveActividad(m, p, h);
  const previa = enVueloAct.get(clave);
  if (previa) return previa;
  const pedido = request<{ data: Actividad }>(`/api/reportes/actividad?metrica=${m}&periodo=${p}&hasta=${h}&desfase=${new Date().getTimezoneOffset()}`)
    .then((r) => { if (actividades.size >= MAX_ACTIVIDADES) actividades.clear(); actividades.set(clave, { en: Date.now(), datos: r.data }); oyentesAct.forEach((f) => f()); })
    .finally(() => { enVueloAct.delete(clave); });
  enVueloAct.set(clave, pedido);
  return pedido;
}

// Al pasar el cursor por una tarjeta se pide su serie con anticipación (si no está fresca) para que al hacer clic ya esté.
export function precargarActividad(m: Metrica, p: Periodo, h: string) {
  const hit = actividades.get(claveActividad(m, p, h));
  if (!hit || Date.now() - hit.en > 30000) void pedirActividad(m, p, h).catch(() => { /* se reintenta al elegir la tarjeta */ });
}

export function useActividad(metrica: Metrica, periodo: Periodo, hasta: string): { datos: Actividad | null } {
  const [, forzar] = useState(0);
  useEffect(() => {
    const f = () => forzar((n) => n + 1);
    oyentesAct.add(f);
    const pedir = () => { void pedirActividad(metrica, periodo, hasta).catch(() => { /* el gráfico queda como estaba; el resto del resumen ya avisa si el servidor falla */ }); };
    const hit = actividades.get(claveActividad(metrica, periodo, hasta));
    if (!hit || Date.now() - hit.en > 15000) pedir();
    const t = window.setInterval(() => { if (!document.hidden) pedir(); }, 60000);
    return () => { oyentesAct.delete(f); window.clearInterval(t); };
  }, [metrica, periodo, hasta]);
  return { datos: actividades.get(claveActividad(metrica, periodo, hasta))?.datos ?? null };
}

export const refrescarResumen = () => cargar(true);
export const olvidarResumen = () => { cache = null; error = ""; ultima = 0; actividades.clear(); avisar(); };

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
