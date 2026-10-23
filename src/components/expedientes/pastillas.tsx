import { ESTADOS } from "../../lib/filtrosExpedientes";

// Pastillas de la lista de expedientes y del historial de cargas (colores del diseño de Figma).

export const PastillaTipo = ({ tipo }: { tipo: string }) => <span className={`ex-tipo ${tipo === "OTROS" ? "mype" : "consumo"}`}>{tipo === "OTROS" ? "MYPE" : "Consumo"}</span>;

export const PastillaUbicacion = ({ con }: { con: boolean }) => <span className={`ex-pastilla ${con ? "ok" : "gris"}`}><i aria-hidden="true" />{con ? "Con coordenadas" : "Sin coordenadas"}</span>;

const TONO_ESTADO: Record<string, string> = { PENDIENTE: "bad", ASIGNADO: "warn", VISITADO: "ok", CERRADO: "gris" };
export const PastillaEstado = ({ estado }: { estado: string }) => <span className={`ex-pastilla ${TONO_ESTADO[estado] || "gris"}`}><i aria-hidden="true" />{ESTADOS.find((e) => e.clave === estado)?.etiqueta || estado}</span>;

// Cómo terminó una carga: lo que se ve en la tabla del historial y en el detalle.
export type ResultadoCarga = "IMPORTADA" | "CON_ERRORES" | "VALIDADA" | "ERROR" | "EN_PROCESO" | "INTERRUMPIDA";
const CARGA: Record<ResultadoCarga, { corta: string; larga: string; tono: string }> = {
  IMPORTADA: { corta: "Importada", larga: "Importada", tono: "ok" },
  CON_ERRORES: { corta: "Con errores / Sin importar", larga: "Con errores · Sin importar", tono: "bad" },
  VALIDADA: { corta: "Validada / Sin importar", larga: "Validada · Sin importar", tono: "azul" },
  ERROR: { corta: "No se pudo leer", larga: "No se pudo leer", tono: "bad" },
  EN_PROCESO: { corta: "En proceso", larga: "En proceso", tono: "warn" },
  INTERRUMPIDA: { corta: "Interrumpida", larga: "Interrumpida", tono: "gris" },
};
export const etiquetaCarga = (r: ResultadoCarga) => (CARGA[r] || CARGA.ERROR);
export const PastillaCarga = ({ resultado }: { resultado: ResultadoCarga }) => <span className={`ex-etiqueta-carga ${etiquetaCarga(resultado).tono}`}>{etiquetaCarga(resultado).larga}</span>;
