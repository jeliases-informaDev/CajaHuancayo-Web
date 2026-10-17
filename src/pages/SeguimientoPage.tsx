import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle, CircleMarker, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { io, Socket } from "socket.io-client";
import "leaflet/dist/leaflet.css";
import { API_URL, getToken, request } from "../api";
import { Avatar, Field } from "../components/ui";
import { horaCorta } from "../lib/format";

type Ubicacion = {
  id: string; username: string; nombres: string; apellidos: string; rol: string;
  latitud: number | null; longitud: number | null;
  actualizado_en?: string | null; precision?: number | null; simulada?: boolean;
  en_jornada?: boolean; jornada_inicio?: string | null; jornada_fin?: string | null;
  bateria?: number | null; cargando?: boolean; movimiento?: Movimiento | null;
};
type Punto = { latitud: number; longitud: number; precision: number | null; fecha: string };
type Asignacion = {
  id_asignacion: number; id_usuario_auditor: string; prioridad: string; expediente: any;
  auditor?: { id_usuario: string; username: string; nombres: string; apellidos: string } | null;
};
type AuditorInfo = {
  id: string; username: string; nombres: string; apellidos: string; rol: string;
  latitud: number | null; longitud: number | null; enVivo: boolean;
  actualizadoEn: string | null; precision: number | null; simulada: boolean;
  enJornada: boolean; jornadaInicio: string | null; jornadaFin: string | null;
  bateria: number | null; cargando: boolean; movimiento: Movimiento | null;
};

// Aviso de llegada o salida: el auditor entró al radio de un cliente (o de su negocio) o se alejó de él.
type EventoCampo = {
  id: string; tipo: "LLEGADA" | "SALIDA"; fecha: string; distancia_m: number | null;
  id_usuario: string; auditor: string; id_expediente: number; codigo_expediente: string | null;
  cliente: string | null; punto: string; direccion: string | null;
};
// Cómo se está moviendo el auditor, calculado por el servidor con sus últimos puntos (no depende de nada extra del celular).
type Movimiento = { estado: "SIN_DATOS" | "DETENIDO" | "EN_MOVIMIENTO"; desde: string | null; velocidad_kmh: number | null; modo: "A_PIE" | "VEHICULO" | "SALTO_GPS" | null };
function textoMovimiento(m: Movimiento | null | undefined, ahoraMs: number): string | null {
  if (!m || m.estado === "SIN_DATOS") return null;
  if (m.estado === "DETENIDO" && m.desde) {
    const min = Math.max(0, Math.floor((ahoraMs - Date.parse(m.desde)) / 60000));
    return min >= 60 ? "Detenido hace más de 1 h" : "Detenido hace " + min + " min";
  }
  if (m.modo === "SALTO_GPS") return "Salto de GPS: posición imposible";
  if (m.modo === "VEHICULO") return "En vehículo · " + Math.round(m.velocidad_kmh ?? 0) + " km/h";
  if (m.modo === "A_PIE") return "A pie · " + Math.round(m.velocidad_kmh ?? 0) + " km/h";
  return null;
}
const horaConSegundos = (iso: string) => new Date(iso).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
// Tramos del recorrido en los que no llegó ninguna posición durante más de 5 min (sin señal, sin batería o app cerrada).
type Pausa = { desde: string; hasta: string; minutos: number };
function pausasSinSenal(puntos: { fecha: string }[]): Pausa[] {
  const lista: Pausa[] = [];
  for (let i = 1; i < puntos.length; i += 1) {
    const dt = (Date.parse(puntos[i].fecha) - Date.parse(puntos[i - 1].fecha)) / 1000;
    if (dt > 300) lista.push({ desde: puntos[i - 1].fecha, hasta: puntos[i].fecha, minutos: Math.round(dt / 60) });
  }
  return lista;
}

// Con 15 % o menos y sin cargador, el celular está por apagarse: el supervisor debe saberlo antes de que se pierda la señal.
const bateriaBaja = (u: { bateria: number | null; cargando: boolean }) => u.bateria != null && u.bateria <= 15 && !u.cargando;

// Qué tan fresca es la última posición de un auditor: «en vivo» (llegó hace menos de 45 s, la app envía cada ~7 s),
// «reciente» (menos de 5 min) o «sin señal» (más antigua o sin hora guardada).
type Frescura = "VIVO" | "RECIENTE" | "SIN_SENAL" | "SIN_UBICACION";
function frescuraDe(u: { latitud: number | null; actualizadoEn: string | null }, ahoraMs: number): { estado: Frescura; segundos: number | null } {
  if (u.latitud == null) return { estado: "SIN_UBICACION", segundos: null };
  if (!u.actualizadoEn) return { estado: "SIN_SENAL", segundos: null };
  const segundos = Math.max(0, Math.round((ahoraMs - Date.parse(u.actualizadoEn)) / 1000));
  return { estado: segundos < 45 ? "VIVO" : segundos < 300 ? "RECIENTE" : "SIN_SENAL", segundos };
}
function haceTexto(s: number | null) {
  if (s == null) return "sin hora registrada";
  if (s < 60) return `hace ${s} s`;
  if (s < 3600) return `hace ${Math.floor(s / 60)} min`;
  if (s < 86400) return `hace ${Math.floor(s / 3600)} h`;
  return `hace ${Math.floor(s / 86400)} d`;
}

const CENTER: [number, number] = [-9.19, -75.0152]; // vista nacional: el mapa se encuadra solo en cuanto hay auditores o clientes
const RUTA_COLOR = "#0f9d6c";
const INICIO_COLOR = "#2d41c4";
const DISPONIBLE_COLOR = "#334155";
const PRIORIDAD_COLORS: Record<string, string> = { ALTA: "#ef4444", MEDIA: "#f59e0b", BAJA: "#6d788a" };

function colorForRol(rol: string) {
  return rol === "SUPERVISOR" ? "#2c70e8" : "#0ead7a";
}

// El color del pin sigue al rol; el anillo dice la frescura: pulsa si está en vivo, gris si se perdió la señal y rojo si el GPS es simulado.
function markerIcon(rol: string, estado: Frescura = "VIVO", simulada = false) {
  const color = estado === "SIN_SENAL" ? "#94a3b8" : colorForRol(rol);
  const anillo = simulada ? "0 0 0 3px #d92d20" : `0 0 0 2px ${color}66`;
  const pulso = estado === "VIVO" && !simulada ? "animation:pulso-gps 1.8s ease-out infinite;" : "";
  return L.divIcon({
    className: "",
    html: `<div class="${estado === "VIVO" ? "gps-vivo" : ""}" style="width:16px;height:16px;border-radius:50%;background:${color};border:3px solid #fff;box-shadow:${anillo};${pulso}"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

// Punto de partida del auditor: pin celeste tipo "gota" (mismo lenguaje visual que
// el resto del panel), distinto de los paraditas verdes numeradas de la ruta.
const inicioIcon = L.divIcon({
  className: "",
  html: `<div style="width:26px;height:26px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${INICIO_COLOR};border:3px solid #fff;box-shadow:0 2px 8px rgba(18,54,199,.45)"></div>`,
  iconSize: [26, 26],
  iconAnchor: [13, 26],
});

// Paradas "en ruta": burbuja verde numerada, ordenadas por cercanía (vecino más próximo)
// desde la posición del auditor — mismo lenguaje visual que Mi Radar 360.
function routeStopIcon(n: number) {
  return L.divIcon({
    className: "",
    html: `<div style="width:24px;height:24px;border-radius:50%;background:${RUTA_COLOR};border:2px solid #fff;box-shadow:0 2px 6px rgba(14,173,122,.45);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:11px;font-family:inherit">${n}</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}

// Clientes de la zona que no forman parte de la ruta numerada de un auditor puntual:
// punto coloreado por prioridad, para poder ver de un vistazo todos los clientes del
// bloque geográfico (de cualquier auditor) sin necesidad de elegir a alguien primero.
function clienteIcon(prioridad: string) {
  const color = PRIORIDAD_COLORS[prioridad] || DISPONIBLE_COLOR;
  return L.divIcon({
    className: "",
    html: `<div style="width:13px;height:13px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 0 0 1px ${color}66"></div>`,
    iconSize: [13, 13],
    iconAnchor: [6, 6],
  });
}

// Ordena los puntos como una ruta real: en cada paso, salta al más cercano a la
// posición actual (vecino más próximo), partiendo del auditor.
function ordenarPorRuta<T extends { latitud: number; longitud: number }>(
  origen: { latitud: number; longitud: number }, puntos: T[]
): (T & { orden: number; distanciaDesdeAsesor: number })[] {
  const restantes = [...puntos];
  const ordenados: (T & { orden: number; distanciaDesdeAsesor: number })[] = [];
  let actual = origen;
  let orden = 1;
  while (restantes.length) {
    let idxMin = 0;
    let distMin = Infinity;
    restantes.forEach((p, i) => {
      const d = distanciaMetros(actual.latitud, actual.longitud, p.latitud, p.longitud);
      if (d < distMin) { distMin = d; idxMin = i; }
    });
    const [siguiente] = restantes.splice(idxMin, 1);
    ordenados.push({
      ...siguiente,
      orden: orden++,
      distanciaDesdeAsesor: distanciaMetros(origen.latitud, origen.longitud, siguiente.latitud, siguiente.longitud),
    });
    actual = siguiente;
  }
  return ordenados;
}

function fmtDistancia(m: number | null | undefined) {
  if (m == null) return "-";
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(2)} km`;
}

// Distancia entre dos coordenadas (Haversine), en metros — mismo criterio que el backend.
function distanciaMetros(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Encuadra el mapa. Con «clave» solo se vuelve a encuadrar cuando esa clave cambia (p. ej. al elegir otro auditor), no en cada posición
// nueva: así el mapa no se mueve solo mientras el supervisor está mirando o haciendo zoom.
function FitBounds({ coords, clave }: { coords: [number, number][]; clave?: string }) {
  const map = useMap();
  useEffect(() => {
    if (coords.length) map.fitBounds(coords, { padding: [60, 60], maxZoom: 15 });
  }, [clave ?? coords.length, clave ?? coords.map((c) => c.join(",")).join("|")]);
  return null;
}

// Cuando el auditor elegido no está transmitiendo ubicación en vivo no hay ningún
// pin de inicio que arrastrar, así que se deja tocar el mapa directamente para
// fijar un punto de partida manual y poder planificar igual su ruta del día.
// Durante la reproducción del recorrido el mapa sigue al punto, para que no se salga de la vista.
function SeguirPunto({ latitud, longitud }: { latitud: number; longitud: number }) {
  const map = useMap();
  useEffect(() => { map.panTo([latitud, longitud], { animate: true, duration: 0.2 }); }, [latitud, longitud]);
  return null;
}

function ClickParaIniciar({ activo, onClick }: { activo: boolean; onClick: (p: { latitud: number; longitud: number }) => void }) {
  useMapEvents({
    click(e) {
      if (activo) onClick({ latitud: e.latlng.lat, longitud: e.latlng.lng });
    },
  });
  return null;
}

export default function SeguimientoPage() {
  const [ubicaciones, setUbicaciones] = useState<Ubicacion[]>([]);
  const [asignaciones, setAsignaciones] = useState<Asignacion[]>([]);
  const [seleccionado, setSeleccionado] = useState<string | null>(null);
  const [departamentoFiltro, setDepartamentoFiltro] = useState("TODOS");
  const [provinciaFiltro, setProvinciaFiltro] = useState("TODOS");
  const [distritoFiltro, setDistritoFiltro] = useState("TODOS");
  const [ruta, setRuta] = useState<Punto[]>([]);
  const [error, setError] = useState("");
  // Punto de partida simulado: se arrastra el pin de inicio para planificar "¿y si
  // empieza desde aquí?" sin tocar la ubicación real en vivo del auditor.
  const [puntoManual, setPuntoManual] = useState<{ latitud: number; longitud: number } | null>(null);
  const socketRef = useRef<Socket | null>(null);
  // Hora del servidor menos la de esta PC, para medir la antigüedad de cada posición aunque el reloj de la PC esté desfasado.
  const offsetRef = useRef(0);
  const [ahoraMs, setAhoraMs] = useState(() => Date.now());
  const [eventos, setEventos] = useState<EventoCampo[]>([]);
  // Recorrido real del auditor elegido: día, momento que se está viendo (null = ver todo) y reproducción automática.
  const hoy = () => new Date().toLocaleDateString("en-CA"); // AAAA-MM-DD en hora local
  const [fechaRuta, setFechaRuta] = useState(hoy);
  const [idxRepeticion, setIdxRepeticion] = useState<number | null>(null);
  const [reproduciendo, setReproduciendo] = useState(false);

  const load = async () => {
    try {
      const [ubis, asigs, evs]: any[] = await Promise.all([
        request("/api/usuarios/ubicaciones"),
        request("/api/asignaciones?estado=ACTIVA&limit=300"),
        request("/api/usuarios/eventos").catch(() => ({ data: null })), // los avisos no deben tumbar el mapa si fallan
      ]);
      if (ubis.ahora) { offsetRef.current = Date.parse(ubis.ahora) - Date.now(); setAhoraMs(Date.now() + offsetRef.current); }
      setUbicaciones(ubis.data);
      setAsignaciones(asigs.data);
      if (evs.data) setEventos(evs.data);
    } catch (e: any) {
      setError(e.message);
    }
  };

  useEffect(() => {
    load();
    const token = getToken();
    if (!token) return;
    const socket = io(API_URL, { auth: { token }, transports: ["websocket", "polling"] });
    socketRef.current = socket;
    // El auditor inicia o termina su jornada: se refleja al instante (aunque todavía no haya mandado ninguna posición).
    socket.on("jornada_actualizada", (data: any) => {
      setUbicaciones((prev) => {
        const base = prev.find((u) => u.id === data.id_usuario) || { id: data.id_usuario, username: data.username, nombres: data.nombres || "", apellidos: data.apellidos || "", rol: "AUDITOR", latitud: null, longitud: null };
        const nuevo: Ubicacion = { ...base, en_jornada: Boolean(data.en_jornada), jornada_inicio: data.jornada_inicio ?? null, jornada_fin: data.jornada_fin ?? null };
        return prev.some((u) => u.id === nuevo.id) ? prev.map((u) => (u.id === nuevo.id ? nuevo : u)) : [...prev, nuevo];
      });
    });
    socket.on("ubicacion_actualizada", (data: any) => {
      setUbicaciones((prev) => {
        const actualizado: Ubicacion = {
          id: data.id_usuario, username: data.username,
          nombres: data.nombres || "", apellidos: data.apellidos || "",
          rol: data.rol || "", latitud: Number(data.latitud), longitud: Number(data.longitud),
          actualizado_en: data.actualizado_en || data.fecha || new Date(Date.now() + offsetRef.current).toISOString(),
          precision: data.precision ?? null, simulada: Boolean(data.simulada),
          bateria: data.bateria ?? null, cargando: Boolean(data.cargando),
        };
        const idx = prev.findIndex((u) => u.id === actualizado.id);
        if (idx === -1) return [...prev, actualizado];
        const next = [...prev];
        next[idx] = { ...next[idx], ...actualizado }; // conserva el estado de jornada que ya se conocía
        return next;
      });
    });
    // Llegada o salida de un cliente: entra al principio de la lista al instante.
    socket.on("evento_campo", (e: EventoCampo) => setEventos((prev) => (prev.some((x) => x.id === e.id) ? prev : [e, ...prev].slice(0, 300))));
    // El socket trae cada posición al instante; este refresco solo cubre cortes de conexión. El segundero actualiza «hace X s».
    const timer = setInterval(load, 10000);
    const reloj = setInterval(() => setAhoraMs(Date.now() + offsetRef.current), 5000);
    return () => { socket.disconnect(); clearInterval(timer); clearInterval(reloj); };
  }, []);

  useEffect(() => {
    setIdxRepeticion(null); setReproduciendo(false);
    if (!seleccionado) { setRuta([]); return; }
    request("/api/usuarios/" + seleccionado + "/tracking?fecha=" + fechaRuta)
      .then((r: any) => setRuta(r.data))
      .catch(() => setRuta([]));
  }, [seleccionado, fechaRuta]);
  // Reproducción: un punto cada 250 ms hasta el final del día.
  useEffect(() => {
    if (!reproduciendo) return;
    const t = setInterval(() => setIdxRepeticion((i) => Math.min((i ?? 0) + 1, ruta.length - 1)), 250);
    return () => clearInterval(t);
  }, [reproduciendo, ruta.length]);
  useEffect(() => { if (reproduciendo && idxRepeticion != null && idxRepeticion >= ruta.length - 1) setReproduciendo(false); }, [reproduciendo, idxRepeticion, ruta.length]);

  // El filtro de zona es independiente de a quién elijas (ver más abajo): al cambiar
  // de auditor solo se limpia el punto de partida simulado, que es propio de esa
  // planificación puntual.
  useEffect(() => { setPuntoManual(null); }, [seleccionado]);

  // El roster de auditores se arma a partir de las asignaciones (quién pertenece a
  // cada zona, tenga o no el GPS prendido en este momento) y se le superpone la
  // ubicación en vivo de quienes sí la están transmitiendo ahora mismo — así un
  // auditor no "desaparece" de su zona solo porque no tiene la app abierta.
  const auditorPorId = useMemo(() => {
    const mapa = new Map<string, AuditorInfo>();
    asignaciones.forEach((a) => {
      if (!a.auditor || mapa.has(a.auditor.id_usuario)) return;
      mapa.set(a.auditor.id_usuario, {
        id: a.auditor.id_usuario, username: a.auditor.username,
        nombres: a.auditor.nombres || "", apellidos: a.auditor.apellidos || "",
        rol: "AUDITOR", latitud: null, longitud: null, enVivo: false, actualizadoEn: null, precision: null, simulada: false,
        enJornada: false, jornadaInicio: null, jornadaFin: null, bateria: null, cargando: false, movimiento: null,
      });
    });
    ubicaciones.forEach((u) => {
      const previo = mapa.get(u.id);
      mapa.set(u.id, {
        id: u.id, username: u.username,
        nombres: u.nombres || previo?.nombres || "", apellidos: u.apellidos || previo?.apellidos || "",
        rol: u.rol || previo?.rol || "AUDITOR",
        latitud: u.latitud, longitud: u.longitud,
        enVivo: u.latitud != null && u.longitud != null,
        actualizadoEn: u.actualizado_en ?? null, precision: u.precision ?? null, simulada: Boolean(u.simulada),
        enJornada: Boolean(u.en_jornada), jornadaInicio: u.jornada_inicio ?? null, jornadaFin: u.jornada_fin ?? null,
        bateria: u.bateria ?? null, cargando: Boolean(u.cargando), movimiento: u.movimiento ?? null,
      });
    });
    return mapa;
  }, [asignaciones, ubicaciones]);
  const todosLosAuditores = useMemo(() => Array.from(auditorPorId.values()), [auditorPorId]);
  const polyline = useMemo<[number, number][]>(() => ruta.map((p) => [p.latitud, p.longitud]), [ruta]);
  const pausas = useMemo(() => pausasSinSenal(ruta), [ruta]);
  const puntoRepeticion = idxRepeticion != null && ruta[idxRepeticion] ? ruta[idxRepeticion] : null;
  const rutaRecorrida = useMemo<[number, number][]>(() => (idxRepeticion == null ? [] : ruta.slice(0, idxRepeticion + 1).map((p) => [p.latitud, p.longitud] as [number, number])), [ruta, idxRepeticion]);
  const alternarReproduccion = () => {
    if (reproduciendo) { setReproduciendo(false); return; }
    if (idxRepeticion == null || idxRepeticion >= ruta.length - 1) setIdxRepeticion(0);
    setReproduciendo(true);
  };

  const auditorSeleccionado = (seleccionado && auditorPorId.get(seleccionado)?.enVivo ? auditorPorId.get(seleccionado) : null) || null;
  const origenRuta = useMemo(() => {
    if (puntoManual) return puntoManual;
    if (auditorSeleccionado) return { latitud: auditorSeleccionado.latitud as number, longitud: auditorSeleccionado.longitud as number };
    return null;
  }, [puntoManual, auditorSeleccionado]);

  // Todos los clientes con expediente asignado y ubicación, de TODOS los auditores —
  // el filtro de zona (departamento/provincia/distrito) es la vista principal de esta
  // pantalla: sirve para ver quiénes (auditores) y qué (clientes) hay en un bloque
  // geográfico, no para armar un recorrido que salte de una ciudad a otra.
  const todosLosClientes = useMemo(() => {
    return asignaciones
      .filter((a) => a.expediente?.latitud != null && a.expediente?.longitud != null)
      .map((a) => ({ ...a, latitud: Number(a.expediente.latitud), longitud: Number(a.expediente.longitud) }));
  }, [asignaciones]);

  // Filtro geográfico en cascada: cada nivel solo ofrece las opciones que existen
  // dentro del nivel superior ya elegido, para no mostrar una lista plana de
  // decenas de distritos de todo el país.
  const departamentos = useMemo(
    () => Array.from(new Set(todosLosClientes.map((a) => a.expediente.departamento).filter(Boolean))).sort(),
    [todosLosClientes]
  );
  const enDepartamento = useMemo(
    () => todosLosClientes.filter((a) => departamentoFiltro === "TODOS" || a.expediente.departamento === departamentoFiltro),
    [todosLosClientes, departamentoFiltro]
  );
  const provincias = useMemo(
    () => Array.from(new Set(enDepartamento.map((a) => a.expediente.provincia).filter(Boolean))).sort(),
    [enDepartamento]
  );
  const enProvincia = useMemo(
    () => enDepartamento.filter((a) => provinciaFiltro === "TODOS" || a.expediente.provincia === provinciaFiltro),
    [enDepartamento, provinciaFiltro]
  );
  const distritos = useMemo(
    () => Array.from(new Set(enProvincia.map((a) => a.expediente.distrito).filter(Boolean))).sort(),
    [enProvincia]
  );
  const clientesEnZona = useMemo(
    () => enProvincia.filter((a) => distritoFiltro === "TODOS" || a.expediente.distrito === distritoFiltro),
    [enProvincia, distritoFiltro]
  );
  const zonaActiva = departamentoFiltro !== "TODOS";

  const clientesPorAuditor = useMemo(() => {
    const mapa = new Map<string, number>();
    clientesEnZona.forEach((a) => mapa.set(a.id_usuario_auditor, (mapa.get(a.id_usuario_auditor) || 0) + 1));
    return mapa;
  }, [clientesEnZona]);

  // La lista de "quién pertenece a esta zona" se arma desde el roster completo
  // (todosLosAuditores), no solo desde quienes tienen el GPS prendido ahora — un
  // auditor de Lima no debe desaparecer de la lista solo por no estar transmitiendo
  // ubicación en este momento.
  const auditoresVisibles = useMemo(
    () => (zonaActiva ? todosLosAuditores.filter((u) => clientesPorAuditor.has(u.id)) : todosLosAuditores),
    [zonaActiva, todosLosAuditores, clientesPorAuditor]
  );
  // Para los pines del mapa sí hace falta una ubicación real.
  const auditoresConMapa = useMemo(() => auditoresVisibles.filter((u) => u.enVivo), [auditoresVisibles]);

  // Clientes del auditor puntualmente seleccionado, ya acotados a la zona elegida.
  const clientesDelAuditorSeleccionado = useMemo(
    () => (seleccionado ? clientesEnZona.filter((a) => a.id_usuario_auditor === seleccionado) : []),
    [clientesEnZona, seleccionado]
  );
  const departamentosDelAuditorSeleccionado = useMemo(
    () => Array.from(new Set(clientesDelAuditorSeleccionado.map((a) => a.expediente.departamento).filter(Boolean))),
    [clientesDelAuditorSeleccionado]
  );
  // Si no se eligió un departamento puntual y ese auditor tiene clientes repartidos
  // en más de uno, no tiene sentido sugerirle una ruta que los cruce a todos (p. ej.
  // Lima -> Huancayo -> Junín en un mismo día): se le pide elegir uno primero.
  const rutaBloqueadaPorAlcance = !zonaActiva && departamentosDelAuditorSeleccionado.length > 1;

  // Ruta sugerida: desde el punto de partida (real o simulado), salta siempre al
  // cliente más cercano restante — el mismo criterio "en ruta" que Mi Radar 360.
  const enRuta = useMemo(() => {
    if (!origenRuta || !seleccionado || rutaBloqueadaPorAlcance) return [];
    return ordenarPorRuta(origenRuta, clientesDelAuditorSeleccionado);
  }, [origenRuta, seleccionado, clientesDelAuditorSeleccionado, rutaBloqueadaPorAlcance]);

  const idsEnRuta = useMemo(() => new Set(enRuta.map((a) => a.id_asignacion)), [enRuta]);
  // Todo lo que se ve en el mapa como punto de color por prioridad en vez de parada
  // numerada: los clientes de otros auditores de la zona, o los de este auditor
  // cuando su ruta está bloqueada por abarcar varios departamentos.
  const clientesSinRuta = useMemo(
    () => clientesEnZona.filter((a) => !idsEnRuta.has(a.id_asignacion)),
    [clientesEnZona, idsEnRuta]
  );

  const rutaSugerida = useMemo<[number, number][]>(() => {
    if (!origenRuta || !enRuta.length) return [];
    return [[origenRuta.latitud, origenRuta.longitud], ...enRuta.map((a) => [a.latitud, a.longitud] as [number, number])];
  }, [origenRuta, enRuta]);

  // Con un auditor elegido el mapa se centra en él y en sus clientes (no en todo el país); sin elegir, en todos.
  const fitCoords = useMemo<[number, number][]>(() => (origenRuta && seleccionado
    ? [[origenRuta.latitud, origenRuta.longitud] as [number, number], ...clientesDelAuditorSeleccionado.map((a) => [a.latitud, a.longitud] as [number, number])]
    : [
      ...auditoresConMapa.map((u) => [u.latitud as number, u.longitud as number] as [number, number]),
      ...clientesEnZona.map((a) => [a.latitud, a.longitud] as [number, number]),
    ]), [auditoresConMapa, clientesEnZona, origenRuta, seleccionado, clientesDelAuditorSeleccionado]);
  const fitClave = origenRuta && seleccionado ? `sel:${seleccionado}:${clientesDelAuditorSeleccionado.length}` : undefined;

  const frescura = (u: AuditorInfo) => frescuraDe(u, ahoraMs);
  const enVivo = auditoresConMapa.filter((u) => frescura(u).estado === "VIVO").length;
  const conSenalAntigua = auditoresConMapa.length - enVivo;
  // Quien está transmitiendo ahora va primero; después los de señal reciente, los de señal antigua y los que nunca transmitieron.
  // Quien perdió la señal en plena jornada va primero: es lo que el supervisor debe atender.
  // (o si inició la jornada hace más de 2 min y todavía no mandó ninguna posición)
  const sinPosicionDesdeInicio = (u: AuditorInfo) => u.enJornada && frescura(u).estado === "SIN_UBICACION" && u.jornadaInicio != null && ahoraMs - Date.parse(u.jornadaInicio) > 120_000;
  const perdioSenal = (u: AuditorInfo) => u.enJornada && (frescura(u).estado === "SIN_SENAL" || sinPosicionDesdeInicio(u));
  const perdieron = todosLosAuditores.filter(perdioSenal).length;
  const rango: Record<Frescura, number> = { VIVO: 0, RECIENTE: 1, SIN_SENAL: 2, SIN_UBICACION: 3 };
  const prioridad = (u: AuditorInfo) => (perdioSenal(u) ? -1 : rango[frescura(u).estado]);
  const eventosVisibles = seleccionado ? eventos.filter((e) => e.id_usuario === seleccionado) : eventos;
  const auditoresOrdenados = [...auditoresVisibles].sort((a, b) => prioridad(a) - prioridad(b) || `${a.nombres} ${a.apellidos}`.localeCompare(`${b.nombres} ${b.apellidos}`));

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Seguimiento <em>en vivo</em></h1>
          <p>Filtra por zona para ver qué auditores y qué clientes hay en cada bloque geográfico. Elige un auditor para ver su ruta sugerida del día.</p>
        </div>
        <div className="actions"><span className={`live${enVivo ? " on" : ""}`} role="status">{enVivo ? `${enVivo} ${enVivo === 1 ? "auditor transmite" : "auditores transmiten"} su ubicación en vivo` : "Nadie transmite ubicación en vivo ahora"}{conSenalAntigua ? ` · ${conSenalAntigua} con señal antigua` : ""}{perdieron ? ` · ⚠ ${perdieron} sin señal en plena jornada` : ""}</span></div>
      </div>
      {error ? <div role="alert" className="error-box">{error}</div> : null}

      <div className="seg-layout">
        <aside className="seg-side" aria-label="Zona, auditores y ruta">
          <h2 className="section-title">Zona</h2>
          {departamentos.length ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <Field label="Departamento">
                <select name="departamento" value={departamentoFiltro} onChange={(e) => { setDepartamentoFiltro(e.target.value); setProvinciaFiltro("TODOS"); setDistritoFiltro("TODOS"); }}>
                  <option value="TODOS">Todos ({todosLosClientes.length})</option>
                  {departamentos.map((d) => (
                    <option key={d} value={d}>{d} ({todosLosClientes.filter((a) => a.expediente.departamento === d).length})</option>
                  ))}
                </select>
              </Field>
              {provincias.length > 1 ? (
                <Field label="Provincia">
                  <select name="provincia" value={provinciaFiltro} onChange={(e) => { setProvinciaFiltro(e.target.value); setDistritoFiltro("TODOS"); }}>
                    <option value="TODOS">Todas ({enDepartamento.length})</option>
                    {provincias.map((p) => (
                      <option key={p} value={p}>{p} ({enDepartamento.filter((a) => a.expediente.provincia === p).length})</option>
                    ))}
                  </select>
                </Field>
              ) : null}
              {distritos.length > 1 ? (
                <Field label="Distrito">
                  <select name="distrito" value={distritoFiltro} onChange={(e) => setDistritoFiltro(e.target.value)}>
                    <option value="TODOS">Todos ({enProvincia.length})</option>
                    {distritos.map((d) => (
                      <option key={d} value={d}>{d} ({enProvincia.filter((a) => a.expediente.distrito === d).length})</option>
                    ))}
                  </select>
                </Field>
              ) : null}
            </div>
          ) : <p className="subtle">Aún no hay expedientes asignados con ubicación registrada.</p>}

          <h2 className="section-title">Auditores{zonaActiva ? ` en ${departamentoFiltro}` : ""} ({auditoresVisibles.length})</h2>
          {!auditoresVisibles.length ? (
            <p className="subtle">{zonaActiva ? "Ningún auditor tiene clientes en esta zona." : "Nadie tiene casos asignados con ubicación todavía."}</p>
          ) : null}
          <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 340, overflowY: "auto", overscrollBehavior: "contain" }}>
            {auditoresOrdenados.map((u) => {
              const nombreU = `${u.nombres || u.username} ${u.apellidos}`.trim();
              const f = frescura(u);
              const hace = haceTexto(f.segundos);
              // Dentro de la jornada, no tener señal es una alerta; fuera de ella solo es información.
              const etiqueta = u.enJornada
                ? (f.estado === "VIVO" ? `En jornada · en vivo ${hace}` : f.estado === "RECIENTE" ? `En jornada · reciente ${hace}` : f.estado === "SIN_UBICACION" ? (sinPosicionDesdeInicio(u) ? "Perdió la señal en plena jornada · no mandó ninguna posición" : "En jornada · esperando su primera posición") : `Perdió la señal en plena jornada · última ${hace}`)
                : (f.estado === "VIVO" ? `En vivo · ${hace}` : f.estado === "RECIENTE" ? `Reciente · ${hace}` : f.estado === "SIN_SENAL" ? `Fuera de jornada · última ${hace}${u.jornadaFin ? ` (terminó ${horaCorta(u.jornadaFin)})` : ""}` : "Sin GPS ahora");
              const simulada = u.simulada && f.estado !== "SIN_UBICACION";
              const mov = f.estado !== "SIN_SENAL" ? textoMovimiento(u.movimiento, ahoraMs) : null;
              const enVisita = eventos.find((x) => x.id_usuario === u.id); // el aviso más reciente: si es una llegada, sigue en la visita
              const clase = simulada || perdioSenal(u) ? " bad" : f.estado === "VIVO" ? " on" : f.estado === "RECIENTE" || (u.enJornada && f.estado === "SIN_UBICACION") ? " warn" : "";
              return (
                <button key={u.id} type="button" className={`pick${seleccionado === u.id ? " on" : ""}`} aria-pressed={seleccionado === u.id} onClick={() => setSeleccionado(u.id === seleccionado ? null : u.id)}>
                  <Avatar nombre={nombreU} />
                  <span>
                    <b>{nombreU}</b>
                    <span className={`live${clase}`}>{simulada ? "GPS simulado · " : ""}{etiqueta}{zonaActiva ? ` · ${clientesPorAuditor.get(u.id) || 0} aquí` : ""}</span>
                    {u.bateria != null ? <span className={`bat${bateriaBaja(u) ? " bajo" : ""}`}>Batería {u.bateria} %{u.cargando ? " · cargando" : ""}{bateriaBaja(u) ? (perdioSenal(u) ? " · posible batería agotada" : " · baja") : ""}</span> : null}
                    {mov ? <span className={"bat" + (u.movimiento?.modo === "SALTO_GPS" ? " bajo" : "")}>{mov}</span> : null}
                    {enVisita && enVisita.tipo === "LLEGADA" ? <span className="bat">En la visita de {enVisita.cliente || "un cliente"} desde {horaCorta(enVisita.fecha)}</span> : null}
                  </span>
                </button>
              );
            })}
          </div>

          <h2 className="section-title">Llegadas y salidas de hoy ({eventosVisibles.length})</h2>
          {!eventosVisibles.length ? (
            <p className="subtle">Aún no hay llegadas ni salidas hoy. Aparecen solas cuando un auditor entra al radio de un cliente o se aleja de él.</p>
          ) : (
            <ul className="eventos" aria-live="polite" aria-label="Llegadas y salidas de hoy">
              {eventosVisibles.slice(0, 40).map((e) => (
                <li key={e.id} className={`evento ${e.tipo === "LLEGADA" ? "llegada" : "salida"}`}>
                  <span className="ico" aria-hidden="true">{e.tipo === "LLEGADA" ? "→" : "←"}</span>
                  <div>
                    <b>{e.auditor}</b> {e.tipo === "LLEGADA" ? "llegó a" : "salió de"} <b>{e.cliente || "un cliente"}</b>
                    <small>{e.direccion || "Sin dirección"}{e.punto.startsWith("NEGOCIO") ? " · negocio" : ""} · a {e.distancia_m ?? "?"} m</small>
                  </div>
                  <time dateTime={e.fecha}>{horaCorta(e.fecha)}</time>
                </li>
              ))}
            </ul>
          )}

          {seleccionado ? (
            <>
              <h2 className="section-title">Recorrido real</h2>
              <div className="replay">
                <Field label="Día">
                  <input type="date" name="fecha-recorrido" value={fechaRuta} max={hoy()} onChange={(e) => { if (e.target.value) setFechaRuta(e.target.value); }} />
                </Field>
                {ruta.length < 2 ? <p className="subtle">Sin recorrido registrado ese día.</p> : (
                  <>
                    <div className="replay-barra">
                      <button type="button" className="btn small" onClick={alternarReproduccion}>{reproduciendo ? "Pausar" : "Reproducir"}</button>
                      <input type="range" name="momento" aria-label="Momento del recorrido" min={0} max={ruta.length - 1} value={idxRepeticion ?? ruta.length - 1} onChange={(e) => { setReproduciendo(false); setIdxRepeticion(Number(e.target.value)); }} />
                    </div>
                    <p className="subtle" role="status">
                      {puntoRepeticion ? horaConSegundos(puntoRepeticion.fecha) + (puntoRepeticion.precision ? " · ±" + Math.round(puntoRepeticion.precision) + " m" : "") : "Mueve la barra para ver dónde estaba."} · {ruta.length} puntos de {horaCorta(ruta[0].fecha)} a {horaCorta(ruta[ruta.length - 1].fecha)}
                    </p>
                    {pausas.length ? (
                      <ul className="pausas" aria-label="Tramos sin señal">
                        {pausas.map((p) => <li key={p.desde}>Sin señal de {horaCorta(p.desde)} a {horaCorta(p.hasta)} ({p.minutos} min)</li>)}
                      </ul>
                    ) : null}
                  </>
                )}
              </div>
              <h2 className="section-title">Ruta del día</h2>
              {puntoManual ? (
                <div className="callout info" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                  <span>Ruta simulada desde un punto de partida manual.</span>
                  <button type="button" className="btn quiet small" onClick={() => setPuntoManual(null)}>Usar ubicación en vivo</button>
                </div>
              ) : null}
              {rutaBloqueadaPorAlcance ? (
                <div role="alert" className="callout aviso">
                  Este auditor tiene clientes en {departamentosDelAuditorSeleccionado.length} departamentos distintos ({departamentosDelAuditorSeleccionado.join(", ")}).
                  Elige uno arriba para planificar su ruta del día: no tiene sentido sugerir una ruta que cruce ciudades tan alejadas.
                </div>
              ) : !origenRuta ? (
                <div role="alert" className="callout info">
                  Este auditor no está transmitiendo ubicación en vivo ahora mismo. Toca un punto en el mapa para fijar un inicio y planificar su ruta desde ahí.
                </div>
              ) : (
                <>
                  <p className="subtle" style={{ marginBottom: 6 }}>En ruta ({enRuta.length}), del más cercano al más lejano</p>
                  {!clientesDelAuditorSeleccionado.length ? <p className="subtle">Sin clientes asignados en esta zona.</p> : null}
                  <div>
                    {enRuta.map((a) => (
                      <div key={a.id_asignacion} className="stop">
                        <span className="n">{a.orden}</span>
                        <div>
                          <b>{a.expediente.nombres_cliente}</b>
                          <small><span translate="no">{a.expediente.codigo_expediente}</span> · {a.expediente.distrito || "-"}</small>
                          <em>{fmtDistancia(a.distanciaDesdeAsesor)} desde el punto de partida</em>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          ) : null}
        </aside>

        <div className="seg-mapcard">
          <MapContainer center={CENTER} zoom={5} className="seguimiento-map">
            <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <FitBounds coords={fitCoords} clave={fitClave} />
            <ClickParaIniciar activo={Boolean(seleccionado && !origenRuta)} onClick={setPuntoManual} />
            {auditoresConMapa.map((u) => { const f = frescura(u); return f.estado !== "SIN_SENAL" && u.precision ? (
              <Circle key={`p-${u.id}`} center={[u.latitud as number, u.longitud as number]} radius={Math.min(u.precision, 500)} pathOptions={{ color: u.simulada ? "#d92d20" : colorForRol(u.rol), weight: 1, fillOpacity: 0.08 }} />
            ) : null; })}
            {auditoresConMapa.filter((u) => u.id !== seleccionado).map((u) => {
              const f = frescura(u);
              return (
                <Marker
                  key={u.id}
                  position={[u.latitud as number, u.longitud as number]}
                  icon={markerIcon(u.rol, f.estado, u.simulada)}
                  eventHandlers={{ click: () => setSeleccionado(u.id === seleccionado ? null : u.id) }}
                >
                  <Popup>
                    <strong>{u.nombres || u.username} {u.apellidos}</strong><br />{u.rol}<br />
                    {f.estado === "VIVO" ? "En vivo" : f.estado === "RECIENTE" ? "Reciente" : "Sin señal"} · {haceTexto(f.segundos)}{u.precision ? ` · precisión ±${Math.round(u.precision)} m` : ""}
                    {u.simulada ? <><br /><strong style={{ color: "#d92d20" }}>El celular avisó GPS simulado</strong></> : null}
                    {u.bateria != null ? <><br />Batería {u.bateria} %{u.cargando ? " · cargando" : ""}</> : null}
                  </Popup>
                </Marker>
              );
            })}
            {origenRuta ? (
              <Marker
                position={[origenRuta.latitud, origenRuta.longitud]}
                icon={inicioIcon}
                draggable
                eventHandlers={{
                  dragend: (e) => {
                    const { lat, lng } = (e.target as L.Marker).getLatLng();
                    setPuntoManual({ latitud: lat, longitud: lng });
                  },
                }}
              >
                <Popup>
                  <strong>{auditorSeleccionado?.nombres || "Inicio de ruta"} {auditorSeleccionado?.apellidos}</strong><br />
                  {puntoManual ? "Punto de partida simulado" : auditorSeleccionado ? `Ubicación ${haceTexto(frescura(auditorSeleccionado).segundos)}${auditorSeleccionado.precision ? ` · ±${Math.round(auditorSeleccionado.precision)} m` : ""}` : "Ubicación en vivo"}<br />
                  <em>Arrastra el pin para planificar desde otro punto.</em>
                </Popup>
              </Marker>
            ) : null}
            {enRuta.map((a) => (
              <Marker key={a.id_asignacion} position={[a.latitud, a.longitud]} icon={routeStopIcon(a.orden)}>
                <Popup>
                  <strong>{a.orden}. {a.expediente.nombres_cliente}</strong><br />
                  {a.expediente.codigo_expediente}<br />
                  {a.expediente.direccion_domicilio}<br />
                  {fmtDistancia(a.distanciaDesdeAsesor)} desde el punto de partida
                </Popup>
              </Marker>
            ))}
            {clientesSinRuta.map((a) => {
              const auditor = auditorPorId.get(a.id_usuario_auditor);
              return (
                <Marker
                  key={a.id_asignacion}
                  position={[a.latitud, a.longitud]}
                  icon={clienteIcon(a.prioridad)}
                  eventHandlers={{ click: () => setSeleccionado(a.id_usuario_auditor === seleccionado ? null : a.id_usuario_auditor) }}
                >
                  <Popup>
                    <strong>{a.expediente.nombres_cliente}</strong><br />
                    {a.expediente.codigo_expediente} · {a.expediente.distrito || "-"}<br />
                    Auditor: {auditor ? (auditor.nombres || auditor.username) : "—"}<br />
                    Prioridad: {a.prioridad}
                  </Popup>
                </Marker>
              );
            })}
            {rutaSugerida.length > 1 ? <Polyline positions={rutaSugerida} pathOptions={{ color: RUTA_COLOR, weight: 4, opacity: 0.85 }} /> : null}
            {polyline.length > 1 ? <Polyline positions={polyline} pathOptions={{ color: "#94a3b8", weight: 2, opacity: 0.7, dashArray: "4 6" }} /> : null}
            {rutaRecorrida.length > 1 ? <Polyline positions={rutaRecorrida} pathOptions={{ color: INICIO_COLOR, weight: 4, opacity: 0.9 }} /> : null}
            {puntoRepeticion ? <CircleMarker center={[puntoRepeticion.latitud, puntoRepeticion.longitud]} radius={9} pathOptions={{ color: "#ffffff", weight: 3, fillColor: INICIO_COLOR, fillOpacity: 1 }} /> : null}
            {reproduciendo && puntoRepeticion ? <SeguirPunto latitud={puntoRepeticion.latitud} longitud={puntoRepeticion.longitud} /> : null}
          </MapContainer>
          <div className="maplegend" aria-label="Leyenda del mapa">
            <span style={{ ["--c" as any]: INICIO_COLOR }}><i />Inicio de ruta (arrastrable)</span>
            <span style={{ ["--c" as any]: RUTA_COLOR }}><i />En ruta</span>
            <span style={{ ["--c" as any]: PRIORIDAD_COLORS.ALTA }}><i />Prioridad alta</span>
            <span style={{ ["--c" as any]: PRIORIDAD_COLORS.MEDIA }}><i />Media</span>
            <span style={{ ["--c" as any]: PRIORIDAD_COLORS.BAJA }}><i />Baja</span>
            <span style={{ ["--c" as any]: "#94a3b8" }}><i className="ln" />Recorrido real de hoy</span>
          </div>
        </div>
      </div>
    </>
  );
}
