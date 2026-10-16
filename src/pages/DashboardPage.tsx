import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { request } from "../api";
import { Badge, Card, Empty, SkeletonKpis, SkeletonTable } from "../components/ui";

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

  const conObservaciones = stats ? stats.visitas.filter((v) => v.resultado !== "CONFORME").length : 0;

  return (
    <>
      <div className="hero">
        <div className="eyebrow">{new Date().toLocaleDateString("es-PE", { weekday: "long", day: "numeric", month: "long" })}</div>
        <h1>Resumen de la operación</h1>
        <p>Seguimiento de la muestra, las visitas en campo y las observaciones que requieren tu revisión.</p>
      </div>
      {!stats ? (
        <>
          <SkeletonKpis />
          <Card>
            <p className="section-title">Últimas visitas</p>
            <SkeletonTable rows={6} cols={4} />
          </Card>
        </>
      ) : (
        <>
          <div className="grid grid-4">
            <Card className="kpi"><div className="kpi-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" /></svg></div><div className="value">{stats.expedientes}</div><div className="label">Expedientes totales</div></Card>
            <Card className="kpi"><div className="kpi-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="4" width="14" height="17" rx="2.2" /><path d="M9 4h6v3H9zM9 14l2 2 4-4" /></svg></div><div className="value">{stats.asignacionesActivas}</div><div className="label">Asignaciones activas</div></Card>
            <Card className="kpi"><div className="kpi-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M8 12.5l2.7 2.7L16 9.8" /></svg></div><div className="value">{stats.visitas.length}</div><div className="label">Visitas recientes</div></Card>
            <Card className="kpi"><div className="kpi-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l9.5 17h-19L12 3z" /><path d="M12 10v4.5M12 17.5v.01" /></svg></div><div className="value">{conObservaciones}</div><div className="label">Con observaciones</div></Card>
          </div>
          {!stats.visitas.length ? (
            <Empty title="Sin visitas todavía" text="Cuando los auditores registren visitas en campo, aparecerán aquí." />
          ) : (
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
                </tbody>
              </table>
              <p style={{ marginTop: 10 }}><Link to="/visitas">Ver todas las visitas →</Link></p>
            </Card>
          )}
        </>
      )}
    </>
  );
}
