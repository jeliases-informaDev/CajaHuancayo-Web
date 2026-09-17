import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { request } from "../api";
import { Badge, Card, Loading } from "../components/ui";

export default function VisitasPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    request("/api/visitas?limit=100")
      .then((r: any) => { setData(r.data); setTotal(r.pagination.total); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <div className="page-header">
        <h1>Visitas</h1>
        <p>{total} visita(s) registradas.</p>
      </div>
      {error ? <div className="error-box">{error}</div> : null}
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
                  <td>{v.mock_location ? <span className="alert-chip">FAKE GPS</span> : null}{!v.device_integrity_ok ? <span className="alert-chip">DISPOSITIVO</span> : null}</td>
                </tr>
              ))}
              {!data.length ? <tr><td colSpan={6} className="muted">Sin visitas registradas todavía.</td></tr> : null}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}
