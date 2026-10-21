import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQueryParam } from "../lib/useQueryParam";
import { request } from "../api";
import { useAuth } from "../AuthContext";
import { Avatar, Badge, Empty, Skeleton } from "../components/ui";
import { Icon } from "../components/icons";
import { ActionMenu, Seg } from "../components/kit";
import { dash, fecha } from "../lib/format";

const nombreDe = (a: any) => `${a?.nombres || ""} ${a?.apellidos || ""}`.trim() || a?.username || "";

export default function AsignacionesPage() {
  const [auditores, setAuditores] = useState<any[]>([]);
  const [pool, setPool] = useState<any[]>([]);
  const [asignaciones, setAsignaciones] = useState<any[]>([]);
  // Cuántos casos tomó cada auditor por su cuenta («Disponibles / Tomar este caso») frente a los asignados por un supervisor.
  const [resumen, setResumen] = useState<any>(null);
  const { user } = useAuth();
  const esAdmin = user?.rol === "ADMINISTRADOR";
  // Cambiar el interruptor afecta a todos los auditores: primero se pide confirmar, y solo el administrador puede hacerlo.
  const [confirmarInterruptor, setConfirmarInterruptor] = useState(false);
  const [cambiandoInterruptor, setCambiandoInterruptor] = useState(false);
  const cambiarInterruptor = async (activa: boolean) => {
    setCambiandoInterruptor(true);
    try {
      const r: any = await request("/api/asignaciones/autoasignacion", { method: "PUT", body: JSON.stringify({ activa }) });
      setResumen(r.data); setConfirmarInterruptor(false);
      setAviso(activa ? "Los auditores ya pueden tomar casos disponibles." : "Los auditores ya no pueden tomar casos por su cuenta: solo trabajan los que asignes tú.");
    } catch (x: any) { setError(x.message); } finally { setCambiandoInterruptor(false); }
  };
  // Pendientes que solo asigna un supervisor (cargas de Excel sin la casilla «disponibles»): el administrador puede liberarlos de una vez.
  const [liberando, setLiberando] = useState(false);
  const liberarReservados = async () => {
    if (!window.confirm(`¿Dejar ${Number(resumen?.pendientes_reservados || 0).toLocaleString("es-PE")} casos pendientes disponibles para que los auditores los tomen?`)) return;
    setLiberando(true);
    try {
      const r: any = await request("/api/asignaciones/liberar", { method: "POST" });
      setResumen(r.data.resumen); setError("");
      setAviso(`Se liberaron ${r.data.liberados.toLocaleString("es-PE")} casos: los auditores ya pueden tomarlos.`);
    } catch (x: any) { setError(x.message); } finally { setLiberando(false); }
  };
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [auditorId, setAuditorId] = useQueryParam("auditor");
  const [seleccion, setSeleccion] = useState<number[]>([]);
  const [prioridad, setPrioridad] = useState("MEDIA");
  const [guardando, setGuardando] = useState(false);
  const [busqueda, setBusqueda] = useQueryParam("q");
  const [tipoRaw, setTipo] = useQueryParam("tipo");
  const tipo = tipoRaw as "" | "OTROS" | "CONSUMO";

  // Nada de esta pantalla depende de que todo quepa en una respuesta: los expedientes sin asignar y las asignaciones se piden por páginas,
  // con la búsqueda y los filtros en el servidor, y la carga de cada auditor es un conteo de la base.
  const [poolInfo, setPoolInfo] = useState<{ page: number; pages: number; total: number } | null>(null);
  const [asigInfo, setAsigInfo] = useState<{ page: number; pages: number; total: number } | null>(null);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [carga, setCarga] = useState<Map<string, number>>(new Map());

  const cargarPool = async (pagina = 1) => {
    if (pagina > 1) setCargandoMas(true);
    try {
      const q = new URLSearchParams({ estado: "PENDIENTE", limit: "100", page: String(pagina) });
      if (busqueda.trim()) q.set("search", busqueda.trim());
      if (tipo) q.set("tipo_credito", tipo);
      const r: any = await request("/api/expedientes?" + q.toString());
      setPool((prev) => (pagina === 1 ? r.data : [...prev, ...r.data]));
      setPoolInfo(r.pagination ? { page: r.pagination.page, pages: r.pagination.pages, total: r.pagination.total } : null);
      setError("");
    } catch (x: any) { setError(x.message); } finally { setCargandoMas(false); setLoading(false); }
  };
  const cargarAsignaciones = async (pagina = 1) => {
    if (pagina > 1) setCargandoMas(true);
    try {
      const q = new URLSearchParams({ limit: "50", page: String(pagina) });
      if (auditorId) q.set("auditor", auditorId);
      const r: any = await request("/api/asignaciones?" + q.toString());
      setAsignaciones((prev) => (pagina === 1 ? r.data : [...prev, ...r.data]));
      setAsigInfo(r.pagination ? { page: r.pagination.page, pages: r.pagination.pages, total: r.pagination.total } : null);
    } catch (x: any) { setError(x.message); } finally { setCargandoMas(false); }
  };
  const cargar = async () => {
    try {
      const [a, o, c]: any[] = await Promise.all([
        request("/api/usuarios/auditores"),
        request("/api/asignaciones/resumen-origen").catch(() => ({ data: null })), // el reporte no debe tumbar la pantalla si falla
        request("/api/asignaciones/carga").catch(() => ({ data: [] })),
      ]);
      setAuditores(a.data); setResumen(o.data);
      setCarga(new Map<string, number>((c.data || []).map((x: any) => [x.id_usuario_auditor, x.activas])));
      setError("");
    } catch (x: any) { setError(x.message); }
    await Promise.all([cargarPool(1), cargarAsignaciones(1)]);
  };
  useEffect(() => { cargar(); }, []);
  // Al escribir o cambiar el tipo se vuelve a pedir la primera página (con una pequeña espera para no pedir en cada letra).
  const primeraCarga = useRef(true);
  useEffect(() => {
    if (primeraCarga.current) { primeraCarga.current = false; return; }
    const t = window.setTimeout(() => cargarPool(1), 300);
    return () => window.clearTimeout(t);
  }, [busqueda, tipoRaw]);
  const primeraCargaAsig = useRef(true);
  useEffect(() => {
    if (primeraCargaAsig.current) { primeraCargaAsig.current = false; return; }
    cargarAsignaciones(1);
  }, [auditorId]);

  const visibles = pool; // el servidor ya aplicó la búsqueda y el tipo
  const todosMarcados = visibles.length > 0 && visibles.every((x) => seleccion.includes(x.id_expediente));
  const alternar = (id: number) => setSeleccion((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const alternarTodos = () => setSeleccion((p) => (todosMarcados ? p.filter((id) => !visibles.some((x) => x.id_expediente === id)) : [...new Set([...p, ...visibles.map((x) => x.id_expediente)])]));

  const auditor = auditores.find((a) => a.id === auditorId);
  const asignar = async () => {
    if (!auditorId || !seleccion.length) return;
    setGuardando(true); setError(""); setAviso("");
    try {
      const r: any = await request("/api/asignaciones/masivo", { method: "POST", body: JSON.stringify({ id_usuario_auditor: auditorId, id_expedientes: seleccion, prioridad }) });
      const fallidos = (r.data || []).filter((x: any) => !x.ok);
      setAviso(fallidos.length ? `Se asignaron ${(r.data || []).length - fallidos.length} y ${fallidos.length} no se pudieron asignar: ${fallidos[0].error}` : `Se asignaron ${seleccion.length} expedientes a ${nombreDe(auditor)}.`);
      setSeleccion([]);
      await cargar();
    } catch (x: any) { setError(x.message); } finally { setGuardando(false); }
  };

  const cancelar = async (id: number) => {
    try { await request(`/api/asignaciones/${id}/cancelar`, { method: "POST" }); await cargar(); } catch (x: any) { setError(x.message); }
  };

  const activas = asignaciones; // ya vienen del servidor filtradas por el auditor elegido

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Asignaciones</h1>
          <p>Elige un auditor y marca los expedientes que debe visitar.</p>
        </div>
      </div>
      {error ? <div role="alert" className="error-box">{error}</div> : null}
      {aviso ? <div role="status" className="callout ok">{aviso}</div> : null}
      {resumen ? (
        <div className="callout info toma-casos">
          <div className="toma-texto" role="status">
            {resumen.total > 0 ? <b>Casos tomados por el propio auditor: {resumen.autoasignadas.toLocaleString("es-PE")} de {resumen.total.toLocaleString("es-PE")} ({resumen.porcentaje} %).</b> : <b>Aún no hay casos asignados.</b>}{" "}
            {resumen.autoasignacion_activa ? "Los auditores pueden tomar casos disponibles de cualquier distrito, los más cercanos a ellos primero." : "La toma de casos por cuenta propia está desactivada: solo trabajan lo que asigna un supervisor."}
            {resumen.pendientes_reservados > 0 ? (
              <p style={{ margin: "8px 0 0" }}>
                Hay {resumen.pendientes_reservados.toLocaleString("es-PE")} casos pendientes que solo asigna un supervisor (se cargaron sin marcar «disponibles»): los auditores no los ven en «Disponibles».{" "}
                {esAdmin ? <button type="button" className="btn small" disabled={liberando} onClick={liberarReservados}>{liberando ? "Liberando…" : "Liberarlos a los auditores"}</button> : "Pide al administrador que los libere."}
              </p>
            ) : null}
            {resumen.auditores.some((x: any) => x.autoasignadas > 0) ? (
              <ul className="pausas" aria-label="Casos tomados por auditor">
                {resumen.auditores.filter((x: any) => x.autoasignadas > 0).slice(0, 6).map((x: any) => <li key={x.id}>{x.nombre}: {x.autoasignadas} de {x.total} ({x.porcentaje} %)</li>)}
              </ul>
            ) : null}
          </div>
          {esAdmin ? (
            <div className="toma-control">
              <button type="button" role="switch" aria-checked={resumen.autoasignacion_activa} className={"interruptor" + (resumen.autoasignacion_activa ? " on" : "")} disabled={cambiandoInterruptor} onClick={() => setConfirmarInterruptor(true)}>
                <span className="pista" aria-hidden="true"><span className="perilla" /></span>
                <span>Los auditores pueden tomar casos</span>
              </button>
              {confirmarInterruptor ? (
                <div className="toma-confirma" role="alert">
                  <span>{resumen.autoasignacion_activa ? "¿Desactivarlo para todos los auditores?" : "¿Activarlo para todos los auditores?"}</span>
                  <button type="button" className="btn small primary" disabled={cambiandoInterruptor} onClick={() => cambiarInterruptor(!resumen.autoasignacion_activa)}>{cambiandoInterruptor ? "Guardando…" : "Sí, cambiar"}</button>
                  <button type="button" className="btn small quiet" onClick={() => setConfirmarInterruptor(false)}>Cancelar</button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="planner">
        <div>
          <div className="section-head"><h2>Auditores</h2><span className="meta">Casos activos</span></div>
          {loading ? <Skeleton height={220} radius={16} style={{ display: "block" }} /> : (
            <ul className="auditor-list">
              {auditores.map((a) => (
                <li key={a.id}>
                  <button className={auditorId === a.id ? "on" : ""} onClick={() => setAuditorId(auditorId === a.id ? "" : a.id)} aria-pressed={auditorId === a.id}>
                    <Avatar nombre={nombreDe(a)} />
                    <span><b>{nombreDe(a)}</b><small>{a.departamento || "Sin zona habitual"}</small></span>
                    <span className="load">{carga.get(a.id) || 0}<small>activos</small></span>
                  </button>
                </li>
              ))}
              {!auditores.length ? <li style={{ padding: 14 }} className="subtle">No hay auditores activos.</li> : null}
            </ul>
          )}
        </div>

        <div>
          <div className="section-head"><h2>Expedientes sin asignar</h2><span className="meta">{pool.length.toLocaleString("es-PE")} de {(poolInfo ? poolInfo.total : pool.length).toLocaleString("es-PE")}</span></div>
          <div className="filters">
            <div className="fgroup grow"><label className="lbl" htmlFor="b-asig">Buscar</label><input id="b-asig" name="q" type="search" autoComplete="off" spellCheck={false} className="input" placeholder="Crédito, cliente, documento o distrito…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} /></div>
            <div className="fgroup"><span className="lbl">Tipo de crédito</span><Seg label="Tipo de crédito" value={tipo} onChange={setTipo} options={[{ value: "", label: "Todos" }, { value: "OTROS", label: "MYPE" }, { value: "CONSUMO", label: "Consumo" }]} /></div>
          </div>
          {loading ? <Skeleton height={240} radius={16} style={{ display: "block" }} /> : !visibles.length ? (
            <Empty tipo="asignar" title="No hay expedientes por asignar" text={pool.length ? "Ninguno coincide con la búsqueda." : "Todos los expedientes ya tienen auditor o aún no cargaste ninguno."} />
          ) : (
            <div className="table-wrap long" style={{ maxHeight: 420, overflowY: "auto" }}>
              <table>
                <thead><tr><th scope="col" className="check-col"><input type="checkbox" checked={todosMarcados} onChange={alternarTodos} aria-label="Marcar todos los visibles" /></th><th scope="col">Crédito</th><th scope="col">Cliente</th><th scope="col">Tipo</th><th scope="col">Distrito</th></tr></thead>
                <tbody>
                  {visibles.map((x) => (
                    <tr key={x.id_expediente} className={`clickable${seleccion.includes(x.id_expediente) ? " selected" : ""}`} onClick={() => alternar(x.id_expediente)}>
                      <td className="check-col"><input type="checkbox" checked={seleccion.includes(x.id_expediente)} onChange={() => alternar(x.id_expediente)} onClick={(e) => e.stopPropagation()} aria-label={`Marcar ${x.nombres_cliente}`} /></td>
                      <td className="code" translate="no">{x.codigo_expediente}</td>
                      <td><div className="who-cell"><Avatar nombre={x.nombres_cliente} size="sm" /><span>{x.nombres_cliente}</span></div></td>
                      <td><span className={`tag ${x.tipo_credito === "OTROS" ? "aviso" : "base"}`}>{x.tipo_credito === "OTROS" ? "MYPE" : "Consumo"}</span></td>
                      <td>{dash(x.distrito)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {poolInfo && poolInfo.page < poolInfo.pages ? (
            <button type="button" className="btn quiet" style={{ marginTop: 8 }} disabled={cargandoMas} onClick={() => cargarPool(poolInfo.page + 1)}>{cargandoMas ? "Cargando…" : "Ver más (quedan " + (poolInfo.total - pool.length) + ")"}</button>
          ) : null}

          <div className="stickybar">
            <span className="grow">{seleccion.length ? <><b style={{ fontWeight: 600 }}>{seleccion.length}</b> {seleccion.length === 1 ? "expediente marcado" : "expedientes marcados"}{auditor ? <> para <b style={{ fontWeight: 600 }}>{nombreDe(auditor)}</b></> : <>: elige un auditor a la izquierda</>}</> : "Marca los expedientes que quieres asignar"}</span>
            <label className="sr-only" htmlFor="prio">Prioridad de los casos</label>
            <select id="prio" name="prioridad" value={prioridad} onChange={(e) => setPrioridad(e.target.value)}><option value="ALTA">Prioridad alta</option><option value="MEDIA">Prioridad media</option><option value="BAJA">Prioridad baja</option></select>
            <button className="btn" disabled={guardando || !auditorId || !seleccion.length} onClick={asignar}><Icon name="ok" size={17} />{guardando ? "Asignando…" : "Asignar"}</button>
          </div>

          <div className="section">
            <div className="section-head"><h2>Asignaciones {auditor ? `de ${nombreDe(auditor)}` : "recientes"}</h2><span className="meta">{(asigInfo ? asigInfo.total : activas.length).toLocaleString("es-PE")}</span></div>
            {!activas.length ? <Empty tipo="asignar" title="Sin asignaciones" text="Cuando asignes expedientes aparecerán aquí." /> : (
              <div className="table-wrap">
                <table>
                  <thead><tr><th scope="col">Expediente</th><th scope="col">Auditor</th><th scope="col">Asignado</th><th scope="col">Prioridad</th><th scope="col">Estado</th><th scope="col"></th></tr></thead>
                  <tbody>
                    {activas.map((a) => (
                      <tr key={a.id_asignacion}>
                        <td><Link to={`/expedientes/${a.id_expediente}`}>{a.expediente?.nombres_cliente}</Link><span className="sub">{a.expediente?.codigo_expediente}</span></td>
                        <td>{nombreDe(a.auditor)}</td>
                        <td>{fecha(a.fecha_asignacion)}<span className="sub">{a.origen === "AUTOASIGNADA" ? "La tomó el auditor" : "Asignada por supervisor"}</span></td>
                        <td><Badge label={a.prioridad} /></td>
                        <td><Badge label={a.estado} /></td>
                        <td style={{ textAlign: "right" }}>{a.estado === "ACTIVA" ? <ActionMenu items={[{ label: "Cancelar asignación", tone: "bad", onClick: () => { if (window.confirm("¿Cancelar esta asignación? El expediente vuelve a quedar sin asignar.")) cancelar(a.id_asignacion); } }]} /> : null}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {asigInfo && asigInfo.page < asigInfo.pages ? (
              <button type="button" className="btn quiet" style={{ marginTop: 8 }} disabled={cargandoMas} onClick={() => cargarAsignaciones(asigInfo.page + 1)}>{cargandoMas ? "Cargando…" : "Ver más (quedan " + (asigInfo.total - asignaciones.length) + ")"}</button>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}
