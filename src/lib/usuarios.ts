import { useCallback } from "react";
import { enteroDe, useParametros } from "./useParametros";
import { FILAS_POR_DEFECTO, TAMANOS } from "./paginas";

// Lo que la pantalla Usuarios sabe de cada cuenta (lo que devuelve GET /api/usuarios) y cómo se muestra.
export type Usuario = {
  id: string; username: string; rol: string; estado: string; nombres: string; apellidos: string; email: string; departamento?: string;
  zona: null | { texto: string | null; distrito: string | null; provincia: string | null; departamento: string | null; en: string };
  ultimo_acceso: string | null; terminos: null | { version: string; fecha: string; plataforma?: string }; mfa_habilitado?: boolean;
};

export const nombreDe = (u: { nombres?: string; apellidos?: string; username: string }) => `${u.nombres || ""} ${u.apellidos || ""}`.trim() || u.username;

export const ROL: Record<string, { etiqueta: string; clase: "admin" | "sup" | "aud" }> = {
  ADMINISTRADOR: { etiqueta: "Administrador", clase: "admin" },
  UNIVERSAL: { etiqueta: "Administrador universal", clase: "admin" },
  SUPERVISOR: { etiqueta: "Supervisor", clase: "sup" },
  AUDITOR: { etiqueta: "Auditor", clase: "aud" },
};

// «Hoy», «Ayer» o la fecha; el momento exacto va en el título de la celda.
export function ultimoAcceso(iso?: string | null): { texto: string; titulo: string } {
  if (!iso) return { texto: "Nunca", titulo: "Todavía no ha iniciado sesión" };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { texto: "-", titulo: "" };
  const dia = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const hace = Math.round((dia(new Date()) - dia(d)) / 86_400_000);
  const titulo = d.toLocaleString("es-PE");
  if (hace <= 0) return { texto: "Hoy", titulo };
  if (hace === 1) return { texto: "Ayer", titulo };
  return { texto: d.toLocaleDateString("es-PE"), titulo };
}

// «19/10/2026, 5:22:14 pm» (el navegador escribe «p. m.»: se junta como en el diseño).
export function fechaHoraCorta(v?: string | null) {
  const d = v ? new Date(v) : null;
  if (!d || Number.isNaN(d.getTime())) return "-";
  const p: Record<string, string> = {};
  for (const x of new Intl.DateTimeFormat("es-PE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true }).formatToParts(d)) p[x.type] = x.value;
  return `${p.day}/${p.month}/${p.year}, ${p.hour}:${p.minute}:${p.second} ${(p.dayPeriod || "").replace(/[\s.  ]/g, "").toLowerCase()}`.trim();
}

// La zona de trabajo es la de su última jornada; quien nunca salió a campo muestra la zona habitual que tenía escrita, con el aviso.
export function zonaDe(u: Usuario): { texto: string; sub: string | null } {
  if (u.zona) return { texto: u.zona.texto || "Sin nombre de zona", sub: `Jornada del ${new Date(u.zona.en).toLocaleDateString("es-PE")}` };
  if (u.rol !== "AUDITOR") return { texto: "-", sub: null };
  return { texto: u.departamento || "-", sub: "Aún sin jornada" };
}

// Filtros de la lista de usuarios: viven en la URL (q, rol, pagina, filas); cambiar uno vuelve a la página 1.
const ROLES_FILTRO = ["AUDITOR", "SUPERVISOR", "ADMINISTRADOR"];
export function useFiltrosUsuarios() {
  const { params, fijar } = useParametros();
  const q = (params.get("q") || "").trim().slice(0, 100);
  const pedido = params.get("rol") || "";
  const rol = ROLES_FILTRO.includes(pedido) ? pedido : "";
  const pagina = enteroDe(params, "pagina", 1);
  const pedidas = enteroDe(params, "filas", FILAS_POR_DEFECTO, 1, 100);
  const filas = TAMANOS.includes(pedidas) ? pedidas : FILAS_POR_DEFECTO;
  const fijarQ = useCallback((v: string) => fijar({ q: v.trim(), pagina: null }), [fijar]);
  const fijarRol = useCallback((v: string) => fijar({ rol: v, pagina: null }), [fijar]);
  const irAPagina = useCallback((n: number) => fijar({ pagina: n > 1 ? n : null }), [fijar]);
  const fijarFilas = useCallback((n: number) => fijar({ filas: n !== FILAS_POR_DEFECTO ? n : null, pagina: null }), [fijar]);
  return { q, rol, pagina, filas, fijarQ, fijarRol, irAPagina, fijarFilas };
}
