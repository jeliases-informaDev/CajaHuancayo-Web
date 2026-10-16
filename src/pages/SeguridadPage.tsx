import { Fragment, useEffect, useState } from "react";
import { request } from "../api";
import { Empty, Skeleton } from "../components/ui";
import { fechaHora } from "../lib/format";

function Metrica({ valor, etiqueta, alerta }: { valor?: number; etiqueta: string; alerta?: boolean }) {
  return (
    <div className={`metric${alerta && valor ? " alert" : ""}`}>
      <div className="figure">{(valor ?? 0).toLocaleString("es-PE")}</div>
      <p>{etiqueta}</p>
    </div>
  );
}

export default function SeguridadPage() {
  const [metricas, setMetricas] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandido, setExpandido] = useState<string | null>(null);
  const [soloCambios, setSoloCambios] = useState(false);
  const [soloErrores, setSoloErrores] = useState(false);

  useEffect(() => {
    Promise.all([request("/api/seguridad/metricas"), request("/api/seguridad/auditoria?limit=100")])
      .then(([m, l]: any[]) => { setMetricas(m.data); setLogs(l.data); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (error) return <div role="alert" className="error-box">{error}</div>;

  const visibles = logs.filter((l) => (!soloCambios || l.entidad) && (!soloErrores || l.estado_http >= 400));

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Seguridad</h1>
          <p>Registro de accesos y operaciones. Los registros no se pueden editar ni borrar desde el sistema.</p>
        </div>
      </div>

      {loading ? <Skeleton height={120} radius={20} style={{ display: "block" }} /> : (
        <div className="metrics">
          <Metrica valor={metricas?.total_eventos} etiqueta="Eventos en las últimas 24 horas" />
          <Metrica valor={metricas?.errores} etiqueta="Peticiones con error" alerta />
          <Metrica valor={metricas?.fallos_autenticacion} etiqueta="Intentos de acceso fallidos" alerta />
          <Metrica valor={metricas?.cuentas_bloqueadas} etiqueta="Cuentas bloqueadas ahora" alerta />
        </div>
      )}

      <div className="section">
        <div className="section-head"><h2>Registro de auditoría</h2><span className="meta">{visibles.length} de {logs.length} más recientes</span></div>
        <div className="filters">
          <label className="check-inline"><input type="checkbox" checked={soloCambios} onChange={(e) => setSoloCambios(e.target.checked)} />Solo cambios de datos (con valor anterior y nuevo)</label>
          <label className="check-inline"><input type="checkbox" checked={soloErrores} onChange={(e) => setSoloErrores(e.target.checked)} />Solo errores</label>
        </div>
        {loading ? <Skeleton height={260} radius={16} style={{ display: "block" }} /> : !visibles.length ? (
          <Empty tipo="busqueda" title="Sin registros" text="Ningún registro coincide con estos filtros." />
        ) : (
          <div className="table-wrap long">
            <table>
              <thead><tr><th scope="col" style={{ width: 28 }}></th><th scope="col">Fecha</th><th scope="col">Quién</th><th scope="col">Operación</th><th scope="col" className="num">Resultado</th><th scope="col">IP</th></tr></thead>
              <tbody>
                {visibles.map((log) => {
                  const tieneDiff = Boolean(log.entidad);
                  const abierto = expandido === log.id_auditoria;
                  return (
                    <Fragment key={log.id_auditoria}>
                      <tr className={tieneDiff ? "clickable" : undefined} onClick={() => tieneDiff && setExpandido(abierto ? null : log.id_auditoria)}>
                        <td>{tieneDiff ? <button type="button" className="kebab" aria-expanded={abierto} aria-label={abierto ? "Ocultar el detalle del cambio" : "Ver el detalle del cambio"} onClick={(e) => { e.stopPropagation(); setExpandido(abierto ? null : log.id_auditoria); }}>{abierto ? "−" : "+"}</button> : null}</td>
                        <td style={{ whiteSpace: "nowrap" }}>{fechaHora(log.fecha)}</td>
                        <td>{log.actor || "Sin sesión"}<span className="sub">{log.rol || ""}</span></td>
                        <td><span className="code">{log.metodo}</span> {log.ruta}{tieneDiff ? <span className="sub">{log.entidad} #{log.entidad_id}</span> : null}</td>
                        <td className="num"><span className={`state ${log.estado_http >= 400 ? "bad" : "ok"}`}>{log.estado_http}</span></td>
                        <td className="code" translate="no">{log.ip_address || "-"}</td>
                      </tr>
                      {abierto ? (
                        <tr>
                          <td></td>
                          <td colSpan={5} style={{ background: "var(--wash)" }}>
                            <div className="cols cols-eq" style={{ gap: 24 }}>
                              <div><p className="lbl">Valor anterior</p><pre style={{ fontSize: 12, whiteSpace: "pre-wrap", margin: "6px 0 0" }}>{log.valor_anterior ? JSON.stringify(log.valor_anterior, null, 2) : "No existía"}</pre></div>
                              <div><p className="lbl">Valor nuevo</p><pre style={{ fontSize: 12, whiteSpace: "pre-wrap", margin: "6px 0 0" }}>{log.valor_nuevo ? JSON.stringify(log.valor_nuevo, null, 2) : "Eliminado"}</pre></div>
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
