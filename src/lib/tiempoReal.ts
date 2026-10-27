import { useEffect, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { API_URL, getEmpresaElegida, getToken } from "../api";

// Avisos en vivo del servidor (visita registrada, muestra cambiada, expedientes cargados...). Una sola conexión compartida por todo el panel:
// quien necesita enterarse se suscribe con `suscribir`, y cuando ya nadie escucha la conexión se cierra. Si se corta, el socket reintenta solo y
// quien depende de los avisos conserva su consulta periódica como respaldo. El servidor manda cada aviso solo a la empresa que corresponde.
type Oyente = (datos: unknown) => void;

// Lo que cambia las cifras del Resumen. «conectado» no lo manda el servidor: lo emitimos al (re)conectar para ponerse al día de lo que pasó mientras tanto.
export const EVENTOS_RESUMEN = ["visita_registrada", "muestra_actualizada", "expedientes_actualizados", "conectado"];

const oyentes = new Map<string, Set<Oyente>>();
const alCambiarEstado = new Set<() => void>();
let socket: Socket | null = null;
let clave = "";
let conectado = false;

const claveActual = () => `${getToken() || ""}|${getEmpresaElegida() || ""}`;
const hayOyentes = () => [...oyentes.values()].some((s) => s.size > 0);
const avisarEstado = () => alCambiarEstado.forEach((f) => f());
const ponerEstado = (valor: boolean) => { if (conectado !== valor) { conectado = valor; avisarEstado(); } };

function cerrar() {
  if (socket) { socket.removeAllListeners(); socket.disconnect(); }
  socket = null;
  clave = "";
  ponerEstado(false);
}

// Abre la conexión si hace falta, o la rehace si cambió la sesión o la empresa elegida por el administrador universal.
function asegurar() {
  const token = getToken();
  if (!token) { cerrar(); return; }
  if (socket && clave === claveActual()) return;
  cerrar();
  clave = claveActual();
  const nuevo = io(API_URL, { auth: { token, empresa: getEmpresaElegida() || undefined }, transports: ["websocket", "polling"] });
  socket = nuevo;
  nuevo.on("connect", () => { ponerEstado(true); oyentes.get("conectado")?.forEach((f) => f(null)); });
  nuevo.on("disconnect", () => ponerEstado(false));
  nuevo.on("connect_error", () => ponerEstado(false));
  nuevo.onAny((evento: string, datos: unknown) => oyentes.get(evento)?.forEach((f) => f(datos)));
}

export function suscribir(eventos: string[], fn: Oyente): () => void {
  for (const e of eventos) {
    if (!oyentes.has(e)) oyentes.set(e, new Set());
    oyentes.get(e)!.add(fn);
  }
  asegurar();
  return () => {
    for (const e of eventos) oyentes.get(e)?.delete(fn);
    if (!hayOyentes()) cerrar();
  };
}

// Por si cambió la sesión o la empresa elegida desde que se abrió la conexión.
export const revisarConexion = asegurar;
export const cerrarTiempoReal = cerrar;

// true mientras la conexión en vivo está abierta (si no, el panel se actualiza solo por su consulta periódica).
export function useEnVivo(): boolean {
  const [valor, setValor] = useState(conectado);
  useEffect(() => {
    const f = () => setValor(conectado);
    alCambiarEstado.add(f);
    f();
    return () => { alCambiarEstado.delete(f); };
  }, []);
  return valor;
}
