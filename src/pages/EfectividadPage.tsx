import { Fragment, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { descargarArchivo, request } from "../api";
import { Avatar, Skeleton } from "../components/ui";
import { Icon } from "../components/icons";
import "../efectividad.css";

// Efectividad de los auditores de campo por periodo (mes o rango de fechas): casos cerrados y visitas con su resultado, junto con cómo se movieron según el
// seguimiento en tiempo real (días en campo, horas de jornada, kilómetros, primera y última posición, llegadas) y las señales de alerta. Todo lo calcula el
// servidor (/api/reportes/efectividad) con los días de este navegador; el Excel trae además el detalle por día y la lista de visitas del periodo.

type Campo = { dias_en_campo: number; dias_con_jornada: number; horas_jornada: number | null; jornadas_sin_cierre: number; km: number | null; puntos_gps: number; inicio_promedio: string | null; fin_promedio: string | null };
type Casos = { pendientes_inicio: number; asignados: number; finalizados: number; pendientes_cierre: number; cumplimiento: number | null };
type Visitas = {
  total: number; conforme: number; observado: number; no_ubicado: number; rechazado: number; conformidad: number | null; por_dia_en_campo: number | null;
  duracion_promedio_min: number | null; precision_promedio_m: number | null; llegadas: number; clientes_con_llegada: number; fuera_geocerca: number; gps_simulado: number;
};
type Auditor = { id: string; nombre: string; usuario: string; zona: string | null; activo: boolean; campo: Campo; casos: Casos; visitas: Visitas };
type Dia = {
  id_usuario: string; dia: string; jornada_inicio: string | null; jornada_fin: string | null; horas_jornada: number | null; jornadas_sin_cierre: number;
  primera_posicion: string | null; ultima_posicion: string | null; km: number | null; puntos_gps: number; visitas: number; conforme: number; observado: number;
  no_ubicado: number; rechazado: number; casos_cerrados: number; llegadas: number; fuera_geocerca: number; gps_simulado: number;
};
type Totales = {
  auditores: number; auditores_con_visitas: number; dias_en_campo: number; horas_jornada: number | null; km: number | null; pendientes_inicio: number; asignados: number;
  finalizados: number; pendientes_cierre: number; cumplimiento: number | null; visitas: number; conforme: number; observado: number; no_ubicado: number; rechazado: number;
  conformidad: number | null; llegadas: number; fuera_geocerca: number; gps_simulado: number;
};
type Reporte = { desde: string; hasta: string; dias_del_periodo: number; geocerca_m: number; auditores: Auditor[]; totales: Totales; dias: Dia[]; generado_en: string };

const diaLocal = (d: Date) => d.toLocaleDateString("en-CA");
const mesDe = (d: Date) => diaLocal(d).slice(0, 7);
const rangoDeMes = (mes: string) => { const [y, m] = mes.split("-").map(Number); return { desde: `${mes}-01`, hasta: `${mes}-${String(new Date(y, m, 0).getDate()).padStart(2, "0")}` }; };
const num = (v: number | null | undefined, d = 0) => (v == null ? "—" : v.toLocaleString("es-PE", { minimumFractionDigits: d, maximumFractionDigits: d }));
const pct = (v: number | null | undefined) => (v == null ? "—" : `${Math.round(v * 100)} %`);
const fechaLarga = (iso: string) => new Intl.DateTimeFormat("es-PE", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));
const fechaDia = (iso: string) => new Intl.DateTimeFormat("es-PE", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));
// Semáforo de los porcentajes: desde 80 % bien, desde 50 % regular, menos es bajo; sin datos, gris.
const tonoPct = (v: number | null | undefined) => (v == null ? "gris" : v >= 0.8 ? "ok" : v >= 0.5 ? "aviso" : "mal");
const ES_DIA = /^\d{4}-\d{2}-\d{2}$/;

export default function EfectividadPage() {
  const [modo, setModo] = useState<"mes" | "rango">("mes");
  const [mes, setMes] = useState(mesDe(new Date()));
  const [rango, setRango] = useState(() => ({ desde: diaLocal(new Date(Date.now() - 29 * 86400000)), hasta: diaLocal(new Date()) }));
  const periodo = modo === "mes" ? rangoDeMes(mes) : rango;
  const periodoValido = ES_DIA.test(periodo.desde) && ES_DIA.test(periodo.hasta) && periodo.desde <= periodo.hasta;
  const [reporte, setReporte] = useState<Reporte | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [abierto, setAbierto] = useState<string | null>(null);
  const [descargando, setDescargando] = useState(false);
  const consulta = `desde=${periodo.desde}&hasta=${periodo.hasta}&desfase=${new Date().getTimezoneOffset()}`;

  useEffect(() => {
    if (!periodoValido) return;
    let vigente = true;
    setCargando(true); setError("");
    request<{ data: Reporte }>(`/api/reportes/efectividad?${consulta}`)
      .then((r) => { if (vigente) { setReporte(r.data); setAbierto(null); } })
      .catch((e) => { if (vigente) setError(e?.message || "No se pudo armar el reporte."); })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [consulta, periodoValido]);

  const descargar = async () => {
    setDescargando(true); setError("");
    try { await descargarArchivo(`/api/reportes/efectividad/excel?${consulta}`, `efectividad-auditores-${periodo.desde}-a-${periodo.hasta}.xlsx`); }
    catch (e: any) { setError(e?.message || "No se pudo descargar el Excel."); }
    finally { setDescargando(false); }
  };
  const t = reporte?.totales;
  const diasDe = (id: string) => (reporte?.dias || []).filter((d) => d.id_usuario === id);

  return (
    <div className="pa-pagina ef-pagina">
      <h1 className="sr-only">Efectividad de auditores</h1>
      <div className="ef-barra">
        <div className="pa-seg" role="group" aria-label="Cómo elegir el periodo">
          <button type="button" className={modo === "mes" ? "on" : ""} aria-pressed={modo === "mes"} onClick={() => setModo("mes")}>Por mes</button>
          <button type="button" className={modo === "rango" ? "on" : ""} aria-pressed={modo === "rango"} onClick={() => setModo("rango")}>Rango de fechas</button>
        </div>
        {modo === "mes" ? (
          <label className="ef-campo"><span>Mes</span><input type="month" name="mes" className="pa-entrada" value={mes} max={mesDe(new Date())} onChange={(e) => { if (e.target.value) setMes(e.target.value); }} /></label>
        ) : (
          <>
            <label className="ef-campo"><span>Desde</span><input type="date" name="desde" className="pa-entrada" value={rango.desde} max={rango.hasta} onChange={(e) => setRango((r) => ({ ...r, desde: e.target.value }))} /></label>
            <label className="ef-campo"><span>Hasta</span><input type="date" name="hasta" className="pa-entrada" value={rango.hasta} min={rango.desde} max={diaLocal(new Date())} onChange={(e) => setRango((r) => ({ ...r, hasta: e.target.value }))} /></label>
          </>
        )}
        <p className="ef-tramo" role="status">
          {periodoValido ? `Del ${fechaLarga(periodo.desde)} al ${fechaLarga(periodo.hasta)}` : "Elige un rango válido: «desde» no puede ser después de «hasta»."}
          {reporte && periodoValido ? ` · ${reporte.dias_del_periodo} ${reporte.dias_del_periodo === 1 ? "día" : "días"}` : ""}
        </p>
        <button type="button" className="pa-boton cabecera primario ef-descargar" onClick={descargar} disabled={!reporte || cargando || descargando || !periodoValido}>
          <Icon name="descargar" size={15} /><span>{descargando ? "Preparando…" : "Descargar Excel"}</span>
        </button>
      </div>

      {error ? <div role="alert" className="pa-error">{error}</div> : null}

      {t ? (
        <div className="ef-totales" aria-label="Totales del periodo">
          <Tarjeta titulo="Visitas" valor={num(t.visitas)} detalle={`${t.auditores_con_visitas} de ${t.auditores} auditores visitaron`} />
          <Tarjeta titulo="Conformidad" valor={pct(t.conformidad)} tono={tonoPct(t.conformidad)} detalle={`${num(t.conforme)} conformes · ${num(t.observado)} observadas · ${num(t.no_ubicado)} no ubicados · ${num(t.rechazado)} rechazadas`} />
          <Tarjeta titulo="Cumplimiento" valor={pct(t.cumplimiento)} tono={tonoPct(t.cumplimiento)} detalle={`${num(t.finalizados)} casos cerrados de ${num(t.pendientes_inicio + t.asignados)} · ${num(t.pendientes_cierre)} pendientes al cierre`} />
          <Tarjeta titulo="Días en campo" valor={num(t.dias_en_campo)} detalle={`${num(t.horas_jornada, 1)} h en jornada en total`} />
          <Tarjeta titulo="Km recorridos" valor={t.km == null ? "sin datos" : num(t.km, 1)} detalle={t.km == null ? "Nadie transmitió su posición en el periodo" : `${num(t.llegadas)} llegadas detectadas por el seguimiento`} />
          <Tarjeta titulo="Alertas" valor={num(t.fuera_geocerca + t.gps_simulado)} tono={t.fuera_geocerca + t.gps_simulado ? "mal" : "ok"} detalle={`${num(t.fuera_geocerca)} fuera de la geocerca · ${num(t.gps_simulado)} con GPS simulado`} />
        </div>
      ) : null}

      <div className="pa-tarjeta" aria-busy={cargando}>
        {cargando && !reporte ? (
          <div className="pa-esqueleto">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} height={44} radius={10} style={{ display: "block" }} />)}</div>
        ) : !reporte || !reporte.auditores.length ? (
          <p className="ef-vacio">No hay auditores con datos en este periodo.</p>
        ) : (
          <div className="pa-scroll">
            <table className="pa-tabla ef-tabla">
              <caption className="sr-only">Efectividad por auditor</caption>
              <thead>
                <tr>
                  <th scope="col" className="ef-col-aud">Auditor</th>
                  <th scope="col" className="c col-dias" title="Días con alguna visita, una jornada iniciada o posiciones del seguimiento">Días en campo</th>
                  <th scope="col" className="c" title="Suma de las jornadas iniciadas y terminadas en la app">Horas en jornada</th>
                  <th scope="col" className="c" title="Suma de los tramos del seguimiento en tiempo real, sin posiciones imprecisas ni saltos">Km recorridos</th>
                  <th scope="col" className="c col-ini" title="Hora promedio de la primera y de la última posición de cada día">Inicio · fin</th>
                  <th scope="col" className="c col-cerrados" title="Casos cerrados en el periodo, sobre los pendientes al inicio más los asignados">Casos cerrados</th>
                  <th scope="col" className="c">Cumplimiento</th>
                  <th scope="col" className="c">Visitas</th>
                  <th scope="col" className="ef-col-res">Resultados</th>
                  <th scope="col" className="c" title="Visitas conformes sobre el total de visitas">Conformidad</th>
                  <th scope="col" className="c col-alertas" title="Visitas fuera de la geocerca o con GPS simulado">Alertas</th>
                  <th scope="col" className="ef-col-mas"><span className="sr-only">Detalle por día</span></th>
                </tr>
              </thead>
              <tbody>
                {reporte.auditores.map((a) => {
                  const on = abierto === a.id;
                  const alertas = a.visitas.fuera_geocerca + a.visitas.gps_simulado;
                  const carga = a.casos.pendientes_inicio + a.casos.asignados;
                  return (
                    <Fragment key={a.id}>
                      <tr className={`ef-fila${on ? " on" : ""}${a.activo ? "" : " inactivo"}`} onClick={() => setAbierto(on ? null : a.id)}>
                        <td className="ef-col-aud">
                          <div className="ef-aud"><Avatar nombre={a.nombre} /><div><b>{a.nombre}</b><small>{a.usuario}{a.zona ? ` · ${a.zona}` : ""}{a.activo ? "" : " · inactivo"}</small></div></div>
                        </td>
                        <td className="c col-dias">{num(a.campo.dias_en_campo)}</td>
                        <td className="c">{num(a.campo.horas_jornada, 1)}{a.campo.jornadas_sin_cierre ? <small className="ef-nota" title="Jornadas que no se terminaron en la app: no suman horas">+{a.campo.jornadas_sin_cierre} sin cerrar</small> : null}</td>
                        <td className="c">{a.campo.km == null ? <span className="subtle">sin datos</span> : num(a.campo.km, 1)}</td>
                        <td className="c ef-horas col-ini">{a.campo.inicio_promedio || a.campo.fin_promedio ? `${a.campo.inicio_promedio || "—"} · ${a.campo.fin_promedio || "—"}` : "—"}</td>
                        <td className="c col-cerrados">{num(a.casos.finalizados)} <span className="subtle">/ {num(carga)}</span></td>
                        <td className="c"><span className={`pa-pastilla ${tonoPct(a.casos.cumplimiento)}`}>{pct(a.casos.cumplimiento)}</span></td>
                        <td className="c"><b>{num(a.visitas.total)}</b></td>
                        <td className="ef-col-res"><Resultados total={a.visitas.total} conforme={a.visitas.conforme} observado={a.visitas.observado} no_ubicado={a.visitas.no_ubicado} rechazado={a.visitas.rechazado} /></td>
                        <td className="c"><span className={`pa-pastilla ${tonoPct(a.visitas.conformidad)}`}>{pct(a.visitas.conformidad)}</span></td>
                        <td className="c col-alertas">{alertas ? <span className="pa-pastilla mal" title={`${a.visitas.fuera_geocerca} fuera de la geocerca · ${a.visitas.gps_simulado} con GPS simulado`}>{alertas}</span> : <span className="subtle">0</span>}</td>
                        <td className="ef-col-mas">
                          <button type="button" className="ef-mas" aria-expanded={on} aria-label={on ? "Ocultar el detalle por día" : "Ver el detalle por día"} onClick={(e) => { e.stopPropagation(); setAbierto(on ? null : a.id); }}><Icon name={on ? "arriba" : "abajo"} size={16} /></button>
                        </td>
                      </tr>
                      {on ? <tr className="ef-detalle"><td colSpan={12}><div className="ef-detalle-caja"><DetalleDias dias={diasDe(a.id)} /></div></td></tr> : null}
                    </Fragment>
                  );
                })}
              </tbody>
              {t ? (
                <tfoot>
                  <tr className="ef-total">
                    <td className="ef-col-aud">Total</td>
                    <td className="c col-dias">{num(t.dias_en_campo)}</td>
                    <td className="c">{num(t.horas_jornada, 1)}</td>
                    <td className="c">{t.km == null ? "—" : num(t.km, 1)}</td>
                    <td className="col-ini" />
                    <td className="c col-cerrados">{num(t.finalizados)} <span className="subtle">/ {num(t.pendientes_inicio + t.asignados)}</span></td>
                    <td className="c">{pct(t.cumplimiento)}</td>
                    <td className="c"><b>{num(t.visitas)}</b></td>
                    <td className="ef-col-res"><Resultados total={t.visitas} conforme={t.conforme} observado={t.observado} no_ubicado={t.no_ubicado} rechazado={t.rechazado} /></td>
                    <td className="c">{pct(t.conformidad)}</td>
                    <td className="c col-alertas">{num(t.fuera_geocerca + t.gps_simulado)}</td>
                    <td />
                  </tr>
                </tfoot>
              ) : null}
            </table>
          </div>
        )}
      </div>
      <p className="ef-pie subtle">
        Los kilómetros, las horas y las llegadas salen del seguimiento en tiempo real de la app (con la jornada iniciada); los casos y las visitas, de lo registrado.
        El Excel trae además el detalle por día y la lista de visitas del periodo. <Link to="/visitas">Ver las visitas</Link>
      </p>
    </div>
  );
}

function Tarjeta({ titulo, valor, detalle, tono }: { titulo: string; valor: string; detalle: string; tono?: string }) {
  return <div className={`ef-tarjeta${tono ? ` ${tono}` : ""}`}><span className="ef-t-titulo">{titulo}</span><b className="ef-t-valor">{valor}</b><span className="ef-t-detalle">{detalle}</span></div>;
}

function Resultados({ total, conforme, observado, no_ubicado, rechazado }: { total: number; conforme: number; observado: number; no_ubicado: number; rechazado: number }) {
  if (!total) return <span className="subtle">—</span>;
  const partes = [["ok", conforme, "conformes"], ["aviso", observado, "observadas"], ["gris", no_ubicado, "no ubicados"], ["mal", rechazado, "rechazadas"]] as const;
  return (
    <div className="ef-res" title={partes.map(([, n, texto]) => `${n} ${texto}`).join(" · ")}>
      <div className="ef-res-barra" aria-hidden="true">{partes.map(([k, n]) => (n ? <i key={k} className={k} style={{ flex: n }} /> : null))}</div>
      <div className="ef-res-num">{partes.map(([k, n, texto]) => <span key={k} className={k}><b>{n}</b><span className="sr-only"> {texto}</span></span>)}</div>
    </div>
  );
}

function DetalleDias({ dias }: { dias: Dia[] }) {
  if (!dias.length) return <p className="subtle ef-sin-dias">Sin actividad registrada en este periodo.</p>;
  return (
    <table className="ef-dias">
      <caption className="sr-only">Detalle por día</caption>
      <thead>
        <tr><th scope="col">Día</th><th scope="col">Jornada</th><th scope="col">Primera · última posición</th><th scope="col" className="c">Horas</th><th scope="col" className="c">Km</th><th scope="col" className="c">Casos cerrados</th><th scope="col" className="c">Visitas</th><th scope="col">Resultados</th><th scope="col" className="c">Llegadas</th><th scope="col" className="c">Alertas</th></tr>
      </thead>
      <tbody>
        {dias.map((d) => (
          <tr key={d.dia}>
            <td className="ef-dia">{fechaDia(d.dia)}</td>
            <td>{d.jornada_inicio ? `${d.jornada_inicio} – ${d.jornada_fin || "sin terminar"}` : <span className="subtle">sin jornada</span>}</td>
            <td>{d.primera_posicion ? `${d.primera_posicion} · ${d.ultima_posicion || "—"}` : <span className="subtle">sin posiciones</span>}</td>
            <td className="c">{num(d.horas_jornada, 1)}</td>
            <td className="c">{d.km == null ? "—" : num(d.km, 1)}</td>
            <td className="c">{num(d.casos_cerrados)}</td>
            <td className="c"><b>{num(d.visitas)}</b></td>
            <td><Resultados total={d.visitas} conforme={d.conforme} observado={d.observado} no_ubicado={d.no_ubicado} rechazado={d.rechazado} /></td>
            <td className="c">{num(d.llegadas)}</td>
            <td className="c">{d.fuera_geocerca + d.gps_simulado ? <span className="pa-pastilla mal">{d.fuera_geocerca + d.gps_simulado}</span> : "0"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
