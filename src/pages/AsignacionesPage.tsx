import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQueryParam } from "../lib/useQueryParam";
import { request } from "../api";
import { Badge, Empty, Skeleton } from "../components/ui";
import { ActionMenu, Seg } from "../components/kit";
import { dash, fecha } from "../lib/format";

const nombreDe = (a: any) => `${a?.nombres || ""} ${a?.apellidos || ""}`.trim() || a?.username || "";

export default function AsignacionesPage() {
  const [auditores, setAuditores] = useState<any[]>([]);
  const [pool, setPool] = useState<any[]>([]);
  const [asignaciones, setAsignaciones] = useState<any[]>([]);
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

  const cargar = async () => {
    try {
      const [a, e, s]: any[] = await Promise.all([
        request("/api/usuarios/auditores"),
        request("/api/expedientes?estado=PENDIENTE&limit=200"),
        request("/api/asignaciones?limit=100"),
      ]);
      setAuditores(a.data); setPool(e.data); setAsignaciones(s.data);
      setError("");
    } catch (x: any) { setError(x.message); } finally { setLoading(false); }
  };
  useEffect(() => { cargar(); }, []);

  const carga = useMemo(() => {
    const m = new Map<string, number>();
    asignaciones.filter((x) => x.estado === "ACTIVA").forEach((x) => m.set(x.id_usuario_auditor, (m.get(x.id_usuario_auditor) || 0) + 1));
    return m;
  }, [asignaciones]);

  const q = busqueda.trim().toLowerCase();
  const visibles = pool.filter((x) => (!tipo || x.tipo_credito === tipo) && (!q || [x.codigo_expediente, x.nombres_cliente, x.numero_documento_cliente, x.distrito].some((v) => String(v || "").toLowerCase().includes(q))));
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

  const activas = asignaciones.filter((x) => (!auditorId || x.id_usuario_auditor === auditorId));

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

      <div className="planner">
        <div>
          <div className="section-head"><h2>Auditores</h2><span className="meta">Casos activos</span></div>
          {loading ? <Skeleton height={180} radius={3} style={{ display: "block", marginTop: 12 }} /> : (
            <ul className="auditor-list">
              {auditores.map((a) => (
                <li key={a.id}>
                  <button className={auditorId === a.id ? "on" : ""} onClick={() => setAuditorId(auditorId === a.id ? "" : a.id)} aria-pressed={auditorId === a.id}>
                    <span><b>{nombreDe(a)}</b><small>{a.departamento || "Sin zona definida"}</small></span>
                    <span className="load">{carga.get(a.id) || 0}</span>
                  </button>
                </li>
              ))}
              {!auditores.length ? <li style={{ padding: 14 }} className="subtle">No hay auditores activos.</li> : null}
            </ul>
          )}
        </div>

        <div>
          <div className="section-head"><h2>Expedientes sin asignar</h2><span className="meta">{visibles.length} de {pool.length}</span></div>
          <div className="filters">
            <div className="fgroup grow"><label className="lbl" htmlFor="b-asig">Buscar</label><input id="b-asig" name="q" type="search" autoComplete="off" spellCheck={false} className="input" placeholder="Crédito, cliente, documento o distrito…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} /></div>
            <div className="fgroup"><span className="lbl">Tipo de crédito</span><Seg label="Tipo de crédito" value={tipo} onChange={setTipo} options={[{ value: "", label: "Todos" }, { value: "OTROS", label: "MYPE" }, { value: "CONSUMO", label: "Consumo" }]} /></div>
          </div>
          {loading ? <Skeleton height={240} radius={3} style={{ display: "block", marginTop: 12 }} /> : !visibles.length ? (
            <Empty title="No hay expedientes por asignar" text={pool.length ? "Ninguno coincide con la búsqueda." : "Todos los expedientes ya tienen auditor o aún no cargaste ninguno."} />
          ) : (
            <div className="table-wrap long" style={{ maxHeight: 420, overflowY: "auto" }}>
              <table>
                <thead><tr><th scope="col" className="check-col"><input type="checkbox" checked={todosMarcados} onChange={alternarTodos} aria-label="Marcar todos los visibles" /></th><th scope="col">Crédito</th><th scope="col">Cliente</th><th scope="col">Tipo</th><th scope="col">Distrito</th></tr></thead>
                <tbody>
                  {visibles.map((x) => (
                    <tr key={x.id_expediente} className={`clickable${seleccion.includes(x.id_expediente) ? " selected" : ""}`} onClick={() => alternar(x.id_expediente)}>
                      <td className="check-col"><input type="checkbox" checked={seleccion.includes(x.id_expediente)} onChange={() => alternar(x.id_expediente)} onClick={(e) => e.stopPropagation()} aria-label={`Marcar ${x.nombres_cliente}`} /></td>
                      <td className="code" translate="no">{x.codigo_expediente}</td>
                      <td>{x.nombres_cliente}</td>
                      <td>{x.tipo_credito === "OTROS" ? "MYPE" : "Consumo"}</td>
                      <td>{dash(x.distrito)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="stickybar">
            <span className="grow">{seleccion.length ? <><b style={{ fontWeight: 600 }}>{seleccion.length}</b> {seleccion.length === 1 ? "expediente marcado" : "expedientes marcados"}{auditor ? <> para <b style={{ fontWeight: 600 }}>{nombreDe(auditor)}</b></> : <>: elige un auditor a la izquierda</>}</> : "Marca los expedientes que quieres asignar"}</span>
            <label className="sr-only" htmlFor="prio">Prioridad de los casos</label>
            <select id="prio" name="prioridad" value={prioridad} onChange={(e) => setPrioridad(e.target.value)}><option value="ALTA">Prioridad alta</option><option value="MEDIA">Prioridad media</option><option value="BAJA">Prioridad baja</option></select>
            <button className="btn" style={{ background: "#fff", color: "var(--ink)", borderColor: "#fff" }} disabled={guardando || !auditorId || !seleccion.length} onClick={asignar}>{guardando ? "Asignando…" : "Asignar"}</button>
          </div>

          <div className="section">
            <div className="section-head"><h2>Asignaciones {auditor ? `de ${nombreDe(auditor)}` : "recientes"}</h2><span className="meta">{activas.length}</span></div>
            {!activas.length ? <Empty title="Sin asignaciones" text="Cuando asignes expedientes aparecerán aquí." /> : (
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
          </div>
        </div>
      </div>
    </>
  );
}
