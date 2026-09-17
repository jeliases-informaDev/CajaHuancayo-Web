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

function FitBounds({ puntos }: { puntos: Ubicacion[] }) {
  const map = useMap();
  useEffect(() => {
    const coords = puntos
      .filter((p) => p.latitud != null && p.longitud != null)
      .map((p) => [p.latitud, p.longitud] as [number, number]);
    if (coords.length) map.fitBounds(coords, { padding: [60, 60], maxZoom: 15 });
  }, [puntos.length]);
  return null;
}

export default function SeguimientoPage() {
  const [ubicaciones, setUbicaciones] = useState<Ubicacion[]>([]);
  const [seleccionado, setSeleccionado] = useState<string | null>(null);
  const [ruta, setRuta] = useState<Punto[]>([]);
  const [error, setError] = useState("");
  const socketRef = useRef<Socket | null>(null);

  const load = async () => {
    try {
      const r: any = await request("/api/usuarios/ubicaciones");
      setUbicaciones(r.data);
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
        </Card>
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <MapContainer center={CENTER} zoom={12} style={{ height: 560, width: "100%" }}>
            <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <FitBounds puntos={activos} />
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
            {polyline.length > 1 ? <Polyline positions={polyline} pathOptions={{ color: "#1236c7", weight: 4, opacity: 0.7 }} /> : null}
          </MapContainer>
        </Card>
      </div>
    </>
  );
}
