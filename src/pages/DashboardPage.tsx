import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { request } from "../api";
import { Badge, Empty, Skeleton } from "../components/ui";
import { Bars, SegBar } from "../components/kit";

type Resumen = {
  expedientes: { total: number; por_estado: Record<string, number>; por_tipo: Record<string, number> };
  asignaciones_activas: number;
  visitas: { total: number; por_resultado: Record<string, number>; actividad: { dia: string; total: number }[] };
  auditores: { id: string; nombre: string; zona: string | null; asignadas_activas: number; visitas_30_dias: number }[];
  cola_revision: { id_visita: number; resultado: string; fecha: string; cliente: string; codigo: string; tipo_credito: string; auditor: string; motivos: string[] }[];
};

const AZUL = "#1f3fa8";
const AZUL_CLARO = "#a9b8ee";
const REGLA = "#dcdae5";

function Cargando() {
  return (
    <>
      <div className="cols cols-eq">
        {[0, 1].map((i) => (
          <div key={i}><Skeleton width={140} height={44} radius={4} /><div style={{ height: 14 }} /><Skeleton height={12} radius={2} style={{ display: "block" }} /></div>
        ))}
      </div>
      <div className="section"><Skeleton height={220} radius={4} style={{ display: "block" }} /></div>
    </>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const [r, setR] = useState<Resumen | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    request<{ data: Resumen }>("/api/reportes/resumen").then((x) => setR(x.data)).catch((e) => setError(e.message));
  }, []);

  const fecha = new Date().toLocaleDateString("es-PE", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  if (error) return <div className="error-box">{error}</div>;

  const e = r?.expedientes.por_estado;
  const visitados = (e?.VISITADO || 0) + (e?.CERRADO || 0);
  const v = r?.visitas.por_resultado;
  const conformes = v?.CONFORME || 0;
  const pctConformes = r?.visitas.total ? Math.round((conformes / r.visitas.total) * 100) : 0;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Resumen de la muestra</h1>
          <p>{fecha.charAt(0).toUpperCase() + fecha.slice(1)}</p>
        </div>
        <div className="actions">
          <Link to="/expedientes" className="btn ghost">Cargar expedientes</Link>
          <Link to="/asignaciones" className="btn">Armar muestra</Link>
        </div>
      </div>

      {!r ? <Cargando /> : (
        <>
          <div className="cols cols-eq">
            <div>
              <div className="figure">{visitados.toLocaleString("es-PE")}<small>de {r.expedientes.total.toLocaleString("es-PE")} expedientes visitados</small></div>
              <div style={{ height: 16 }} />
              <SegBar segments={[
                { label: "Visitados", value: visitados, color: AZUL },
                { label: "Asignados", value: e?.ASIGNADO || 0, color: AZUL_CLARO },
                { label: "Sin asignar", value: e?.PENDIENTE || 0, color: REGLA },
              ]} />
            </div>
            <div>
              <div className="figure">{conformes.toLocaleString("es-PE")}<small>de {r.visitas.total.toLocaleString("es-PE")} visitas conformes{r.visitas.total ? ` (${pctConformes} %)` : ""}</small></div>
              <div style={{ height: 16 }} />
              <SegBar segments={[
                { label: "Conformes", value: conformes, color: "#12805c" },
                { label: "Observadas", value: v?.OBSERVADO || 0, color: "#d9930d" },
                { label: "No ubicados", value: v?.NO_UBICADO || 0, color: "#6c7391" },
                { label: "Rechazadas", value: v?.RECHAZADO || 0, color: "#b3243b" },
              ]} />
            </div>
          </div>

          <div className="section cols cols-2">
            <div>
              <div className="section-head">
                <h2>Visitas por revisar</h2>
                <Link to="/visitas">Ver todas las visitas</Link>
              </div>
              {!r.cola_revision.length ? (
                <Empty title="Nada pendiente de revisión" text="Las visitas observadas, rechazadas o con alertas de seguridad aparecen aquí." />
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Cliente</th><th>Motivo</th><th>Auditor</th><th>Fecha</th></tr></thead>
                    <tbody>
                      {r.cola_revision.map((x) => (
                        <tr key={x.id_visita} className="clickable" onClick={() => navigate(`/visitas/${x.id_visita}`)}>
                          <td><b style={{ fontWeight: 500 }}>{x.cliente}</b><span className="sub">{x.codigo}</span></td>
                          <td><Badge label={x.resultado} />{x.motivos.length ? <span className="sub">{x.motivos.slice(0, 2).join("; ")}</span> : null}</td>
                          <td>{x.auditor}</td>
                          <td style={{ whiteSpace: "nowrap" }}>{new Date(x.fecha).toLocaleDateString("es-PE", { day: "numeric", month: "short" })}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div>
              <div className="section-head"><h2>Actividad de los últimos 14 días</h2><span className="meta">{r.visitas.actividad.reduce((s, d) => s + d.total, 0)} visitas</span></div>
              <div style={{ padding: "18px 0 6px" }}><Bars data={r.visitas.actividad} /></div>

              <div className="section-head" style={{ marginTop: 28 }}><h2>Carga por auditor</h2></div>
              {!r.auditores.length ? <p className="subtle" style={{ padding: "14px 0" }}>No hay auditores activos.</p> : (
                <table>
                  <thead><tr><th>Auditor</th><th className="num">Asignados</th><th className="num">Visitas, 30 días</th></tr></thead>
                  <tbody>
                    {r.auditores.slice(0, 8).map((a) => (
                      <tr key={a.id}>
                        <td>{a.nombre}{a.zona ? <span className="sub">{a.zona}</span> : null}</td>
                        <td className="num">{a.asignadas_activas}</td>
                        <td className="num">{a.visitas_30_dias}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
