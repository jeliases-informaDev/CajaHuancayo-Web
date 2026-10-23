// Piezas puras de la pantalla de Seguridad (sin React): tipos, armar la consulta, fechas locales y comparar el antes con el después de un cambio.

export type Gravedad = "INFO" | "AVISO" | "CRITICO";
export const GRAVEDAD: Record<Gravedad, string> = { INFO: "Información", AVISO: "Aviso", CRITICO: "Crítico" };

export const CATEGORIAS: { value: string; label: string }[] = [
  { value: "ACCESO", label: "Accesos" }, { value: "USUARIOS", label: "Usuarios" }, { value: "ASIGNACIONES", label: "Asignaciones" },
  { value: "EXPEDIENTES", label: "Expedientes" }, { value: "VISITAS", label: "Visitas" }, { value: "CONFIGURACION", label: "Configuración" },
  { value: "BORRADO", label: "Borrado de datos" }, { value: "CONSULTA", label: "Consultas de datos" }, { value: "OTRO", label: "Otros" },
];

export type Registro = {
  id_auditoria: string; fecha: string; actor: string; actor_nombre: string | null; rol: string | null;
  titulo: string; categoria: string; categoria_texto: string; severidad: Gravedad; accion: string;
  estado_http: number; resultado: "ok" | "error"; metodo: string; ruta: string;
  ip_address: string | null; plataforma: string | null; device_id: string | null; user_agent: string | null; request_id: string | null;
  entidad: string | null; entidad_id: string | null; con_cambios: boolean; valor_anterior: unknown; valor_nuevo: unknown;
};

export type Aviso = {
  id: string; tipo: string; severidad: Gravedad; titulo: string; detalle?: string; ultima?: string;
  filtro?: { categoria?: string; accion?: string; actor?: string; desde?: string }; enlace?: string; ancla?: string;
};

export type Metricas = {
  ventana: string; ventana_horas: number; total_eventos: number; errores: number; fallos_autenticacion: number; operaciones_criticas: number;
  cuentas_bloqueadas: number; retencion_dias: number; postura: { oficina_total: number; oficina_con_mfa: number; cuentas_sin_entrar_30d: number };
};

// Filtros del registro: viven en la URL (se pueden compartir y sobreviven a recargar). Las fechas son días locales (AAAA-MM-DD).
export type Filtros = { q: string; categoria: string; severidad: string; resultado: string; desde: string; hasta: string; cambios: boolean; actor: string; accion: string };
export const SIN_FILTROS: Filtros = { q: "", categoria: "", severidad: "", resultado: "", desde: "", hasta: "", cambios: false, actor: "", accion: "" };
export const hayFiltros = (f: Filtros) => Object.entries(f).some(([, v]) => Boolean(v));

const dos = (n: number) => String(n).padStart(2, "0");
// Día local de una fecha ISO (el aviso «últimas 24 horas» trae una hora; el campo de fecha solo entiende días).
export const diaLocal = (iso: string) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? "" : `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`; };
// Los límites de un día local, ya en ISO: «desde» a las 00:00 y «hasta» a las 23:59:59 de la hora de quien mira (no de UTC).
export function rangoIso(desde: string, hasta: string) {
  const parte = (dia: string, fin: boolean) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dia);
    if (!m) return undefined;
    const d = fin ? new Date(+m[1], +m[2] - 1, +m[3], 23, 59, 59, 999) : new Date(+m[1], +m[2] - 1, +m[3], 0, 0, 0, 0);
    return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
  };
  return { desde: parte(desde, false), hasta: parte(hasta, true) };
}

// La consulta al servidor con los filtros puestos (los vacíos no se mandan).
export function consultaDe(f: Filtros, extra: Record<string, string> = {}) {
  const p = new URLSearchParams();
  if (f.q.trim()) p.set("q", f.q.trim());
  if (f.categoria) p.set("categoria", f.categoria);
  if (f.severidad) p.set("severidad", f.severidad);
  if (f.resultado) p.set("resultado", f.resultado);
  if (f.cambios) p.set("solo_cambios", "true");
  if (f.actor) p.set("actor", f.actor);
  if (f.accion) p.set("accion", f.accion);
  const r = rangoIso(f.desde, f.hasta);
  if (r.desde) p.set("desde", r.desde);
  if (r.hasta) p.set("hasta", r.hasta);
  for (const [k, v] of Object.entries(extra)) p.set(k, v);
  return p;
}

// ---------------------------------------------------------------- el detalle de un cambio
const CAMPOS: Record<string, string> = {
  username: "Usuario", nombres: "Nombres", apellidos: "Apellidos", email: "Correo", sede: "Sede", departamento: "Zona", rol: "Rol", estado: "Estado",
  mfa_requerido: "Exige verificación en dos pasos", mfa_exento: "Exento de verificación en dos pasos", clave_cambiada: "Contraseña cambiada",
  activa: "Activada", activo: "Encendido", maximo: "Máximo de casos abiertos", quitadas: "Casos quitados", devueltas: "Devueltos a Disponibles",
  reasignadas: "Pasados a otro asesor", sin_cambio: "Ya visitados (sin cambio)", motivo: "Motivo", nota: "Nota", destino: "Destino", accion: "Acción",
  casos_activos: "Casos abiertos antes", alcance: "Alcance", archivo: "Archivo", simulacion: "Solo revisión (sin guardar)", autoasignable: "Disponibles para los asesores",
  id_usuario_destino: "Asesor que recibe", solo_elegidos: "Solo los elegidos", filas: "Filas exportadas", completo: "Descarga completa", filtros: "Filtros",
  prioridad: "Prioridad", id_expediente: "Expediente", id_usuario_auditor: "Asesor", liberados: "Casos liberados",
  codigo_expediente: "Código del expediente", tipo_credito: "Tipo de crédito", oficina: "Oficina", numero_documento_cliente: "Documento del cliente", nombres_cliente: "Cliente",
  distrito: "Distrito", provincia: "Provincia", asesor_responsable: "Asesor responsable", monto_desembolso: "Monto", latitud: "Latitud", longitud: "Longitud",
  ubicacion_origen: "Origen de la ubicación", negocio: "Negocio",
};
const ROL: Record<string, string> = { ADMINISTRADOR: "Administrador", SUPERVISOR: "Supervisor", AUDITOR: "Asesor de campo", UNIVERSAL: "Administrador universal" };
export const nombreRol = (r?: string | null) => ROL[r || ""] || r || "";
// Cuánto se conserva el registro, dicho como una persona: años si son años exactos, si no meses o días.
export function textoRetencion(dias: number) {
  if (!dias || dias <= 0) return "";
  if (dias >= 365 && dias % 365 === 0) { const a = dias / 365; return `${a} ${a === 1 ? "año" : "años"}`; }
  if (dias >= 60) { const m = Math.round(dias / 30.44); return `${m} meses`; }
  return `${dias} ${dias === 1 ? "día" : "días"}`;
}
const MOTIVO: Record<string, string> = { ENFERMEDAD: "Enfermedad", RETIRO: "Se retiró de la empresa", REASIGNACION: "Reasignación de carga", OTRO: "Otro motivo" };
const DESTINO: Record<string, string> = { DISPONIBLES: "Volver a Disponibles", ASESOR: "Otro asesor" };

export const nombreCampo = (campo: string) => CAMPOS[campo] || campo.replaceAll("_", " ");

export function valorLegible(campo: string, v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "Sí" : "No";
  if (typeof v === "number") return v.toLocaleString("es-PE");
  if (typeof v === "string") {
    if (campo === "rol") return ROL[v] || v;
    if (campo === "estado" && (v === "ACTIVO" || v === "INACTIVO")) return v === "ACTIVO" ? "Activo" : "Inactivo";
    if (campo === "motivo") return MOTIVO[v] || v;
    if (campo === "destino") return DESTINO[v] || v;
    return v;
  }
  return JSON.stringify(v);
}

export type Cambio = { campo: string; nombre: string; antes: string; despues: string };
// Solo lo que cambió: los campos que están en el antes o en el después y valen distinto. Una creación (sin «antes») muestra todo lo nuevo, y un borrado todo lo que había.
export function cambiosDe(anterior: unknown, nuevo: unknown): Cambio[] {
  const a = anterior && typeof anterior === "object" ? (anterior as Record<string, unknown>) : {};
  const n = nuevo && typeof nuevo === "object" ? (nuevo as Record<string, unknown>) : {};
  const claves = [...new Set([...Object.keys(n), ...Object.keys(a)])];
  return claves
    .filter((k) => JSON.stringify(a[k] ?? null) !== JSON.stringify(n[k] ?? null))
    .map((k) => ({ campo: k, nombre: nombreCampo(k), antes: valorLegible(k, a[k]), despues: valorLegible(k, n[k]) }));
}
