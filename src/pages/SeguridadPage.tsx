import { useEffect, useState } from "react";
import { request } from "../api";
import { Card, Loading } from "../components/ui";

export default function SeguridadPage() {
  const [metricas, setMetricas] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
      {loading ? <Loading /> : (
        <>
          <div className="grid grid-4">
            <Card><div className="value">{metricas?.total_eventos}</div><div className="label">Eventos (24 h)</div></Card>
            <Card><div className="value">{metricas?.errores}</div><div className="label">Errores (24 h)</div></Card>
            <Card><div className="value">{metricas?.fallos_autenticacion}</div><div className="label">Fallos de login</div></Card>
            <Card><div className="value">{metricas?.cuentas_bloqueadas}</div><div className="label">Cuentas bloqueadas</div></Card>
          </div>
          <Card>
            <p className="section-title">Log de auditoría reciente</p>
            <table>
              <thead><tr><th>Fecha</th><th>Actor</th><th>Rol</th><th>Método</th><th>Ruta</th><th>HTTP</th><th>IP</th></tr></thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id_auditoria}>
                    <td>{new Date(log.fecha).toLocaleString("es-PE")}</td>
                    <td>{log.actor || "anónimo"}</td>
                    <td>{log.rol || "-"}</td>
                    <td>{log.metodo}</td>
                    <td style={{ maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{log.ruta}</td>
                    <td style={{ color: log.estado_http >= 400 ? "var(--danger)" : "var(--success)" }}>{log.estado_http}</td>
                    <td>{log.ip_address || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </>
  );
}
