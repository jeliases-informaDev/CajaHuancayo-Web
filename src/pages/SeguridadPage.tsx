import { Fragment, useEffect, useState } from "react";
import { request } from "../api";
import { Card, SkeletonKpis, SkeletonTable } from "../components/ui";

export default function SeguridadPage() {
  const [metricas, setMetricas] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandido, setExpandido] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([request("/api/seguridad/metricas"), request("/api/seguridad/auditoria?limit=50")])
      .then(([m, l]: any[]) => { setMetricas(m.data); setLogs(l.data); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (error) return <Card><p style={{ color: "var(--danger)" }}>{error}</p></Card>;

  return (
    <>
      <div className="page-header">
        <h1>Seguridad</h1>
        <p>Registro inmutable de operaciones y accesos (últimas 24 h y log reciente).</p>
      </div>
      {loading ? (
        <>
          <SkeletonKpis />
          <Card>
            <p className="section-title">Log de auditoría reciente</p>
            <SkeletonTable rows={8} cols={7} />
          </Card>
        </>
      ) : (
        <>
          <div className="grid grid-4">
            <Card className="kpi"><div className="value">{metricas?.total_eventos}</div><div className="label">Eventos (24 h)</div></Card>
            <Card className="kpi"><div className="value">{metricas?.errores}</div><div className="label">Errores (24 h)</div></Card>
            <Card className="kpi"><div className="value">{metricas?.fallos_autenticacion}</div><div className="label">Fallos de login</div></Card>
            <Card className="kpi"><div className="value">{metricas?.cuentas_bloqueadas}</div><div className="label">Cuentas bloqueadas</div></Card>
          </div>
          <Card>
            <p className="section-title">Log de auditoría reciente</p>
            <p style={{ fontSize: 12, color: "var(--muted)", marginTop: -8, marginBottom: 10 }}>
              Las filas con un cambio de negocio (crear/editar/eliminar usuarios, expedientes o asignaciones) se pueden expandir para ver el valor anterior y el nuevo.
            </p>
            <table>
              <thead><tr><th></th><th>Fecha</th><th>Actor</th><th>Rol</th><th>Método</th><th>Ruta</th><th>HTTP</th><th>IP</th></tr></thead>
              <tbody>
                {logs.map((log) => {
                  const tieneDiff = Boolean(log.entidad);
                  const abierto = expandido === log.id_auditoria;
                  return (
                    <Fragment key={log.id_auditoria}>
                      <tr
                        onClick={() => tieneDiff && setExpandido(abierto ? null : log.id_auditoria)}
                        style={{ cursor: tieneDiff ? "pointer" : "default" }}
                      >
                        <td style={{ color: "var(--primary)", fontWeight: 800 }}>{tieneDiff ? (abierto ? "▾" : "▸") : ""}</td>
                        <td>{new Date(log.fecha).toLocaleString("es-PE")}</td>
                        <td>{log.actor || "anónimo"}</td>
                        <td>{log.rol || "-"}</td>
                        <td>{log.metodo}</td>
                        <td style={{ maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {log.ruta}{tieneDiff ? ` · ${log.entidad} #${log.entidad_id}` : ""}
                        </td>
                        <td style={{ color: log.estado_http >= 400 ? "var(--danger)" : "var(--success)" }}>{log.estado_http}</td>
                        <td>{log.ip_address || "-"}</td>
                      </tr>
                      {abierto ? (
                        <tr>
                          <td colSpan={8} style={{ background: "var(--bg)" }}>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, padding: "10px 4px" }}>
                              <div>
                                <p style={{ fontSize: 11, fontWeight: 800, color: "var(--muted)", textTransform: "uppercase", marginBottom: 4 }}>Valor anterior</p>
                                <pre style={{ fontSize: 11.5, whiteSpace: "pre-wrap", margin: 0 }}>{log.valor_anterior ? JSON.stringify(log.valor_anterior, null, 2) : "(no existía)"}</pre>
                              </div>
                              <div>
                                <p style={{ fontSize: 11, fontWeight: 800, color: "var(--muted)", textTransform: "uppercase", marginBottom: 4 }}>Valor nuevo</p>
                                <pre style={{ fontSize: 11.5, whiteSpace: "pre-wrap", margin: 0 }}>{log.valor_nuevo ? JSON.stringify(log.valor_nuevo, null, 2) : "(eliminado)"}</pre>
                              </div>
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </>
  );
}
