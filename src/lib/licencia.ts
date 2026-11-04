import { useEffect, useState } from "react";
import { getEmpresaElegida, request } from "../api";

// Licencia de GeoMatrix de la empresa (servicio común de licencias de Sulotec; GeoMatrix se licencia por usuarios). Se pide una vez y se comparte: la franja
// bajo la barra superior, Usuarios (cupo) y las pantallas que registran cambios la leen. El servidor es quien bloquea las escrituras; la interfaz solo lo explica.
// `null` = licencias apagadas o sin información: no se muestra nada.
export type EstadoLicencia = "ACTIVA" | "SOLO_LECTURA" | "SUSPENDIDA" | "CANCELADA" | "SIN_LICENCIA";
export type Licencia = {
  estado: EstadoLicencia;
  plan: string | null;
  usuarios_max: number | null;
  usuarios_activos: number | null;
  puede_crear_usuarios: boolean | null;
  vencimiento: string | null;
  dias_para_vencer: number | null;
  mensaje: string;
  enlace: string;
};

// Textos que comparten las pantallas: el motivo de un botón apagado y «Tu licencia ya usa M de N usuarios activos» (por qué no se crea ni se reactiva).
export const TITULO_SOLO_LECTURA = "La licencia está en solo lectura";
// Por qué está apagado un botón, según el estado real de la licencia (suspendida y cancelada no son «solo lectura»).
export const tituloBloqueo = (l: Licencia | null): string =>
  l?.estado === "SUSPENDIDA" ? "La licencia está suspendida" : l?.estado === "CANCELADA" ? "La licencia está cancelada" : TITULO_SOLO_LECTURA;
const num = (n: number) => n.toLocaleString("es-PE");
export const textoCupo = (l: Licencia) => (l.usuarios_max != null ? `Tu licencia ya usa ${num(l.usuarios_activos ?? 0)} de ${num(l.usuarios_max)} usuarios activos.` : "Tu licencia no permite más usuarios activos.");

const TTL = 60000; // una lectura por minuto como mucho; los cambios de usuarios la fuerzan
let cache: Licencia | null = null; // última licencia conocida
let cargado = false;
let deEmpresa = ""; // empresa de la que es `cache`: un administrador universal que cambia de empresa no debe ver la de la anterior
let empresaPedida = ""; // empresa y momento del último pedido (aunque haya fallado), para no repetir la llamada antes del TTL
let ultima = 0;
let generacion = 0; // sube al cerrar sesión: una respuesta que llegue después ya no vale
let enVuelo: Promise<void> | null = null;
const oyentes = new Set<() => void>();
const avisar = () => oyentes.forEach((f) => f());
const empresaActual = () => getEmpresaElegida() || "";

function leer(forzar = false): Promise<void> {
  const empresa = empresaActual();
  // Si hay un pedido en vuelo de otra empresa (el universal acaba de cambiar) o se pide forzar (el cupo acaba de cambiar), se espera y se vuelve a pedir.
  if (enVuelo) return !forzar && empresaPedida === empresa ? enVuelo : enVuelo.then(() => leer(forzar));
  if (!forzar && empresaPedida === empresa && Date.now() - ultima < TTL) return Promise.resolve();
  const gen = generacion;
  empresaPedida = empresa; ultima = Date.now();
  enVuelo = request<{ data: Licencia | null }>("/api/licencia")
    .then((r) => { if (gen !== generacion) return; cache = r.data ?? null; cargado = true; deEmpresa = empresa; })
    .catch(() => { /* se conserva la última licencia conocida; si nunca cargó sigue en null (sin franja) */ })
    .finally(() => { enVuelo = null; avisar(); });
  return enVuelo;
}

// Fuerza una nueva lectura (después de crear, activar, desactivar o eliminar usuarios: cambia el cupo).
export const refrescarLicencia = () => leer(true);
// Al cerrar sesión: que el siguiente usuario no vea la licencia del anterior.
export const olvidarLicencia = () => { generacion += 1; cache = null; cargado = false; deEmpresa = ""; empresaPedida = ""; ultima = 0; avisar(); };
// La misma licencia viene en /api/auth/me: se guarda de ahí para que la primera pintura no espere otra llamada.
export const recordarLicencia = (l: Licencia | null) => { cache = l; cargado = true; deEmpresa = empresaPedida = empresaActual(); ultima = Date.now(); avisar(); };

// `habilitado`: quién pregunta (dentro de una empresa; el universal solo después de elegir una). `soloLectura`: ver sí, registrar no (el servidor rechaza las
// escrituras). `puedeCrear`: hay cupo para crear o reactivar usuarios (sin licencia o sin control de cupo, siempre).
export function useLicencia(habilitado: boolean): { licencia: Licencia | null; cargado: boolean; soloLectura: boolean; puedeCrear: boolean } {
  const [, forzar] = useState(0);
  const empresa = empresaActual();
  useEffect(() => {
    if (!habilitado) return;
    const f = () => forzar((n) => n + 1);
    oyentes.add(f);
    void leer();
    return () => { oyentes.delete(f); };
  }, [habilitado, empresa]);
  const vigente = habilitado && cargado && deEmpresa === empresa;
  const licencia = vigente ? cache : null;
  const estado = licencia?.estado;
  return {
    licencia,
    cargado: vigente,
    soloLectura: estado === "SOLO_LECTURA" || estado === "SUSPENDIDA" || estado === "CANCELADA",
    puedeCrear: !licencia || estado === "SIN_LICENCIA" || licencia.puede_crear_usuarios !== false,
  };
}

// Si la franja bajo la barra superior (FranjaLicencia) se pinta: vencida, suspendida o cancelada para todos; sin licencia registrada solo a los administradores.
// Layout la usa para marcar .main-col con «con-franja»: Seguimiento y Asignaciones, que miden su alto con la ventana, le restan el alto de la franja.
export function hayFranja(licencia: Licencia | null, esAdmin: boolean): boolean {
  if (!licencia) return false;
  const { estado } = licencia;
  return estado === "SOLO_LECTURA" || estado === "SUSPENDIDA" || estado === "CANCELADA" || (estado === "SIN_LICENCIA" && esAdmin);
}
