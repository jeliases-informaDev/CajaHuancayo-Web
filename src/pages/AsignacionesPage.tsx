import { useEffect, useState } from "react";
import { request } from "../api";
import { Badge, Button, Card, Field, Loading } from "../components/ui";

export default function AsignacionesPage() {
  const [auditores, setAuditores] = useState<any[]>([]);
  const [expedientesDisponibles, setExpedientesDisponibles] = useState<any[]>([]);
  const [asignaciones, setAsignaciones] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [auditorId, setAuditorId] = useState("");
  const [seleccionados, setSeleccionados] = useState<number[]>([]);
  const [prioridad, setPrioridad] = useState("MEDIA");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [usuarios, expedientes, asigs]: any[] = await Promise.all([
        request("/api/usuarios"),
        request("/api/expedientes?estado=PENDIENTE&limit=200"),
        request("/api/asignaciones?limit=100"),
      ]);
      setAuditores(usuarios.data.filter((u: any) => u.rol === "AUDITOR" && u.estado === "ACTIVO"));
      setExpedientesDisponibles(expedientes.data);
      setAsignaciones(asigs.data);
    } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const asignar = async () => {
    if (!auditorId || !seleccionados.length) { setError("Selecciona un auditor y al menos un expediente."); return; }
    setSaving(true); setError("");
    try {
      await request("/api/asignaciones/masivo", { method: "POST", body: JSON.stringify({ id_usuario_auditor: auditorId, id_expedientes: seleccionados, prioridad }) });
      setSeleccionados([]);
      await load();
    } catch (e: any) { setError(e.message); } finally { setSaving(false); }
  };

  const cancelar = async (id: number) => {
    try { await request(`/api/asignaciones/${id}/cancelar`, { method: "POST" }); await load(); }
    catch (e: any) { setError(e.message); }
  };

  const toggle = (id: number) => setSeleccionados((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  return (
    <>
      <div className="page-header">
        <h1>Asignaciones</h1>
        <p>Arma la muestra de expedientes que cada auditor debe visitar.</p>
      </div>
      {error ? <div className="error-box">{error}</div> : null}
      {loading ? <Loading /> : (
        <>
          <Card>
            <p className="section-title">Nueva asignación</p>
            <div className="grid grid-2">
              <Field label="Auditor">
                <select value={auditorId} onChange={(e) => setAuditorId(e.target.value)}>
                  <option value="">Selecciona…</option>
                  {auditores.map((a) => <option key={a.id} value={a.id}>{a.nombres || a.username} (@{a.username})</option>)}
                </select>
              </Field>
              <Field label="Prioridad">
                <select value={prioridad} onChange={(e) => setPrioridad(e.target.value)}>
                  <option value="ALTA">Alta</option><option value="MEDIA">Media</option><option value="BAJA">Baja</option>
                </select>
              </Field>
            </div>
            <Field label={`Expedientes sin asignar (${seleccionados.length} seleccionado(s))`}>
              <div style={{ maxHeight: 240, overflowY: "auto", border: "1px solid var(--border)", borderRadius: 10 }}>
                <table>
                  <tbody>
                    {expedientesDisponibles.map((exp) => (
                      <tr key={exp.id_expediente} className="clickable" onClick={() => toggle(exp.id_expediente)}>
                        <td style={{ width: 24 }}><input type="checkbox" checked={seleccionados.includes(exp.id_expediente)} readOnly /></td>
                        <td>{exp.codigo_expediente}</td>
                        <td>{exp.nombres_cliente}</td>
                        <td>{exp.tipo_credito}</td>
                        <td>{exp.distrito || "-"}</td>
                      </tr>
                    ))}
                    {!expedientesDisponibles.length ? <tr><td className="muted">No hay expedientes pendientes de asignar.</td></tr> : null}
                  </tbody>
                </table>
              </div>
            </Field>
            <Button title={saving ? "Asignando…" : "Asignar seleccionados"} onClick={asignar} disabled={saving} />
          </Card>

          <Card>
            <p className="section-title">Asignaciones actuales</p>
            <table>
              <thead><tr><th>Expediente</th><th>Auditor</th><th>Prioridad</th><th>Estado</th><th></th></tr></thead>
              <tbody>
                {asignaciones.map((a) => (
                  <tr key={a.id_asignacion}>
                    <td>{a.expediente?.codigo_expediente} · {a.expediente?.nombres_cliente}</td>
                    <td>{a.auditor?.nombres || a.auditor?.username}</td>
                    <td><Badge label={a.prioridad} /></td>
                    <td><Badge label={a.estado} /></td>
                    <td>{a.estado === "ACTIVA" ? <Button kind="ghost" title="Cancelar" onClick={() => cancelar(a.id_asignacion)} /> : null}</td>
                  </tr>
                ))}
                {!asignaciones.length ? <tr><td colSpan={5} className="muted">Sin asignaciones todavía.</td></tr> : null}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </>
  );
}
