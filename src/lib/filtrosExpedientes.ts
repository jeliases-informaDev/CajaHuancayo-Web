import { useCallback, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { FILAS_POR_DEFECTO, TAMANOS } from "./paginas";

// Filtros de la lista de expedientes. Viven en la URL (se pueden compartir, recargar y volver atrás sin perderlos); cambiar uno vuelve a la página 1.
// Los nombres de siempre se conservan para que sigan sirviendo los enlaces de la paleta y los guardados: q, tipo, estado, sin_coordenadas, ubicacion, pagina.

export const ESTADOS = [
  { clave: "PENDIENTE", etiqueta: "Pendiente" }, { clave: "ASIGNADO", etiqueta: "Asignado" },
  { clave: "VISITADO", etiqueta: "Visitado" }, { clave: "CERRADO", etiqueta: "Cerrado" },
] as const;
const CLAVES_ESTADO: string[] = ESTADOS.map((e) => e.clave);
const CLAVES_GEO = ["PENDIENTE", "LOCALIZADO", "REVISAR", "NO_ENCONTRADO", "ERROR", "VERIFICADO"];

export type FiltrosExp = { q: string; estado: string; tipo: "" | "OTROS" | "CONSUMO"; sinUbicacion: boolean; geo: string };
export const SIN_FILTROS_EXP: FiltrosExp = { q: "", estado: "", tipo: "", sinUbicacion: false, geo: "" };

export function leerFiltrosExp(search: string): FiltrosExp {
  const p = new URLSearchParams(search);
  const q = (p.get("q") || "").trim().slice(0, 150);
  const tipo = p.get("tipo") || ""; const estado = p.get("estado") || ""; const geo = p.get("ubicacion") || "";
  return {
    q: q.length >= 2 ? q : "",
    tipo: tipo === "OTROS" || tipo === "CONSUMO" ? tipo : "",
    estado: CLAVES_ESTADO.includes(estado) ? estado : "",
    sinUbicacion: p.get("sin_coordenadas") === "1",
    geo: CLAVES_GEO.includes(geo) ? geo : "",
  };
}

export function leerPaginacionExp(search: string) {
  const p = new URLSearchParams(search);
  const pagina = Math.max(1, Math.min(100000, parseInt(p.get("pagina") || "1", 10) || 1));
  const pedidas = parseInt(p.get("filas") || "", 10);
  return { pagina, filas: TAMANOS.includes(pedidas) ? pedidas : FILAS_POR_DEFECTO };
}

// Lo que se manda a la API.
export function consultaExpedientes(f: FiltrosExp, pagina: number, filas: number) {
  const q = new URLSearchParams({ limit: String(filas), page: String(pagina) });
  if (f.q) q.set("search", f.q);
  if (f.tipo) q.set("tipo_credito", f.tipo);
  if (f.estado) q.set("estado", f.estado);
  if (f.sinUbicacion) q.set("sin_ubicacion", "true");
  if (f.geo) q.set("geo_estado", f.geo);
  return q;
}

function escribirFiltros(f: FiltrosExp, p: URLSearchParams) {
  const poner = (clave: string, valor: string) => { if (valor) p.set(clave, valor); else p.delete(clave); };
  poner("q", f.q); poner("tipo", f.tipo); poner("estado", f.estado); poner("sin_coordenadas", f.sinUbicacion ? "1" : ""); poner("ubicacion", f.geo);
}

export function useFiltrosExpedientes() {
  const { search } = useLocation();
  const navigate = useNavigate();
  const filtros = useMemo(() => leerFiltrosExp(search), [search]);
  const { pagina, filas } = useMemo(() => leerPaginacionExp(search), [search]);
  // Se parte siempre de la URL de ese instante (no de la del último render): varias llamadas seguidas se acumulan en vez de pisarse.
  const escribir = useCallback((cambio: (p: URLSearchParams) => void) => {
    const p = new URLSearchParams(window.location.search);
    cambio(p);
    const texto = p.toString();
    navigate({ search: texto ? `?${texto}` : "" }, { replace: true });
  }, [navigate]);
  const fijarFiltros = useCallback((nuevo: Partial<FiltrosExp>) => escribir((p) => { escribirFiltros({ ...leerFiltrosExp(window.location.search), ...nuevo }, p); p.delete("pagina"); }), [escribir]);
  const irAPagina = useCallback((n: number) => escribir((p) => { if (n > 1) p.set("pagina", String(n)); else p.delete("pagina"); }), [escribir]);
  const fijarFilas = useCallback((n: number) => escribir((p) => { if (n !== FILAS_POR_DEFECTO) p.set("filas", String(n)); else p.delete("filas"); p.delete("pagina"); }), [escribir]);
  const quitarParametro = useCallback((clave: string) => escribir((p) => { p.delete(clave); }), [escribir]);
  return { filtros, pagina, filas, fijarFiltros, irAPagina, fijarFilas, quitarParametro };
}
