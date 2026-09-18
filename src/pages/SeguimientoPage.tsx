import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import { io, Socket } from "socket.io-client";
import "leaflet/dist/leaflet.css";
import { API_URL, getToken, request } from "../api";
import { Badge, Card } from "../components/ui";

type Ubicacion = {
  id: string; username: string; nombres: string; apellidos: string; rol: string;
  latitud: number | null; longitud: number | null;
};
type Punto = { latitud: number; longitud: number; precision: number | null; fecha: string };
type Asignacion = { id_asignacion: number; id_usuario_auditor: string; prioridad: string; expediente: any };

const CENTER: [number, number] = [-12.0687, -75.2094]; // Huancayo, Junín

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

const clienteIcon = L.divIcon({
  className: "",
  html: `<div style="width:13px;height:13px;border-radius:4px;background:#f59e0b;border:2px solid #fff;box-shadow:0 0 0 1px #f59e0b88"></div>`,
  iconSize: [13, 13],
  iconAnchor: [7, 7],
});

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

export default function SeguimientoPage() {
  const [ubicaciones, setUbicaciones] = useState<Ubicacion[]>([]);
  const [asignaciones, setAsignaciones] = useState<Asignacion[]>([]);
  const [seleccionado, setSeleccionado] = useState<string | null>(null);
  const [ruta, setRuta] = useState<Punto[]>([]);
  const [error, setError] = useState("");
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

  const activos = ubicaciones.filter((u) => u.latitud != null && u.longitud != null);
  const polyline = useMemo<[number, number][]>(() => ruta.map((p) => [p.latitud, p.longitud]), [ruta]);

  const auditorSeleccionado = activos.find((u) => u.id === seleccionado) || null;
  const muestraSeleccionado = useMemo(() => {
    const lista = asignaciones
      .filter((a) => a.id_usuario_auditor === seleccionado && a.expediente?.latitud != null && a.expediente?.longitud != null)
      .map((a) => ({
        ...a,
        distancia: auditorSeleccionado
          ? distanciaMetros(auditorSeleccionado.latitud as number, auditorSeleccionado.longitud as number, Number(a.expediente.latitud), Number(a.expediente.longitud))
          : null,
      }));
    return lista.sort((a, b) => (a.distancia ?? Infinity) - (b.distancia ?? Infinity));
  }, [asignaciones, seleccionado, auditorSeleccionado]);
  const fitCoords = useMemo<[number, number][]>(() => [
    ...activos.map((u) => [u.latitud as number, u.longitud as number] as [number, number]),
    ...muestraSeleccionado.map((a) => [Number(a.expediente.latitud), Number(a.expediente.longitud)] as [number, number]),
  ], [activos, muestraSeleccionado]);

  return (
    <>
      <div className="page-header">
        <h1>Seguimiento en vivo</h1>
        <p>Ubicación en tiempo real del personal de campo. Selecciona a alguien para ver la ruta recorrida hoy.</p>
      </div>
      {error ? <div className="error-box">{error}</div> : null}
      <div className="grid" style={{ gridTemplateColumns: "260px 1fr", gap: 16, alignItems: "start" }}>
        <Card>
          <p className="section-title">Personal activo ({activos.length})</p>
          {!activos.length ? <p className="muted">Nadie está transmitiendo ubicación ahora mismo.</p> : null}
          {activos.map((u) => (
            <div
              key={u.id}
              style={{
                padding: "8px 6px", borderBottom: "1px solid var(--border)", cursor: "pointer", borderRadius: 8,
                background: seleccionado === u.id ? "var(--surface2)" : "transparent",
              }}
              onClick={() => setSeleccionado(u.id === seleccionado ? null : u.id)}
            >
              <div style={{ fontWeight: 700 }}>{u.nombres || u.username} {u.apellidos}</div>
              <Badge label={u.rol} />
            </div>
          ))}

          {seleccionado ? (
            <>
              <div style={{ height: 1, background: "var(--border)", margin: "12px 0" }} />
              <p className="section-title">Muestra asignada ({muestraSeleccionado.length})</p>
              {!muestraSeleccionado.length ? <p className="muted">Sin expedientes asignados activos.</p> : null}
              <div style={{ maxHeight: 320, overflowY: "auto" }}>
                {muestraSeleccionado.map((a) => (
                  <div key={a.id_asignacion} style={{ padding: "7px 4px", borderBottom: "1px solid var(--border)" }}>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{a.expediente.nombres_cliente}</div>
                    <div className="muted" style={{ fontSize: 11 }}>{a.expediente.codigo_expediente} · {a.expediente.distrito || "-"}</div>
                    <div style={{ fontSize: 11, color: "var(--primary)", fontWeight: 700 }}>
                      {a.distancia != null ? (a.distancia < 1000 ? `${Math.round(a.distancia)} m` : `${(a.distancia / 1000).toFixed(1)} km`) : "-"} de distancia
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : null}
        </Card>
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <MapContainer center={CENTER} zoom={12} style={{ height: 560, width: "100%" }}>
            <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <FitBounds coords={fitCoords} />
            {activos.map((u) => (
              <Marker
                key={u.id}
                position={[u.latitud as number, u.longitud as number]}
                icon={markerIcon(u.rol)}
                eventHandlers={{ click: () => setSeleccionado(u.id === seleccionado ? null : u.id) }}
              >
                <Popup><strong>{u.nombres || u.username} {u.apellidos}</strong><br />{u.rol}</Popup>
              </Marker>
            ))}
            {muestraSeleccionado.map((a) => (
              <Marker key={a.id_asignacion} position={[Number(a.expediente.latitud), Number(a.expediente.longitud)]} icon={clienteIcon}>
                <Popup><strong>{a.expediente.nombres_cliente}</strong><br />{a.expediente.codigo_expediente}<br />{a.expediente.direccion_domicilio}</Popup>
              </Marker>
            ))}
            {polyline.length > 1 ? <Polyline positions={polyline} pathOptions={{ color: "#1236c7", weight: 4, opacity: 0.7 }} /> : null}
          </MapContainer>
        </Card>
      </div>
    </>
  );
}
