import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { request } from "../../api";
import Dialogo from "../Dialogo";
import MenuFila from "../MenuFila";
import Paginador from "../Paginador";
import { Skeleton } from "../ui";
import { fecha, nombrePropio } from "../../lib/format";
import { motivoTexto } from "../../lib/casos";
import { nombreAuditor, type Auditor } from "../../lib/asignaciones";

// Ventana «Asignaciones» (o «Casos de …» si se abre desde un auditor): todas las asignaciones, de la más reciente a la más antigua, por páginas y filtradas por estado en el
// servidor. Aquí se cancela una asignación (el expediente vuelve a quedar sin asignar) y se llega a «Quitar sus casos…» del auditor. Antes esta tabla vivía debajo de la
// pantalla; ahora sale cuando se necesita para que la pantalla de tres columnas no se alargue.
const ESTADOS = [["", "Todas"], ["ACTIVA", "Activas"], ["FINALIZADA", "Finalizadas"], ["CANCELADA", "Canceladas"]] as const;
const TAMANOS = [10, 25, 50];
const PASTILLA: Record<string, string> = { ACTIVA: "ok", FINALIZADA: "sup", CANCELADA: "mal", ALTA: "mal", MEDIA: "aviso", BAJA: "gris" };
const ETIQUETA: Record<string, string> = { ACTIVA: "Activa", FINALIZADA: "Finalizada", CANCELADA: "Cancelada", ALTA: "Alta", MEDIA: "Media", BAJA: "Baja" };

export default function ListaAsignaciones({ auditor, onClose, onCambio, onQuitar }: { auditor: Auditor | null; onClose: () => void; onCambio: () => void; onQuitar: () => void }) {
  const [estado, setEstado] = useState(auditor ? "ACTIVA" : "");
  const [pagina, setPagina] = useState(1);
  const [filas, setFilas] = useState(10);
  const [data, setData] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [paginas, setPaginas] = useState(1);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [cancelando, setCancelando] = useState<any | null>(null); // asignación a punto de cancelarse (pide confirmar)
  const [guardando, setGuardando] = useState(false);
  const [recarga, setRecarga] = useState(0);

  const consulta = useMemo(() => {
    const p = new URLSearchParams({ limit: String(filas), page: String(pagina) });
    if (auditor) p.set("auditor", auditor.id);
    if (estado) p.set("estado", estado);
    return p.toString();
  }, [auditor, estado, pagina, filas]);

  useEffect(() => {
    let vigente = true;
    setCargando(true);
    request<{ data: any[]; pagination: { total: number; pages: number } }>(`/api/asignaciones?${consulta}`)
      .then((r) => {
        if (!vigente) return;
        if (!r.data.length && r.pagination.total > 0 && pagina > 1) { setPagina(Math.max(1, r.pagination.pages)); return; }
        setData(r.data); setTotal(r.pagination.total); setPaginas(r.pagination.pages); setError("");
      })
      .catch((e) => { if (vigente) setError(e?.message || "No se pudieron cargar las asignaciones."); })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [consulta, recarga]); // eslint-disable-line react-hooks/exhaustive-deps

  const cancelar = async () => {
    if (!cancelando) return;
    setGuardando(true);
    try { await request(`/api/asignaciones/${cancelando.id_asignacion}/cancelar`, { method: "POST" }); setCancelando(null); setError(""); setRecarga((n) => n + 1); onCambio(); }
    catch (e: any) { setError(e?.message || "No se pudo cancelar."); } finally { setGuardando(false); }
  };

  return (
    <Dialogo icono="asignaciones" titulo={auditor ? `Casos de ${nombreAuditor(auditor)}` : "Asignaciones"} subtitulo={auditor ? "Lo que tiene asignado este auditor, de lo más reciente a lo más antiguo." : "Todas las asignaciones, de la más reciente a la más antigua."} ancho={980} onClose={onClose}
      pie={<>{auditor && (auditor.activos ?? 0) > 0 ? <button type="button" className="pa-boton suave" style={{ marginRight: "auto" }} onClick={onQuitar}>Quitar sus casos…</button> : null}<button type="button" className="pa-boton" onClick={onClose}>Cerrar</button></>}>
      <div className="as-lista-cab">
        <div className="pa-seg" role="group" aria-label="Estado de la asignación">
          {ESTADOS.map(([v, et]) => <button key={v} type="button" className={estado === v ? "on" : ""} aria-pressed={estado === v} onClick={() => { setEstado(v); setPagina(1); }}>{et}</button>)}
        </div>
        <span className="as-cuenta" role="status">{total.toLocaleString("es-PE")} {total === 1 ? "asignación" : "asignaciones"}</span>
      </div>
      {error ? <div role="alert" className="pa-error">{error}</div> : null}
      {cancelando ? (
        <div className="pa-alerta aviso" role="alert">
          <div style={{ flex: 1 }}><b>¿Cancelar esta asignación?</b><p>{nombrePropio(cancelando.expediente?.nombres_cliente)} volverá a quedar sin asignar.</p></div>
          <button type="button" className="pa-boton chico peligro" onClick={cancelar} disabled={guardando}>{guardando ? "Cancelando…" : "Sí, cancelar"}</button>
          <button type="button" className="pa-boton chico" onClick={() => setCancelando(null)} disabled={guardando}>No</button>
        </div>
      ) : null}
      {cargando && !data.length ? <div className="as-esqueleto">{[0, 1, 2, 3].map((i) => <Skeleton key={i} height={44} radius={10} style={{ display: "block" }} />)}</div>
        : !data.length ? <p className="as-vacio grande"><b className="t">Sin asignaciones</b>Cuando asignes expedientes aparecerán aquí.</p> : (
          <div className="pa-tarjeta as-lista-tarjeta" aria-busy={cargando}>
            <div className="pa-scroll">
              <table className="pa-tabla as-lista-tabla">
                <caption className="sr-only">Asignaciones</caption>
                <thead><tr><th scope="col">Expediente</th>{auditor ? null : <th scope="col">Auditor</th>}<th scope="col">Asignado</th><th scope="col" className="c">Prioridad</th><th scope="col" className="c">Estado</th><th scope="col"><span className="sr-only">Acciones</span></th></tr></thead>
                <tbody>
                  {data.map((a) => (
                    <tr key={a.id_asignacion}>
                      <td><Link to={`/expedientes/${a.id_expediente}`} onClick={onClose}>{nombrePropio(a.expediente?.nombres_cliente)}</Link><small className="as-sub" translate="no">{a.expediente?.codigo_expediente}</small></td>
                      {auditor ? null : <td>{nombreAuditor(a.auditor || { username: "" })}</td>}
                      <td>{fecha(a.fecha_asignacion)}<small className="as-sub">{a.origen === "AUTOASIGNADA" ? "La tomó el auditor" : "Asignada por supervisor"}</small></td>
                      <td className="c"><span className={`pa-pastilla ${PASTILLA[a.prioridad] || "gris"}`}>{ETIQUETA[a.prioridad] || a.prioridad}</span></td>
                      <td className="c"><span className={`pa-pastilla ${PASTILLA[a.estado] || "gris"}`}>{ETIQUETA[a.estado] || a.estado}</span>{a.estado === "CANCELADA" && a.motivo_fin ? <small className="as-sub">{motivoTexto(a.motivo_fin)}</small> : null}</td>
                      <td className="as-fin">{a.estado === "ACTIVA" ? <MenuFila etiqueta="Acciones de la asignación" opciones={[{ etiqueta: "Cancelar asignación", icono: "cerrar", peligro: true, onClick: () => setCancelando(a) }]} /> : null}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Paginador compacto pagina={pagina} paginas={paginas} filas={filas} total={total} mostrados={data.length} tamanos={TAMANOS} onPagina={setPagina} onFilas={(n) => { setFilas(n); setPagina(1); }} />
          </div>
        )}
    </Dialogo>
  );
}
