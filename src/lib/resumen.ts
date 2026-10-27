import { useEffect, useState } from "react";
import { getEmpresaElegida, request } from "../api";
import { cerrarTiempoReal, EVENTOS_RESUMEN, revisarConexion, suscribir } from "./tiempoReal";

// El resumen de la muestra lo usan el tablero, el menú lateral (cuántas visitas esperan revisión) y los filtros de varias pantallas. Se pide una
// sola vez y se comparte. Se mantiene al día en vivo: cuando el servidor avisa que cambió algo (visita registrada, muestra cambiada, expedientes
// cargados) se vuelve a pedir, y además cada 30 s mientras la pestaña se vea (respaldo si se corta la conexión).
// A dónde van los asesores: por distrito, las visitas hechas y los casos asignados de los últimos 30 días (más visitas primero).
export type DistritoActividad = { distrito: string; visitas: number; asignados: number };
export type Resumen = {
  expedientes: { total: number; por_estado: Record<string, number>; por_tipo: Record<string, number> };
  asignaciones_activas: number;
  visitas: { total: number; por_resultado: Record<string, number>; actividad: { dia: string; total: number }[]; recientes?: number };
  distritos_actividad?: DistritoActividad[];
  distritos_visitados?: { distrito: string; visitas: number }[]; // primera versión (solo visitas): lo que manda un servidor sin actualizar
  auditores: { id: string; nombre: string; zona: string | null; asignadas_activas: number; visitas_30_dias: number }[];
  cola_revision: { id_visita: number; resultado: string; fecha: string; cliente: string; codigo: string; tipo_credito: string; auditor: string; motivos: string[] }[];
};

// Mantiene al día una consulta. La repite (1) cuando el servidor avisa de un cambio, varios avisos seguidos valen por una sola consulta; (2) cada `cada` ms
// mientras la pestaña se vea; y (3) al volver a la pestaña o recuperar la red. Devuelve la función que lo detiene.
function mantenerAlDia(refrescar: () => void, cada: number) {
  let espera = 0;
  const pronto = () => { window.clearTimeout(espera); espera = window.setTimeout(refrescar, 600); };
  const baja = suscribir(EVENTOS_RESUMEN, pronto);
  const reloj = window.setInterval(() => { revisarConexion(); if (!document.hidden) refrescar(); }, cada);
  const visible = () => { if (!document.hidden) { revisarConexion(); refrescar(); } };
  document.addEventListener("visibilitychange", visible);
  window.addEventListener("online", visible);
  return () => {
    baja();
    window.clearTimeout(espera);
    window.clearInterval(reloj);
    document.removeEventListener("visibilitychange", visible);
    window.removeEventListener("online", visible);
  };
}

let cache: Resumen | null = null;
let error = "";
let enVuelo: Promise<void> | null = null;
let ultima = 0;
const oyentesResumen = new Set<() => void>();
const avisar = () => oyentesResumen.forEach((f) => f());

function cargar(forzar = false) {
  if (enVuelo) return enVuelo;
  if (!forzar && cache && Date.now() - ultima < 15000) return Promise.resolve();
  enVuelo = request<{ data: Resumen }>("/api/reportes/resumen")
    .then((r) => { cache = r.data; error = ""; ultima = Date.now(); })
    .catch((e) => { error = e.message || "No se pudo cargar el resumen."; })
    .finally(() => { enVuelo = null; avisar(); });
  return enVuelo;
}

// Tablero del Resumen: las cuatro series (expedientes cargados, asignaciones hechas, visitas y visitas observadas), los resultados y el ranking de auditores
// de UN mismo tramo (7 días, 8 semanas o 6 meses terminando en el día elegido). Tarjetas, gráfico y ranking salen de esta misma respuesta, por eso coinciden.
// El servidor cuenta con los días del usuario: se le manda su desfase horario.
export type Periodo = "diario" | "semanal" | "mensual";
export type Metrica = "expedientes" | "asignaciones" | "visitas" | "observados";
export type Actividad = { metrica: Metrica; periodo: Periodo; desde: string; hasta: string; total: number; puntos: { inicio: string; fin: string; total: number }[] };
export type SerieTablero = { total: number; anterior: number; puntos: { inicio: string; fin: string; total: number }[] };
export type ResultadoVisita = "CONFORME" | "OBSERVADO" | "NO_UBICADO" | "RECHAZADO";
export type NivelAuditor = "DESTACADO" | "PROMEDIO" | "BAJO" | "SIN_VISITAS";
export type FilaRanking = {
  id: string; nombre: string; usuario: string | null; zona: string | null; activo: boolean;
  visitas: number; resultados: Record<ResultadoVisita, number>; tipos: { MYPE: number; CONSUMO: number };
  anterior: number; posicion: number; efectividad: number | null; nivel: NivelAuditor;
};
export type Tablero = {
  periodo: Periodo; desde: string; hasta: string; dias: number; anterior: { desde: string; hasta: string }; generado_en: string;
  series: Record<Metrica, SerieTablero>;
  hoy: { expedientes: number; asignaciones_activas: number; visitas: number; observados: number };
  resultados: Record<ResultadoVisita, number>;
  ranking: { promedio: number; total_auditores: number; con_visitas: number; auditores: FilaRanking[] };
};

const tableros = new Map<string, { en: number; datos: Tablero }>();
const enVueloTablero = new Map<string, Promise<void>>();
const oyentesTablero = new Set<() => void>();
let errorTablero = "";
let ultimoTablero: Tablero | null = null; // lo último que llegó, de cualquier tramo: se muestra mientras llega el del tramo nuevo
const MAX_TABLEROS = 24; // tope para que no crezca si alguien recorre muchas fechas
const claveTablero = (p: Periodo, h: string) => `${getEmpresaElegida() || ""}|${p}|${h}`;

function pedirTablero(p: Periodo, h: string, forzar = false) {
  const clave = claveTablero(p, h);
  const previa = enVueloTablero.get(clave);
  if (previa) return previa;
  const hit = tableros.get(clave);
  if (!forzar && hit && Date.now() - hit.en < 4000) return Promise.resolve();
  const pedido = request<{ data: Tablero }>(`/api/reportes/tablero?periodo=${p}&hasta=${h}&desfase=${new Date().getTimezoneOffset()}`)
    .then((r) => {
      if (tableros.size >= MAX_TABLEROS) tableros.clear();
      tableros.set(clave, { en: Date.now(), datos: r.data });
      ultimoTablero = r.data;
      errorTablero = "";
    })
    .catch((e) => { errorTablero = e?.message || "No se pudo cargar el resumen."; })
    .finally(() => { enVueloTablero.delete(clave); oyentesTablero.forEach((f) => f()); });
  enVueloTablero.set(clave, pedido);
  return pedido;
}

// `tablero` es lo último que llegó (aunque sea de otro tramo mientras llega el nuevo); `vigente` dice si corresponde al tramo pedido.
// `actualizado` es el instante (ms) en que llegó, para mostrar «hace 5 s».
export function useTablero(periodo: Periodo, hasta: string): { tablero: Tablero | null; vigente: boolean; actualizado: number; error: string } {
  const [, forzar] = useState(0);
  useEffect(() => {
    const f = () => forzar((n) => n + 1);
    oyentesTablero.add(f);
    void pedirTablero(periodo, hasta);
    const detener = mantenerAlDia(() => { void pedirTablero(periodo, hasta, true); }, 20000);
    return () => { oyentesTablero.delete(f); detener(); };
  }, [periodo, hasta]);
  const hit = tableros.get(claveTablero(periodo, hasta));
  return { tablero: hit?.datos ?? ultimoTablero, vigente: Boolean(hit), actualizado: hit?.en ?? 0, error: errorTablero };
}

export const refrescarResumen = () => cargar(true);
export const olvidarResumen = () => { cache = null; error = ""; ultima = 0; tableros.clear(); errorTablero = ""; ultimoTablero = null; cerrarTiempoReal(); avisar(); };

let usuarios = 0;
let detenerResumen: (() => void) | null = null;

export function useResumen(): { resumen: Resumen | null; error: string; refrescar: () => void } {
  const [, forzar] = useState(0);
  useEffect(() => {
    const f = () => forzar((n) => n + 1);
    oyentesResumen.add(f);
    cargar();
    // Una sola vigilancia compartida por todas las pantallas que usan el resumen (el menú lateral, el tablero, expedientes...).
    usuarios += 1;
    if (usuarios === 1) detenerResumen = mantenerAlDia(() => { void cargar(true); }, 30000);
    return () => {
      oyentesResumen.delete(f);
      usuarios -= 1;
      if (usuarios === 0) { detenerResumen?.(); detenerResumen = null; }
    };
  }, []);
  return { resumen: cache, error, refrescar: () => { cargar(true); } };
}
