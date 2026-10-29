import { useCallback, useEffect, useId, useRef, useState } from "react";
import { request } from "../../api";
import { Icon } from "../icons";
import { GEO_ESTADO } from "../../lib/format";

// «Direcciones»: cómo quedaron las direcciones de los expedientes frente al mapa (precisas, aproximadas, por revisar, sin ubicar…), el filtro de la lista por
// esa situación y las acciones de la cola de búsqueda. Es una burbuja en la barra de arriba (se abre y se cierra, como los filtros de Visitas) para que no
// ocupe lugar en la pantalla; solo aparece si ya hay direcciones procesadas.

type Resumen = {
  total: number; precisas: number; verificadas: number; aproximadas: number; por_revisar: number; no_encontradas: number; con_error: number; pendientes: number;
  con_ubicacion_de_la_base_o_persona: number; activa: boolean;
  // Proveedor del mapa: si sus sugerencias son temporales, si solo busca casos asignados y el consumo del mes contra el tope.
  proveedor?: string; temporal?: boolean; vence_dias?: number; solo_asignados?: boolean; consultas_mes?: number; tope_mes?: number;
};
const n = (v: number) => v.toLocaleString("es-PE");

export default function DireccionesMapa({ geo, onGeo, onCambio }: { geo: string; onGeo: (v: string) => void; onCambio: () => void }) {
  const id = useId();
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [abierto, setAbierto] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const raiz = useRef<HTMLDivElement>(null);
  const boton = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  const cargar = useCallback(() => { request<{ data: Resumen }>("/api/expedientes/geocodificacion/resumen").then((r) => setResumen(r.data)).catch(() => {}); }, []);
  useEffect(() => { cargar(); }, [cargar]);

  useEffect(() => {
    if (!abierto) return;
    panel.current?.focus({ preventScroll: true });
    const fuera = (e: Event) => { if (raiz.current && !raiz.current.contains(e.target as Node)) setAbierto(false); };
    const tecla = (e: KeyboardEvent) => { if (e.key === "Escape") { e.preventDefault(); setAbierto(false); boton.current?.focus(); } };
    document.addEventListener("mousedown", fuera); document.addEventListener("focusin", fuera); document.addEventListener("keydown", tecla);
    return () => { document.removeEventListener("mousedown", fuera); document.removeEventListener("focusin", fuera); document.removeEventListener("keydown", tecla); };
  }, [abierto]);

  if (!resumen || resumen.total <= 0) return null;
  const atender = resumen.por_revisar + resumen.no_encontradas + resumen.con_error;
  const procesar = async (ruta: string, ok: (d: any) => string) => {
    setOcupado(true); setMensaje("");
    try { const r = await request<{ data: any }>(ruta, { method: "POST" }); setMensaje(ok(r.data)); onCambio(); cargar(); }
    catch (e: any) { setMensaje(e?.message || "No se pudo completar."); } finally { setOcupado(false); }
  };

  return (
    <div className="ex-direcciones" ref={raiz}>
      <button ref={boton} type="button" className={`ex-enlace${abierto || geo ? " activo" : ""}`} aria-haspopup="dialog" aria-expanded={abierto} aria-controls={`${id}-panel`} onClick={() => setAbierto((v) => !v)}>
        <Icon name="seguimiento" size={15} />Direcciones
        {atender > 0 ? <span className="ex-cuenta" aria-label={`${n(atender)} por atender`}>{n(atender)}</span> : null}
      </button>
      {abierto ? (
        <div className="ex-pop" id={`${id}-panel`} ref={panel} role="dialog" aria-label="Direcciones en el mapa" tabIndex={-1}>
          <h2>Direcciones en el mapa</h2>
          <p>
            {n(resumen.precisas + resumen.verificadas)} precisas o verificadas · {n(resumen.aproximadas)} aproximadas · {n(resumen.por_revisar)} por revisar · {n(resumen.no_encontradas + resumen.con_error)} sin ubicar · {n(resumen.pendientes)} en cola · {n(resumen.con_ubicacion_de_la_base_o_persona)} con coordenadas de la base o fijadas por una persona.
          </p>
          {resumen.activa && resumen.proveedor ? (
            <p className="nota">
              Mapa: {resumen.proveedor === "google" ? "Google Maps" : resumen.proveedor === "mapbox" ? "Mapbox" : "OpenStreetMap"}
              {resumen.temporal ? ` (sugerencias temporales: se borran a los ${resumen.vence_dias} días y no se vuelven referencia)` : ""}
              {resumen.solo_asignados ? " · solo se buscan los casos asignados a un auditor" : ""}
              {" · consultas este mes: "}{n(resumen.consultas_mes || 0)}{resumen.tope_mes ? ` de ${n(resumen.tope_mes)}` : " (sin tope)"}.
            </p>
          ) : null}
          <div className="ex-campo">
            <label htmlFor={`${id}-geo`}>Mostrar en la lista</label>
            <select id={`${id}-geo`} name="ubicacion" value={geo} onChange={(e) => onGeo(e.target.value)}>
              <option value="">Todas las direcciones</option>
              {Object.entries(GEO_ESTADO).map(([v, g]) => <option key={v} value={v}>{g.etiqueta}</option>)}
            </select>
          </div>
          {!resumen.activa ? (
            <p className="nota">La búsqueda automática de ubicaciones está apagada en este servidor: enviar direcciones de clientes a un proveedor de mapas requiere la autorización del banco. Mientras tanto la nomenclatura de cada dirección (avenida, jirón, número, manzana/lote…) ya queda ordenada y con sus avisos de calidad.</p>
          ) : (
            <div className="acciones">
              <button type="button" className="ex-boton claro" disabled={ocupado || !resumen.pendientes}
                onClick={() => procesar("/api/expedientes/geocodificacion/procesar?limite=10", (d) => `Se revisaron ${d.procesados} direcciones (${d.localizado} precisas, ${d.aproximado} aproximadas, ${d.revisar} por revisar, ${d.no_encontrado} sin ubicar)${d.detenido ? ` · ${d.detenido}` : ""}.`)}>{ocupado ? "Buscando…" : "Buscar ubicaciones ahora"}</button>
              <button type="button" className="ex-boton claro" disabled={ocupado || !(resumen.no_encontradas + resumen.con_error)}
                onClick={() => procesar("/api/expedientes/geocodificacion/reencolar", (d) => `${d.reencoladas} direcciones volvieron a la cola.`)}>Reintentar las que fallaron</button>
            </div>
          )}
          <span className="mensaje" aria-live="polite">{mensaje}</span>
        </div>
      ) : null}
    </div>
  );
}
