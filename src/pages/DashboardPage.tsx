import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../AuthContext";
import { Avatar, Badge, Skeleton } from "../components/ui";
import { Icon } from "../components/icons";
import { Anillo, GraficoArea, rotuloPeriodo, totalPeriodo } from "../components/graficos";
import { useActividadAsignaciones, useResumen, type Periodo } from "../lib/resumen";
import { fechaCorta } from "../lib/format";

const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const hoyLocal = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const fechaCorta2 = (iso: string) => { const [y, m, d] = iso.split("-").map(Number); return `${d} ${MESES[m - 1]} ${y}`; };

function Cargando() {
  return (
    <div role="status" aria-live="polite">
      <div className="rs-fila1">
        <div className="rs-kpis">{[0, 1, 2, 3].map((i) => <div key={i} className="rs-kpi" style={{ ["--cap" as any]: "var(--line-2)" }}><Skeleton width={56} height={36} radius={8} /></div>)}</div>
        <div className="rs-tarjeta rs-grafico"><Skeleton width="100%" height={300} radius={14} style={{ display: "block", margin: "0 0 0 62px", maxWidth: "calc(100% - 62px)" }} /></div>
      </div>
      <div className="rs-fila2"><div className="rs-tarjeta rs-avance"><Skeleton width="100%" height={200} radius={14} style={{ display: "block" }} /></div><div className="rs-tarjeta rs-distritos"><Skeleton width="100%" height={200} radius={14} style={{ display: "block" }} /></div></div>
      <span className="sr-only">Cargando el resumen…</span>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { resumen: r, error } = useResumen();
  const [periodo, setPeriodo] = useState<Periodo>("diario");
  const [hasta, setHasta] = useState(hoyLocal);
  const { datos: actividad } = useActividadAsignaciones(periodo, hasta);
  const nombre = user?.nombres || user?.username || "";

  if (error && !r) return <div role="alert" className="error-box">{error}</div>;

  const e = r?.expedientes.por_estado;
  const visitados = (e?.VISITADO || 0) + (e?.CERRADO || 0);
  const porRevisar = r?.cola_revision.length || 0;
  const recientes = r ? r.visitas.recientes ?? r.visitas.actividad.slice(-7).reduce((s, d) => s + d.total, 0) : 0;
  const observados = r?.visitas.por_resultado.OBSERVADO || 0;
  const maxCarga = Math.max(1, ...(r?.auditores.map((a) => a.asignadas_activas) || [1]));
  const num = (n: number) => n.toLocaleString("es-PE");
  const segmentos = [
    { label: "Visitados", value: visitados, color: "#4d61ab" },
    { label: "Asignados", value: e?.ASIGNADO || 0, color: "#6e4dab" },
    { label: "Sin asignar", value: e?.PENDIENTE || 0, color: "#cbccde" },
  ];

  return (
    <>
      <div className="rs-cabecera">
        <h1 className="rs-saludo">Bienvenido, {nombre}</h1>
        <div className="rs-controles">
          <div className="rs-periodo">
            <select aria-label="Período del gráfico de asignaciones" value={periodo} onChange={(ev) => setPeriodo(ev.target.value as Periodo)}>
              <option value="diario">Diario</option><option value="semanal">Semanal</option><option value="mensual">Mensual</option>
            </select>
            <label><Icon name="calendario" size={18} /><span>{fechaCorta2(hasta)}</span>
              <input type="date" aria-label="Último día del gráfico" value={hasta} max={hoyLocal()} onChange={(ev) => ev.target.value && setHasta(ev.target.value)} />
            </label>
          </div>
          <Link to="/expedientes?nuevo=1" className="rs-nuevo"><Icon name="mas" size={17} />Nuevo Expediente</Link>
        </div>
      </div>

      {!r ? <Cargando /> : (
        <>
          <div className="rs-fila1">
            <div className="rs-kpis">
              <Link to="/expedientes" className="rs-kpi" style={{ ["--cap" as any]: "#4d61ab" }}><b>{num(r.expedientes.total)}</b><span>Expedientes totales</span></Link>
              <Link to="/asignaciones" className="rs-kpi activo" style={{ ["--cap" as any]: "#4dab56" }}><b>{num(r.asignaciones_activas)}</b><span>Asignaciones</span></Link>
              <Link to="/visitas" className="rs-kpi" style={{ ["--cap" as any]: "#d4d945" }}><b>{num(recientes)}</b><span>Visitas recientes</span></Link>
              <Link to="/visitas?resultado=OBSERVADO" className="rs-kpi" style={{ ["--cap" as any]: "#ab4d4d" }}><b>{num(observados)}</b><span>Observados</span></Link>
            </div>
            <section className="rs-tarjeta rs-grafico" aria-label="Asignaciones">
              <div className="rs-grafico-cab">
                <div><h2>Asignaciones</h2><p>{actividad ? rotuloPeriodo(actividad) : "Cargando…"}</p></div>
                <div className="rs-total"><b>{actividad ? num(actividad.total) : "–"}</b><span>{totalPeriodo[periodo]}</span></div>
              </div>
              {actividad ? <GraficoArea datos={actividad} /> : <div className="rs-vacio" role="status">Cargando el gráfico…</div>}
            </section>
          </div>

          <div className="rs-fila2">
            <section className="rs-tarjeta rs-avance" aria-label="Avance de la muestra">
              <div className="rs-cab"><h2 className="rs-titulo-tarjeta">Avance de la muestra</h2><span className="rs-apoyo">Hoy, {num(r.asignaciones_activas)} casos activos</span></div>
              <div className="rs-avance-cuerpo">
                <Anillo valor={visitados} total={r.expedientes.total} titulo="visitado" />
                <div className="rs-avance-datos">
                  <div className="rs-cifra"><b>{num(visitados)}</b><span>de {num(r.expedientes.total)} expedientes</span></div>
                  <div className="rs-barra" role="img" aria-label={segmentos.map((s) => `${s.label}: ${s.value}`).join(", ")}>
                    {segmentos.filter((s) => s.value > 0).map((s) => <i key={s.label} style={{ flexGrow: s.value, flexBasis: 0, background: s.color }} />)}
                  </div>
                  <div className="rs-leyenda">{segmentos.map((s) => <span key={s.label} style={{ ["--c" as any]: s.color }}>{s.label} <b>{num(s.value)}</b></span>)}</div>
                </div>
              </div>
            </section>

            <section className="rs-tarjeta rs-distritos" aria-label="Distritos más visitados">
              <div className="rs-cab"><h2 className="rs-titulo-tarjeta">Distritos más visitados</h2></div>
              {!r.distritos_visitados?.length ? <p className="rs-vacio">Aún no hay visitas con distrito en los últimos 30 días.</p> : (
                <table className="rs-tabla">
                  <thead><tr><th scope="col">Distritos</th><th scope="col">Visitas</th></tr></thead>
                  <tbody>{r.distritos_visitados.map((d) => <tr key={d.distrito}><td>{d.distrito}</td><td>{num(d.visitas)}</td></tr>)}</tbody>
                </table>
              )}
            </section>
          </div>

          <div className="rs-fila3">
            <section className="tile rs-tarjeta t-7" aria-label="Visitas por revisar">
              <div className="tile-head">
                <h2 className="tile-title"><Icon name="alerta" size={17} />Por revisar{porRevisar ? <span className="tag aviso">{porRevisar}</span> : null}</h2>
                <Link to="/visitas" className="tile-link">Ver todas<Icon name="siguiente" size={15} /></Link>
              </div>
              {!porRevisar ? (
                <div className="empty-state" style={{ padding: "26px 10px 30px" }}>
                  <p className="t">Todo al día</p>
                  <p>Las visitas observadas, rechazadas o con alertas de seguridad aparecen aquí para que las revises.</p>
                </div>
              ) : (
                <div className="queue">
                  {r.cola_revision.map((x) => (
                    <Link key={x.id_visita} to={`/visitas/${x.id_visita}`} className="qitem">
                      <Avatar nombre={x.cliente} />
                      <span className="qmain"><b>{x.cliente}</b><span>{x.motivos.length ? x.motivos.slice(0, 2).join("; ") : <span translate="no">{x.codigo}</span>}</span></span>
                      <span className="qmeta"><Badge label={x.resultado} /><span>{x.auditor} · {fechaCorta(x.fecha)}</span></span>
                      <Icon name="derecha" size={16} />
                    </Link>
                  ))}
                </div>
              )}
            </section>

            <section className="tile rs-tarjeta t-5" aria-label="Equipo en campo">
              <div className="tile-head"><h2 className="tile-title"><Icon name="usuarios" size={17} />Equipo en campo</h2><Link to="/asignaciones" className="tile-link">Asignar<Icon name="siguiente" size={15} /></Link></div>
              {!r.auditores.length ? <div className="empty-state" style={{ padding: "20px 0" }}><p className="t">Sin auditores</p><p>Crea auditores en Usuarios para empezar a asignar casos.</p></div> : (
                <div className="team">
                  {r.auditores.slice(0, 7).map((a) => (
                    <div key={a.id} className="team-row">
                      <Avatar nombre={a.nombre} />
                      <div>
                        <b>{a.nombre}</b>
                        <span className="z">{a.zona || "Sin zona habitual"}</span>
                        <div className="loadbar" role="img" aria-label={`${a.asignadas_activas} casos asignados`}><i style={{ width: `${(a.asignadas_activas / maxCarga) * 100}%` }} /></div>
                      </div>
                      <div className="n"><b>{a.asignadas_activas}</b><br />{a.visitas_30_dias} en 30 d</div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </>
      )}
    </>
  );
}
