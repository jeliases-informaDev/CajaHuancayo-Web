import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQueryParam } from "../lib/useQueryParam";
import { request } from "../api";
import { Badge, Empty, Skeleton } from "../components/ui";
import { Seg } from "../components/kit";
import { fechaHora } from "../lib/format";

const RESULTADOS = [
  { value: "", label: "Todos" }, { value: "CONFORME", label: "Conformes" }, { value: "OBSERVADO", label: "Observadas" },
  { value: "NO_UBICADO", label: "No ubicados" }, { value: "RECHAZADO", label: "Rechazadas" },
] as const;

export default function VisitasPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [auditores, setAuditores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // Los filtros viven en la URL: se pueden compartir, recargar y volver atrás sin perderlos.
  const [auditorId, setAuditorId] = useQueryParam("auditor");
  const [resultado, setResultado] = useQueryParam("resultado");
  const [tipoRaw, setTipoCredito] = useQueryParam("tipo");
  const tipoCredito = tipoRaw as "" | "OTROS" | "CONSUMO";
  const [alertasRaw, setAlertasRaw] = useQueryParam("alertas");
  const soloAlertas = alertasRaw === "1";

  useEffect(() => { request("/api/usuarios/auditores").then((r: any) => setAuditores(r.data)).catch(() => {}); }, []);

  const consulta = useMemo(() => {
    const p = new URLSearchParams({ limit: "200" });
    if (auditorId) p.set("id_usuario_auditor", auditorId);
    if (resultado) p.set("resultado", resultado);
    if (tipoCredito) p.set("tipo_credito", tipoCredito);
    if (soloAlertas) p.set("con_alertas", "true");
    return p.toString();
  }, [auditorId, resultado, tipoCredito, soloAlertas]);

  useEffect(() => {
    setLoading(true);
    request<any>(`/api/visitas?${consulta}`)
      .then((r) => { setData(r.data); setTotal(r.pagination.total); setError(""); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [consulta]);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Visitas</h1>
          <p>{total.toLocaleString("es-PE")} {total === 1 ? "visita registrada" : "visitas registradas"} en campo, con su ficha y evidencia.</p>
        </div>
      </div>
      {error ? <div role="alert" className="error-box">{error}</div> : null}

      <div className="filters">
        <div className="fgroup"><span className="lbl">Resultado</span><Seg label="Resultado" value={resultado} onChange={setResultado} options={RESULTADOS.map((r) => ({ value: r.value, label: r.label }))} /></div>
        <div className="fgroup"><span className="lbl">Tipo de ficha</span><Seg label="Tipo de ficha" value={tipoCredito} onChange={setTipoCredito} options={[{ value: "", label: "Todas" }, { value: "OTROS", label: "MYPE" }, { value: "CONSUMO", label: "Consumo" }]} /></div>
        <div className="fgroup">
          <label className="lbl" htmlFor="aud">Auditor</label>
          <select id="aud" name="auditor" className="select" value={auditorId} onChange={(e) => setAuditorId(e.target.value)}>
            <option value="">Todos</option>
            {auditores.map((a) => <option key={a.id} value={a.id}>{a.nombres || a.username}</option>)}
          </select>
        </div>
        <label className="check-inline"><input type="checkbox" checked={soloAlertas} onChange={(e) => setAlertasRaw(e.target.checked ? "1" : "")} />Solo con alertas de seguridad</label>
      </div>

      {loading && !data.length ? (
        <div style={{ paddingTop: 18 }}>{[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} height={22} radius={3} style={{ display: "block", margin: "16px 0" }} />)}</div>
      ) : !data.length ? (
        <Empty title="Sin visitas" text="No hay visitas para estos filtros. Prueba con otros." />
      ) : (
        <div className="table-wrap long" style={{ opacity: loading ? 0.55 : 1 }}>
          <table>
            <thead><tr><th scope="col">Fecha</th><th scope="col">Cliente</th><th scope="col">Ficha</th><th scope="col">Auditor</th><th scope="col">Resultado</th><th scope="col" className="num">Distancia</th><th scope="col">Alertas</th></tr></thead>
            <tbody>
              {data.map((v) => {
                const alertas = [v.mock_location ? "GPS simulado" : "", !v.device_integrity_ok ? "Dispositivo" : "", !v.evidencias?.length ? "Sin fotos" : ""].filter(Boolean);
                return (
                  <tr key={v.id_visita} className="clickable" onClick={() => navigate(`/visitas/${v.id_visita}`)}>
                    <td style={{ whiteSpace: "nowrap" }}>{fechaHora(v.fecha_hora_checkin)}</td>
                    <td><Link to={`/visitas/${v.id_visita}`} onClick={(e) => e.stopPropagation()}>{v.expediente?.nombres_cliente}</Link><span className="sub" translate="no">{v.expediente?.codigo_expediente}</span></td>
                    <td>{v.expediente?.tipo_credito === "OTROS" ? "MYPE" : "Consumo"}</td>
                    <td>{v.auditor?.nombres || v.auditor?.username}</td>
                    <td><Badge label={v.resultado} /></td>
                    <td className="num">{v.distancia_domicilio_m != null ? `${Math.round(v.distancia_domicilio_m)} m` : "-"}</td>
                    <td>{alertas.length ? alertas.map((a) => <span key={a} className="alert-chip">{a}</span>) : <span className="muted">Ninguna</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
