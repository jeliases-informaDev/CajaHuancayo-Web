import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { request } from "../api";
import { Badge, Card, Loading } from "../components/ui";

export default function DashboardPage() {
  const [stats, setStats] = useState<{ expedientes: number; asignacionesActivas: number; visitas: any[] } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const [expedientes, asignaciones, visitas]: any[] = await Promise.all([
          request("/api/expedientes?limit=1"),
          request("/api/asignaciones?estado=ACTIVA&limit=1"),
          request("/api/visitas?limit=8"),
        ]);
        setStats({
          expedientes: expedientes.pagination.total,
          asignacionesActivas: asignaciones.pagination.total,
          visitas: visitas.data,
        });
      } catch (e: any) {
        setError(e.message);
      }
    })();
  }, []);

  if (error) return <Card><p style={{ color: "var(--danger)", margin: 0 }}>{error}</p></Card>;
  if (!stats) return <Loading />;

  const conObservaciones = stats.visitas.filter((v) => v.resultado !== "CONFORME").length;

  return (
    <>
      <div className="page-header">
        <h1>Dashboard</h1>
        <p>Resumen general de la operación de auditoría.</p>
      </div>
      <div className="grid grid-4">
        <Card className="kpi"><div className="value">{stats.expedientes}</div><div className="label">Expedientes totales</div></Card>
        <Card><div className="value">{stats.asignacionesActivas}</div><div className="label">Asignaciones activas</div></Card>
        <Card><div className="value">{stats.visitas.length}</div><div className="label">Visitas recientes</div></Card>
        <Card><div className="value">{conObservaciones}</div><div className="label">Con observaciones</div></Card>
      </div>
      <Card>
        <p className="section-title">Últimas visitas</p>
        <table>
          <thead><tr><th>Fecha</th><th>Expediente</th><th>Auditor</th><th>Resultado</th></tr></thead>
          <tbody>
            {stats.visitas.map((v) => (
              <tr key={v.id_visita} className="clickable" onClick={() => (window.location.href = `/visitas/${v.id_visita}`)}>
                <td>{new Date(v.fecha_hora_checkin).toLocaleString("es-PE")}</td>
                <td>{v.expediente?.codigo_expediente} · {v.expediente?.nombres_cliente}</td>
                <td>{v.auditor?.nombres || v.auditor?.username}</td>
                <td><Badge label={v.resultado} /></td>
              </tr>
            ))}
            {!stats.visitas.length ? <tr><td colSpan={4} className="muted">Sin visitas registradas todavía.</td></tr> : null}
          </tbody>
        </table>
        <p style={{ marginTop: 10 }}><Link to="/visitas">Ver todas las visitas →</Link></p>
      </Card>
    </>
  );
}
