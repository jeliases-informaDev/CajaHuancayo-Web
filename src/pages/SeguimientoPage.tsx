import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle, CircleMarker, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { io, Socket } from "socket.io-client";
import { renderToStaticMarkup } from "react-dom/server";
import { useNavigate } from "react-router-dom";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";
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
type ZonaMapa = { departamento: string | null; provincia: string | null; distrito: string | null; n: number };
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
const GEOCERCA_M = 100; // radio de la geocerca del servidor (por defecto 100 m): se dibuja alrededor del cliente señalado
const RUTA_COLOR = "#0f9d6c";
const INICIO_COLOR = "#2d41c4";
const DISPONIBLE_COLOR = "#334155";
const PRIORIDAD_COLORS: Record<string, string> = { ALTA: "#ef4444", MEDIA: "#f59e0b", BAJA: "#6d788a" };

function colorForRol(rol: string) {
  return rol === "SUPERVISOR" ? "#2c70e8" : "#0ead7a";
}

const norm = (t: string) => t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const escHtml = (t: string) => String(t).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
const iniciales = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "?";

// Auditor en el mapa: círculo con sus iniciales. El color dice el estado (verde en vivo, gris sin señal, rojo si hay una alerta o GPS simulado),
// el anillo late mientras está en vivo y crece cuando es el auditor elegido.
// Los iconos se reutilizan: si cada actualización creara uno nuevo por auditor, Leaflet rehacía el dibujo de TODOS los marcadores en cada
// vuelta (con mil auditores en vivo, la pantalla se congelaba). Mientras el aspecto no cambie, se devuelve el mismo objeto.
const cacheIconos = new Map<string, L.DivIcon>();
function conCache(clave: string, crear: () => L.DivIcon): L.DivIcon {
  let icono = cacheIconos.get(clave);
  if (!icono) { if (cacheIconos.size > 4000) cacheIconos.clear(); icono = crear(); cacheIconos.set(clave, icono); }
  return icono;
}
// `pulsar`: el anillo que late en cada auditor en vivo es una animación por marcador; con cientos de ellos a la vez la pantalla se arrastra
// (5 cuadros por segundo con mil auditores en vivo), así que solo late en todos cuando son pocos; el auditor elegido siempre late.
function markerIcon(nombre: string, rol: string, estado: Frescura, simulada: boolean, alerta: boolean, elegido: boolean, pulsar = true) {
  return conCache(["a", nombre, rol, estado, simulada, alerta, elegido, pulsar].join("|"), () => crearMarkerIcon(nombre, rol, estado, simulada, alerta, elegido, pulsar));
}
function crearMarkerIcon(nombre: string, rol: string, estado: Frescura, simulada: boolean, alerta: boolean, elegido: boolean, pulsar: boolean) {
  const color = simulada || alerta ? "#d92d20" : estado === "SIN_SENAL" ? "#94a3b8" : colorForRol(rol);
  const tam = elegido ? 44 : 34;
  const clases = "avatar-pin" + (estado === "VIVO" && !simulada && (pulsar || elegido) ? " gps-vivo" : "") + (elegido ? " elegido" : "");
  return L.divIcon({
    className: "",
    html: '<div class="' + clases + '" style="--c:' + color + ";width:" + tam + "px;height:" + tam + 'px"><span>' + escHtml(iniciales(nombre)) + "</span></div>",
    iconSize: [tam, tam],
    iconAnchor: [tam / 2, tam / 2],
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
  return conCache("r|" + n, () => crearRouteStopIcon(n));
}
function crearRouteStopIcon(n: number) {
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
  return conCache("c|" + prioridad, () => crearClienteIcon(prioridad));
}
function crearClienteIcon(prioridad: string) {
  const color = PRIORIDAD_COLORS[prioridad] || DISPONIBLE_COLOR;
  return L.divIcon({
    className: "",
    html: `<div style="width:13px;height:13px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 0 0 1px ${color}66"></div>`,
    iconSize: [13, 13],
    iconAnchor: [6, 6],
  });
}

const fmtMonto = (monto: any, moneda?: string) => (monto == null || Number(monto) <= 0 ? null : (moneda === "USD" ? "US$ " : "S/ ") + Number(monto).toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));

// Tarjeta de un cliente (el mismo contenido para las paradas de la ruta y para cualquier otro punto del mapa).
function TarjetaCliente({ a, auditor, orden, distancia, etiquetaDistancia, onVer, conAuditor }: { a: { prioridad: string; id_usuario_auditor?: string; expediente: any }; auditor: string; orden?: number; distancia?: number | null; etiquetaDistancia?: string; onVer?: (id: number) => void; conAuditor?: boolean }) {
  const e = a.expediente;
  const monto = fmtMonto(e.monto_desembolso, e.moneda);
  const lugar = [e.direccion_domicilio, e.distrito].filter(Boolean).join(", ");
  return (
    <div className="pop pop-cliente">
      <strong>{orden ? orden + ". " : ""}{e.nombres_cliente}</strong>
      <div className="pop-codigo" translate="no">{e.codigo_expediente}</div>
      {lugar ? <div>{lugar}</div> : null}
      <div className="pop-chips">
        <span className="pop-chip tipo">{e.tipo_credito === "OTROS" ? "MYPE" : "Consumo"}</span>
        <span className="pop-chip" style={{ background: (PRIORIDAD_COLORS[a.prioridad] || DISPONIBLE_COLOR) + "22", color: PRIORIDAD_COLORS[a.prioridad] || DISPONIBLE_COLOR }}>Prioridad {a.prioridad.toLowerCase()}</span>
      </div>
      {monto ? <div>Desembolso: <b>{monto}</b></div> : null}
      {e.asesor_responsable ? <div>Asesor: {e.asesor_responsable}</div> : null}
      <div>Auditor: {auditor}</div>
      {distancia != null ? <div className="pop-dist">{fmtDistancia(distancia)} {etiquetaDistancia || "desde el punto de partida"}</div> : null}
      <a className="pop-btn" href={"/expedientes/" + e.id_expediente} data-ver-exp={e.id_expediente} onClick={onVer ? (ev) => { ev.preventDefault(); onVer(e.id_expediente); } : undefined}>Ver expediente</a>
      {conAuditor && a.id_usuario_auditor ? <a className="pop-btn sec" href="#auditor" data-ver-auditor={a.id_usuario_auditor}>Ver al auditor</a> : null}
    </div>
  );
}

type ClienteMapa = { id_asignacion: number; id_usuario_auditor: string; prioridad: string; latitud: number; longitud: number; expediente: any };

// Clientes de la zona agrupados: de lejos son burbujas con el número de clientes, al acercarse se separan. Al pasar el cursor por un
// cliente se dibuja su geocerca (el radio dentro del cual el servidor da por buena una visita).
function ClientesAgrupados({ clientes, nombreAuditor, onVerAuditor, origen, onVer }: { clientes: ClienteMapa[]; nombreAuditor: (id: string) => string; onVerAuditor: (id: string) => void; origen: { latitud: number; longitud: number } | null; onVer: (id: number) => void }) {
  const map = useMap();
  const datos = useRef({ clientes, nombreAuditor, onVerAuditor, origen, onVer });
  datos.current = { clientes, nombreAuditor, onVerAuditor, origen, onVer };
  // Los clientes se reciben de nuevo cada 10 s: el grupo solo se reconstruye si cambió algo (así no se cierra lo que el supervisor abrió).
  const clave = clientes.map((c) => c.id_asignacion + ":" + c.prioridad + ":" + c.id_usuario_auditor).join(",");
  useEffect(() => {
    const grupo = L.markerClusterGroup({
      showCoverageOnHover: false, maxClusterRadius: 46, spiderfyOnMaxZoom: true, chunkedLoading: true, zoomToBoundsOnClick: false,
      // La burbuja toma el color de la prioridad más alta que contiene.
      iconCreateFunction: (c) => {
        const prios = c.getAllChildMarkers().map((m) => (m.options as any).prioridad as string);
        const color = prios.includes("ALTA") ? PRIORIDAD_COLORS.ALTA : prios.includes("MEDIA") ? PRIORIDAD_COLORS.MEDIA : "var(--brand)";
        return L.divIcon({ html: '<div class="cluster-pin" style="background:' + color + '"><span>' + c.getChildCount() + "</span></div>", className: "", iconSize: [38, 38] });
      },
    });
    // Tocar un grupo muestra su resumen (cuántos, de qué prioridad, cuáles) en vez de acercar el mapa de golpe; «Acercar» lo hace si se quiere.
    grupo.on("clusterclick", (ev) => {
      const hijos = ev.layer.getAllChildMarkers();
      const cuenta: Record<string, number> = {};
      hijos.forEach((m: L.Marker) => { const p = (m.options as any).prioridad as string; cuenta[p] = (cuenta[p] || 0) + 1; });
      const chips = ["ALTA", "MEDIA", "BAJA"].filter((p) => cuenta[p]).map((p) => '<span class="pop-chip" style="background:' + PRIORIDAD_COLORS[p] + "22;color:" + PRIORIDAD_COLORS[p] + '">' + cuenta[p] + " " + p.toLowerCase() + "</span>").join("");
      const nombres = hijos.slice(0, 5).map((m: L.Marker) => "<li>" + escHtml(m.options.title || "") + "</li>").join("") + (hijos.length > 5 ? '<li class="mas">y ' + (hijos.length - 5) + " más</li>" : "");
      const popup = L.popup({ minWidth: 220, maxWidth: 280 }).setLatLng(ev.layer.getLatLng())
        .setContent('<div class="pop pop-grupo"><strong>' + hijos.length + ' clientes en este punto</strong><div class="pop-chips">' + chips + "</div><ul>" + nombres + '</ul><button type="button" class="pop-btn" data-acercar>Acercar para verlos</button></div>')
        .openOn(map);
      const abrirGrupo = () => {
        map.closePopup();
        // Si al llegar al zoom máximo siguen juntos (mismo edificio o misma dirección), se abren en abanico para poder tocarlos uno por uno.
        const separar = () => {
          const padre = (hijos[0] as any).__parent;
          if (padre && padre.spiderfy && map.getZoom() >= map.getMaxZoom() && map.hasLayer(padre) && padre.getChildCount() > 1) padre.spiderfy();
        };
        if (map.getZoom() >= map.getMaxZoom()) { separar(); return; }
        ev.layer.zoomToBounds({ padding: [50, 50] });
        map.once("moveend", () => setTimeout(separar, 700));
      };
      popup.getElement()?.querySelector("[data-acercar]")?.addEventListener("click", () => abrirGrupo());
    });
    const halo = L.layerGroup().addTo(map);
    for (const a of datos.current.clientes) {
      const m = L.marker([a.latitud, a.longitud], { icon: clienteIcon(a.prioridad), title: a.expediente.nombres_cliente, prioridad: a.prioridad } as L.MarkerOptions);
      // El contenido se arma al abrir la tarjeta: así la distancia usa el auditor que esté elegido en ese momento.
      m.bindPopup(() => renderToStaticMarkup(<TarjetaCliente a={a} auditor={datos.current.nombreAuditor(a.id_usuario_auditor)} conAuditor
        distancia={datos.current.origen ? distanciaMetros(datos.current.origen.latitud, datos.current.origen.longitud, a.latitud, a.longitud) : null} etiquetaDistancia="desde el auditor elegido" />), { minWidth: 230, maxWidth: 300 });
      m.on("popupopen", (ev) => {
        const caja = ev.popup.getElement();
        const enlace = caja?.querySelector("a[data-ver-exp]");
        if (enlace) enlace.addEventListener("click", (c) => { c.preventDefault(); datos.current.onVer(Number(enlace.getAttribute("data-ver-exp"))); });
        const aud = caja?.querySelector("a[data-ver-auditor]");
        if (aud) aud.addEventListener("click", (c) => { c.preventDefault(); map.closePopup(); datos.current.onVerAuditor(aud.getAttribute("data-ver-auditor") || ""); });
      });
      m.on("mouseover", () => { halo.clearLayers(); L.circle([a.latitud, a.longitud], { radius: GEOCERCA_M, color: PRIORIDAD_COLORS[a.prioridad] || DISPONIBLE_COLOR, weight: 1.5, dashArray: "4 4", fillOpacity: 0.08 }).addTo(halo); });
      m.on("mouseout", () => halo.clearLayers());
      grupo.addLayer(m);
    }
    map.addLayer(grupo);
    return () => { map.removeLayer(grupo); map.removeLayer(halo); };
  }, [clave, map]);
  return null;
}

// Marcador de un auditor que se desliza hasta su nueva posición en vez de saltar: se nota que es en vivo.
function AuditorMarker({ posicion, icon, onClick, children }: { posicion: [number, number]; icon: L.DivIcon; onClick: () => void; children: ReactNode }) {
  const ref = useRef<L.Marker | null>(null);
  const inicial = useRef<[number, number]>(posicion);
  const actual = useRef<[number, number]>(posicion);
  useEffect(() => {
    const m = ref.current; if (!m) return;
    const a = actual.current; const b = posicion;
    if (a[0] === b[0] && a[1] === b[1]) return;
    const t0 = performance.now(); const dur = 900; let raf = 0;
    const paso = (t: number) => {
      const k = Math.min(1, (t - t0) / dur); const e = 1 - Math.pow(1 - k, 3);
      const p: [number, number] = [a[0] + (b[0] - a[0]) * e, a[1] + (b[1] - a[1]) * e];
      m.setLatLng(p); actual.current = p;
      if (k < 1) raf = requestAnimationFrame(paso); else actual.current = b;
    };
    raf = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(raf);
  }, [posicion[0], posicion[1]]);
  return <Marker ref={ref} position={inicial.current} icon={icon} eventHandlers={{ click: onClick }}>{children}</Marker>;
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
function FitBounds({ coords, clave, nonce = 0 }: { coords: [number, number][]; clave?: string; nonce?: number }) {
  const map = useMap();
  useEffect(() => {
    if (coords.length) map.fitBounds(coords, { padding: [60, 60], maxZoom: 15, animate: false }); // sin animación: así no queda un zoom a medias que pise el vuelo a un auditor
  }, [clave ?? coords.length, clave ?? coords.map((c) => c.join(",")).join("|"), nonce]);
  return null;
}

// Cámara del mapa: un solo lugar decide a dónde mira. Elegir un auditor lo centra a ÉL (no aleja el mapa para abarcar todos sus clientes,
// que pueden estar a 200 km); buscar un cliente vuela hasta el cliente; «Ver ruta completa» sí encuadra todo, pero porque se pidió.
type Camara = { n: number; modo: "auditor" | "cliente" | "ruta"; punto?: [number, number]; coords?: [number, number][] };
function CamaraMapa({ camara }: { camara: Camara | null }) {
  const map = useMap();
  useEffect(() => {
    if (!camara) return;
    if (camara.modo === "cliente" && camara.punto) map.flyTo(camara.punto, 17, { duration: 1.1 });
    else if (camara.modo === "auditor" && camara.punto) map.flyTo(camara.punto, Math.max(map.getZoom(), 15), { duration: 1.1 });
    else if (camara.coords?.length) map.fitBounds(camara.coords, { padding: [60, 60], maxZoom: 15 });
  }, [camara?.n]);
  return null;
}

// Durante la reproducción del recorrido el mapa sigue al punto, para que no se salga de la vista.
function SeguirPunto({ latitud, longitud }: { latitud: number; longitud: number }) {
  const map = useMap();
  useEffect(() => { map.panTo([latitud, longitud], { animate: true, duration: 0.2 }); }, [latitud, longitud]);
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
  // Los clientes del mapa llegan filtrados por zona desde el servidor (con tope de seguridad); las zonas disponibles y el roster de auditores
  // se piden aparte, así nada depende de que todos los casos del país quepan en una sola respuesta.
  const [zonas, setZonas] = useState<ZonaMapa[]>([]);
  const [truncado, setTruncado] = useState(false);
  const [totalMapa, setTotalMapa] = useState(0);
  const [roster, setRoster] = useState<{ id: string; username: string; nombres?: string; apellidos?: string }[]>([]);
  const [hallazgosSrv, setHallazgosSrv] = useState<any[]>([]);
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
  const navegar = useNavigate();
  const verExpediente = (id: number) => navegar("/expedientes/" + id);
  const [eventos, setEventos] = useState<EventoCampo[]>([]);
  // Recorrido real del auditor elegido: día, momento que se está viendo (null = ver todo) y reproducción automática.
  const hoy = () => new Date().toLocaleDateString("en-CA"); // AAAA-MM-DD en hora local
  const [fechaRuta, setFechaRuta] = useState(hoy);
  const [idxRepeticion, setIdxRepeticion] = useState<number | null>(null);
  const [reproduciendo, setReproduciendo] = useState(false);
  // Buscar y filtrar por estado; capas visibles del mapa; leyenda; reencuadre y vuelo a un cliente.
  const [busca, setBusca] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState<"TODOS" | "VIVO" | "ALERTA" | "SIN_SENAL">("TODOS");
  const [capas, setCapas] = useState({ auditores: true, clientes: true });
  const [leyenda, setLeyenda] = useState(true);
  const [reencuadre, setReencuadre] = useState(0);
  const [camara, setCamara] = useState<Camara | null>(null);

  // Posiciones y avisos: cambian a cada rato (además llegan por socket). Los casos asignados cambian poco y se piden aparte.
  const cargarVivo = async () => {
    try {
      const [ubis, evs]: any[] = await Promise.all([
        request("/api/usuarios/ubicaciones"),
        request("/api/usuarios/eventos").catch(() => ({ data: null })), // los avisos no deben tumbar el mapa si fallan
      ]);
      if (ubis.ahora) { offsetRef.current = Date.parse(ubis.ahora) - Date.now(); setAhoraMs(Date.now() + offsetRef.current); }
      setUbicaciones(ubis.data);
      if (evs.data) setEventos(evs.data);
    } catch (e: any) {
      setError(e.message);
    }
  };
  const cargarMapa = async () => {
    try {
      const q = new URLSearchParams();
      if (departamentoFiltro !== "TODOS") q.set("departamento", departamentoFiltro);
      if (provinciaFiltro !== "TODOS") q.set("provincia", provinciaFiltro);
      if (distritoFiltro !== "TODOS") q.set("distrito", distritoFiltro);
      const r: any = await request("/api/asignaciones/mapa?" + q.toString());
      setAsignaciones(r.data); setTruncado(Boolean(r.truncado)); setTotalMapa(r.total ?? r.data.length);
      if (r.zonas) setZonas(r.zonas);
    } catch (e: any) {
      setError(e.message);
    }
  };
  const cargarMapaRef = useRef(cargarMapa);
  cargarMapaRef.current = cargarMapa;
  const cargarRoster = async () => {
    try { const r: any = await request("/api/usuarios/auditores"); setRoster(r.data || []); } catch { /* el roster completa la lista; sin él se usan los auditores con casos o con ubicación */ }
  };

  useEffect(() => {
    cargarVivo();
    cargarRoster();
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
    // Con cientos de auditores llegan decenas de posiciones por segundo: pintar el mapa en cada una congelaba la pantalla. Se juntan
    // (la última de cada auditor) y se aplican todas de una vez cada segundo.
    const pendientes = new Map<string, Ubicacion>();
    socket.on("ubicacion_actualizada", (data: any) => {
      pendientes.set(data.id_usuario, {
        id: data.id_usuario, username: data.username,
        nombres: data.nombres || "", apellidos: data.apellidos || "",
        rol: data.rol || "", latitud: Number(data.latitud), longitud: Number(data.longitud),
        actualizado_en: data.actualizado_en || data.fecha || new Date(Date.now() + offsetRef.current).toISOString(),
        precision: data.precision ?? null, simulada: Boolean(data.simulada),
        bateria: data.bateria ?? null, cargando: Boolean(data.cargando),
      });
    });
    const aplicarPendientes = window.setInterval(() => {
      if (!pendientes.size) return;
      const lote = new Map(pendientes); pendientes.clear();
      // La función es pura (React puede ejecutarla dos veces): no toca `lote`, solo lo lee.
      setUbicaciones((prev) => {
        const vistos = new Set<string>();
        const next = prev.map((u) => { const nuevo = lote.get(u.id); if (!nuevo) return u; vistos.add(u.id); return { ...u, ...nuevo }; }); // conserva el estado de jornada que ya se conocía
        const nuevos = [...lote.values()].filter((n) => !vistos.has(n.id));
        return nuevos.length ? [...next, ...nuevos] : next;
      });
    }, 1000);
    // Llegada o salida de un cliente: entra al principio de la lista al instante.
    socket.on("evento_campo", (e: EventoCampo) => setEventos((prev) => (prev.some((x) => x.id === e.id) ? prev : [e, ...prev].slice(0, 300))));
    // El socket trae cada posición al instante; este refresco solo cubre cortes de conexión. El segundero actualiza «hace X s».
    const timer = setInterval(cargarVivo, 10000);
    // Los casos asignados cambian poco: se piden cada minuto y, enseguida, cuando el servidor avisa que cambió la muestra o se registró una visita.
    const timerMapa = setInterval(() => cargarMapaRef.current(), 60000);
    let espera = 0;
    const recargarMapa = () => { window.clearTimeout(espera); espera = window.setTimeout(() => cargarMapaRef.current(), 800); };
    socket.on("muestra_actualizada", recargarMapa);
    socket.on("visita_registrada", recargarMapa);
    const reloj = setInterval(() => setAhoraMs(Date.now() + offsetRef.current), 5000);
    return () => { socket.disconnect(); clearInterval(timer); clearInterval(timerMapa); window.clearTimeout(espera); clearInterval(reloj); window.clearInterval(aplicarPendientes); };
  }, []);
  // Al cambiar de zona se piden al servidor solo los clientes de esa zona.
  useEffect(() => { cargarMapaRef.current(); }, [departamentoFiltro, provinciaFiltro, distritoFiltro]);
  // Buscar un cliente por nombre, código o documento se hace en el servidor (en todo el país, no solo entre los que están en pantalla).
  useEffect(() => {
    const texto = busca.trim();
    if (texto.length < 2) { setHallazgosSrv([]); return; }
    const t = window.setTimeout(async () => {
      try {
        const r: any = await request("/api/asignaciones/mapa?limite=5&q=" + encodeURIComponent(texto));
        setHallazgosSrv((r.data || []).map((a: any) => ({ ...a, latitud: Number(a.expediente.latitud), longitud: Number(a.expediente.longitud) })));
      } catch { setHallazgosSrv([]); }
    }, 300);
    return () => window.clearTimeout(t);
  }, [busca]);

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
  // Escape suelta al auditor elegido y vuelve a la vista general.
  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => { if (e.key === "Escape") setSeleccionado(null); };
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, []);

  // El roster de auditores se arma a partir de las asignaciones (quién pertenece a
  // cada zona, tenga o no el GPS prendido en este momento) y se le superpone la
  // ubicación en vivo de quienes sí la están transmitiendo ahora mismo — así un
  // auditor no "desaparece" de su zona solo porque no tiene la app abierta.
  const auditorPorId = useMemo(() => {
    const mapa = new Map<string, AuditorInfo>();
    roster.forEach((r) => {
      mapa.set(r.id, {
        id: r.id, username: r.username, nombres: r.nombres || "", apellidos: r.apellidos || "",
        rol: "AUDITOR", latitud: null, longitud: null, enVivo: false, actualizadoEn: null, precision: null, simulada: false,
        enJornada: false, jornadaInicio: null, jornadaFin: null, bateria: null, cargando: false, movimiento: null,
      });
    });
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
  }, [asignaciones, ubicaciones, roster]);
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
  const suma = (lista: ZonaMapa[]) => lista.reduce((n, z) => n + z.n, 0);
  const departamentos = useMemo(() => Array.from(new Set(zonas.map((z) => z.departamento).filter(Boolean) as string[])).sort(), [zonas]);
  const enDepartamento = useMemo(() => zonas.filter((z) => departamentoFiltro === "TODOS" || z.departamento === departamentoFiltro), [zonas, departamentoFiltro]);
  const provincias = useMemo(() => Array.from(new Set(enDepartamento.map((z) => z.provincia).filter(Boolean) as string[])).sort(), [enDepartamento]);
  const enProvincia = useMemo(() => enDepartamento.filter((z) => provinciaFiltro === "TODOS" || z.provincia === provinciaFiltro), [enDepartamento, provinciaFiltro]);
  const distritos = useMemo(() => Array.from(new Set(enProvincia.map((z) => z.distrito).filter(Boolean) as string[])).sort(), [enProvincia]);
  // El servidor ya filtró por la zona elegida; aquí solo se vuelve a asegurar (por si la respuesta llega después de cambiar de zona).
  const clientesEnZona = useMemo(
    () => todosLosClientes.filter((a) => (departamentoFiltro === "TODOS" || a.expediente.departamento === departamentoFiltro) && (provinciaFiltro === "TODOS" || a.expediente.provincia === provinciaFiltro) && (distritoFiltro === "TODOS" || a.expediente.distrito === distritoFiltro)),
    [todosLosClientes, departamentoFiltro, provinciaFiltro, distritoFiltro]
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

  // Vista general (sin auditor elegido): se encuadra todo lo de la zona al cargar y al cambiar de zona, no con cada posición nueva.
  const coordsTodos = useMemo<[number, number][]>(() => [
    ...auditoresConMapa.map((u) => [u.latitud as number, u.longitud as number] as [number, number]),
    ...clientesEnZona.map((a) => [a.latitud, a.longitud] as [number, number]),
  ], [auditoresConMapa, clientesEnZona]);
  const zonaClave = [departamentoFiltro, provinciaFiltro, distritoFiltro, coordsTodos.length > 0 ? "con-datos" : "vacio"].join("|");

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
  const nombreAud = (u: { nombres: string; apellidos: string; username: string }) => `${u.nombres || u.username} ${u.apellidos}`.trim();
  // Alerta: GPS simulado, señal perdida en plena jornada o batería por agotarse.
  const esAlerta = (u: AuditorInfo) => (u.simulada && frescura(u).estado !== "SIN_UBICACION") || perdioSenal(u) || bateriaBaja(u);
  const sinSenalDe = (u: AuditorInfo) => frescura(u).estado === "SIN_SENAL" || frescura(u).estado === "SIN_UBICACION";
  const cuentas = {
    todos: auditoresVisibles.length,
    vivo: auditoresVisibles.filter((u) => frescura(u).estado === "VIVO").length,
    alerta: auditoresVisibles.filter(esAlerta).length,
    sinSenal: auditoresVisibles.filter(sinSenalDe).length,
  };
  const textoBuscado = norm(busca.trim());
  const pasaFiltros = (u: AuditorInfo) => u.id === seleccionado ||
    ((estadoFiltro === "TODOS" || (estadoFiltro === "VIVO" && frescura(u).estado === "VIVO") || (estadoFiltro === "ALERTA" && esAlerta(u)) || (estadoFiltro === "SIN_SENAL" && sinSenalDe(u)))
    && (!textoBuscado || norm(`${u.nombres} ${u.apellidos} ${u.username}`).includes(textoBuscado)));
  const marcadores = auditoresConMapa.filter(pasaFiltros);
  // Clientes que coinciden con lo buscado: al elegir uno se selecciona a su auditor y el mapa vuela hasta él.
  const hallazgos = textoBuscado.length < 2 ? [] : hallazgosSrv;
  const resumenZona = departamentoFiltro === "TODOS" ? "Todo el país" : [departamentoFiltro, provinciaFiltro, distritoFiltro].filter((x) => x !== "TODOS").join(" › ");
  const auditoresOrdenados = [...auditoresVisibles].filter(pasaFiltros).sort((a, b) => prioridad(a) - prioridad(b) || (a.nombres + " " + a.apellidos).localeCompare(b.nombres + " " + b.apellidos));

  // Estado en palabras (el mismo texto para la lista y para el resumen del auditor elegido).
  const estadoTexto = (u: AuditorInfo) => {
    const f = frescura(u); const hace = haceTexto(f.segundos);
    // Dentro de la jornada, no tener señal es una alerta; fuera de ella solo es información.
    const etiqueta = u.enJornada
      ? (f.estado === "VIVO" ? "En jornada · en vivo " + hace : f.estado === "RECIENTE" ? "En jornada · reciente " + hace : f.estado === "SIN_UBICACION" ? (sinPosicionDesdeInicio(u) ? "Perdió la señal en plena jornada · no mandó ninguna posición" : "En jornada · esperando su primera posición") : "Perdió la señal en plena jornada · última " + hace)
      : (f.estado === "VIVO" ? "En vivo · " + hace : f.estado === "RECIENTE" ? "Reciente · " + hace : f.estado === "SIN_SENAL" ? "Fuera de jornada · última " + hace + (u.jornadaFin ? " (terminó " + horaCorta(u.jornadaFin) + ")" : "") : "Sin GPS ahora");
    const simulada = u.simulada && f.estado !== "SIN_UBICACION";
    const clase = simulada || perdioSenal(u) ? " bad" : f.estado === "VIVO" ? " on" : f.estado === "RECIENTE" || (u.enJornada && f.estado === "SIN_UBICACION") ? " warn" : "";
    return { etiqueta, clase, simulada };
  };

  const mover = (c: Omit<Camara, "n">) => setCamara({ ...c, n: Date.now() + Math.random() });
  const LEJOS_M = 60_000; // más allá de esto un cliente se considera de otra zona y no entra en el encuadre automático
  // Elegir (o soltar) a un auditor. Con un cliente, el mapa vuela al cliente; si no, se centra en el auditor (o, sin posición, en sus clientes cercanos).
  const elegirAuditor = (id: string | null, cliente?: [number, number]) => {
    setSeleccionado(id);
    if (!id) return;
    if (cliente) { mover({ modo: "cliente", punto: cliente }); return; }
    const a = auditorPorId.get(id);
    if (a?.enVivo) { mover({ modo: "auditor", punto: [a.latitud as number, a.longitud as number] }); return; }
    const suyos = todosLosClientes.filter((c) => c.id_usuario_auditor === id);
    if (!suyos.length) return;
    const cerca = suyos.filter((c) => distanciaMetros(suyos[0].latitud, suyos[0].longitud, c.latitud, c.longitud) <= LEJOS_M);
    mover({ modo: "ruta", coords: cerca.map((c) => [c.latitud, c.longitud] as [number, number]) });
  };

  // Resumen del auditor elegido.
  const auditorSel = seleccionado ? auditorPorId.get(seleccionado) || null : null;
  const visitadosHoy = new Set(eventos.filter((e) => e.id_usuario === seleccionado && e.tipo === "LLEGADA").map((e) => e.id_expediente)).size;
  const proximo = enRuta[0] || null;
  const rutaKm = rutaSugerida.reduce((suma, p, i) => (i === 0 ? 0 : suma + distanciaMetros(rutaSugerida[i - 1][0], rutaSugerida[i - 1][1], p[0], p[1])), 0);
  const lejanos = origenRuta ? clientesDelAuditorSeleccionado.filter((c) => distanciaMetros(origenRuta.latitud, origenRuta.longitud, c.latitud, c.longitud) > LEJOS_M).length : 0;
  // Frase bajo los botones de estado: qué hay en ese grupo (y qué hacer si está vacío).
  const resumenChip = (() => {
    if (estadoFiltro === "ALERTA") {
      const sj = auditoresVisibles.filter(perdioSenal).length; const bj = auditoresVisibles.filter(bateriaBaja).length;
      const gs = auditoresVisibles.filter((u) => u.simulada && frescura(u).estado !== "SIN_UBICACION").length;
      const partes = [sj ? sj + " sin señal en plena jornada" : "", bj ? bj + " con batería baja" : "", gs ? gs + " con GPS simulado" : ""].filter(Boolean);
      return partes.length ? partes.join(" · ") : "Sin alertas por ahora.";
    }
    if (estadoFiltro === "VIVO") return cuentas.vivo ? null : "Nadie transmite ahora. Aparecen aquí cuando inician su jornada.";
    if (estadoFiltro === "SIN_SENAL") return cuentas.sinSenal + " sin posición en los últimos 5 min o que nunca transmitieron.";
    return null;
  })();

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
      {truncado ? <div role="status" className="callout aviso">Hay {totalMapa} clientes con caso activo en esta vista y se muestran los primeros {asignaciones.length}. Elige una zona (departamento, provincia o distrito) para verlos todos.</div> : null}

      <div className="seg-layout">
        <aside className="seg-side" aria-label="Zona, auditores y ruta">
          {auditorSel ? (() => {
            const est = estadoTexto(auditorSel);
            const mov = textoMovimiento(auditorSel.movimiento, ahoraMs);
            const lugar = eventos.find((x) => x.id_usuario === auditorSel.id);
            return (
              <section className="resumen-aud" aria-label={"Resumen de " + nombreAud(auditorSel)}>
                <div className="resumen-cab">
                  <Avatar nombre={nombreAud(auditorSel)} />
                  <div className="resumen-quien"><b>{nombreAud(auditorSel)}</b><span className={"live" + est.clase}>{est.simulada ? "GPS simulado · " : ""}{est.etiqueta}</span></div>
                  <button type="button" className="btn quiet small" onClick={() => elegirAuditor(null)}>Soltar</button>
                </div>
                <dl className="resumen-datos">
                  <div><dt>Casos activos</dt><dd>{clientesDelAuditorSeleccionado.length}</dd></div>
                  <div><dt>Visitados hoy</dt><dd>{visitadosHoy}</dd></div>
                  <div><dt>Batería</dt><dd className={bateriaBaja(auditorSel) ? "bajo" : ""}>{auditorSel.bateria != null ? auditorSel.bateria + " %" + (auditorSel.cargando ? " · cargando" : "") : "—"}</dd></div>
                  <div><dt>Movimiento</dt><dd>{mov || "—"}</dd></div>
                </dl>
                {lugar && lugar.tipo === "LLEGADA" ? <p className="resumen-linea">En la visita de <b>{lugar.cliente || "un cliente"}</b> desde {horaCorta(lugar.fecha)}</p> : null}
                {proximo ? <p className="resumen-linea">Siguiente: <b>{proximo.expediente.nombres_cliente}</b> · {fmtDistancia(proximo.distanciaDesdeAsesor)}{rutaKm > 0 ? " · ruta de " + fmtDistancia(rutaKm) + " en total" : ""}</p> : null}
                {lejanos > 0 ? <p className="resumen-linea apagado">{lejanos} {lejanos === 1 ? "cliente está" : "clientes están"} a más de 60 km: no entran en el encuadre.</p> : null}
                <div className="resumen-acciones">
                  {auditorSel.enVivo ? <button type="button" className="btn small" onClick={() => mover({ modo: "auditor", punto: [auditorSel.latitud as number, auditorSel.longitud as number] })}>Centrar en él</button> : null}
                  {rutaSugerida.length > 1 ? <button type="button" className="btn small quiet" onClick={() => mover({ modo: "ruta", coords: rutaSugerida })}>Ver ruta completa</button> : null}
                </div>
              </section>
            );
          })() : null}
          <div className="seg-busca">
            <label className="sr-only" htmlFor="seg-busca">Buscar auditor o cliente</label>
            <input id="seg-busca" name="busqueda" type="search" autoComplete="off" spellCheck={false} placeholder="Buscar auditor o cliente…" value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>
          {hallazgos.length ? (
            <ul className="hallazgos" aria-label="Clientes encontrados">
              {hallazgos.map((a) => (
                <li key={a.id_asignacion}>
                  <button type="button" onClick={() => { elegirAuditor(a.id_usuario_auditor, [a.latitud, a.longitud]); setBusca(""); }}>
                    <b>{a.expediente.nombres_cliente}</b>
                    <small>{a.expediente.codigo_expediente} · {a.expediente.distrito || "-"} · {nombreAud(auditorPorId.get(a.id_usuario_auditor) || { nombres: "", apellidos: "", username: "sin auditor" })}</small>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <div className="seg-chips" role="group" aria-label="Filtrar auditores por estado">
            {([["TODOS", "Todos", cuentas.todos], ["VIVO", "En vivo", cuentas.vivo], ["ALERTA", "Alertas", cuentas.alerta], ["SIN_SENAL", "Sin señal", cuentas.sinSenal]] as const).map(([id, texto, n]) => (
              <button key={id} type="button" className={"seg-chip" + (estadoFiltro === id ? " on" : "") + (id === "ALERTA" && n ? " alerta" : "")} aria-pressed={estadoFiltro === id} onClick={() => setEstadoFiltro(id)}>{texto} <b>{n}</b></button>
            ))}
          </div>
          {resumenChip ? <p className="seg-resumen" role="status">{resumenChip}</p> : null}
          <details className="zona-det">
            <summary><span>Zona</span><em>{resumenZona}</em></summary>
          {departamentos.length ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <Field label="Departamento">
                <select name="departamento" value={departamentoFiltro} onChange={(e) => { setDepartamentoFiltro(e.target.value); setProvinciaFiltro("TODOS"); setDistritoFiltro("TODOS"); }}>
                  <option value="TODOS">Todos ({suma(zonas)})</option>
                  {departamentos.map((d) => (
                    <option key={d} value={d}>{d} ({suma(zonas.filter((z) => z.departamento === d))})</option>
                  ))}
                </select>
              </Field>
              {provincias.length > 1 ? (
                <Field label="Provincia">
                  <select name="provincia" value={provinciaFiltro} onChange={(e) => { setProvinciaFiltro(e.target.value); setDistritoFiltro("TODOS"); }}>
                    <option value="TODOS">Todas ({suma(enDepartamento)})</option>
                    {provincias.map((p) => (
                      <option key={p} value={p}>{p} ({suma(enDepartamento.filter((z) => z.provincia === p))})</option>
                    ))}
                  </select>
                </Field>
              ) : null}
              {distritos.length > 1 ? (
                <Field label="Distrito">
                  <select name="distrito" value={distritoFiltro} onChange={(e) => setDistritoFiltro(e.target.value)}>
                    <option value="TODOS">Todos ({suma(enProvincia)})</option>
                    {distritos.map((d) => (
                      <option key={d} value={d}>{d} ({suma(enProvincia.filter((z) => z.distrito === d))})</option>
                    ))}
                  </select>
                </Field>
              ) : null}
            </div>
          ) : <p className="subtle">Aún no hay expedientes asignados con ubicación registrada.</p>}
          </details>

          <h2 className="section-title">Auditores{zonaActiva ? ` en ${departamentoFiltro}` : ""} ({auditoresVisibles.length})</h2>
          {!auditoresVisibles.length ? (
            <p className="subtle">{zonaActiva ? "Ningún auditor tiene clientes en esta zona." : "Nadie tiene casos asignados con ubicación todavía."}</p>
          ) : null}
          <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 340, overflowY: "auto", overscrollBehavior: "contain" }}>
            {auditoresOrdenados.map((u) => {
              const nombreU = `${u.nombres || u.username} ${u.apellidos}`.trim();
              const f = frescura(u);
              const { etiqueta, clase, simulada } = estadoTexto(u);
              const mov = f.estado !== "SIN_SENAL" ? textoMovimiento(u.movimiento, ahoraMs) : null;
              const enVisita = eventos.find((x) => x.id_usuario === u.id); // el aviso más reciente: si es una llegada, sigue en la visita
              return (
                <button key={u.id} type="button" className={`pick${seleccionado === u.id ? " on" : ""}`} aria-pressed={seleccionado === u.id} onClick={() => elegirAuditor(u.id === seleccionado ? null : u.id)}>
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
              <details className="seg-sec" open>
              <summary>Recorrido real</summary>
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
              </details>
              <details className="seg-sec" open>
              <summary>Ruta del día</summary>
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
              </details>
            </>
          ) : null}
        </aside>

        <div className="seg-mapcard">
          <MapContainer center={CENTER} zoom={5} className="seguimiento-map">
            <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            {!seleccionado ? <FitBounds coords={coordsTodos} clave={zonaClave} nonce={reencuadre} /> : null}
            <CamaraMapa camara={camara} />
            <ClickParaIniciar activo={Boolean(seleccionado && !origenRuta)} onClick={setPuntoManual} />
            {capas.auditores ? marcadores.map((u) => { const f = frescura(u); return f.estado !== "SIN_SENAL" && u.precision ? (
              <Circle key={"p-" + u.id} center={[u.latitud as number, u.longitud as number]} radius={Math.min(u.precision, 500)} pathOptions={{ color: u.simulada ? "#d92d20" : colorForRol(u.rol), weight: 1, fillOpacity: 0.08 }} />
            ) : null; }) : null}
            {capas.auditores ? marcadores.filter((u) => u.id !== seleccionado).map((u) => {
              const f = frescura(u);
              return (
                <AuditorMarker key={u.id} posicion={[u.latitud as number, u.longitud as number]} icon={markerIcon(nombreAud(u), u.rol, f.estado, u.simulada, esAlerta(u), false, enVivo <= 60)} onClick={() => elegirAuditor(u.id)}>
                  <Popup>
                    <div className="pop">
                      <strong>{nombreAud(u)}</strong><span className="pop-rol">{u.rol}</span>
                      <div>{f.estado === "VIVO" ? "En vivo" : f.estado === "RECIENTE" ? "Reciente" : "Sin señal"} · {haceTexto(f.segundos)}{u.precision ? " · precisión ±" + Math.round(u.precision) + " m" : ""}</div>
                      {u.simulada ? <div><strong style={{ color: "#d92d20" }}>El celular avisó GPS simulado</strong></div> : null}
                      {u.bateria != null ? <div>Batería {u.bateria} %{u.cargando ? " · cargando" : ""}</div> : null}
                      {textoMovimiento(u.movimiento, ahoraMs) ? <div>{textoMovimiento(u.movimiento, ahoraMs)}</div> : null}
                    </div>
                  </Popup>
                </AuditorMarker>
              );
            }) : null}
            {origenRuta ? (
              <Marker
                position={[origenRuta.latitud, origenRuta.longitud]}
                icon={puntoManual || !auditorSeleccionado ? inicioIcon : markerIcon(nombreAud(auditorSeleccionado), auditorSeleccionado.rol, frescura(auditorSeleccionado).estado, auditorSeleccionado.simulada, esAlerta(auditorSeleccionado), true)}
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
              <Marker key={a.id_asignacion} position={[a.latitud, a.longitud]} icon={routeStopIcon(a.orden)} title={a.expediente.nombres_cliente}>
                <Popup minWidth={230} maxWidth={300}>
                  <TarjetaCliente a={a} auditor={nombreAud(auditorPorId.get(a.id_usuario_auditor) || { nombres: "", apellidos: "", username: "—" })} orden={a.orden} distancia={a.distanciaDesdeAsesor} onVer={verExpediente} />
                </Popup>
              </Marker>
            ))}
            {enRuta.slice(0, 8).map((a) => <Circle key={"g-" + a.id_asignacion} center={[a.latitud, a.longitud]} radius={GEOCERCA_M} pathOptions={{ color: RUTA_COLOR, weight: 1, dashArray: "4 4", fillOpacity: 0.06 }} />)}
            {capas.clientes ? <ClientesAgrupados clientes={clientesSinRuta} nombreAuditor={(id) => { const a = auditorPorId.get(id); return a ? (a.nombres || a.username) : "—"; }} onVerAuditor={(id) => elegirAuditor(id)} origen={origenRuta} onVer={verExpediente} /> : null}
            {rutaSugerida.length > 1 ? <Polyline positions={rutaSugerida} pathOptions={{ color: RUTA_COLOR, weight: 4, opacity: 0.85 }} /> : null}
            {polyline.length > 1 ? <Polyline positions={polyline} pathOptions={{ color: "#94a3b8", weight: 2, opacity: 0.7, dashArray: "4 6" }} /> : null}
            {rutaRecorrida.length > 1 ? <Polyline positions={rutaRecorrida} pathOptions={{ color: INICIO_COLOR, weight: 4, opacity: 0.9 }} /> : null}
            {puntoRepeticion ? <CircleMarker center={[puntoRepeticion.latitud, puntoRepeticion.longitud]} radius={9} pathOptions={{ color: "#ffffff", weight: 3, fillColor: INICIO_COLOR, fillOpacity: 1 }} /> : null}
            {reproduciendo && puntoRepeticion ? <SeguirPunto latitud={puntoRepeticion.latitud} longitud={puntoRepeticion.longitud} /> : null}
          </MapContainer>
          <div className="map-tools" role="toolbar" aria-label="Controles del mapa">
            <button type="button" onClick={() => { setSeleccionado(null); setReencuadre((n) => n + 1); }}>Ver todo</button>
            <button type="button" aria-pressed={capas.auditores} className={capas.auditores ? "on" : ""} onClick={() => setCapas((c) => ({ ...c, auditores: !c.auditores }))}>Auditores</button>
            <button type="button" aria-pressed={capas.clientes} className={capas.clientes ? "on" : ""} onClick={() => setCapas((c) => ({ ...c, clientes: !c.clientes }))}>Clientes</button>
            <button type="button" aria-pressed={leyenda} className={leyenda ? "on" : ""} onClick={() => setLeyenda((v) => !v)}>Leyenda</button>
          </div>
          <div className={"maplegend" + (leyenda ? "" : " cerrada")} aria-label="Leyenda del mapa">
            <span style={{ ["--c" as any]: "#0ead7a" }}><i />Auditor en vivo</span>
            <span style={{ ["--c" as any]: "#d92d20" }}><i />Alerta</span>
            <span style={{ ["--c" as any]: "#94a3b8" }}><i />Sin señal</span>
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
