export const dash = (v: any) => (v === null || v === undefined || v === "" ? "-" : String(v));

export const n2 = (v: any) =>
  v === null || v === undefined || v === "" || Number.isNaN(Number(v))
    ? "-"
    : Number(v).toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const entero = (v: any) =>
  v === null || v === undefined || v === "" || Number.isNaN(Number(v)) ? "-" : String(Math.round(Number(v)));

// 'AAAA-MM-DD' (como lo guarda el importador) → 'DD/MM/AAAA'. Otros formatos de fecha se muestran completos.
export function fecha(v: any) {
  if (!v) return "-";
  const m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleDateString("es-PE");
}

export const fechaHora = (v: any) => (v ? new Date(v).toLocaleString("es-PE") : "-");

export const variacion = (nuevo: any, anterior: any) => {
  const a = Number(anterior);
  const n = Number(nuevo);
  if (anterior == null || nuevo == null || !Number.isFinite(a) || !Number.isFinite(n) || a === 0) return "-";
  const pct = ((n - a) / Math.abs(a)) * 100;
  return `${pct > 0 ? "+" : ""}${pct.toFixed(1)} %`;
};

export const ADVERTENCIAS: Record<string, string> = {
  SIN_COORDENADAS: "La base no trae las coordenadas del domicilio. Fíjalas en la pestaña Trazabilidad o se tomarán en la primera visita.",
  TEXTO_DANADO: "El archivo perdió letras al exportarse (Ñ o acentos). Conviene pedir el archivo nuevamente en UTF-8.",
  DISTRITO_IGUAL_A_AGENCIA: "El distrito coincide con el de la agencia: puede no ser el distrito real del domicilio.",
  SIN_EVALUACION: "La base no trae evaluación financiera para este crédito.",
  DOCUMENTO_ATIPICO: "El documento del cliente no tiene 8, 9 u 11 dígitos.",
};

export const ORIGEN_UBICACION: Record<string, string> = {
  REFERENCIA: "Coordenadas de la base (escritas en la referencia)",
  MANUAL: "Fijada manualmente en el panel",
  PRIMERA_VISITA: "Tomada en la primera visita del auditor",
};

export const ESTADO_NEGOCIO: Record<string, string> = {
  EN_FUNCIONAMIENTO: "En funcionamiento",
  INOPERATIVO: "Inoperativo",
  DE_TERCEROS: "De terceros",
};

export const PROPIEDAD_LOCAL: Record<string, string> = { PROPIO: "Propio", ALQUILADO: "Alquilado", FAMILIAR: "Familiar", OTRO: "Otro" };

export const PLANTILLA_NOMBRE: Record<string, string> = { MYPE_V1: "Ficha MYPE (créditos Otros)", CONSUMO_V1: "Ficha de Consumo" };
