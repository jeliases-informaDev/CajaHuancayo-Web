import { useEffect, useMemo, useState } from "react";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Icon } from "./icons";
import { interpretarCoordenadas, type Coordenadas } from "../lib/coordenadas";

// Ubicación del domicilio sin pedir latitud y longitud a mano: se pega un enlace de Google Maps o unas coordenadas,
// se marca el punto en el mapa (clic, o arrastrar el pin) o se usa la ubicación del navegador. Puede quedar vacía.

const HUANCAYO: [number, number] = [-12.0651, -75.2049];
const pin = L.divIcon({ className: "", html: `<div style="width:18px;height:18px;border-radius:50%;background:#2d41c4;border:3px solid #fff;box-shadow:0 1px 6px rgba(0,0,0,.4)"></div>`, iconSize: [18, 18], iconAnchor: [9, 9] });

function Clics({ onClick }: { onClick: (c: Coordenadas) => void }) {
  useMapEvents({ click: (e) => onClick({ latitud: e.latlng.lat, longitud: e.latlng.lng }) });
  return null;
}

function Centrar({ lat, lng }: { lat: number | null; lng: number | null }) {
  const map = useMap();
  useEffect(() => { if (lat != null && lng != null) map.setView([lat, lng], Math.max(map.getZoom(), 16)); }, [lat, lng, map]);
  return null;
}

export default function UbicacionPicker({ valor, onChange }: { valor: Coordenadas | null; onChange: (c: Coordenadas | null) => void }) {
  const [texto, setTexto] = useState("");
  const [abierto, setAbierto] = useState(false);
  const [aviso, setAviso] = useState("");
  const posicion = useMemo<[number, number] | null>(() => (valor ? [valor.latitud, valor.longitud] : null), [valor]);

  const pegar = (t: string) => {
    setTexto(t);
    const c = interpretarCoordenadas(t);
    if (c) { onChange(c); setAbierto(true); setAviso(""); }
    else if (t.trim()) setAviso("No reconozco esas coordenadas. Pega el enlace de Google Maps del lugar o algo como -12.0651, -75.2049.");
    else setAviso("");
  };
  const miUbicacion = () => {
    if (!navigator.geolocation) { setAviso("Este navegador no permite usar la ubicación."); return; }
    setAviso("Obteniendo tu ubicación…");
    navigator.geolocation.getCurrentPosition(
      (p) => { onChange({ latitud: p.coords.latitude, longitud: p.coords.longitude }); setAbierto(true); setAviso(""); },
      () => setAviso("No se pudo obtener tu ubicación: revisa el permiso del navegador."),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  return (
    <div className="ubicacion-picker">
      <div className="field">
        <label htmlFor="ubicacion-texto">Ubicación en el mapa (opcional)</label>
        <input id="ubicacion-texto" name="ubicacion" type="text" autoComplete="off" spellCheck={false} placeholder="Pega un enlace de Google Maps o las coordenadas…" value={texto} onChange={(e) => pegar(e.target.value)} />
      </div>
      <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
        <button type="button" className="btn ghost small" onClick={() => setAbierto((v) => !v)}><Icon name="mapa" size={15} />{abierto ? "Ocultar el mapa" : "Marcar en el mapa"}</button>
        <button type="button" className="btn ghost small" onClick={miUbicacion}><Icon name="objetivo" size={15} />Usar mi ubicación</button>
        {valor ? <button type="button" className="btn quiet small" onClick={() => { onChange(null); setTexto(""); setAviso(""); }}>Quitar</button> : null}
      </div>
      <p className="subtle" style={{ margin: 0 }} aria-live="polite">
        {valor
          ? `Punto marcado: ${valor.latitud.toFixed(5)}, ${valor.longitud.toFixed(5)}. En el mapa puedes arrastrar el pin para afinarlo.`
          : "Si lo dejas vacío, el expediente queda «sin coordenadas»: la primera visita conforme fijará la referencia, o lo ubicas después desde el expediente."}
      </p>
      {aviso ? <div role="status" className="callout aviso" style={{ marginTop: 4 }}>{aviso}</div> : null}
      {abierto ? (
        <>
          <div className="ubicacion-mapa">
            <MapContainer center={posicion || HUANCAYO} zoom={posicion ? 16 : 13} style={{ height: "100%", width: "100%" }}>
              <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <Clics onClick={(c) => { onChange(c); setAviso(""); }} />
              <Centrar lat={valor?.latitud ?? null} lng={valor?.longitud ?? null} />
              {posicion ? (
                <Marker position={posicion} icon={pin} draggable eventHandlers={{ dragend: (e) => { const p = (e.target as L.Marker).getLatLng(); onChange({ latitud: p.lat, longitud: p.lng }); } }} />
              ) : null}
            </MapContainer>
          </div>
          <p className="subtle" style={{ margin: 0 }}>Haz clic en el lugar exacto del domicilio.</p>
        </>
      ) : null}
    </div>
  );
}
