import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQueryParam } from "../lib/useQueryParam";
import { request } from "../api";
import { Avatar, Badge, Empty, Skeleton } from "../components/ui";
import { Pips, Seg } from "../components/kit";
import { Icon } from "../components/icons";
import { useResumen } from "../lib/resumen";
import { senalesDeLista } from "../lib/senales";
import { fechaCorta, horaCorta } from "../lib/format";

const RESULTADOS: { value: string; label: string; clave?: string }[] = [
  { value: "", label: "Todas" }, { value: "CONFORME", label: "Conformes", clave: "CONFORME" }, { value: "OBSERVADO", label: "Observadas", clave: "OBSERVADO" },
  { value: "NO_UBICADO", label: "No ubicados", clave: "NO_UBICADO" }, { value: "RECHAZADO", label: "Rechazadas", clave: "RECHAZADO" },
];

export default function VisitasPage() {
  const navigate = useNavigate();
  const { resumen } = useResumen();
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

  // La mesa de revisión recorre esta misma lista con "anterior / siguiente": se guarda el orden que se está viendo.
  useEffect(() => {
    try { sessionStorage.setItem("ch_cola_visitas", JSON.stringify(data.map((v) => v.id_visita))); } catch { /* sin almacenamiento */ }
  }, [data]);

  const opciones = RESULTADOS.map((o) => ({ value: o.value, label: o.label, n: o.clave ? resumen?.visitas.por_resultado[o.clave] ?? 0 : resumen?.visitas.total }));
  const hayFiltros = Boolean(resultado || tipoCredito || auditorId || soloAlertas);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Visitas</h1>
          <p>{total.toLocaleString("es-PE")} {total === 1 ? "visita registrada" : "visitas registradas"} en campo, con su ficha, evidencia y señales de verificación.</p>
        </div>
      </div>
      {error ? <div role="alert" className="error-box">{error}</div> : null}

      <div className="filters">
        <div className="fgroup"><span className="lbl" id="l-res">Resultado</span><Seg label="Resultado" value={resultado} onChange={setResultado} options={opciones} /></div>
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
        <div className="table-wrap" style={{ padding: 18 }}>{[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} height={26} radius={8} style={{ display: "block", margin: "14px 0" }} />)}</div>
      ) : !data.length ? (
        <Empty tipo={hayFiltros ? "busqueda" : "visitas"} title="Sin visitas" text={hayFiltros ? "No hay visitas con estos filtros. Prueba con otros." : "Cuando los auditores registren visitas desde la app, aparecerán aquí."} />
      ) : (
        <div className="table-wrap long" style={{ opacity: loading ? 0.55 : 1, transition: "opacity .15s" }}>
          <table>
            <thead><tr><th scope="col">Cliente</th><th scope="col">Ficha</th><th scope="col">Auditor</th><th scope="col">Resultado</th><th scope="col">Señales</th><th scope="col" className="num">Distancia</th><th scope="col" className="num">Fecha</th></tr></thead>
            <tbody>
              {data.map((v) => {
                const cliente = v.expediente?.nombres_cliente;
                const auditor = v.auditor?.nombres || v.auditor?.username;
                return (
                  <tr key={v.id_visita} className="clickable" onClick={() => navigate(`/visitas/${v.id_visita}`)}>
                    <td>
                      <div className="who-cell">
                        <Avatar nombre={cliente} />
                        <div><Link to={`/visitas/${v.id_visita}`} onClick={(e) => e.stopPropagation()}>{cliente}</Link><span className="sub code" translate="no">{v.expediente?.codigo_expediente}</span></div>
                      </div>
                    </td>
                    <td><span className={`tag ${v.expediente?.tipo_credito === "OTROS" ? "aviso" : "base"}`}>{v.expediente?.tipo_credito === "OTROS" ? "MYPE" : "Consumo"}</span></td>
                    <td><div className="who-cell"><Avatar nombre={auditor} size="sm" /><span>{auditor}</span></div></td>
                    <td><Badge label={v.resultado} /></td>
                    <td><Pips senales={senalesDeLista(v)} /></td>
                    <td className="num">{v.distancia_domicilio_m != null ? (Number(v.distancia_domicilio_m) >= 1000 ? `${(Number(v.distancia_domicilio_m) / 1000).toFixed(1)} km` : `${Math.round(v.distancia_domicilio_m)} m`) : "-"}</td>
                    <td className="num">{fechaCorta(v.fecha_hora_checkin)}<span className="sub">{horaCorta(v.fecha_hora_checkin)}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {data.length ? <p className="subtle" style={{ marginTop: 12, display: "flex", gap: 8, alignItems: "center" }}><Icon name="huella" size={15} />Cada barrita de «Señales» es un control: GPS real, dispositivo íntegro, fotografías y distancia al domicilio. Pasa el cursor para ver el detalle.</p> : null}
    </>
  );
}
