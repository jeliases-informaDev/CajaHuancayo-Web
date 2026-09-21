import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { io, Socket } from "socket.io-client";
import "leaflet/dist/leaflet.css";
import { API_URL, getToken, request } from "../api";
import { Badge, Card, Field } from "../components/ui";

type Ubicacion = {
  id: string; username: string; nombres: string; apellidos: string; rol: string;
  latitud: number | null; longitud: number | null;
};
type Punto = { latitud: number; longitud: number; precision: number | null; fecha: string };
type Asignacion = {
  id_asignacion: number; id_usuario_auditor: string; prioridad: string; expediente: any;
  auditor?: { id_usuario: string; username: string; nombres: string; apellidos: string } | null;
};
type AuditorInfo = {
  id: string; username: string; nombres: string; apellidos: string; rol: string;
  latitud: number | null; longitud: number | null; enVivo: boolean;
};

const CENTER: [number, number] = [-12.0687, -75.2094]; // Huancayo, Junín
const RUTA_COLOR = "#0ead7a";
const INICIO_COLOR = "#1236c7";
const DISPONIBLE_COLOR = "#334155";
const PRIORIDAD_COLORS: Record<string, string> = { ALTA: "#ef4444", MEDIA: "#f59e0b", BAJA: "#6d788a" };

function colorForRol(rol: string) {
  return rol === "SUPERVISOR" ? "#2c70e8" : "#0ead7a";
}

function markerIcon(rol: string) {
  const color = colorForRol(rol);
  return L.divIcon({
    className: "",
    html: `<div style="width:16px;height:16px;border-radius:50%;background:${color};border:3px solid #fff;box-shadow:0 0 0 2px ${color}66"></div>`,
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

function FitBounds({ coords }: { coords: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (coords.length) map.fitBounds(coords, { padding: [60, 60], maxZoom: 15 });
  }, [coords.length, coords.map((c) => c.join(",")).join("|")]);
  return null;
}

// Cuando el auditor elegido no está transmitiendo ubicación en vivo no hay ningún
// pin de inicio que arrastrar, así que se deja tocar el mapa directamente para
// fijar un punto de partida manual y poder planificar igual su ruta del día.
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

  const load = async () => {
    try {
      const [ubis, asigs]: any[] = await Promise.all([
        request("/api/usuarios/ubicaciones"),
        request("/api/asignaciones?estado=ACTIVA&limit=300"),
      ]);
      setUbicaciones(ubis.data);
      setAsignaciones(asigs.data);
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
    socket.on("ubicacion_actualizada", (data: any) => {
      setUbicaciones((prev) => {
        const actualizado: Ubicacion = {
          id: data.id_usuario, username: data.username,
          nombres: data.nombres || "", apellidos: data.apellidos || "",
          rol: data.rol || "", latitud: Number(data.latitud), longitud: Number(data.longitud),
        };
        const idx = prev.findIndex((u) => u.id === actualizado.id);
        if (idx === -1) return [...prev, actualizado];
        const next = [...prev];
        next[idx] = actualizado;
        return next;
      });
    });
    const timer = setInterval(load, 20000);
    return () => { socket.disconnect(); clearInterval(timer); };
  }, []);

  useEffect(() => {
    if (!seleccionado) { setRuta([]); return; }
    request(`/api/usuarios/${seleccionado}/tracking`)
      .then((r: any) => setRuta(r.data))
      .catch(() => setRuta([]));
  }, [seleccionado]);

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
        rol: "AUDITOR", latitud: null, longitud: null, enVivo: false,
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
      });
    });
    return mapa;
  }, [asignaciones, ubicaciones]);
  const todosLosAuditores = useMemo(() => Array.from(auditorPorId.values()), [auditorPorId]);
  const activos = useMemo(() => todosLosAuditores.filter((u) => u.enVivo), [todosLosAuditores]);
  const polyline = useMemo<[number, number][]>(() => ruta.map((p) => [p.latitud, p.longitud]), [ruta]);

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

  const fitCoords = useMemo<[number, number][]>(() => [
    ...auditoresConMapa.map((u) => [u.latitud as number, u.longitud as number] as [number, number]),
    ...clientesEnZona.map((a) => [a.latitud, a.longitud] as [number, number]),
  ], [auditoresConMapa, clientesEnZona]);

  return (
    <>
      <div className="page-header">
        <h1>Seguimiento en vivo</h1>
        <p>Filtra por zona para ver qué auditores y qué clientes hay en cada bloque geográfico. Elige un auditor para ver su ruta sugerida del día.</p>
      </div>
      {error ? <div className="error-box">{error}</div> : null}
      <div className="grid seguimiento-grid" style={{ alignItems: "start" }}>
        <Card>
          <p className="section-title">Zona</p>
          {departamentos.length ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
              <Field label="Departamento">
                <select
                  value={departamentoFiltro}
                  onChange={(e) => { setDepartamentoFiltro(e.target.value); setProvinciaFiltro("TODOS"); setDistritoFiltro("TODOS"); }}
                >
                  <option value="TODOS">Todos ({todosLosClientes.length})</option>
                  {departamentos.map((d) => (
                    <option key={d} value={d}>{d} ({todosLosClientes.filter((a) => a.expediente.departamento === d).length})</option>
                  ))}
                </select>
              </Field>
              {provincias.length > 1 ? (
                <Field label="Provincia">
                  <select
                    value={provinciaFiltro}
                    onChange={(e) => { setProvinciaFiltro(e.target.value); setDistritoFiltro("TODOS"); }}
                  >
                    <option value="TODOS">Todas ({enDepartamento.length})</option>
                    {provincias.map((p) => (
                      <option key={p} value={p}>{p} ({enDepartamento.filter((a) => a.expediente.provincia === p).length})</option>
                    ))}
                  </select>
                </Field>
              ) : null}
              {distritos.length > 1 ? (
                <Field label="Distrito">
                  <select value={distritoFiltro} onChange={(e) => setDistritoFiltro(e.target.value)}>
                    <option value="TODOS">Todos ({enProvincia.length})</option>
                    {distritos.map((d) => (
                      <option key={d} value={d}>{d} ({enProvincia.filter((a) => a.expediente.distrito === d).length})</option>
                    ))}
                  </select>
                </Field>
              ) : null}
            </div>
          ) : <p className="muted" style={{ marginBottom: 14 }}>Aún no hay expedientes asignados con ubicación registrada.</p>}

          <p className="section-title">Auditores{zonaActiva ? ` en ${departamentoFiltro}` : ""} ({auditoresVisibles.length})</p>
          {!auditoresVisibles.length ? (
            <p className="muted">{zonaActiva ? "Ningún auditor tiene clientes en esta zona." : "Nadie está transmitiendo ubicación ahora mismo."}</p>
          ) : null}
          {auditoresVisibles.map((u) => (
            <div
              key={u.id}
              style={{
                padding: "8px 6px", borderBottom: "1px solid var(--border)", cursor: "pointer", borderRadius: 8,
                background: seleccionado === u.id ? "var(--surface2)" : "transparent",
              }}
              onClick={() => setSeleccionado(u.id === seleccionado ? null : u.id)}
            >
              <div style={{ fontWeight: 700 }}>{u.nombres || u.username} {u.apellidos}</div>
              <div className="row" style={{ gap: 6, marginTop: 3 }}>
                <Badge label={u.rol} />
                <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 800, color: u.enVivo ? "var(--success)" : "var(--muted-soft)" }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: u.enVivo ? "var(--success)" : "#c7cedb", display: "inline-block" }} />
                  {u.enVivo ? "En línea" : "Sin GPS ahora"}
                </span>
                {zonaActiva ? <span className="muted" style={{ fontSize: 11 }}>{clientesPorAuditor.get(u.id) || 0} cliente(s) aquí</span> : null}
              </div>
            </div>
          ))}

          {seleccionado ? (
            <>
              <div style={{ height: 1, background: "var(--border)", margin: "12px 0" }} />
              {puntoManual ? (
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
                  background: "#EAF1FF", border: `1px solid ${INICIO_COLOR}33`, borderRadius: 8, padding: "6px 8px", marginBottom: 10, fontSize: 11,
                }}>
                  <span>Ruta simulada desde un punto de partida manual.</span>
                  <button
                    type="button"
                    onClick={() => setPuntoManual(null)}
                    style={{ border: 0, background: "none", color: INICIO_COLOR, fontWeight: 800, cursor: "pointer", whiteSpace: "nowrap" }}
                  >
                    Usar ubicación en vivo
                  </button>
                </div>
              ) : null}
              {rutaBloqueadaPorAlcance ? (
                <div className="error-box" style={{ background: "#fff7e6", color: "#9a6300" }}>
                  Este auditor tiene clientes en {departamentosDelAuditorSeleccionado.length} departamentos distintos ({departamentosDelAuditorSeleccionado.join(", ")}).
                  Elige uno arriba para planificar su ruta del día — no tiene sentido sugerir una ruta que cruce ciudades tan alejadas.
                </div>
              ) : !origenRuta ? (
                <div className="error-box" style={{ background: "#eef2ff", color: "var(--primary)" }}>
                  Este auditor no está transmitiendo ubicación en vivo ahora mismo. Toca un punto en el mapa para fijar un inicio y planificar su ruta desde ahí.
                </div>
              ) : (
                <>
                  <p className="section-title">En ruta ({enRuta.length})</p>
                  {!clientesDelAuditorSeleccionado.length ? <p className="muted">Sin clientes asignados en esta zona.</p> : null}
                  <div style={{ maxHeight: 260, overflowY: "auto" }}>
                    {enRuta.map((a) => (
                      <div key={a.id_asignacion} style={{ padding: "7px 4px", borderBottom: "1px solid var(--border)", display: "flex", gap: 8 }}>
                        <span style={{
                          flexShrink: 0, width: 20, height: 20, borderRadius: "50%", background: RUTA_COLOR, color: "#fff",
                          fontSize: 10, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", marginTop: 1,
                        }}>{a.orden}</span>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 13 }}>{a.expediente.nombres_cliente}</div>
                          <div className="muted" style={{ fontSize: 11 }}>{a.expediente.codigo_expediente} · {a.expediente.distrito || "-"}</div>
                          <div style={{ fontSize: 11, color: "var(--primary)", fontWeight: 700 }}>{fmtDistancia(a.distanciaDesdeAsesor)} desde el punto de partida</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          ) : null}

          <div style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: 14, fontSize: 11 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}><i style={{ width: 10, height: 10, borderRadius: "50%", background: INICIO_COLOR, display: "inline-block" }} /> Inicio de ruta (arrastrable)</span>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}><i style={{ width: 10, height: 10, borderRadius: "50%", background: RUTA_COLOR, display: "inline-block" }} /> En ruta</span>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}><i style={{ width: 10, height: 10, borderRadius: "50%", background: PRIORIDAD_COLORS.ALTA, display: "inline-block" }} /> Prioridad alta</span>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}><i style={{ width: 10, height: 10, borderRadius: "50%", background: PRIORIDAD_COLORS.MEDIA, display: "inline-block" }} /> Prioridad media</span>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}><i style={{ width: 10, height: 10, borderRadius: "50%", background: PRIORIDAD_COLORS.BAJA, display: "inline-block" }} /> Prioridad baja</span>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}><i style={{ width: 10, height: 2, background: "#94a3b8", display: "inline-block" }} /> Recorrido real de hoy</span>
          </div>
        </Card>
        <Card style={{ padding: 0, overflow: "hidden" }} className="seguimiento-map-card">
          <MapContainer center={CENTER} zoom={12} className="seguimiento-map" style={{ height: 560, width: "100%" }}>
            <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <FitBounds coords={fitCoords} />
            <ClickParaIniciar activo={Boolean(seleccionado && !origenRuta)} onClick={setPuntoManual} />
            {auditoresConMapa.filter((u) => u.id !== seleccionado).map((u) => (
              <Marker
                key={u.id}
                position={[u.latitud as number, u.longitud as number]}
                icon={markerIcon(u.rol)}
                eventHandlers={{ click: () => setSeleccionado(u.id === seleccionado ? null : u.id) }}
              >
                <Popup><strong>{u.nombres || u.username} {u.apellidos}</strong><br />{u.rol}</Popup>
              </Marker>
            ))}
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
                  {puntoManual ? "Punto de partida simulado" : "Ubicación en vivo"}<br />
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
            {rutaSugerida.length > 1 ? <Polyline positions={rutaSugerida} pathOptions={{ color: RUTA_COLOR, weight: 4, opacity: 0.8 }} /> : null}
            {polyline.length > 1 ? <Polyline positions={polyline} pathOptions={{ color: "#94a3b8", weight: 2, opacity: 0.6, dashArray: "4 6" }} /> : null}
          </MapContainer>
        </Card>
      </div>
    </>
  );
}
