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
  if (m) return new Intl.DateTimeFormat("es-PE", { timeZone: "UTC", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00Z`));
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
  EVALUACION_POSTERIOR_AL_DESEMBOLSO: "La fecha de la evaluación es posterior al desembolso: la evaluación, los ingresos y las deudas de esta fila pueden ser de otro cliente. Pide el archivo otra vez con los datos de cada crédito en su misma fila.",
  DIRECCION_SIN_NUMERO: "La dirección no trae número de puerta: el mapa solo podrá ubicar la calle (precisión aproximada).",
  DIRECCION_MANZANA_LOTE: "La dirección es de manzana y lote (sin calle ni número): el mapa la ubica con baja precisión.",
  DIRECCION_SIN_TIPO_VIA: "La dirección no indica si es avenida, jirón, calle o pasaje.",
  DIRECCION_SIN_DISTRITO: "El expediente no trae distrito: sin él la dirección se confunde con otras iguales.",
  DIRECCION_CORTA: "La dirección es muy corta para ubicarla con precisión.",
  SIN_DIRECCION: "El expediente no trae dirección del domicilio.",
};

// Cómo quedó la dirección frente al mapa (ver src/modules/geocodificacion en el servidor).
export const GEO_ESTADO: Record<string, { etiqueta: string; tono: "ok" | "warn" | "bad" | "na" }> = {
  PENDIENTE: { etiqueta: "En cola para ubicar", tono: "na" },
  LOCALIZADO: { etiqueta: "Ubicada", tono: "ok" },
  REVISAR: { etiqueta: "Por revisar", tono: "warn" },
  NO_ENCONTRADO: { etiqueta: "No se encontró", tono: "bad" },
  ERROR: { etiqueta: "Falló la búsqueda", tono: "bad" },
  VERIFICADO: { etiqueta: "Verificada", tono: "ok" },
};

export const ORIGEN_UBICACION: Record<string, string> = {
  REFERENCIA: "Coordenadas de la base (escritas en la referencia)",
  MANUAL: "Fijada manualmente en el panel",
  PRIMERA_VISITA: "Tomada en la primera visita del auditor",
  GEOCODIFICADA: "Ubicada por el mapa (punto exacto con número y distrito)",
  MANZANA_VECINA: "Por manzana vecina: lotes de la misma manzana ya verificados en visitas anteriores",
};

export const ESTADO_NEGOCIO: Record<string, string> = {
  EN_FUNCIONAMIENTO: "En funcionamiento",
  INOPERATIVO: "Inoperativo",
  DE_TERCEROS: "De terceros",
};

export const PROPIEDAD_LOCAL: Record<string, string> = { PROPIO: "Propio", ALQUILADO: "Alquilado", FAMILIAR: "Familiar", OTRO: "Otro" };

export const PLANTILLA_NOMBRE: Record<string, string> = { MYPE_V1: "Ficha MYPE (créditos Otros)", CONSUMO_V1: "Ficha de Consumo" };

// Nombres de clientes como en el diseño («Quispe Huaman, Maria Elena»): la base del core los trae TODO EN MAYÚSCULAS, así que solo si vienen así se pasan a
// mayúscula inicial. Es solo cómo se muestran (los datos y la búsqueda no cambian). Las siglas de las empresas (S.A.C., E.I.R.L., SRL…) se respetan.
const SIGLAS = new Set(["SAC", "SRL", "EIRL", "SA", "SCRL", "SAA"]);
export function nombrePropio(nombre?: string | null) {
  if (!nombre) return "";
  if (nombre !== nombre.toLocaleUpperCase("es-PE")) return nombre;
  return nombre.replace(/[^\s,]+/g, (palabra) => {
    if (palabra.includes(".") || SIGLAS.has(palabra)) return palabra;
    return palabra.toLocaleLowerCase("es-PE").replace(/(^|[-'’])(\p{L})/gu, (_m, antes: string, letra: string) => antes + letra.toLocaleUpperCase("es-PE"));
  });
}

// ---- Identidad visual de las personas (iniciales y un color estable por nombre) ----
export const iniciales = (nombre?: string | null) =>
  (nombre || "?").trim().split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "?";

export const tonoAvatar = (nombre?: string | null) => {
  let h = 0;
  for (const c of String(nombre || "")) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return `av-${h % 6}`;
};

export const saludo = (hora = new Date().getHours()) => (hora < 12 ? "Buenos días" : hora < 19 ? "Buenas tardes" : "Buenas noches");

export const fechaLarga = (d = new Date()) => {
  const t = new Intl.DateTimeFormat("es-PE", { weekday: "long", day: "numeric", month: "long" }).format(d);
  return t.charAt(0).toUpperCase() + t.slice(1);
};

export const fechaCorta = (v: any) => (v ? new Intl.DateTimeFormat("es-PE", { day: "numeric", month: "short" }).format(new Date(v)) : "-");
export const horaCorta = (v: any) => (v ? new Intl.DateTimeFormat("es-PE", { hour: "2-digit", minute: "2-digit" }).format(new Date(v)) : "");
