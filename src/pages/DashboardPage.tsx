import { Link } from "react-router-dom";
import { useAuth } from "../AuthContext";
import { Avatar, Badge, Skeleton } from "../components/ui";
import { Bars, Ring, SegBar } from "../components/kit";
import { Icon } from "../components/icons";
import { useResumen } from "../lib/resumen";
import { fechaCorta, fechaLarga, saludo } from "../lib/format";

function Cargando() {
  return (
    <div className="bento" role="status" aria-live="polite">
      <div className="tile t-5"><Skeleton width={140} height={14} /><div style={{ height: 22 }} /><Skeleton width="100%" height={110} radius={14} style={{ display: "block" }} /></div>
      <div className="tile t-4"><Skeleton width={140} height={14} /><div style={{ height: 22 }} /><Skeleton width="100%" height={110} radius={14} style={{ display: "block" }} /></div>
      <div className="tile t-3"><Skeleton width={110} height={14} /><div style={{ height: 22 }} /><Skeleton width="100%" height={110} radius={14} style={{ display: "block" }} /></div>
      <div className="tile t-7"><Skeleton width="100%" height={230} radius={14} style={{ display: "block" }} /></div>
      <div className="tile t-5"><Skeleton width="100%" height={230} radius={14} style={{ display: "block" }} /></div>
      <span className="sr-only">Cargando el resumen…</span>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { resumen: r, error } = useResumen();
  const nombre = user?.nombres || user?.username || "";

  if (error && !r) return <div role="alert" className="error-box">{error}</div>;

  const e = r?.expedientes.por_estado;
  const visitados = (e?.VISITADO || 0) + (e?.CERRADO || 0);
  const v = r?.visitas.por_resultado;
  const conformes = v?.CONFORME || 0;
  const pctConformes = r?.visitas.total ? Math.round((conformes / r.visitas.total) * 100) : 0;
  const porRevisar = r?.cola_revision.length || 0;
  const actividad = r?.visitas.actividad.reduce((s, d) => s + d.total, 0) || 0;
  const maxCarga = Math.max(1, ...(r?.auditores.map((a) => a.asignadas_activas) || [1]));

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">{fechaLarga()}</p>
          <h1>{saludo()}, <em>{nombre}</em></h1>
          <p>
            {!r ? "Preparando el resumen de la muestra…" : porRevisar
              ? `${porRevisar} ${porRevisar === 1 ? "visita espera" : "visitas esperan"} tu revisión.`
              : "No hay visitas pendientes de revisión."}
          </p>
        </div>
        <div className="actions">
          <Link to="/expedientes" className="btn ghost"><Icon name="subir" size={17} />Cargar expedientes</Link>
          <Link to="/asignaciones" className="btn"><Icon name="asignaciones" size={17} />Armar muestra</Link>
        </div>
      </div>

      {!r ? <Cargando /> : (
        <div className="bento rise">
          <section className="tile dark t-5" aria-label="Avance de la muestra">
            <div className="tile-head"><h2 className="tile-title"><Icon name="objetivo" size={17} />Avance de la muestra</h2><span className="meta">{r.asignaciones_activas} casos activos</span></div>
            <div className="ringbox">
              <Ring value={visitados} total={r.expedientes.total} caption="visitado" />
              <div style={{ flex: 1, minWidth: 180 }}>
                <div className="figure">{visitados.toLocaleString("es-PE")}<small>de {r.expedientes.total.toLocaleString("es-PE")} expedientes</small></div>
                <div style={{ height: 18 }} />
                <SegBar segments={[
                  { label: "Visitados", value: visitados, color: "#8ea2ff" },
                  { label: "Asignados", value: e?.ASIGNADO || 0, color: "#c58bff" },
                  { label: "Sin asignar", value: e?.PENDIENTE || 0, color: "rgba(255,255,255,0.28)" },
                ]} />
              </div>
            </div>
          </section>

          <section className="tile t-4" aria-label="Resultado de las visitas">
            <div className="tile-head"><h2 className="tile-title"><Icon name="visitas" size={17} />Resultado de las visitas</h2></div>
            <div className="figure">{conformes.toLocaleString("es-PE")}<small>de {r.visitas.total.toLocaleString("es-PE")} conformes{r.visitas.total ? ` · ${pctConformes} %` : ""}</small></div>
            <div style={{ height: 18 }} />
            <SegBar segments={[
              { label: "Conformes", value: conformes, color: "var(--ok)" },
              { label: "Observadas", value: v?.OBSERVADO || 0, color: "var(--warn)" },
              { label: "No ubicados", value: v?.NO_UBICADO || 0, color: "var(--faint)" },
              { label: "Rechazadas", value: v?.RECHAZADO || 0, color: "var(--bad)" },
            ]} />
          </section>

          <section className="tile t-3" aria-label="Actividad reciente">
            <div className="tile-head"><h2 className="tile-title"><Icon name="pulso" size={17} />Últimos 14 días</h2></div>
            <div className="figure" style={{ fontSize: 44 }}>{actividad.toLocaleString("es-PE")}<small>visitas</small></div>
            <div style={{ height: 14 }} />
            {actividad ? <Bars data={r.visitas.actividad} /> : <p className="subtle">Sin visitas registradas en este período.</p>}
          </section>

          <section className="tile t-7" aria-label="Visitas por revisar">
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

          <section className="tile t-5" aria-label="Equipo en campo">
            <div className="tile-head"><h2 className="tile-title"><Icon name="usuarios" size={17} />Equipo en campo</h2><Link to="/asignaciones" className="tile-link">Asignar<Icon name="siguiente" size={15} /></Link></div>
            {!r.auditores.length ? <div className="empty-state" style={{ padding: "20px 0" }}><p className="t">Sin auditores</p><p>Crea auditores en Usuarios para empezar a asignar casos.</p></div> : (
              <div className="team">
                {r.auditores.slice(0, 7).map((a) => (
                  <div key={a.id} className="team-row">
                    <Avatar nombre={a.nombre} />
                    <div>
                      <b>{a.nombre}</b>
                      <span className="z">{a.zona || "Sin zona definida"}</span>
                      <div className="loadbar" role="img" aria-label={`${a.asignadas_activas} casos asignados`}><i style={{ width: `${(a.asignadas_activas / maxCarga) * 100}%` }} /></div>
                    </div>
                    <div className="n"><b>{a.asignadas_activas}</b><br />{a.visitas_30_dias} en 30 d</div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </>
  );
}
