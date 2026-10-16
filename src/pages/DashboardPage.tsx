import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { request } from "../api";
import { Badge, Card, Empty, SkeletonKpis, SkeletonTable } from "../components/ui";

const ICONOS = {
  expedientes: <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />,
  asignaciones: <><rect x="5" y="4" width="14" height="17" rx="2.2" /><path d="M9 4h6v3H9zM9 14l2 2 4-4" /></>,
  visitas: <><circle cx="12" cy="12" r="9" /><path d="M8 12.5l2.7 2.7L16 9.8" /></>,
  revision: <><path d="M12 3l9.5 17h-19L12 3z" /><path d="M12 10v4.5M12 17.5v.01" /></>,
};

function Kpi({ icono, label, value, hint }: { icono: keyof typeof ICONOS; label: string; value: number | string; hint?: string }) {
  return (
    <Card className="kpi">
      <div className="kpi-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{ICONOS[icono]}</svg></div>
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {hint ? <div className="hint">{hint}</div> : null}
    </Card>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<{ expedientes: number; asignacionesActivas: number; visitas: any[] } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const [expedientes, asignaciones, visitas]: any[] = await Promise.all([
          request("/api/expedientes?limit=1"),
          request("/api/asignaciones?estado=ACTIVA&limit=1"),
          request("/api/visitas?limit=10"),
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

  const fecha = new Date().toLocaleDateString("es-PE", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const conObservaciones = stats ? stats.visitas.filter((v) => v.resultado !== "CONFORME") : [];
  const conformes = stats ? stats.visitas.length - conObservaciones.length : 0;

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Resumen de la operación</h1>
          <p>{fecha.charAt(0).toUpperCase() + fecha.slice(1)}</p>
        </div>
        <div className="row">
          <Link to="/expedientes" className="btn ghost">Cargar expedientes</Link>
          <Link to="/asignaciones" className="btn">Armar muestra</Link>
        </div>
      </div>

      {!stats ? (
        <>
          <SkeletonKpis />
          <Card><p className="section-title">Últimas visitas</p><SkeletonTable rows={6} cols={4} /></Card>
        </>
      ) : (
        <>
          <div className="grid grid-4" style={{ marginBottom: 16 }}>
            <Kpi icono="expedientes" label="Expedientes cargados" value={stats.expedientes.toLocaleString("es-PE")} />
            <Kpi icono="asignaciones" label="Asignaciones activas" value={stats.asignacionesActivas.toLocaleString("es-PE")} hint="Casos en campo" />
            <Kpi icono="visitas" label="Visitas recientes" value={stats.visitas.length} hint={`${conformes} conformes`} />
            <Kpi icono="revision" label="Para revisar" value={conObservaciones.length} hint="Observadas, no ubicadas o rechazadas" />
          </div>

          {!stats.visitas.length ? (
            <Empty title="Sin visitas todavía" text="Cuando los auditores registren visitas en campo, aparecerán aquí." />
          ) : (
            <div className="grid grid-main">
              <Card>
                <div className="card-head">
                  <p className="section-title">Últimas visitas</p>
                  <Link to="/visitas" className="subtle">Ver todas →</Link>
                </div>
                <table>
                  <thead><tr><th>Fecha</th><th>Expediente</th><th>Auditor</th><th>Resultado</th></tr></thead>
                  <tbody>
                    {stats.visitas.map((v) => (
                      <tr key={v.id_visita} className="clickable" onClick={() => navigate(`/visitas/${v.id_visita}`)}>
                        <td style={{ whiteSpace: "nowrap" }}>{new Date(v.fecha_hora_checkin).toLocaleString("es-PE", { dateStyle: "short", timeStyle: "short" })}</td>
                        <td><b style={{ fontWeight: 600 }}>{v.expediente?.nombres_cliente}</b><div className="subtle">{v.expediente?.codigo_expediente}</div></td>
                        <td>{v.auditor?.nombres || v.auditor?.username}</td>
                        <td><Badge label={v.resultado} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>

              <Card>
                <div className="card-head"><p className="section-title">Requieren revisión</p></div>
                {conObservaciones.length ? (
                  <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                    {conObservaciones.slice(0, 6).map((v) => (
                      <li key={v.id_visita} style={{ padding: "10px 0", borderBottom: "1px solid var(--border-soft)" }}>
                        <div className="row" style={{ justifyContent: "space-between", flexWrap: "nowrap" }}>
                          <Link to={`/visitas/${v.id_visita}`}>{v.expediente?.nombres_cliente}</Link>
                          <Badge label={v.resultado} />
                        </div>
                        <div className="subtle">{v.expediente?.codigo_expediente} · {v.auditor?.nombres || v.auditor?.username}</div>
                      </li>
                    ))}
                  </ul>
                ) : <p className="subtle">Sin visitas observadas entre las más recientes.</p>}
              </Card>
            </div>
          )}
        </>
      )}
    </>
  );
}
