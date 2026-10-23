import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle, CircleMarker, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { io, Socket } from "socket.io-client";
import { renderToStaticMarkup } from "react-dom/server";
import { useNavigate } from "react-router-dom";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "../seguimiento.css";
import { API_URL, getToken, request } from "../api";
import { Avatar } from "../components/ui";
import { Icon } from "../components/icons";
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
// `estado` y `fecha_fin` solo vienen cuando se pidió lo visitado hoy: FINALIZADA = la visita ya se registró.
type Asignacion = {
  id_asignacion: number; id_usuario_auditor: string; prioridad: string; estado?: string; fecha_fin?: string | null; expediente: any;
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
// Colores del diseño de Figma: el auditor y su recorrido registrado van en índigo, la secuencia sugerida en el mismo tono más claro.
const INDIGO = "#4858b9";
const INDIGO_CLARO = "#8189c9";
const ALERTA_COLOR = "#d92d20";
const SIN_SENAL_COLOR = "#9aa1b8";
const SUPERVISOR_COLOR = "#0f8f8f";
// Cada prioridad tiene su letra y su par de colores (relleno claro y letra en el tono fuerte); `punto` es el puntito de los botones del filtro.
const PRIORIDAD: Record<string, { letra: string; nombre: string; fondo: string; tinta: string; punto: string }> = {
  ALTA: { letra: "A", nombre: "Alta", fondo: "#fceced", tinta: "#a24542", punto: "#a51d1d" },
  MEDIA: { letra: "M", nombre: "Media", fondo: "#fff1d8", tinta: "#8b550c", punto: "#f0a050" },
  BAJA: { letra: "B", nombre: "Baja", fondo: "#eef0f4", tinta: "#636776", punto: "#999ca8" },
};
const prio = (p: string) => PRIORIDAD[p] || PRIORIDAD.BAJA;
const PRIORIDADES = ["ALTA", "MEDIA", "BAJA"] as const;
// Estado de la visita de cada cliente: VISITADO = la visita ya se registró hoy; EN_RUTA = su auditor tiene la jornada iniciada; PENDIENTE = todavía no sale.
const ESTADOS_VISITA = [["PENDIENTE", "Pendiente"], ["EN_RUTA", "En ruta"], ["VISITADO", "Visitado"]] as const;
const TIPOS_FICHA = [["CONSUMO", "Consumo"], ["OTROS", "MYPE"]] as const;

function colorForRol(rol: string) {
  return rol === "SUPERVISOR" ? SUPERVISOR_COLOR : INDIGO;
}

const norm = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const escHtml = (t: string) => String(t).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
const iniciales = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "?";
const alternar = (lista: string[], valor: string) => (lista.includes(valor) ? lista.filter((x) => x !== valor) : [...lista, valor]);

// Auditor en el mapa: círculo con sus iniciales. El color dice el estado (índigo en línea, gris sin señal, rojo si hay una alerta o GPS simulado),
// el anillo late mientras está en vivo y el auditor elegido va más grande, con un halo alrededor (como en el diseño).
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
  const color = simulada || alerta ? ALERTA_COLOR : estado === "SIN_SENAL" ? SIN_SENAL_COLOR : colorForRol(rol);
  const clases = "aud-pin" + (estado === "VIVO" && !simulada && (pulsar || elegido) ? " gps-vivo" : "");
  const tam = elegido ? 80 : 38;
  return L.divIcon({
    className: "",
    html: '<div class="aud-caja' + (elegido ? " elegido" : "") + '" style="--c:' + color + '">' + (elegido ? '<div class="aud-halo"></div>' : "") + '<div class="' + clases + '"><span>' + escHtml(iniciales(nombre)) + "</span></div></div>",
    iconSize: [tam, tam],
    iconAnchor: [tam / 2, tam / 2],
  });
}

// Punto de partida manual del auditor: pin «gota» índigo, distinto de los círculos con letra de los clientes.
const inicioIcon = L.divIcon({
  className: "",
  html: `<div style="width:26px;height:26px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${INDIGO};border:3px solid #fff;box-shadow:0 2px 8px rgba(40,50,130,.45)"></div>`,
  iconSize: [26, 26],
  iconAnchor: [13, 26],
});

// Cliente en el mapa: círculo con la letra de su prioridad (A, M o B). Con `orden` lleva un numerito (su lugar en la secuencia sugerida del auditor elegido)
// y con `visitado` se ve atenuado y con una marca de visto: la visita ya se registró hoy.
function clienteIcon(prioridad: string, visitado = false, orden = 0) {
  return conCache(["c", prioridad, visitado, orden].join("|"), () => crearClienteIcon(prioridad, visitado, orden));
}
function crearClienteIcon(prioridad: string, visitado: boolean, orden: number) {
  const p = prio(prioridad);
  return L.divIcon({
    className: "",
    html: `<div class="cli${visitado ? " visto" : ""}" style="--f:${p.fondo};--t:${p.tinta}"><span>${p.letra}</span>${orden ? `<i class="ord">${orden}</i>` : ""}${visitado ? '<i class="ok" aria-hidden="true"></i>' : ""}</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
}
// Mientras la tarjeta de un cliente está abierta, su círculo se agranda y se rodea del color de su prioridad.
// Al abrirse, la tarjeta se acomoda en el hueco libre del mapa: debajo de los controles de arriba y a la derecha de la columna de filtros.
const opcionesTarjeta = (): L.PopupOptions => (window.innerWidth > 900
  ? { autoPanPaddingTopLeft: L.point(430, 125), autoPanPaddingBottomRight: L.point(60, 130) }
  : { autoPanPaddingTopLeft: L.point(20, 75), autoPanPaddingBottomRight: L.point(20, 165) });
const alAbrirTarjeta = (m: L.Marker) => {
  m.on("popupopen", () => m.getElement()?.classList.add("abierto"));
  m.on("popupclose", () => m.getElement()?.classList.remove("abierto"));
};

const fmtMonto = (monto: any, moneda?: string) => (monto == null || Number(monto) <= 0 ? null : (moneda === "USD" ? "US$ " : "S/ ") + Number(monto).toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));

// Tarjeta de un cliente (el mismo contenido para las paradas de la ruta y para cualquier otro punto del mapa).
function TarjetaCliente({ a, auditor, orden, distancia, etiquetaDistancia, onVer, conAuditor }: { a: { prioridad: string; id_usuario_auditor?: string; estado?: string; fecha_fin?: string | null; expediente: any }; auditor: string; orden?: number; distancia?: number | null; etiquetaDistancia?: string; onVer?: (id: number) => void; conAuditor?: boolean }) {
  const e = a.expediente;
  const p = prio(a.prioridad);
  const monto = fmtMonto(e.monto_desembolso, e.moneda);
  const lugar = [e.direccion_domicilio, e.distrito].filter(Boolean).join(", ");
  return (
    <div className="pop pop-cliente">
      <div className="pop-cab"><span className="pop-prio" style={{ background: p.fondo, color: p.tinta }}>{p.letra} · {p.nombre}</span><strong>{orden ? orden + ". " : ""}{e.nombres_cliente}</strong></div>
      <div className="pop-linea">Expediente: <span className="pop-codigo" translate="no">{e.codigo_expediente}</span></div>
      <div className="pop-linea">Tipo: {e.tipo_credito === "OTROS" ? "MYPE" : "Consumo"}</div>
      {a.estado === "FINALIZADA" ? <div className="pop-linea pop-visto">Visitado hoy{a.fecha_fin ? " · " + horaCorta(a.fecha_fin) : ""}</div> : null}
      <div className="pop-mas">
        {lugar ? <div className="pop-linea">{lugar}</div> : null}
        {monto || e.asesor_responsable ? <div className="pop-linea">{monto ? <>Desembolso: <b>{monto}</b></> : null}{monto && e.asesor_responsable ? " · " : null}{e.asesor_responsable ? "Asesor: " + e.asesor_responsable : null}</div> : null}
        <div className="pop-linea">Auditor: {auditor}</div>
        {distancia != null ? <div className="pop-dist">{fmtDistancia(distancia)} {etiquetaDistancia || "desde el punto de partida"}</div> : null}
      </div>
      <div className="pop-acciones">
        <a className="pop-btn" href={"/expedientes/" + e.id_expediente} data-ver-exp={e.id_expediente} onClick={onVer ? (ev) => { ev.preventDefault(); onVer(e.id_expediente); } : undefined}>Ver expediente</a>
        {conAuditor && a.id_usuario_auditor ? <a className="pop-btn sec" href="#auditor" data-ver-auditor={a.id_usuario_auditor}>Ver al auditor</a> : null}
      </div>
    </div>
  );
}

type ClienteMapa = { id_asignacion: number; id_usuario_auditor: string; prioridad: string; estado?: string; fecha_fin?: string | null; visitado: boolean; latitud: number; longitud: number; expediente: any };

// Clientes de la zona agrupados: de lejos son burbujas con el número de clientes, al acercarse se separan. Al pasar el cursor por un
// cliente se dibuja su geocerca (el radio dentro del cual el servidor da por buena una visita).
function ClientesAgrupados({ clientes, nombreAuditor, onVerAuditor, origen, onVer }: { clientes: ClienteMapa[]; nombreAuditor: (id: string) => string; onVerAuditor: (id: string) => void; origen: { latitud: number; longitud: number } | null; onVer: (id: number) => void }) {
  const map = useMap();
  const datos = useRef({ clientes, nombreAuditor, onVerAuditor, origen, onVer });
  datos.current = { clientes, nombreAuditor, onVerAuditor, origen, onVer };
  // Los clientes se reciben de nuevo cada 10 s: el grupo solo se reconstruye si cambió algo (así no se cierra lo que el supervisor abrió).
  const clave = clientes.map((c) => c.id_asignacion + ":" + c.prioridad + ":" + c.id_usuario_auditor + ":" + (c.visitado ? "v" : "a")).join(",");
  useEffect(() => {
    const grupo = L.markerClusterGroup({
      showCoverageOnHover: false, maxClusterRadius: 46, spiderfyOnMaxZoom: true, chunkedLoading: true, zoomToBoundsOnClick: false,
      // La burbuja es blanca con el tono de la prioridad más alta que contiene (lo ya visitado no cuenta: si todo está visitado, va en verde).
      iconCreateFunction: (c) => {
        const prios = c.getAllChildMarkers().filter((m) => !(m.options as any).visitado).map((m) => (m.options as any).prioridad as string);
        const mayor = prios.includes("ALTA") ? "ALTA" : prios.includes("MEDIA") ? "MEDIA" : prios.length ? "BAJA" : null;
        const p = mayor ? prio(mayor) : null;
        return L.divIcon({ html: '<div class="cluster-pin" style="--f:' + (p ? p.fondo : "#e3f5ec") + ";--t:" + (p ? p.tinta : "#1e7a4d") + '"><span>' + c.getChildCount() + "</span></div>", className: "", iconSize: [42, 42] });
      },
    });
    // Tocar un grupo muestra su resumen (cuántos, de qué prioridad, cuáles) en vez de acercar el mapa de golpe; «Acercar» lo hace si se quiere.
    grupo.on("clusterclick", (ev) => {
      const hijos = ev.layer.getAllChildMarkers();
      const cuenta: Record<string, number> = {};
      hijos.forEach((m: L.Marker) => { const p = (m.options as any).prioridad as string; cuenta[p] = (cuenta[p] || 0) + 1; });
      const chips = PRIORIDADES.filter((p) => cuenta[p]).map((p) => '<span class="pop-prio" style="background:' + prio(p).fondo + ";color:" + prio(p).tinta + '">' + cuenta[p] + " " + prio(p).nombre.toLowerCase() + "</span>").join("");
      const nombres = hijos.slice(0, 5).map((m: L.Marker) => "<li>" + escHtml(m.options.title || "") + "</li>").join("") + (hijos.length > 5 ? '<li class="mas">y ' + (hijos.length - 5) + " más</li>" : "");
      const popup = L.popup({ minWidth: 220, maxWidth: 280, className: "sv-popup", ...opcionesTarjeta() }).setLatLng(ev.layer.getLatLng())
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
      const m = L.marker([a.latitud, a.longitud], { icon: clienteIcon(a.prioridad, a.visitado), title: a.expediente.nombres_cliente, prioridad: a.prioridad, visitado: a.visitado } as L.MarkerOptions);
      // El contenido se arma al abrir la tarjeta: así la distancia usa el auditor que esté elegido en ese momento.
      m.bindPopup(() => renderToStaticMarkup(<TarjetaCliente a={a} auditor={datos.current.nombreAuditor(a.id_usuario_auditor)} conAuditor
        distancia={datos.current.origen && !a.visitado ? distanciaMetros(datos.current.origen.latitud, datos.current.origen.longitud, a.latitud, a.longitud) : null} etiquetaDistancia="desde el auditor elegido" />), { minWidth: 240, maxWidth: 320, className: "sv-popup", ...opcionesTarjeta() });
      alAbrirTarjeta(m);
      m.on("popupopen", (ev) => {
        const caja = ev.popup.getElement();
        const enlace = caja?.querySelector("a[data-ver-exp]");
        if (enlace) enlace.addEventListener("click", (c) => { c.preventDefault(); datos.current.onVer(Number(enlace.getAttribute("data-ver-exp"))); });
        const aud = caja?.querySelector("a[data-ver-auditor]");
        if (aud) aud.addEventListener("click", (c) => { c.preventDefault(); map.closePopup(); datos.current.onVerAuditor(aud.getAttribute("data-ver-auditor") || ""); });
      });
      m.on("mouseover", () => { halo.clearLayers(); L.circle([a.latitud, a.longitud], { radius: GEOCERCA_M, color: prio(a.prioridad).tinta, weight: 1.5, dashArray: "4 4", fillOpacity: 0.08 }).addTo(halo); });
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
  const map = useMap();
  useMapEvents({
    click(e) {
      if (activo) onClick({ latitud: e.latlng.lat, longitud: e.latlng.lng });
    },
  });
  useEffect(() => { map.getContainer().classList.toggle("elegir-inicio", activo); }, [activo, map]);
  return null;
}

// Botón de filtro (píldora). `punto` es el puntito de color de la prioridad.
function Chip({ on, onClick, children, punto, alerta }: { on: boolean; onClick: () => void; children: ReactNode; punto?: string; alerta?: boolean }) {
  return (
    <button type="button" className={"sv-chip" + (on ? " on" : "") + (alerta ? " alerta" : "")} aria-pressed={on} onClick={onClick}>
      {punto ? <i className="punto" style={{ background: punto }} aria-hidden="true" /> : null}{children}
    </button>
  );
}

// Lista desplegable de zona: se ve como en el diseño («Lima (18)» con la cantidad en gris) y por debajo es un <select> de verdad (teclado, lector de pantalla y lista nativa).
type OpcionZona = { valor: string; texto: string; n: number };
function SelectZona({ name, etiqueta, valor, onChange, opciones, todos, deshabilitado }: { name: string; etiqueta: string; valor: string; onChange: (v: string) => void; opciones: OpcionZona[]; todos: { texto: string; n: number }; deshabilitado?: boolean }) {
  const actual = opciones.find((o) => o.valor === valor);
  return (
    <label className={"sv-sel" + (valor === "TODOS" ? " vacio" : "") + (deshabilitado ? " off" : "")}>
      <span className="sr-only">{etiqueta}</span>
      <span className="sv-sel-val" aria-hidden="true">{actual ? actual.texto : todos.texto} <em>({actual ? actual.n : todos.n})</em></span>
      <Icon name="abajo" size={16} />
      <select name={name} value={valor} disabled={deshabilitado} onChange={(e) => onChange(e.target.value)}>
        <option value="TODOS">{todos.texto} ({todos.n})</option>
        {opciones.map((o) => <option key={o.valor} value={o.valor}>{o.texto} ({o.n})</option>)}
      </select>
    </label>
  );
}

const rangoPrioridad: Record<string, number> = { ALTA: 0, MEDIA: 1, BAJA: 2 };
// Un cliente pasa los filtros de estado de la visita y de tipo de ficha (sin ninguno marcado, pasan todos).
const cumpleEstadoYTipo = (a: { estadoVisita: string; tipo: string }, estados: string[], tipos: string[]) => (!estados.length || estados.includes(a.estadoVisita)) && (!tipos.length || tipos.includes(a.tipo));
const AUDITORES_POR_PAGINA = 120; // la lista se arma por tandas: con cientos de auditores no se dibujan todos de golpe

export default function SeguimientoPage() {
  const [ubicaciones, setUbicaciones] = useState<Ubicacion[]>([]);
  const [asignaciones, setAsignaciones] = useState<Asignacion[]>([]);
  // Los clientes del mapa llegan filtrados por zona desde el servidor (con tope de seguridad); las zonas disponibles y el roster de auditores
  // se piden aparte, así nada depende de que todos los casos del país quepan en una sola respuesta.
  const [zonas, setZonas] = useState<ZonaMapa[]>([]);
  const [truncado, setTruncado] = useState(false);
  const [totalMapa, setTotalMapa] = useState(0);
  const [roster, setRoster] = useState<{ id: string; username: string; nombres?: string; apellidos?: string }[]>([]);
  const [carga, setCarga] = useState<Map<string, number> | null>(null); // casos activos de cada auditor en todo el país (el servidor los cuenta)
  const [hallazgosSrv, setHallazgosSrv] = useState<any[]>([]);
  const [seleccionado, setSeleccionado] = useState<string | null>(null);
  const [departamentoFiltro, setDepartamentoFiltro] = useState("TODOS");
  const [provinciaFiltro, setProvinciaFiltro] = useState("TODOS");
  const [distritoFiltro, setDistritoFiltro] = useState("TODOS");
  // Filtros de los clientes del mapa: sin ninguno marcado se ven todos; marcar varios de un grupo suma (alta o media).
  const [prioridades, setPrioridades] = useState<string[]>([]);
  const [estadosVisita, setEstadosVisita] = useState<string[]>([]);
  const [tipos, setTipos] = useState<string[]>([]);
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
  // Buscar y filtrar auditores por estado; capas visibles del mapa; reencuadre y vuelo a un cliente.
  const [busca, setBusca] = useState("");
  const [chipsAud, setChipsAud] = useState<string[]>([]); // EN_LINEA | SIN_GPS | SIN_ASIGNACIONES | ALERTA: sin ninguno se ven todos; con varios se suman
  const [capas, setCapas] = useState({ auditores: true, clientes: true });
  const [eventosAbiertos, setEventosAbiertos] = useState(false);
  const [limiteLista, setLimiteLista] = useState(AUDITORES_POR_PAGINA);
  const [reencuadre, setReencuadre] = useState(0);
  const [camara, setCamara] = useState<Camara | null>(null);
  const [mapa, setMapa] = useState<L.Map | null>(null);
  const inputBusca = useRef<HTMLInputElement | null>(null);
  // Si el servidor todavía no conoce `visitados_desde` (se actualizó el panel antes que el servidor), el mapa se pide sin él y solo faltan los visitados.
  const visitadosOk = useRef(true);

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
      // Además de los casos activos, los visitados desde el inicio del día de este navegador (para el filtro «Visitado»).
      if (visitadosOk.current) { const d = new Date(); d.setHours(0, 0, 0, 0); q.set("visitados_desde", d.toISOString()); }
      let r: any;
      try { r = await request("/api/asignaciones/mapa?" + q.toString()); }
      catch (e: any) {
        if (e?.status !== 400 || !visitadosOk.current) throw e;
        visitadosOk.current = false; q.delete("visitados_desde");
        r = await request("/api/asignaciones/mapa?" + q.toString());
      }
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
  // Casos activos de cada auditor (conteo del servidor): sirve para saber quién no tiene ninguno («Sin asignaciones»).
  const cargarCarga = async () => {
    try { const r: any = await request("/api/asignaciones/carga"); setCarga(new Map((r.data || []).map((x: any) => [x.id_usuario_auditor, Number(x.activas)]))); } catch { /* sin este dato solo falta el conteo de «Sin asignaciones» */ }
  };
  const recargarCasos = () => { cargarMapaRef.current(); cargarCarga(); };
  const recargarCasosRef = useRef(recargarCasos);
  recargarCasosRef.current = recargarCasos;

  useEffect(() => {
    cargarVivo();
    cargarRoster();
    cargarCarga();
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
    const timerMapa = setInterval(() => recargarCasosRef.current(), 60000);
    let espera = 0;
    const recargarMapa = () => { window.clearTimeout(espera); espera = window.setTimeout(() => recargarCasosRef.current(), 800); };
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
  // Escape suelta al auditor elegido y vuelve a la vista general. Ctrl/Cmd + K lleva al buscador de esta pantalla (en vez de abrir la paleta general:
  // el diseño lo muestra dentro del buscador del mapa); se escucha en la fase de captura para ir antes que el atajo general.
  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSeleccionado(null);
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); e.stopImmediatePropagation(); inputBusca.current?.focus(); inputBusca.current?.select(); }
    };
    window.addEventListener("keydown", alTeclear, true);
    return () => window.removeEventListener("keydown", alTeclear, true);
  }, []);
  useEffect(() => { setLimiteLista(AUDITORES_POR_PAGINA); }, [chipsAud, busca, departamentoFiltro, provinciaFiltro, distritoFiltro]);

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
  // Incluye lo visitado hoy (asignación FINALIZADA) cuando el servidor lo manda.
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

  // Estado de la visita de cada cliente. «En ruta» = su auditor tiene la jornada iniciada: la clave es un texto para que no se recalcule
  // todo el mapa cada vez que llega una posición (solo cuando alguien inicia o termina su jornada).
  const claveJornada = todosLosAuditores.filter((u) => u.enJornada).map((u) => u.id).sort().join(",");
  const enJornadaIds = useMemo(() => new Set(claveJornada ? claveJornada.split(",") : []), [claveJornada]);
  const clientesConEstado = useMemo(
    () => clientesEnZona.map((a) => {
      const visitado = a.estado === "FINALIZADA";
      return { ...a, visitado, estadoVisita: visitado ? "VISITADO" : enJornadaIds.has(a.id_usuario_auditor) ? "EN_RUTA" : "PENDIENTE", tipo: a.expediente?.tipo_credito === "OTROS" ? "OTROS" : "CONSUMO" };
    }),
    [clientesEnZona, enJornadaIds]
  );
  // Filtros de cliente. Los números de «Prioridad» cuentan lo que pasa los otros filtros (así se ve cuántos habría al marcar cada uno).
  const clientesFiltrados = useMemo(
    () => clientesConEstado.filter((a) => (!prioridades.length || prioridades.includes(a.prioridad)) && cumpleEstadoYTipo(a, estadosVisita, tipos)),
    [clientesConEstado, prioridades, estadosVisita, tipos]
  );
  const conteoPrioridad = useMemo(() => {
    const cuenta: Record<string, number> = { ALTA: 0, MEDIA: 0, BAJA: 0 };
    clientesConEstado.filter((a) => cumpleEstadoYTipo(a, estadosVisita, tipos)).forEach((a) => { cuenta[a.prioridad] = (cuenta[a.prioridad] || 0) + 1; });
    return cuenta;
  }, [clientesConEstado, estadosVisita, tipos]);
  const filtrosActivos = (zonaActiva ? 1 : 0) + (prioridades.length ? 1 : 0) + (estadosVisita.length ? 1 : 0) + (tipos.length ? 1 : 0);
  const limpiarFiltros = () => { setDepartamentoFiltro("TODOS"); setProvinciaFiltro("TODOS"); setDistritoFiltro("TODOS"); setPrioridades([]); setEstadosVisita([]); setTipos([]); };

  // Casos activos (sin lo ya visitado) de cada auditor en la zona, y el que se le muestra en la lista: el de la visita en curso o, si no hay,
  // el más urgente (prioridad alta primero, luego el más antiguo).
  const { clientesPorAuditor, casoPrincipal, auditoresConClientes } = useMemo(() => {
    const cuenta = new Map<string, number>(); const principal = new Map<string, { codigo: string; rango: number; id: number }>(); const con = new Set<string>();
    clientesConEstado.forEach((a) => {
      con.add(a.id_usuario_auditor);
      if (a.visitado) return;
      cuenta.set(a.id_usuario_auditor, (cuenta.get(a.id_usuario_auditor) || 0) + 1);
      const rango = rangoPrioridad[a.prioridad] ?? 3; const p = principal.get(a.id_usuario_auditor);
      if (!p || rango < p.rango || (rango === p.rango && a.id_asignacion < p.id)) principal.set(a.id_usuario_auditor, { codigo: a.expediente.codigo_expediente, rango, id: a.id_asignacion });
    });
    return { clientesPorAuditor: cuenta, casoPrincipal: principal, auditoresConClientes: con };
  }, [clientesConEstado]);

  // La lista de "quién pertenece a esta zona" se arma desde el roster completo
  // (todosLosAuditores), no solo desde quienes tienen el GPS prendido ahora — un
  // auditor de Lima no debe desaparecer de la lista solo por no estar transmitiendo
  // ubicación en este momento.
  const auditoresVisibles = useMemo(
    () => (zonaActiva ? todosLosAuditores.filter((u) => auditoresConClientes.has(u.id)) : todosLosAuditores),
    [zonaActiva, todosLosAuditores, auditoresConClientes]
  );
  // Para los pines del mapa sí hace falta una ubicación real.
  const auditoresConMapa = useMemo(() => auditoresVisibles.filter((u) => u.enVivo), [auditoresVisibles]);

  // Clientes del auditor puntualmente seleccionado (sin lo ya visitado), ya acotados a la zona y a los filtros elegidos.
  const clientesDelAuditorSeleccionado = useMemo(
    () => (seleccionado ? clientesFiltrados.filter((a) => a.id_usuario_auditor === seleccionado && !a.visitado) : []),
    [clientesFiltrados, seleccionado]
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
  // Todo lo que se ve en el mapa como círculo con la letra de su prioridad en vez de parada
  // numerada: los clientes de otros auditores de la zona, o los de este auditor
  // cuando su ruta está bloqueada por abarcar varios departamentos.
  const clientesSinRuta = useMemo(
    () => clientesFiltrados.filter((a) => !idsEnRuta.has(a.id_asignacion)),
    [clientesFiltrados, idsEnRuta]
  );

  const rutaSugerida = useMemo<[number, number][]>(() => {
    if (!origenRuta || !enRuta.length) return [];
    return [[origenRuta.latitud, origenRuta.longitud], ...enRuta.map((a) => [a.latitud, a.longitud] as [number, number])];
  }, [origenRuta, enRuta]);

  // Vista general (sin auditor elegido): se encuadra todo lo de la zona al cargar y al cambiar de zona, no con cada posición nueva.
  const coordsTodos = useMemo<[number, number][]>(() => [
    ...auditoresConMapa.map((u) => [u.latitud as number, u.longitud as number] as [number, number]),
    ...clientesFiltrados.map((a) => [a.latitud, a.longitud] as [number, number]),
  ], [auditoresConMapa, clientesFiltrados]);
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
  const enLineaDe = (u: AuditorInfo) => !sinSenalDe(u); // en vivo o reciente (posición de los últimos 5 min)
  const sinAsignaciones = (u: AuditorInfo) => carga != null && !(carga.get(u.id) || 0);
  const cuentas = {
    enLinea: auditoresVisibles.filter(enLineaDe).length,
    sinGps: auditoresVisibles.filter(sinSenalDe).length,
    sinAsignaciones: auditoresVisibles.filter(sinAsignaciones).length,
    alerta: auditoresVisibles.filter(esAlerta).length,
  };
  const textoBuscado = norm(busca.trim());
  const pasaChipAud = (u: AuditorInfo) => !chipsAud.length || chipsAud.some((c) => (c === "EN_LINEA" ? enLineaDe(u) : c === "SIN_GPS" ? sinSenalDe(u) : c === "SIN_ASIGNACIONES" ? sinAsignaciones(u) : esAlerta(u)));
  const pasaFiltros = (u: AuditorInfo) => u.id === seleccionado || (pasaChipAud(u) && (!textoBuscado || norm(`${u.nombres} ${u.apellidos} ${u.username}`).includes(textoBuscado)));
  const marcadores = auditoresConMapa.filter(pasaFiltros);
  // Clientes que coinciden con lo buscado: al elegir uno se selecciona a su auditor y el mapa vuela hasta él.
  const hallazgos = textoBuscado.length < 2 ? [] : hallazgosSrv;
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
  // Estado corto del lado derecho de cada auditor en la lista (el diseño solo dice «En línea» o «Sin gps»; lo grave sale en rojo).
  const estadoCorto = (u: AuditorInfo) => {
    const f = frescura(u);
    if (u.simulada && f.estado !== "SIN_UBICACION") return { texto: "GPS simulado", clase: "bad" };
    if (perdioSenal(u)) return { texto: "Sin señal", clase: "bad" };
    if (f.estado === "VIVO") return { texto: "En línea", clase: "on" };
    if (f.estado === "RECIENTE") return { texto: "Reciente", clase: "warn" };
    return { texto: "Sin gps", clase: "" };
  };
  // Frase bajo los botones de estado: qué hay en ese grupo (y qué hacer si está vacío).
  const resumenChip = (() => {
    if (chipsAud.length !== 1) return null;
    if (chipsAud[0] === "ALERTA") {
      const sj = auditoresVisibles.filter(perdioSenal).length; const bj = auditoresVisibles.filter(bateriaBaja).length;
      const gs = auditoresVisibles.filter((u) => u.simulada && frescura(u).estado !== "SIN_UBICACION").length;
      const partes = [sj ? sj + " sin señal en plena jornada" : "", bj ? bj + " con batería baja" : "", gs ? gs + " con GPS simulado" : ""].filter(Boolean);
      return partes.length ? partes.join(" · ") : "Sin alertas por ahora.";
    }
    if (chipsAud[0] === "EN_LINEA") return cuentas.enLinea ? null : "Nadie transmite ahora. Aparecen aquí cuando inician su jornada.";
    if (chipsAud[0] === "SIN_GPS") return cuentas.sinGps + " sin posición en los últimos 5 min o que nunca transmitieron.";
    return cuentas.sinAsignaciones + " sin ningún caso activo.";
  })();

  const mover = (c: Omit<Camara, "n">) => setCamara({ ...c, n: Date.now() + Math.random() });
  const LEJOS_M = 60_000; // más allá de esto un cliente se considera de otra zona y no entra en el encuadre automático
  // Elegir (o soltar) a un auditor. Con un cliente, el mapa vuela al cliente; si no, se centra en el auditor (o, sin posición, en sus clientes cercanos).
  const elegirAuditor = (id: string | null, cliente?: [number, number]) => {
    setSeleccionado(id);
    if (!id) return;
    if (cliente) { mover({ modo: "cliente", punto: cliente }); return; }
    const a = auditorPorId.get(id);
    if (a?.enVivo) { mover({ modo: "auditor", punto: [a.latitud as number, a.longitud as number] }); return; }
    const suyos = todosLosClientes.filter((c) => c.id_usuario_auditor === id && c.estado !== "FINALIZADA");
    if (!suyos.length) return;
    const cerca = suyos.filter((c) => distanciaMetros(suyos[0].latitud, suyos[0].longitud, c.latitud, c.longitud) <= LEJOS_M);
    mover({ modo: "ruta", coords: cerca.map((c) => [c.latitud, c.longitud] as [number, number]) });
  };

  // Resumen del auditor elegido.
  const auditorSel = seleccionado ? auditorPorId.get(seleccionado) || null : null;
  const llegadasHoy = new Set(eventos.filter((e) => e.id_usuario === seleccionado && e.tipo === "LLEGADA").map((e) => e.id_expediente)).size;
  const visitadosEnMapa = seleccionado ? clientesConEstado.filter((a) => a.id_usuario_auditor === seleccionado && a.visitado).length : 0;
  const visitadosHoy = Math.max(llegadasHoy, visitadosEnMapa);
  const proximo = enRuta[0] || null;
  const rutaKm = rutaSugerida.reduce((suma, p, i) => (i === 0 ? 0 : suma + distanciaMetros(rutaSugerida[i - 1][0], rutaSugerida[i - 1][1], p[0], p[1])), 0);
  const lejanos = origenRuta ? clientesDelAuditorSeleccionado.filter((c) => distanciaMetros(origenRuta.latitud, origenRuta.longitud, c.latitud, c.longitud) > LEJOS_M).length : 0;

  const nombreDeAuditor = (id: string) => { const a = auditorPorId.get(id); return a ? (a.nombres || a.username) : "—"; };
  const fila = (u: AuditorInfo) => {
    const nombreU = nombreAud(u);
    const f = frescura(u);
    const { etiqueta, clase, simulada } = estadoTexto(u);
    const corto = estadoCorto(u);
    const mov = f.estado !== "SIN_SENAL" ? textoMovimiento(u.movimiento, ahoraMs) : null;
    const enVisita = eventos.find((x) => x.id_usuario === u.id); // el aviso más reciente: si es una llegada, sigue en la visita
    const visitaTexto = enVisita && enVisita.tipo === "LLEGADA" ? "En la visita de " + (enVisita.cliente || "un cliente") + " desde " + horaCorta(enVisita.fecha) : null;
    const principal = casoPrincipal.get(u.id);
    const codigo = enVisita && enVisita.tipo === "LLEGADA" && enVisita.codigo_expediente ? enVisita.codigo_expediente : principal?.codigo;
    const casos = clientesPorAuditor.get(u.id) || 0;
    const bateriaTexto = u.bateria != null ? "Batería " + u.bateria + " %" + (u.cargando ? " · cargando" : "") + (bateriaBaja(u) ? (perdioSenal(u) ? " · posible batería agotada" : " · baja") : "") : null;
    // Debajo del código solo sale lo que merece atención (batería baja, salto de GPS o la visita en curso); el resto queda en el texto para lectores de pantalla.
    const aviso = bateriaBaja(u) ? { texto: bateriaTexto as string, malo: true } : u.movimiento?.modo === "SALTO_GPS" ? { texto: mov as string, malo: true } : visitaTexto ? { texto: visitaTexto, malo: false } : null;
    return (
      <button key={u.id} type="button" className={`pick${seleccionado === u.id ? " on" : ""}`} aria-pressed={seleccionado === u.id} title={etiqueta} onClick={() => elegirAuditor(u.id === seleccionado ? null : u.id)}>
        <Avatar nombre={nombreU} />
        <span className="pick-info">
          <b>{nombreU}</b>
          {codigo ? <span className="pick-cod" translate="no" title={casos + (casos === 1 ? " caso activo" : " casos activos")}>{codigo}</span> : <span className="pick-sin">{carga != null && !(carga.get(u.id) || 0) ? "Sin asignaciones" : "Sin casos en esta vista"}</span>}
          {aviso ? <span className={"pick-aviso" + (aviso.malo ? " bajo" : "")}>{aviso.texto}</span> : null}
        </span>
        <span className={"pick-est " + corto.clase}>{corto.texto}</span>
        <span className="sr-only">
          <span className={`live${clase}`}>{simulada ? "GPS simulado · " : ""}{etiqueta}{zonaActiva ? ` · ${casos} aquí` : ""}</span>
          {bateriaTexto ? <span className={`bat${bateriaBaja(u) ? " bajo" : ""}`}>{bateriaTexto}</span> : null}
          {mov ? <span className={"bat" + (u.movimiento?.modo === "SALTO_GPS" ? " bajo" : "")}>{mov}</span> : null}
          {visitaTexto ? <span className="bat">{visitaTexto}</span> : null}
        </span>
      </button>
    );
  };

  const estadoPill = enVivo ? `${enVivo} ${enVivo === 1 ? "auditor transmite" : "auditores transmiten"} su ubicación` : "Nadie transmite ubicación ahora";

  return (
    <div className="sv-pagina">
      <h1 className="sr-only">Seguimiento en vivo</h1>
      <div className="sv-izq">
        <div className="sv-busca">
          <Icon name="buscar" size={17} />
          <label className="sr-only" htmlFor="seg-busca">Buscar cliente, crédito o auditor</label>
          <input ref={inputBusca} id="seg-busca" name="busqueda" type="search" autoComplete="off" spellCheck={false} placeholder="Buscar cliente, crédito o auditor…" value={busca} onChange={(e) => setBusca(e.target.value)} />
          <kbd aria-hidden="true">Ctrl K</kbd>
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
        </div>

        <section className="sv-card sv-filtros" aria-label="Filtros del mapa">
          <div className="sv-cab">
            <h2>Filtros</h2>
            {filtrosActivos ? <span className="sv-insignia">{filtrosActivos} {filtrosActivos === 1 ? "activo" : "activos"}</span> : null}
            <button type="button" className="sv-limpiar" onClick={limpiarFiltros} disabled={!filtrosActivos}>Limpiar</button>
          </div>
          <div className="sv-grupo">
            <h3>Zona</h3>
            {departamentos.length ? (
              <div className="sv-selects">
                <SelectZona name="departamento" etiqueta="Departamento" valor={departamentoFiltro} todos={{ texto: "Todos", n: suma(zonas) }}
                  onChange={(v) => { setDepartamentoFiltro(v); setProvinciaFiltro("TODOS"); setDistritoFiltro("TODOS"); }}
                  opciones={departamentos.map((d) => ({ valor: d, texto: d, n: suma(zonas.filter((z) => z.departamento === d)) }))} />
                <SelectZona name="provincia" etiqueta="Provincia" valor={provinciaFiltro} todos={{ texto: "Todas", n: suma(enDepartamento) }} deshabilitado={provincias.length < 2}
                  onChange={(v) => { setProvinciaFiltro(v); setDistritoFiltro("TODOS"); }}
                  opciones={provincias.map((p) => ({ valor: p, texto: p, n: suma(enDepartamento.filter((z) => z.provincia === p)) }))} />
                <SelectZona name="distrito" etiqueta="Distrito" valor={distritoFiltro} todos={{ texto: "Todos", n: suma(enProvincia) }} deshabilitado={distritos.length < 2}
                  onChange={setDistritoFiltro}
                  opciones={distritos.map((d) => ({ valor: d, texto: d, n: suma(enProvincia.filter((z) => z.distrito === d)) }))} />
              </div>
            ) : <p className="sv-vacio">Aún no hay expedientes asignados con ubicación registrada.</p>}
          </div>
          <div className="sv-grupo">
            <h3>Prioridad</h3>
            <div className="sv-chips">
              {PRIORIDADES.map((p) => <Chip key={p} on={prioridades.includes(p)} punto={prio(p).punto} onClick={() => setPrioridades(alternar(prioridades, p))}>{prio(p).nombre} {conteoPrioridad[p] || 0}</Chip>)}
            </div>
          </div>
          <div className="sv-grupo">
            <h3>Estado de la visita</h3>
            <div className="sv-chips">
              {ESTADOS_VISITA.map(([id, texto]) => <Chip key={id} on={estadosVisita.includes(id)} onClick={() => setEstadosVisita(alternar(estadosVisita, id))}>{texto}</Chip>)}
            </div>
          </div>
          <div className="sv-grupo">
            <h3>Tipo de ficha</h3>
            <div className="sv-chips">
              {TIPOS_FICHA.map(([id, texto]) => <Chip key={id} on={tipos.includes(id)} onClick={() => setTipos(alternar(tipos, id))}>{texto}</Chip>)}
            </div>
          </div>
        </section>

        <section className="sv-card sv-auditores" aria-label="Auditores">
          <h3 className="sv-tit">Auditores{zonaActiva ? ` en ${departamentoFiltro}` : ""} ({auditoresVisibles.length})</h3>
          <div className="sv-chips" role="group" aria-label="Filtrar auditores por estado">
            <Chip on={chipsAud.includes("EN_LINEA")} onClick={() => setChipsAud(alternar(chipsAud, "EN_LINEA"))}>En línea {cuentas.enLinea}</Chip>
            <Chip on={chipsAud.includes("SIN_GPS")} onClick={() => setChipsAud(alternar(chipsAud, "SIN_GPS"))}>Sin GPS {cuentas.sinGps}</Chip>
            <Chip on={chipsAud.includes("SIN_ASIGNACIONES")} onClick={() => setChipsAud(alternar(chipsAud, "SIN_ASIGNACIONES"))}>Sin asignaciones {cuentas.sinAsignaciones}</Chip>
            <Chip on={chipsAud.includes("ALERTA")} alerta={cuentas.alerta > 0} onClick={() => setChipsAud(alternar(chipsAud, "ALERTA"))}>Alertas {cuentas.alerta}</Chip>
          </div>
          {resumenChip ? <p className="sv-nota-chip" role="status">{resumenChip}</p> : null}
          {!auditoresVisibles.length ? (
            <p className="sv-vacio">{zonaActiva ? "Ningún auditor tiene clientes en esta zona." : "Nadie tiene casos asignados con ubicación todavía."}</p>
          ) : null}
          <div className="sv-lista">
            {auditoresOrdenados.slice(0, limiteLista).map(fila)}
            {auditoresOrdenados.length > limiteLista ? (
              <button type="button" className="sv-mas" onClick={() => setLimiteLista((n) => n + AUDITORES_POR_PAGINA)}>Ver más auditores ({auditoresOrdenados.length - limiteLista})</button>
            ) : null}
          </div>
        </section>
      </div>

      <div className="sv-mapa" data-clientes={clientesSinRuta.length + enRuta.length}>
        <MapContainer center={CENTER} zoom={5} className="seguimiento-map" zoomControl={false} ref={setMapa}>
          <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {!seleccionado ? <FitBounds coords={coordsTodos} clave={zonaClave} nonce={reencuadre} /> : null}
          <CamaraMapa camara={camara} />
          <ClickParaIniciar activo={Boolean(seleccionado && !origenRuta)} onClick={setPuntoManual} />
          {capas.auditores ? marcadores.map((u) => { const f = frescura(u); return f.estado !== "SIN_SENAL" && u.precision ? (
            <Circle key={"p-" + u.id} center={[u.latitud as number, u.longitud as number]} radius={Math.min(u.precision, 500)} pathOptions={{ color: u.simulada ? ALERTA_COLOR : colorForRol(u.rol), weight: 1, fillOpacity: 0.08 }} />
          ) : null; }) : null}
          {capas.auditores ? marcadores.filter((u) => u.id !== seleccionado).map((u) => {
            const f = frescura(u);
            return (
              <AuditorMarker key={u.id} posicion={[u.latitud as number, u.longitud as number]} icon={markerIcon(nombreAud(u), u.rol, f.estado, u.simulada, esAlerta(u), false, enVivo <= 60)} onClick={() => elegirAuditor(u.id)}>
                <Popup className="sv-popup" {...opcionesTarjeta()}>
                  <div className="pop">
                    <strong>{nombreAud(u)}</strong>{u.rol === "SUPERVISOR" ? <span className="pop-rol">{u.rol}</span> : null}
                    <div className="pop-linea">{f.estado === "VIVO" ? "En vivo" : f.estado === "RECIENTE" ? "Reciente" : "Sin señal"} · {haceTexto(f.segundos)}{u.precision ? " · precisión ±" + Math.round(u.precision) + " m" : ""}</div>
                    {u.simulada ? <div className="pop-linea"><strong style={{ color: ALERTA_COLOR }}>El celular avisó GPS simulado</strong></div> : null}
                    {u.bateria != null ? <div className="pop-linea">Batería {u.bateria} %{u.cargando ? " · cargando" : ""}</div> : null}
                    {textoMovimiento(u.movimiento, ahoraMs) ? <div className="pop-linea">{textoMovimiento(u.movimiento, ahoraMs)}</div> : null}
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
              <Popup className="sv-popup" {...opcionesTarjeta()}>
                <div className="pop">
                  <strong>{auditorSeleccionado ? nombreAud(auditorSeleccionado) : "Inicio de ruta"}</strong>
                  <div className="pop-linea">{puntoManual ? "Punto de partida simulado" : auditorSeleccionado ? `Última actualización: ${haceTexto(frescura(auditorSeleccionado).segundos)}${auditorSeleccionado.precision ? ` · ±${Math.round(auditorSeleccionado.precision)} m` : ""}` : "Ubicación en vivo"}</div>
                  <div className="pop-linea"><em>Arrastra el pin para planificar desde otro punto.</em></div>
                </div>
              </Popup>
            </Marker>
          ) : null}
          {enRuta.map((a) => (
            <Marker key={a.id_asignacion} position={[a.latitud, a.longitud]} icon={clienteIcon(a.prioridad, false, a.orden)} title={a.expediente.nombres_cliente}
              eventHandlers={{ add: (ev) => alAbrirTarjeta(ev.target as L.Marker) }}>
              <Popup minWidth={240} maxWidth={320} className="sv-popup" {...opcionesTarjeta()}>
                <TarjetaCliente a={a} auditor={nombreAud(auditorPorId.get(a.id_usuario_auditor) || { nombres: "", apellidos: "", username: "—" })} orden={a.orden} distancia={a.distanciaDesdeAsesor} onVer={verExpediente} />
              </Popup>
            </Marker>
          ))}
          {enRuta.slice(0, 8).map((a) => <Circle key={"g-" + a.id_asignacion} center={[a.latitud, a.longitud]} radius={GEOCERCA_M} pathOptions={{ color: INDIGO_CLARO, weight: 1, dashArray: "4 4", fillOpacity: 0.06 }} />)}
          {capas.clientes ? <ClientesAgrupados clientes={clientesSinRuta} nombreAuditor={nombreDeAuditor} onVerAuditor={(id) => elegirAuditor(id)} origen={origenRuta} onVer={verExpediente} /> : null}
          {rutaSugerida.length > 1 ? <Polyline positions={rutaSugerida} pathOptions={{ color: INDIGO_CLARO, weight: 3, opacity: 0.95, dashArray: "9 9" }} /> : null}
          {polyline.length > 1 ? <Polyline positions={polyline} pathOptions={{ color: INDIGO, weight: 3.5, opacity: idxRepeticion == null ? 0.9 : 0.3 }} /> : null}
          {rutaRecorrida.length > 1 ? <Polyline positions={rutaRecorrida} pathOptions={{ color: INDIGO, weight: 5, opacity: 0.95 }} /> : null}
          {puntoRepeticion ? <CircleMarker center={[puntoRepeticion.latitud, puntoRepeticion.longitud]} radius={9} pathOptions={{ color: "#ffffff", weight: 3, fillColor: INDIGO, fillOpacity: 1 }} /> : null}
          {reproduciendo && puntoRepeticion ? <SeguirPunto latitud={puntoRepeticion.latitud} longitud={puntoRepeticion.longitud} /> : null}
        </MapContainer>

        {error ? <div role="alert" className="sv-aviso mal">{error}</div> : null}
        {truncado ? <div role="status" className="sv-aviso">Hay {totalMapa} clientes en esta vista y se muestran los primeros {asignaciones.length}. Elige una zona (departamento, provincia o distrito) para verlos todos.</div> : null}

        <div className="sv-sup">
          <div className="sv-pill">
            <span className={`live${enVivo ? " on" : ""}`} role="status">{estadoPill}{conSenalAntigua ? ` · ${conSenalAntigua} con señal antigua` : ""}{perdieron ? ` · ⚠ ${perdieron} sin señal en plena jornada` : ""}</span>
          </div>
          <div className="map-tools" role="toolbar" aria-label="Controles del mapa">
            <button type="button" className="zoom" aria-label="Acercar el mapa" onClick={() => mapa?.zoomIn()}>+</button>
            <button type="button" className="zoom" aria-label="Alejar el mapa" onClick={() => mapa?.zoomOut()}>−</button>
            <button type="button" onClick={() => { setSeleccionado(null); setReencuadre((n) => n + 1); }}>Ver todo</button>
            <button type="button" aria-pressed={capas.auditores} className={capas.auditores ? "on" : ""} onClick={() => setCapas((c) => ({ ...c, auditores: !c.auditores }))}>Auditores</button>
            <button type="button" aria-pressed={capas.clientes} className={capas.clientes ? "on" : ""} onClick={() => setCapas((c) => ({ ...c, clientes: !c.clientes }))}>Clientes</button>
            <button type="button" aria-pressed={eventosAbiertos} aria-controls="sv-eventos" className={eventosAbiertos ? "on" : ""} onClick={() => setEventosAbiertos((v) => !v)}>Llegadas y salidas{eventosVisibles.length ? <b>{eventosVisibles.length}</b> : null}</button>
          </div>
        </div>

        <div className="sv-der">
          {auditorSel ? (() => {
            const est = estadoTexto(auditorSel);
            const mov = textoMovimiento(auditorSel.movimiento, ahoraMs);
            const lugar = eventos.find((x) => x.id_usuario === auditorSel.id);
            return (
              <section className="sv-card resumen-aud" aria-label={"Resumen de " + nombreAud(auditorSel)}>
                <div className="resumen-cab">
                  <Avatar nombre={nombreAud(auditorSel)} />
                  <div className="resumen-quien"><b>{nombreAud(auditorSel)}</b><span className={"live" + est.clase}>{est.simulada ? "GPS simulado · " : ""}{est.etiqueta}</span></div>
                  <button type="button" className="sv-soltar" onClick={() => elegirAuditor(null)}>Soltar</button>
                </div>
                <dl className="resumen-datos">
                  <div><dt>Casos activos</dt><dd>{clientesPorAuditor.get(auditorSel.id) || 0}</dd></div>
                  <div><dt>Visitados hoy</dt><dd>{visitadosHoy}</dd></div>
                  <div><dt>Batería</dt><dd className={bateriaBaja(auditorSel) ? "bajo" : ""}>{auditorSel.bateria != null ? auditorSel.bateria + " %" + (auditorSel.cargando ? " · cargando" : "") : "—"}</dd></div>
                  <div><dt>Movimiento</dt><dd>{mov || "—"}</dd></div>
                </dl>
                {lugar && lugar.tipo === "LLEGADA" ? <p className="resumen-linea">En la visita de <b>{lugar.cliente || "un cliente"}</b> desde {horaCorta(lugar.fecha)}</p> : null}
                {proximo ? <p className="resumen-linea">Siguiente: <b>{proximo.expediente.nombres_cliente}</b> · {fmtDistancia(proximo.distanciaDesdeAsesor)}{rutaKm > 0 ? " · ruta de " + fmtDistancia(rutaKm) + " en total" : ""}</p> : null}
                {lejanos > 0 ? <p className="resumen-linea apagado">{lejanos} {lejanos === 1 ? "cliente está" : "clientes están"} a más de 60 km: no entran en el encuadre.</p> : null}
                <div className="resumen-acciones">
                  {auditorSel.enVivo ? <button type="button" className="sv-btn" onClick={() => mover({ modo: "auditor", punto: [auditorSel.latitud as number, auditorSel.longitud as number] })}>Centrar en él</button> : null}
                  {rutaSugerida.length > 1 ? <button type="button" className="sv-btn claro" onClick={() => mover({ modo: "ruta", coords: rutaSugerida })}>Ver ruta completa</button> : null}
                </div>
                <details className="seg-sec">
                  <summary>Recorrido real</summary>
                  <div className="replay">
                    <label className="replay-dia"><span>Día</span>
                      <input type="date" name="fecha-recorrido" value={fechaRuta} max={hoy()} onChange={(e) => { if (e.target.value) setFechaRuta(e.target.value); }} />
                    </label>
                    {ruta.length < 2 ? <p className="subtle">Sin recorrido registrado ese día.</p> : (
                      <>
                        <div className="replay-barra">
                          <button type="button" className="sv-btn" onClick={alternarReproduccion}>{reproduciendo ? "Pausar" : "Reproducir"}</button>
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
                <details className="seg-sec">
                  <summary>Ruta del día</summary>
                  {puntoManual ? (
                    <div className="callout info sv-callout">
                      <span>Ruta simulada desde un punto de partida manual.</span>
                      <button type="button" className="sv-btn claro" onClick={() => setPuntoManual(null)}>Usar ubicación en vivo</button>
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
              </section>
            );
          })() : null}

          {eventosAbiertos ? (
            <section className="sv-card sv-eventos" id="sv-eventos" aria-label="Llegadas y salidas de hoy">
              <div className="sv-cab">
                <h2>Llegadas y salidas de hoy ({eventosVisibles.length})</h2>
                <button type="button" className="sv-x" aria-label="Cerrar llegadas y salidas" onClick={() => setEventosAbiertos(false)}><Icon name="cerrar" size={16} /></button>
              </div>
              {!eventosVisibles.length ? (
                <p className="sv-vacio">Aún no hay llegadas ni salidas hoy. Aparecen solas cuando un auditor entra al radio de un cliente o se aleja de él.</p>
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
            </section>
          ) : null}
        </div>

        <div className="maplegend sv-leyenda" aria-label="Leyenda del mapa">
          <div className="leg-bloque">
            <span className="leg-tit">Prioridad del cliente</span>
            <div className="leg-items">
              {PRIORIDADES.map((p) => <span key={p} className="leg-item"><i className="leg-badge" style={{ background: prio(p).fondo, color: prio(p).tinta }}>{prio(p).letra}</i>{prio(p).nombre}</span>)}
            </div>
          </div>
          <div className="leg-bloque">
            <span className="leg-tit">Auditor</span>
            <div className="leg-items">
              <span className="leg-item"><i className="leg-punto" style={{ background: INDIGO }} />En línea</span>
              <span className="leg-item"><i className="leg-punto" style={{ background: ALERTA_COLOR }} />Alerta</span>
              <span className="leg-item"><i className="leg-punto" style={{ background: SIN_SENAL_COLOR }} />Sin señal</span>
            </div>
          </div>
          <div className="leg-bloque">
            <span className="leg-tit">Recorrido</span>
            <div className="leg-items">
              <span className="leg-item"><i className="leg-linea" style={{ background: INDIGO }} />Registrado</span>
              <span className="leg-item"><i className="leg-linea disc" style={{ ["--c" as any]: INDIGO_CLARO }} />Secuencia sugerida</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
