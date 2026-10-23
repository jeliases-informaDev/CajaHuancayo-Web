import { useCallback, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";

// Filtros de la lista de visitas. Viven en la URL (se pueden compartir, recargar y volver atrás sin perderlos) y se escriben de a varios a la vez:
// «Aplicar filtros» cambia resultado, ficha, fechas y auditor en una sola navegación. Una lista vacía significa «todas»: la URL sin filtro y el
// panel con todas las casillas marcadas son lo mismo.

export const RESULTADOS = [
  { clave: "CONFORME", plural: "Conformes", color: "var(--vi-punto-ok)" },
  { clave: "OBSERVADO", plural: "Observadas", color: "var(--vi-punto-warn)" },
  { clave: "NO_UBICADO", plural: "No ubicadas", color: "var(--vi-punto-nu)" },
  { clave: "RECHAZADO", plural: "Rechazadas", color: "var(--vi-punto-rech)" },
] as const;
export const FICHAS = [
  { clave: "CONSUMO", etiqueta: "Consumo", clase: "consumo" },
  { clave: "OTROS", etiqueta: "MYPE", clase: "mype" },
] as const;
export const CLAVES_RESULTADO: string[] = RESULTADOS.map((r) => r.clave);
export const CLAVES_FICHA: string[] = FICHAS.map((f) => f.clave);

export const TAMANOS = [10, 25, 50, 100];
export const FILAS_POR_DEFECTO = 10;

export type Filtros = { resultado: string[]; tipo: string[]; desde: string; hasta: string; auditor: string; alertas: boolean; q: string };
export const SIN_FILTROS: Filtros = { resultado: [], tipo: [], desde: "", hasta: "", auditor: "", alertas: false, q: "" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Un día «AAAA-MM-DD» que existe de verdad (el servidor rechaza «2026-02-31»).
const diaValido = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v;
const lista = (texto: string | null, validos: string[]) => [...new Set((texto || "").split(",").map((x) => x.trim()).filter((x) => validos.includes(x)))];

// Marcar todas las opciones equivale a no filtrar.
export const normalizar = (marcadas: string[], todas: string[]) => (marcadas.length === 0 || todas.every((c) => marcadas.includes(c)) ? [] : todas.filter((c) => marcadas.includes(c)));

export function leerFiltros(search: string): Filtros {
  const p = new URLSearchParams(search);
  const dia = (clave: string) => { const v = p.get(clave) || ""; return diaValido(v) ? v : ""; };
  const auditor = p.get("auditor") || "";
  const q = (p.get("q") || "").trim().slice(0, 100);
  return {
    resultado: normalizar(lista(p.get("resultado"), CLAVES_RESULTADO), CLAVES_RESULTADO),
    tipo: normalizar(lista(p.get("tipo"), CLAVES_FICHA), CLAVES_FICHA),
    desde: dia("desde"), hasta: dia("hasta"),
    auditor: UUID.test(auditor) ? auditor : "",
    alertas: p.get("alertas") === "1",
    q: q.length >= 2 ? q : "",
  };
}

export function leerPaginacion(search: string) {
  const p = new URLSearchParams(search);
  const pagina = Math.max(1, Math.min(100000, parseInt(p.get("pagina") || "1", 10) || 1));
  const pedidas = parseInt(p.get("filas") || "", 10);
  return { pagina, filas: TAMANOS.includes(pedidas) ? pedidas : FILAS_POR_DEFECTO };
}

// Lo que se manda a la API (lista y exportación). `desfase` son los minutos que el navegador está detrás de UTC: así «Hoy» es el día del usuario.
export function consultaApi(f: Filtros, desfase: number) {
  const p = new URLSearchParams();
  if (f.resultado.length) p.set("resultado", f.resultado.join(","));
  if (f.tipo.length) p.set("tipo_credito", f.tipo.join(","));
  if (f.auditor) p.set("id_usuario_auditor", f.auditor);
  if (f.alertas) p.set("con_alertas", "true");
  if (f.q) p.set("q", f.q);
  if (f.desde) p.set("desde", f.desde);
  if (f.hasta) p.set("hasta", f.hasta);
  p.set("desfase", String(desfase));
  return p;
}

function escribirFiltros(f: Filtros, p: URLSearchParams) {
  const poner = (clave: string, valor: string) => { if (valor) p.set(clave, valor); else p.delete(clave); };
  poner("resultado", f.resultado.join(","));
  poner("tipo", f.tipo.join(","));
  poner("desde", f.desde); poner("hasta", f.hasta);
  poner("auditor", f.auditor);
  poner("alertas", f.alertas ? "1" : "");
  poner("q", f.q);
}

// Cuántos grupos de filtros hay puestos (resultado, ficha, fecha, auditor, alertas). La búsqueda por texto tiene su propia caja y no cuenta.
export const gruposActivos = (f: Filtros) => [f.resultado.length > 0, f.tipo.length > 0, Boolean(f.desde || f.hasta), Boolean(f.auditor), f.alertas].filter(Boolean).length;

const dos = (n: number) => String(n).padStart(2, "0");
export const diaLocal = (d: Date) => `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
export const hoyLocal = () => diaLocal(new Date());

// «Hoy», «Ayer», «Últimos 7 días» y «Este mes»: días del reloj del usuario.
export function atajosDeFecha(ahora = new Date()) {
  const dia = (atras: number) => diaLocal(new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() - atras));
  return [
    { clave: "hoy", etiqueta: "Hoy", desde: dia(0), hasta: dia(0) },
    { clave: "ayer", etiqueta: "Ayer", desde: dia(1), hasta: dia(1) },
    { clave: "7d", etiqueta: "Últimos 7 días", desde: dia(6), hasta: dia(0) },
    { clave: "mes", etiqueta: "Este mes", desde: diaLocal(new Date(ahora.getFullYear(), ahora.getMonth(), 1)), hasta: dia(0) },
  ];
}

export function etiquetaDia(dia: string) {
  const [a, m, d] = dia.split("-").map(Number);
  const mismoAnio = a === new Date().getFullYear();
  return new Intl.DateTimeFormat("es-PE", { day: "numeric", month: "short", ...(mismoAnio ? {} : { year: "numeric" }) }).format(new Date(a, m - 1, d));
}

export function etiquetaRango(desde: string, hasta: string) {
  if (desde && hasta) return desde === hasta ? etiquetaDia(desde) : `${etiquetaDia(desde)} – ${etiquetaDia(hasta)}`;
  return desde ? `desde el ${etiquetaDia(desde)}` : `hasta el ${etiquetaDia(hasta)}`;
}

// Números de página a mostrar: la primera, la última y las vecinas de la actual, con «…» donde se salta.
export function paginasVisibles(actual: number, total: number): (number | "…")[] {
  const orden = [...new Set([1, total, actual - 1, actual, actual + 1].filter((n) => n >= 1 && n <= total))].sort((a, b) => a - b);
  const salida: (number | "…")[] = [];
  orden.forEach((n, i) => { if (i && n - orden[i - 1] > 1) salida.push("…"); salida.push(n); });
  return salida;
}

export function useFiltrosVisitas() {
  const { search } = useLocation();
  const navigate = useNavigate();
  const filtros = useMemo(() => leerFiltros(search), [search]);
  const { pagina, filas } = useMemo(() => leerPaginacion(search), [search]);
  // Se parte siempre de la URL de ese instante (no de la del último render): varias llamadas seguidas se acumulan en vez de pisarse.
  const escribir = useCallback((cambio: (p: URLSearchParams) => void) => {
    const p = new URLSearchParams(window.location.search);
    cambio(p);
    const texto = p.toString();
    navigate({ search: texto ? `?${texto}` : "" }, { replace: true });
  }, [navigate]);
  const fijarFiltros = useCallback((nuevo: Partial<Filtros>) => escribir((p) => { escribirFiltros({ ...leerFiltros(window.location.search), ...nuevo }, p); p.delete("pagina"); }), [escribir]);
  const irAPagina = useCallback((n: number) => escribir((p) => { if (n > 1) p.set("pagina", String(n)); else p.delete("pagina"); }), [escribir]);
  const fijarFilas = useCallback((n: number) => escribir((p) => { if (n !== FILAS_POR_DEFECTO) p.set("filas", String(n)); else p.delete("filas"); p.delete("pagina"); }), [escribir]);
  return { filtros, pagina, filas, fijarFiltros, irAPagina, fijarFilas };
}
