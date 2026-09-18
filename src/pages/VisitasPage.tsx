import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { request } from "../api";
import { Badge, Card, Field, Loading } from "../components/ui";

const RESULTADOS = ["CONFORME", "OBSERVADO", "NO_UBICADO", "RECHAZADO"];

export default function VisitasPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [auditores, setAuditores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [auditorId, setAuditorId] = useState("");
  const [resultado, setResultado] = useState("");
  const [tipoCredito, setTipoCredito] = useState("");
  const [soloAlertas, setSoloAlertas] = useState(false);

  useEffect(() => {
    request("/api/usuarios/auditores").then((r: any) => setAuditores(r.data)).catch(() => {});
  }, []);

  const query = useMemo(() => {
    const params = new URLSearchParams({ limit: "200" });
    if (auditorId) params.set("id_usuario_auditor", auditorId);
    if (resultado) params.set("resultado", resultado);
    if (tipoCredito) params.set("tipo_credito", tipoCredito);
    if (soloAlertas) params.set("con_alertas", "true");
    return params.toString();
  }, [auditorId, resultado, tipoCredito, soloAlertas]);

  useEffect(() => {
    setLoading(true);
    request(`/api/visitas?${query}`)
      .then((r: any) => { setData(r.data); setTotal(r.pagination.total); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [query]);

  return (
    <>
      <div className="page-header">
        <h1>Visitas</h1>
        <p>{total} visita(s) — evidencias y fichas registradas en campo.</p>
      </div>
      {error ? <div className="error-box">{error}</div> : null}
      <Card>
        <div className="grid grid-4">
          <Field label="Auditor">
            <select value={auditorId} onChange={(e) => setAuditorId(e.target.value)}>
              <option value="">Todos</option>
              {auditores.map((a) => <option key={a.id} value={a.id}>{a.nombres || a.username} ({a.rol})</option>)}
            </select>
          </Field>
          <Field label="Resultado">
            <select value={resultado} onChange={(e) => setResultado(e.target.value)}>
              <option value="">Todos</option>
              {RESULTADOS.map((r) => <option key={r} value={r}>{r.replaceAll("_", " ")}</option>)}
            </select>
          </Field>
          <Field label="Tipo de ficha">
            <select value={tipoCredito} onChange={(e) => setTipoCredito(e.target.value)}>
              <option value="">Todas</option>
              <option value="CONSUMO">Consumo</option>
              <option value="OTROS">Otros (MYPE)</option>
            </select>
          </Field>
          <Field label="Solo con alertas de seguridad">
            <label className="row" style={{ gap: 8, cursor: "pointer" }}>
              <input type="checkbox" checked={soloAlertas} onChange={(e) => setSoloAlertas(e.target.checked)} />
              <span>GPS falso, dispositivo u observadas</span>
            </label>
          </Field>
        </div>
      </Card>
      <Card>
        {loading ? <Loading /> : (
          <table>
            <thead><tr><th>Fecha</th><th>Expediente</th><th>Auditor</th><th>Resultado</th><th>Distancia</th><th>Señales</th></tr></thead>
            <tbody>
              {data.map((v) => (
                <tr key={v.id_visita} className="clickable" onClick={() => navigate(`/visitas/${v.id_visita}`)}>
                  <td>{new Date(v.fecha_hora_checkin).toLocaleString("es-PE")}</td>
                  <td>{v.expediente?.codigo_expediente} · {v.expediente?.nombres_cliente}</td>
                  <td>{v.auditor?.nombres || v.auditor?.username}</td>
                  <td><Badge label={v.resultado} /></td>
                  <td>{v.distancia_domicilio_m != null ? `${Math.round(v.distancia_domicilio_m)} m` : "-"}</td>
                  <td>{v.mock_location ? <span className="alert-chip">FAKE GPS</span> : null}{!v.device_integrity_ok ? <span className="alert-chip">DISPOSITIVO</span> : null}{!v.evidencias?.length ? <span className="alert-chip">SIN FOTOS</span> : null}</td>
                </tr>
              ))}
              {!data.length ? <tr><td colSpan={6} className="muted">Sin visitas para estos filtros.</td></tr> : null}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}
