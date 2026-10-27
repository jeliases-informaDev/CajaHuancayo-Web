import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../AuthContext";
import { Avatar, Badge, Skeleton } from "../components/ui";
import { Icon } from "../components/icons";
import { Anillo, GraficoArea, rotuloPeriodo, ventanaPeriodo } from "../components/graficos";
import { RankingAuditores } from "../components/ranking";
import { useResumen, useTablero, type Actividad, type Metrica, type Periodo, type Tablero } from "../lib/resumen";
import { useEnVivo } from "../lib/tiempoReal";
import { variacion } from "../lib/variacion";
import { fechaCorta } from "../lib/format";

const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const hoyLocal = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const fechaCorta2 = (iso: string) => { const [y, m, d] = iso.split("-").map(Number); return `${d} ${MESES[m - 1]} ${y}`; };

// Cada tarjeta de arriba elige qué dibuja el gráfico grande (no lleva a otra pantalla). El color de la tarjeta (diseño de Figma) pinta la franja,
// el área y el borde de la tarjeta elegida; la línea del amarillo va más oscura para que se distinga sobre el blanco.
// Las tarjetas y el gráfico cuentan lo MISMO: lo que pasó EN EL TRAMO elegido (7 días, 8 semanas o 6 meses). El número grande de la tarjeta es el total que
// dibuja el gráfico; debajo, cuánto subió o bajó frente al tramo anterior de los mismos días y, en letra chica, lo que hay hoy en total.
// `sube`: si que la cifra suba es buena noticia (bien) o mala (mal, como las visitas observadas).
const SERIES: { id: Metrica; rotulo: string; titulo: string; hechos: [string, string]; singular: string; plural: string; color: string; linea?: string; sube: "bien" | "mal"; hoy: (h: Tablero["hoy"], num: (n: number) => string) => string }[] = [
  { id: "expedientes", rotulo: "Expedientes cargados", titulo: "Expedientes", hechos: ["cargado", "cargados"], singular: "expediente", plural: "expedientes", color: "#4d61ab", sube: "bien", hoy: (h, num) => `${num(h.expedientes)} en total hoy` },
  { id: "asignaciones", rotulo: "Asignaciones hechas", titulo: "Asignaciones", hechos: ["asignación", "asignaciones"], singular: "asignación", plural: "asignaciones", color: "#4dab56", sube: "bien", hoy: (h, num) => `${num(h.asignaciones_activas)} ${h.asignaciones_activas === 1 ? "activa" : "activas"} hoy` },
  { id: "visitas", rotulo: "Visitas hechas", titulo: "Visitas", hechos: ["visita", "visitas"], singular: "visita", plural: "visitas", color: "#d4d945", linea: "#8e9217", sube: "bien", hoy: (h, num) => `${num(h.visitas)} en total hoy` },
  { id: "observados", rotulo: "Visitas observadas", titulo: "Observadas", hechos: ["observada", "observadas"], singular: "observada", plural: "observadas", color: "#ab4d4d", sube: "mal", hoy: (h, num) => `${num(h.observados)} en total hoy` },
];

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

// Hoy en el reloj del usuario. Se vuelve a leer cada 30 s: pasada la medianoche, el tramo que termina «hoy» avanza solo.
function useHoy() {
  const [hoy, setHoy] = useState(hoyLocal);
  useEffect(() => {
    const t = window.setInterval(() => setHoy(hoyLocal()), 30000);
    return () => window.clearInterval(t);
  }, []);
  return hoy;
}

// Hace que la pantalla se repinte cada `ms` para que «hace 5 s» avance.
function useAhora(ms: number) {
  const [ahora, setAhora] = useState(Date.now);
  useEffect(() => {
    const t = window.setInterval(() => setAhora(Date.now()), ms);
    return () => window.clearInterval(t);
  }, [ms]);
  return ahora;
}

const textoHace = (seg: number) => (seg < 5 ? "ahora" : seg < 60 ? `hace ${seg} s` : `hace ${Math.floor(seg / 60)} min`);

export default function DashboardPage() {
  const { user } = useAuth();
  const { resumen: r, error } = useResumen();
  const [periodo, setPeriodo] = useState<Periodo>("diario");
  const [fijada, setFijada] = useState<string | null>(null); // null = el tramo termina hoy y avanza solo con los días
  const hoy = useHoy();
  const hasta = fijada ?? hoy;
  const [serieId, setSerieId] = useState<Metrica>("visitas");
  const { tablero, vigente, actualizado, error: errorTablero } = useTablero(periodo, hasta);
  const enVivo = useEnVivo();
  const ahora = useAhora(5000);
  const serie = SERIES.find((s) => s.id === serieId) || SERIES[2];
  const nombre = user?.nombres || user?.username || "";

  if (((error && !r) || (errorTablero && !tablero))) return <div role="alert" className="error-box">{error || errorTablero}</div>;

  const e = r?.expedientes.por_estado;
  const visitados = (e?.VISITADO || 0) + (e?.CERRADO || 0);
  const porRevisar = r?.cola_revision.length || 0;
  const maxCarga = Math.max(1, ...(r?.auditores.map((a) => a.asignadas_activas) || [1]));
  const num = (n: number) => n.toLocaleString("es-PE");
  // El gráfico dibuja la serie elegida de la MISMA respuesta que las tarjetas: su total es el número grande de la tarjeta.
  const actividad: Actividad | null = tablero
    ? { metrica: serieId, periodo: tablero.periodo, desde: tablero.desde, hasta: tablero.hasta, total: tablero.series[serieId].total, puntos: tablero.series[serieId].puntos }
    : null;
  // Bajo el total del gráfico: la cifra de hoy con la que se compara (la misma que la letra chica de la tarjeta).
  const referencias: Record<Metrica, string> = {
    expedientes: `${num(tablero?.hoy.expedientes || 0)} en total hoy`,
    asignaciones: `${num(tablero?.hoy.asignaciones_activas || 0)} ${tablero?.hoy.asignaciones_activas === 1 ? "activa" : "activas"} hoy`,
    visitas: `${num(tablero?.hoy.visitas || 0)} en total hoy`,
    observados: `${num(tablero?.hoy.observados || 0)} en total hoy`,
  };
  const distritos = r?.distritos_actividad || [];
  const hayVisitasEnDistritos = distritos.some((d) => d.visitas > 0);
  const segmentos = [
    { label: "Visitados", value: visitados, color: "#4d61ab" },
    { label: "Asignados", value: e?.ASIGNADO || 0, color: "#6e4dab" },
    { label: "Sin asignar", value: e?.PENDIENTE || 0, color: "#cbccde" },
  ];
  const hace = actualizado ? Math.max(0, Math.round((ahora - actualizado) / 1000)) : null;

  return (
    <>
      <div className="rs-cabecera">
        <h1 className="rs-saludo">Bienvenido, {nombre}</h1>
        <div className="rs-controles">
          <span className="rs-vivo" data-estado={enVivo ? "vivo" : "sondeo"} role="status"
            title={enVivo ? "Conectado: los cambios aparecen al instante." : "Sin conexión en vivo: la pantalla se actualiza sola cada 20 segundos."}>
            <i aria-hidden="true" />{enVivo ? "En vivo" : "Cada 20 s"}{hace != null ? ` · ${textoHace(hace)}` : ""}
          </span>
          <div className="rs-periodo">
            <select aria-label="Tramo de las tarjetas, el gráfico y los auditores" value={periodo} onChange={(ev) => setPeriodo(ev.target.value as Periodo)}>
              <option value="diario">Diario · 7 días</option><option value="semanal">Semanal · 8 semanas</option><option value="mensual">Mensual · 6 meses</option>
            </select>
            <label><Icon name="calendario" size={18} /><span>{fechaCorta2(hasta)}</span>
              <input type="date" aria-label="Último día del tramo" value={hasta} max={hoy} onChange={(ev) => ev.target.value && setFijada(ev.target.value >= hoy ? null : ev.target.value)} />
            </label>
          </div>
          <Link to="/expedientes?nuevo=1" className="rs-nuevo"><Icon name="mas" size={17} />Nuevo Expediente</Link>
        </div>
      </div>
      {tablero ? <p className="rs-tramo">Todo lo de esta parte (tarjetas, gráfico y auditores) cuenta el mismo tramo: del {fechaCorta2(tablero.desde)} al {fechaCorta2(tablero.hasta)}.</p> : null}

      {!r || !tablero || !actividad ? <Cargando /> : (
        <>
          <div className="rs-fila1">
            <div className="rs-kpis" role="group" aria-label="Indicador que dibuja el gráfico" aria-busy={!vigente}>
              {SERIES.map((s) => {
                const dato = tablero.series[s.id];
                const v = variacion(dato.total, dato.anterior);
                return (
                  <button key={s.id} type="button" className={`rs-kpi${s.id === serieId ? " activo" : ""}${vigente ? "" : " cargando"}`} style={{ ["--cap" as any]: s.color }} aria-pressed={s.id === serieId} aria-controls="rs-grafico"
                    onClick={() => setSerieId(s.id)}>
                    <b>{num(dato.total)}</b><span>{s.rotulo}</span>
                    <i className={`rs-var ${v.tono}${s.sube === "mal" ? " mal" : ""}`} title={`Tramo anterior (${fechaCorta2(tablero.anterior.desde)} al ${fechaCorta2(tablero.anterior.hasta)}): ${num(dato.anterior)}`}>{v.texto}</i>
                    <em>{s.hoy(tablero.hoy, num)}</em>
                  </button>
                );
              })}
            </div>
            <section id="rs-grafico" className="rs-tarjeta rs-grafico" aria-label={serie.titulo} aria-busy={!vigente} style={{ ["--serie" as any]: serie.color, ["--serie-linea" as any]: serie.linea || serie.color }}>
              <div className="rs-grafico-cab">
                <div><h2>{serie.titulo}</h2><p>{rotuloPeriodo(actividad)}</p></div>
                <div className="rs-total">
                  <b>{num(actividad.total)}</b>
                  <span>{serie.hechos[actividad.total === 1 ? 0 : 1]} {ventanaPeriodo[actividad.periodo]}</span>
                  <em>{referencias[serieId]}</em>
                </div>
              </div>
              <GraficoArea key={`${serieId}|${actividad.periodo}|${actividad.hasta}`} datos={actividad} nombre={serie} />
            </section>
          </div>

          <RankingAuditores ranking={tablero.ranking} resultados={tablero.resultados} rotulo={rotuloPeriodo(actividad)} vigente={vigente} />

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
              <div className="rs-cab"><h2 className="rs-titulo-tarjeta">Distritos más visitados</h2><span className="rs-apoyo">Últimos 30 días</span></div>
              {!distritos.length ? <p className="rs-vacio">Aún no hay visitas ni casos asignados con distrito en los últimos 30 días.</p> : (
                <>
                  <table className="rs-tabla">
                    <thead><tr><th scope="col">Distritos</th><th scope="col" title="Visitas hechas en los últimos 30 días">Visitas</th><th scope="col" title="Casos asignados a los asesores en los últimos 30 días">Asignados</th></tr></thead>
                    <tbody>{distritos.map((d) => (
                      <tr key={d.distrito}><td>{d.distrito}</td><td className={d.visitas ? undefined : "cero"}>{num(d.visitas)}</td><td className={d.asignados ? undefined : "cero"}>{num(d.asignados)}</td></tr>
                    ))}</tbody>
                  </table>
                  {!hayVisitasEnDistritos ? <p className="rs-nota">Todavía no hay visitas hechas: por ahora se ordena por los casos asignados.</p> : null}
                </>
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
                        <span className="z">{a.zona || "Aún sin jornada"}</span>
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
