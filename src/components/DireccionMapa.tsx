import { useState } from "react";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { request } from "../api";
import { Button, Card, InfoRow } from "./ui";
import { ADVERTENCIAS, GEO_ESTADO, ORIGEN_UBICACION, dash } from "../lib/format";

// Pin de color (sin imágenes del paquete de Leaflet, que no cargan bien con el empaquetador): azul = referencia vigente, naranja = sugerencia del mapa.
const pin = (color: string) => L.divIcon({ className: "", html: `<div style="width:18px;height:18px;border-radius:50%;background:${color};border:3px solid #fff;box-shadow:0 1px 6px rgba(0,0,0,.4)"></div>`, iconSize: [18, 18], iconAnchor: [9, 9] });

const PARTES: [string, string][] = [["tipo_via", "Tipo de vía"], ["nombre_via", "Nombre de la vía"], ["numero", "Número"], ["manzana", "Manzana"], ["lote", "Lote"], ["urbanizacion", "Urbanización / zona"], ["interior", "Interior"], ["referencia", "Referencia"]];
// Qué tan fina es la ubicación sugerida: del punto exacto a la zona.
const PRECISION_GEO: Record<string, string> = {
  EXACTA: "Punto exacto (número de puerta)",
  APROXIMADA: "Aproximada: la calle, no la puerta",
  DISTRITO: "La zona (AA.HH., urbanización) encontrada en el mapa",
  MANZANA: "La manzana: punto medio de lotes ya verificados en visitas anteriores",
  ZONA: "La zona: punto medio de visitas anteriores en la misma zona",
};
const CALIDAD_A_AVISO: Record<string, string> = { SIN_NUMERO: "DIRECCION_SIN_NUMERO", MANZANA_LOTE: "DIRECCION_MANZANA_LOTE", SIN_TIPO_VIA: "DIRECCION_SIN_TIPO_VIA", SIN_DISTRITO: "DIRECCION_SIN_DISTRITO", DIRECCION_CORTA: "DIRECCION_CORTA", SIN_DIRECCION: "SIN_DIRECCION" };

function distanciaM(a: [number, number], b: [number, number]) {
  const R = 6371000; const rad = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(rad(b[0] - a[0]) / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(rad(b[1] - a[1]) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Dirección del domicilio ya ordenada (tipo de vía, nombre, número…), su calidad y la ubicación que sugiere el mapa, con la que una persona decide.
export default function DireccionMapa({ e, onSaved }: { e: any; onSaved: () => void }) {
  const [ocupado, setOcupado] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const comp = e.direccion_componentes || null;
  const calidad: string[] = comp?.calidad || [];
  const sugerida: [number, number] | null = e.geo_latitud != null && e.geo_longitud != null ? [Number(e.geo_latitud), Number(e.geo_longitud)] : null;
  const referencia: [number, number] | null = e.latitud != null && e.longitud != null ? [Number(e.latitud), Number(e.longitud)] : null;
  const geo = e.geo_estado ? GEO_ESTADO[e.geo_estado] : null;
  const separacion = sugerida && referencia ? distanciaM(sugerida, referencia) : null;
  const yaEsLaReferencia = Boolean(sugerida && referencia && separacion !== null && separacion < 5);

  const llamar = async (ruta: string, exito: string) => {
    setOcupado(true); setMensaje("");
    try { await request(ruta, { method: "POST" }); setMensaje(exito); onSaved(); } catch (err: any) { setMensaje(err.message); } finally { setOcupado(false); }
  };

  return (
    <Card>
      <p className="section-title">Dirección y ubicación en el mapa</p>
      <InfoRow k="Escrita en la base" v={dash(e.direccion_domicilio)} />
      <InfoRow k="Ordenada" v={e.direccion_normalizada ? <b style={{ fontWeight: 500 }}>{e.direccion_normalizada}</b> : "-"} />
      {comp ? PARTES.filter(([k]) => comp[k]).map(([k, etiqueta]) => <InfoRow key={k} k={etiqueta} v={comp[k]} />) : null}
      {calidad.map((c) => ADVERTENCIAS[CALIDAD_A_AVISO[c] || c] ? <div key={c} className="callout aviso" style={{ marginTop: 8 }}>{ADVERTENCIAS[CALIDAD_A_AVISO[c] || c]}</div> : null)}

      {geo ? (
        <>
          <p className="section-title" style={{ marginTop: 16 }}>Lo que encontró el mapa</p>
          <InfoRow k="Situación" v={<span className={`state ${geo.tono === "na" ? "warn" : geo.tono}`}>{geo.etiqueta}</span>} />
          {e.geo_confianza ? <InfoRow k="Confianza" v={e.geo_confianza === "ALTA" ? "Alta: punto exacto con el número y el distrito declarados" : e.geo_confianza === "MEDIA" ? "Media: ubica la calle, no la puerta (sirve para ver la zona, no para medir los 100 m)" : "Baja: dudosa (manzana y lote, o cae fuera del distrito declarado)"} /> : null}
          {e.geo_precision ? <InfoRow k="Precisión" v={PRECISION_GEO[e.geo_precision] || e.geo_precision} /> : null}
          {e.geo_direccion_encontrada ? <InfoRow k="Dirección que devolvió el mapa" v={e.geo_direccion_encontrada} /> : null}
          {e.geo_proveedor ? <InfoRow k="Fuente" v={e.geo_proveedor === "vecinos" ? "Visitas anteriores de GeoMatrix (misma zona o manzana)" : e.geo_proveedor === "google" ? "Google Maps (sugerencia temporal: se borra a los 30 días)" : e.geo_proveedor} /> : null}
          {e.geo_proveedor === "google" && !referencia ? <p className="subtle" style={{ marginTop: 6 }}>Sugerencia temporal: sirve para llegar y para comprobar que la primera visita se hace en la zona. No puede quedar como referencia: la fija la primera visita limpia del auditor (o una ubicación puesta a mano).</p> : null}
          {e.ubicacion_origen ? <InfoRow k="Referencia vigente" v={ORIGEN_UBICACION[e.ubicacion_origen] || e.ubicacion_origen} /> : <InfoRow k="Referencia vigente" v="Ninguna todavía: la primera visita limpia la tomará, o puedes aceptar la sugerencia" />}
          {separacion !== null && !yaEsLaReferencia ? <InfoRow k="Distancia entre la sugerencia y la referencia" v={separacion < 1000 ? `${Math.round(separacion)} m` : `${(separacion / 1000).toFixed(1)} km`} /> : null}
        </>
      ) : <p className="subtle" style={{ marginTop: 12 }}>{e.geo_estado === null || e.geo_estado === undefined ? (referencia ? "Este expediente ya trae coordenadas de la base o fijadas por una persona: no hace falta buscarlo en el mapa." : "Este expediente no está en la cola del mapa (sin dirección).") : ""}</p>}

      {sugerida || referencia ? (
        <div style={{ height: 240, marginTop: 12, borderRadius: 12, overflow: "hidden" }}>
          <MapContainer center={(sugerida || referencia) as [number, number]} zoom={16} scrollWheelZoom={false} style={{ height: "100%", width: "100%" }}>
            <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            {referencia ? <Marker position={referencia} icon={pin("#2d41c4")}><Popup>Referencia vigente</Popup></Marker> : null}
            {sugerida && !yaEsLaReferencia ? <Marker position={sugerida} icon={pin("#f59e0b")}><Popup>Sugerencia del mapa</Popup></Marker> : null}
          </MapContainer>
        </div>
      ) : null}

      <div className="row" style={{ marginTop: 12 }}>
        {sugerida && !yaEsLaReferencia && e.geo_proveedor !== "google" ? <Button title={ocupado ? "Guardando…" : "Usar esta ubicación"} onClick={() => llamar(`/api/expedientes/${e.id_expediente}/aceptar-ubicacion`, "Ubicación aceptada: queda como referencia verificada.")} disabled={ocupado} /> : null}
        {e.direccion_normalizada ? <Button title="Buscar de nuevo" kind="ghost" onClick={() => llamar(`/api/expedientes/${e.id_expediente}/geocodificar`, "Búsqueda hecha.")} disabled={ocupado} /> : null}
      </div>
      {mensaje ? <div role="status" className="subtle" style={{ marginTop: 8 }}>{mensaje}</div> : null}
    </Card>
  );
}
