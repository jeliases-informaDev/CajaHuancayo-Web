import { useCallback, useEffect, useRef, useState } from "react";
import { request } from "../api";
import { Drawer } from "./kit";
import { Skeleton } from "./ui";
import { fechaHora } from "../lib/format";

// Historial de jornadas de campo de un auditor: cuándo salió, cuánto duró y desde qué zona (la que tomó su celular al iniciarla). Por páginas: nunca se
// carga todo el historial de una vez.

type Jornada = {
  id: number; inicio: string; fin: string | null; cierre: string | null; en_curso: boolean; duracion_min: number | null;
  zona: string | null; latitud: number | null; longitud: number | null; precision_metros: number | null; simulada: boolean;
};
type Pagina = { usuario: { id: string; username: string; nombre: string }; data: Jornada[]; siguiente: string | null; total: number };

const duracionTexto = (min: number | null) => {
  if (min == null) return "—";
  const h = Math.floor(min / 60); const m = min % 60;
  return h ? `${h} h${m ? ` ${m} min` : ""}` : `${m} min`;
};
const hora = (v: string) => new Date(v).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" });
const dia = (v: string) => new Date(v).toLocaleDateString("es-PE", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" });

// Cómo terminó: la que sigue abierta, la que cerró el auditor, la que se cerró sola porque inició otra el mismo día, o la que nunca terminó.
function Estado({ j }: { j: Jornada }) {
  if (j.en_curso) return <span className="state ok">En curso</span>;
  if (j.cierre === "NORMAL") return <span className="state neutral">Terminó</span>;
  if (j.cierre === "REINICIADA") return <span className="state warn" title="Inició otra jornada sin terminar esta: la hora de fin es la del nuevo inicio.">Reiniciada</span>;
  if (j.cierre === "SIN_CIERRE") return <span className="state bad" title="Nunca la terminó: no se conoce la hora de fin.">Sin cierre</span>;
  return <span className="state neutral">—</span>;
}

export function JornadasDrawer({ usuario, onClose }: { usuario: { id: string; nombre: string; username: string }; onClose: () => void }) {
  const [filas, setFilas] = useState<Jornada[]>([]);
  const [siguiente, setSiguiente] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [masCargando, setMasCargando] = useState(false);
  const [error, setError] = useState("");
  const vigente = useRef(0);

  const pedir = useCallback(async (cursor?: string) => {
    const id = ++vigente.current;
    if (cursor) setMasCargando(true); else setCargando(true);
    try {
      const r = await request<Pagina>(`/api/usuarios/${usuario.id}/jornadas?limit=30${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`);
      if (id !== vigente.current) return;
      setFilas((previas) => (cursor ? [...previas, ...r.data] : r.data)); setSiguiente(r.siguiente); setTotal(r.total); setError("");
    } catch (e: any) { if (id === vigente.current) setError(e.message || "No se pudo leer el historial."); } finally { if (id === vigente.current) { setCargando(false); setMasCargando(false); } }
  }, [usuario.id]);
  useEffect(() => { pedir(); }, [pedir]);

  return (
    <Drawer title="Jornadas de campo" subtitle={`${usuario.nombre || "Auditor"} · @${usuario.username}`} onClose={onClose}
      footer={<button className="btn ghost" onClick={onClose}>Cerrar</button>}>
      <div className="jor-cuerpo">
        {error ? <div role="alert" className="error-box">{error}</div> : null}
        {cargando && !filas.length ? <Skeleton height={180} radius={14} style={{ display: "block" }} /> : null}
        {!cargando && !error && !filas.length ? <p className="subtle">Todavía no inició ninguna jornada. Cuando la inicie desde el celular, aquí quedará su zona de trabajo de cada día.</p> : null}
        {filas.length ? (
          <>
            <p className="subtle" role="status" aria-live="polite" style={{ margin: 0 }}>{total.toLocaleString("es-PE")} {total === 1 ? "jornada" : "jornadas"} · {filas.length.toLocaleString("es-PE")} a la vista</p>
            <ul className="jor-lista">
              {filas.map((j) => (
                <li key={j.id}>
                  <div className="jor-cab">
                    <b>{dia(j.inicio)}</b>
                    <Estado j={j} />
                  </div>
                  <div className="jor-detalle">
                    <span>{hora(j.inicio)} – {j.fin ? hora(j.fin) : j.en_curso ? "en curso" : "sin hora de fin"}{j.duracion_min != null ? <span className="jor-dur"> · {duracionTexto(j.duracion_min)}</span> : null}</span>
                    <span className={j.zona ? undefined : "muted"}>{j.zona ? `${j.simulada ? "Zona indicada" : "Zona"}: ${j.zona}` : j.latitud != null ? "Zona sin nombre (solo la posición)" : "Sin posición (versión anterior de la app)"}</span>
                    {j.simulada ? <span className="state bad" title="El celular avisó que la posición no era real (GPS falso): no cuenta como su zona de trabajo.">GPS simulado</span> : null}
                    {j.latitud != null && j.longitud != null && !j.simulada ? <span className="muted jor-gps" translate="no" title={`Precisión ${j.precision_metros != null ? Math.round(j.precision_metros) + " m" : "desconocida"}. Inició: ${fechaHora(j.inicio)}`}>{j.latitud.toFixed(5)}, {j.longitud.toFixed(5)}</span> : null}
                  </div>
                </li>
              ))}
            </ul>
            {siguiente ? <button type="button" className="btn quiet" disabled={masCargando} onClick={() => pedir(siguiente)}>{masCargando ? "Cargando…" : `Ver más jornadas (quedan ${(total - filas.length).toLocaleString("es-PE")})`}</button> : null}
          </>
        ) : null}
      </div>
    </Drawer>
  );
}
