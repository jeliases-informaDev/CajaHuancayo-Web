import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { downloadWordExport, fetchEvidenceBlobUrl, request } from "../api";
import { Avatar, Badge, Card, InfoRow, Loading, Origen, TabPanel, Tabs } from "../components/ui";
import { useQueryParam } from "../lib/useQueryParam";
import { Check, Lightbox, Ring } from "../components/kit";
import { Icon } from "../components/icons";
import { ClienteSeccion, CreditoSeccion, EndeudamientoSeccion, EvaluacionMype, IngresosConsumo, NegocioSeccion } from "../components/ficha/Secciones";
import { ESTADO_NEGOCIO, PLANTILLA_NOMBRE, PROPIEDAD_LOCAL, ORIGEN_UBICACION, dash, fechaHora, n2 } from "../lib/format";

const GRUPOS_CUESTIONARIO: { titulo: string; items: [string, string][] }[] = [
  {
    titulo: "Verificación anti-fraude",
    items: [
      ["entrego_dinero_asesor", "¿Alguna vez entregó dinero al asesor por alguna razón?"],
      ["pago_comision_adicional", "¿Pagó alguna comisión adicional por el desembolso?"],
      ["recibio_monto_total", "¿Recibió el total del monto solicitado?"],
    ],
  },
  {
    titulo: "Crédito y hogar",
    items: [
      ["conyuge_conoce_prestamo", "¿Cónyuge tiene conocimiento del préstamo?"],
      ["creditos_paralelos", "¿Tiene créditos paralelos?"],
      ["comparte_dinero_credito", "¿Comparte el dinero del crédito con otra persona?"],
      ["donde_realiza_pagos", "¿Dónde realiza sus pagos?"],
    ],
  },
  { titulo: "Negocio", items: [["titular_administra_negocio", "¿Titular administra el negocio?"]] },
  {
    titulo: "Microseguro",
    items: [
      ["tiene_microseguro", "¿Tiene microseguro?"],
      ["recibio_info_microseguro", "¿Recibió información antes de comprar el microseguro?"],
      ["conforme_microseguro", "¿Está conforme con el microseguro?"],
      ["comentario_microseguro", "Comentario sobre el microseguro"],
    ],
  },
];

const respuesta = (v: any) => (typeof v === "boolean" ? <span className={`tag ${v ? "campo" : "aviso"}`}>{v ? "SI" : "NO"}</span> : dash(v));

function FichaEntrevista({ visita, esMype }: { visita: any; esMype: boolean }) {
  const r = visita.respuestas_cuestionario || {};
  const grupos = GRUPOS_CUESTIONARIO.filter((g) => esMype || g.titulo !== "Negocio");
  return (
    <>
      <div className="callout info">
        {PLANTILLA_NOMBRE[visita.plantilla] || "Ficha"} · registrada por el auditor en campo. Los datos del cliente y del crédito que vio el auditor están en la pestaña «Datos de la base».
      </div>

      {esMype ? (
        <Card>
          <p className="section-title">Negocio verificado <Origen tipo="campo" /></p>
          <InfoRow k="Estado del negocio" v={visita.estado_negocio ? <span className={`tag ${visita.estado_negocio === "EN_FUNCIONAMIENTO" ? "campo" : "aviso"}`}>{ESTADO_NEGOCIO[visita.estado_negocio]}</span> : "-"} />
          <InfoRow k="Propiedad del local" v={dash(PROPIEDAD_LOCAL[visita.propiedad_local])} />
          <InfoRow k="Comentario general del negocio" v={dash(visita.comentario_negocio)} />
        </Card>
      ) : (
        <Card>
          <p className="section-title">Comentario general <Origen tipo="campo" /></p>
          <p>{dash(visita.comentario_negocio)}</p>
        </Card>
      )}

      {esMype ? (
        <Card>
          <p className="section-title">Análisis y conformidad de la evaluación <Origen tipo="campo" /></p>
          {visita.conformidad_financiera ? (
            [["ingresos", "Ingresos del negocio"], ["balance", "Balance general"], ["resultados", "Estado de resultados"]].map(([k, etiqueta]) => {
              const b = visita.conformidad_financiera[k];
              if (!b) return null;
              return <InfoRow key={k} k={etiqueta} v={b.conforme ? <span className="tag campo">CONFORME</span> : <span><span className="tag aviso">OBSERVADO</span> {dash(b.comentario)}</span>} />;
            })
          ) : <p className="subtle">No se registró (visita sin llegar al negocio o enviada con una versión anterior de la app).</p>}
        </Card>
      ) : null}

      <Card>
        <p className="section-title">Cuestionario al cliente <Origen tipo="campo" /></p>
        {grupos.map((g) => {
          // En Consumo el cónyuge puede venir como «No aplica» (sin respuesta Sí/No).
          const filas = g.items.filter(([k]) => r[k] !== undefined || (k === "conyuge_conoce_prestamo" && r.conyuge_no_aplica === true));
          if (!filas.length) return null;
          return (
            <div key={g.titulo} style={{ marginBottom: 10 }}>
              <p className="subtle" style={{ fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5, margin: "6px 0 2px" }}>{g.titulo}</p>
              {filas.map(([k, etiqueta]) => <InfoRow key={k} k={etiqueta} v={k === "conyuge_conoce_prestamo" && r.conyuge_no_aplica === true ? "No aplica" : respuesta(r[k])} />)}
            </div>
          );
        })}
      </Card>

      <Card>
        <p className="section-title">Otros clientes que domician en la vivienda <Origen tipo="campo" /></p>
        {visita.otros_clientes_domicilio?.length ? (
          <table className="compact">
            <thead><tr><th scope="col">Nombre</th><th scope="col">Parentesco</th><th scope="col">Actividad</th><th scope="col">Antigüedad del negocio</th></tr></thead>
            <tbody>{visita.otros_clientes_domicilio.map((x: any, i: number) => <tr key={i}><td>{dash(x.nombre)}</td><td>{dash(x.parentesco)}</td><td>{dash(x.actividad)}</td><td>{dash(x.antiguedad_negocio)}</td></tr>)}</tbody>
          </table>
        ) : <p className="subtle">Ninguno registrado.</p>}
      </Card>

      <Card>
        <p className="section-title">Otros pasivos e ingresos <Origen tipo="campo" /></p>
        <InfoRow k="Otros pasivos del titular y cónyuge" v={dash(visita.otros_pasivos)} />
        {visita.otros_ingresos?.length
          ? visita.otros_ingresos.map((x: any, i: number) => <InfoRow key={i} k={`Ingreso ${i + 1}`} v={`${dash(x.origen)} · S/ ${n2(x.monto_mensual)} al mes`} />)
          : <InfoRow k="Otros ingresos" v="Ninguno registrado" />}
      </Card>

      <Card>
        <p className="section-title">Comentarios finales del auditor <Origen tipo="campo" /></p>
        <p>{dash(visita.comentario_auditor)}</p>
        <InfoRow k="Documento de quien firmó" v={dash(visita.firmante_documento)} />
      </Card>
    </>
  );
}

function DatosBase({ e, esMype, conformidad }: { e: any; esMype: boolean; conformidad: any }) {
  const [sub, setSub] = useState("cliente");
  const tabs = [
    { id: "cliente", label: "Cliente" }, { id: "credito", label: "Crédito" },
    { id: "negocio", label: esMype ? "Negocio" : "Datos laborales" },
    { id: "eval", label: esMype ? "Evaluación" : "Ingresos" }, { id: "deuda", label: "Endeudamiento" },
  ];
  return (
    <>
      <div className="callout info">Estos son los datos de la base tal como los vio el auditor al hacer la visita. Si el expediente se reimporta después, esta ficha no cambia.</div>
      <Tabs name="base" tabs={tabs} value={sub} onChange={setSub} />
      {sub === "cliente" ? <ClienteSeccion e={e} /> : null}
      {sub === "credito" ? <CreditoSeccion e={e} /> : null}
      {sub === "negocio" ? <NegocioSeccion e={e} consumo={!esMype} /> : null}
      {sub === "eval" ? (esMype ? <EvaluacionMype e={e} conformidad={conformidad} /> : <IngresosConsumo e={e} />) : null}
      {sub === "deuda" ? <EndeudamientoSeccion e={e} /> : null}
    </>
  );
}

function Trazabilidad({ visita, e }: { visita: any; e: any }) {
  const t = visita.trazabilidad || {};
  const asignacion = t.asignacion;
  const quien = asignacion?.asignado_por ? `${asignacion.asignado_por.nombres || ""} ${asignacion.asignado_por.apellidos || ""}`.trim() || asignacion.asignado_por.username : null;
  const eventos: { cuando: any; titulo: string; detalle?: string }[] = [
    t.importacion ? { cuando: t.importacion.fecha_creacion, titulo: "Datos cargados desde la base", detalle: `Archivo «${t.importacion.archivo}»${e.fila_origen ? `, fila ${e.fila_origen}` : ""}` } : null,
    asignacion ? { cuando: asignacion.fecha_asignacion, titulo: asignacion.origen === "AUTOASIGNADA" ? "El auditor tomó el caso por su cuenta" : "Muestra asignada", detalle: asignacion.origen === "AUTOASIGNADA" ? undefined : `Por ${dash(quien)} · prioridad ${asignacion.prioridad}` } : null,
    { cuando: visita.fecha_hora_checkin, titulo: "Visita realizada (hora del dispositivo)", detalle: `${visita.latitud}, ${visita.longitud} (±${visita.precision_metros ?? "?"} m)` },
    { cuando: visita.server_received_at, titulo: "Recibida y cerrada por el servidor", detalle: `Resultado ${visita.resultado}. La ficha queda cerrada y no se puede editar.` },
  ].filter(Boolean) as any;
  return (
    <>
      <Card>
        <p className="section-title">Línea de tiempo</p>
        <ul className="timeline">
          {eventos.map((ev, i) => (
            <li key={i}>
              <div><b>{ev.titulo}</b> <span className="when">· {fechaHora(ev.cuando)}</span></div>
              {ev.detalle ? <div className="subtle">{ev.detalle}</div> : null}
            </li>
          ))}
        </ul>
      </Card>
      <Card>
        <p className="section-title">Garantías de la visita</p>
        {visita.ubicacion_visitada ? <InfoRow k="Dirección visitada" v={`${visita.ubicacion_visitada === "NEGOCIO" ? "Negocio" : "Domicilio"}${visita.direccion_visitada ? ` — ${visita.direccion_visitada}` : ""}`} /> : null}
        <InfoRow k={`Distancia al ${visita.ubicacion_visitada === "NEGOCIO" ? "negocio" : "domicilio"} de la base`} v={visita.distancia_domicilio_m != null ? `${Math.round(visita.distancia_domicilio_m)} m` : `No calculada (${visita.ubicacion_visitada === "NEGOCIO" ? "el negocio" : "el domicilio"} no tenía coordenadas)`} />
        {visita.ubicacion_visitada !== "NEGOCIO" ? <InfoRow k="Origen de la ubicación de referencia" v={e.ubicacion_origen ? ORIGEN_UBICACION[e.ubicacion_origen] || e.ubicacion_origen : "-"} /> : null}
        <InfoRow k="Ubicación simulada (Fake GPS)" v={visita.mock_location ? "SÍ — detectada" : "No detectada"} />
        <InfoRow k="Integridad del dispositivo" v={visita.device_integrity_ok ? "OK" : "Con observaciones"} />
        <InfoRow k="Identificador del dispositivo" v={<code style={{ fontSize: 11 }}>{dash(visita.device_id)}</code>} />
        <InfoRow k="Plantilla" v={dash(PLANTILLA_NOMBRE[visita.plantilla] || visita.plantilla)} />
        <InfoRow k="Huella de la fila de la base" v={<code style={{ fontSize: 11 }}>{e.hash_origen ? e.hash_origen.slice(0, 24) + "…" : "-"}</code>} />
      </Card>
      {t.cambios_ubicacion?.length ? (
        <Card>
          <p className="section-title">Cambios de ubicación del expediente</p>
          {t.cambios_ubicacion.map((c: any) => {
            const k = c.cambios || {};
            const claveNegocio = Object.keys(k).find((x) => /^negocio_\d+_latitud$/.test(x));
            const pre = claveNegocio ? claveNegocio.replace("latitud", "") : "";
            return <InfoRow key={c.id_cambio} k={fechaHora(c.fecha)} v={`${claveNegocio ? `Negocio ${pre.split("_")[1]} · ` : ""}${k[`${pre}ubicacion_origen`]?.despues || "-"}: ${k[`${pre}latitud`]?.despues}, ${k[`${pre}longitud`]?.despues}`} />;
          })}
        </Card>
      ) : null}
      <p className="subtle">Todas las acciones de esta visita quedan además en el registro de auditoría de seguridad (menú Seguridad).</p>
    </>
  );
}

// Controles que el revisor comprueba antes de dar por buena una visita. Salen de lo que ya guarda el sistema.
function controlesDe(visita: any, esMype: boolean) {
  const radio = Number(visita.trazabilidad?.geocerca_m) || 100;
  const llegoAlCliente = ["CONFORME", "OBSERVADO"].includes(visita.resultado);
  const r = visita.respuestas_cuestionario || {};
  const tresRespuestas = ["entrego_dinero_asesor", "pago_comision_adicional", "recibio_monto_total"].every((k) => typeof r[k] === "boolean");
  const fotos = visita.evidencias?.length || 0;
  const distancia = visita.distancia_domicilio_m != null ? Math.round(Number(visita.distancia_domicilio_m)) : null;
  const lugar = visita.ubicacion_visitada === "NEGOCIO" ? "negocio" : "domicilio"; // en MYPE el auditor puede ir a cualquiera de los dos
  const lista: { tone: "ok" | "warn" | "bad" | "na"; title: string; detail: string }[] = [
    distancia == null
      ? { tone: "na", title: `Distancia al ${lugar}`, detail: `${lugar === "negocio" ? "El negocio" : "El domicilio"} no tenía coordenadas en la base` }
      : distancia <= radio
        ? { tone: "ok", title: `A ${distancia} m del ${lugar}`, detail: `Máximo permitido: ${radio} m` }
        : { tone: "bad", title: `A ${distancia} m del ${lugar}`, detail: `Supera el máximo de ${radio} m` },
    visita.mock_location
      ? { tone: "bad", title: "GPS simulado", detail: "El dispositivo reportó una ubicación falsa" }
      : { tone: "ok", title: "GPS real", detail: "Sin ubicación simulada" },
    visita.device_integrity_ok
      ? { tone: "ok", title: "Dispositivo íntegro", detail: "Sin root, emulador ni manipulación" }
      : { tone: "bad", title: "Dispositivo con observaciones", detail: "Root, emulador o manipulación detectados" },
    fotos
      ? { tone: "ok", title: `${fotos} ${fotos === 1 ? "fotografía" : "fotografías"}`, detail: "Tomadas con la cámara de la app, sin repetirse" }
      : { tone: "bad", title: "Sin fotografías", detail: "No hay evidencia fotográfica" },
    llegoAlCliente
      ? visita.firma_evidencia ? { tone: "ok", title: "Firma del cliente", detail: visita.firmante_documento ? `Documento ${visita.firmante_documento}` : "Registrada" } : { tone: "bad", title: "Falta la firma", detail: "No se registró la firma del cliente" }
      : { tone: "na", title: "Firma del cliente", detail: "No aplica: no se llegó al cliente" },
    visita.firma_auditor
      ? { tone: "ok", title: "Firma del auditor", detail: "Cerró su trabajo con su firma" }
      : { tone: "na", title: "Firma del auditor", detail: "Sin firma: la visita se hizo con una versión anterior de la app" },
    llegoAlCliente
      ? tresRespuestas ? { tone: "ok", title: "Cuestionario completo", detail: "Las 3 preguntas obligatorias respondidas" } : { tone: "bad", title: "Cuestionario incompleto", detail: "Faltan preguntas obligatorias" }
      : { tone: "na", title: "Cuestionario", detail: "No aplica: no se llegó al cliente" },
  ];
  if (esMype && llegoAlCliente) {
    const c = visita.conformidad_financiera;
    const obs = c ? Object.values(c as Record<string, any>).filter((b) => b && b.conforme === false).length : 0;
    lista.push(!c
      ? { tone: "warn", title: "Evaluación sin revisar", detail: "No se registró conformidad financiera" }
      : obs
        ? { tone: "warn", title: "Evaluación con observaciones", detail: `${obs} de 3 bloques observados` }
        : { tone: "ok", title: "Evaluación conforme", detail: "Ingresos, balance y resultados" });
    lista.push(visita.estado_negocio === "EN_FUNCIONAMIENTO"
      ? { tone: "ok", title: "Negocio en funcionamiento", detail: PROPIEDAD_LOCAL[visita.propiedad_local] ? `Local ${PROPIEDAD_LOCAL[visita.propiedad_local].toLowerCase()}` : "" }
      : { tone: "warn", title: visita.estado_negocio ? ESTADO_NEGOCIO[visita.estado_negocio] : "Estado del negocio sin registrar", detail: "Revisar el comentario del auditor" });
  }
  return lista;
}

function Evidencias({ visita }: { visita: any }) {
  const evid: any[] = visita.evidencias || [];
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [fallos, setFallos] = useState<Record<string, boolean>>({});
  const [visor, setVisor] = useState<number | null>(null);
  const lat = Number(visita.latitud);
  const lng = Number(visita.longitud);

  // Las fotos exigen el token de sesión, así que se piden con fetch y se muestran desde una URL local.
  useEffect(() => {
    let vivo = true;
    const creadas: string[] = [];
    setUrls({}); setFallos({});
    evid.forEach((ev) => {
      fetchEvidenceBlobUrl(ev.id_evidencia)
        .then((u) => { creadas.push(u); if (vivo) setUrls((p) => ({ ...p, [ev.id_evidencia]: u })); else URL.revokeObjectURL(u); })
        .catch(() => { if (vivo) setFallos((p) => ({ ...p, [ev.id_evidencia]: true })); });
    });
    return () => { vivo = false; creadas.forEach((u) => URL.revokeObjectURL(u)); };
  }, [visita.id_visita]); // eslint-disable-line react-hooks/exhaustive-deps

  const titulo = (ev: any) => (ev.tipo === "FOTO_PRINCIPAL" ? "Fotografía principal" : "Fotografía adicional");
  const listos = evid.filter((ev) => urls[ev.id_evidencia]).map((ev) => ({ url: urls[ev.id_evidencia], titulo: titulo(ev) }));

  return (
    <>
      <div className="rail-title"><h2>Evidencia</h2><span className="meta subtle">{evid.length} {evid.length === 1 ? "foto" : "fotos"}</span></div>
      {evid.length ? (
        <div className={`gallery${evid.length === 1 ? " one" : ""}`}>
          {evid.map((ev) => {
            const url = urls[ev.id_evidencia];
            if (fallos[ev.id_evidencia]) return <div key={ev.id_evidencia} className="shot loading">No se pudo cargar la foto</div>;
            if (!url) return <div key={ev.id_evidencia} className="shot loading" role="status">Cargando…</div>;
            return (
              <button key={ev.id_evidencia} type="button" className="shot" onClick={() => setVisor(listos.findIndex((l) => l.url === url))} aria-label={`Ampliar: ${titulo(ev)}`}>
                <img src={url} alt={titulo(ev)} width={640} height={480} loading="lazy" decoding="async" />
                <span>{titulo(ev)}</span>
              </button>
            );
          })}
        </div>
      ) : <p className="subtle">Esta visita no tiene fotografías.</p>}

      {visita.firma_evidencia ? (
        <div className="railblock">
          <span className="lbl">Firma del cliente</span>
          <div className="signature"><img src={visita.firma_evidencia} alt="Firma del cliente" width={520} height={260} /></div>
        </div>
      ) : null}

      {visita.firma_auditor ? (
        <div className="railblock">
          <span className="lbl">Firma del auditor de campo</span>
          <div className="signature"><img src={visita.firma_auditor} alt="Firma del auditor de campo" width={520} height={260} /></div>
        </div>
      ) : null}

      <div className="railblock">
        <span className="lbl">Ubicación registrada</span>
        <div className="locbox">
          <span className="pin"><Icon name="seguimiento" size={20} /></span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <b>{Number.isFinite(lat) ? `${lat.toFixed(6)}, ${lng.toFixed(6)}` : "-"}</b>
            <span className="subtle">Precisión de ±{visita.precision_metros != null ? Math.round(visita.precision_metros) : "?"} m</span>
          </div>
          {Number.isFinite(lat) ? <a className="iconbtn" href={`https://www.google.com/maps?q=${lat},${lng}`} target="_blank" rel="noreferrer" aria-label="Abrir la ubicación en el mapa (se abre en otra pestaña)"><Icon name="externo" size={17} /></a> : null}
        </div>
      </div>
      {visor !== null && listos.length ? <Lightbox items={listos} index={Math.min(visor, listos.length - 1)} onIndex={setVisor} onClose={() => setVisor(null)} /> : null}
    </>
  );
}

function leerCola(): number[] {
  try { const v = JSON.parse(sessionStorage.getItem("ch_cola_visitas") || "[]"); return Array.isArray(v) ? v.map(Number) : []; } catch { return []; }
}

// Los filtros con los que se llegó desde la lista de visitas, para que «Visitas» vuelva a ella tal como estaba.
function leerFiltrosDeLista(): string {
  try { const s = sessionStorage.getItem("ch_visitas_url") || ""; return s.startsWith("?") ? s : ""; } catch { return ""; }
}

export default function VisitaDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [visita, setVisita] = useState<any>(null);
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [tab, setTab] = useQueryParam("tab", "ficha");

  useEffect(() => {
    setVisita(null);
    request(`/api/visitas/${id}`).then((r: any) => setVisita(r.data)).catch((e) => setError(e.message));
  }, [id]);

  // Anterior / siguiente dentro de la lista que se estaba revisando (atajos: K y J).
  const cola = useMemo(leerCola, [id]);
  const [filtrosDeLista] = useState(leerFiltrosDeLista);
  const posicion = cola.indexOf(Number(id));
  const anterior = posicion > 0 ? cola[posicion - 1] : null;
  const siguiente = posicion >= 0 && posicion < cola.length - 1 ? cola[posicion + 1] : null;
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      const t = ev.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
      if (ev.key === "j" && siguiente) navigate(`/visitas/${siguiente}`);
      if (ev.key === "k" && anterior) navigate(`/visitas/${anterior}`);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [anterior, siguiente, navigate]);

  const descargarWord = async () => {
    setDownloading(true);
    try { await downloadWordExport(Number(id), `ficha-visita-${id}.docx`); }
    catch (e: any) { setError(e.message); }
    finally { setDownloading(false); }
  };

  const e = useMemo(() => (visita ? visita.expediente_snapshot || visita.expediente : null), [visita]);
  if (error) return <div role="alert" className="error-box">{error}</div>;
  if (!visita || !e) return <Loading />;

  const esMype = (visita.plantilla || (e.tipo_credito === "OTROS" ? "MYPE_V1" : "CONSUMO_V1")) === "MYPE_V1";
  const controles = controlesDe(visita, esMype);
  const fallan = controles.filter((c) => c.tone === "bad").length;
  const avisos = controles.filter((c) => c.tone === "warn").length;
  const aplican = controles.filter((c) => c.tone !== "na").length;
  const enRegla = controles.filter((c) => c.tone === "ok").length;
  const tabs = [
    { id: "ficha", label: "Ficha de entrevista" },
    { id: "base", label: "Datos de la base" },
    { id: "trazabilidad", label: "Trazabilidad" },
  ];

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow"><Link to={`/visitas${filtrosDeLista}`}><Icon name="volver" size={14} /> Visitas</Link></p>
          <div className="who-cell" style={{ gap: 18 }}>
            <Avatar nombre={e.nombres_cliente} size="lg" />
            <div>
              <h1>{e.nombres_cliente}</h1>
              <p className="row" style={{ marginTop: 10, gap: 12 }}>
                <span className="code" translate="no" style={{ color: "var(--ink-2)" }}>{e.codigo_expediente}</span>
                <span>{fechaHora(visita.fecha_hora_checkin)}</span>
                <Badge label={visita.resultado} />
                <span className={`tag ${esMype ? "aviso" : "base"}`}>{esMype ? "Ficha MYPE" : "Ficha Consumo"}</span>
              </p>
            </div>
          </div>
        </div>
        <div className="actions">
          {posicion >= 0 && cola.length > 1 ? (
            <div className="stepnav" role="group" aria-label="Recorrer las visitas de la lista">
              <button className="iconbtn" disabled={!anterior} onClick={() => anterior && navigate(`/visitas/${anterior}`)} aria-label="Visita anterior (K)" title="Anterior (K)"><Icon name="izquierda" size={18} /></button>
              <span className="pos">{posicion + 1} de {cola.length}</span>
              <button className="iconbtn" disabled={!siguiente} onClick={() => siguiente && navigate(`/visitas/${siguiente}`)} aria-label="Visita siguiente (J)" title="Siguiente (J)"><Icon name="derecha" size={18} /></button>
            </div>
          ) : null}
          <Link to={`/expedientes/${visita.id_expediente}`} className="btn ghost"><Icon name="expedientes" size={17} />Ver expediente</Link>
          <button className="btn" onClick={descargarWord} disabled={downloading}><Icon name="descargar" size={17} />{downloading ? "Generando…" : "Ficha en Word"}</button>
        </div>
      </div>

      <section className="scorecard" aria-label="Señales de verificación de la visita">
        <div className="score-side">
          <div>
            <h2>Señales de verificación</h2>
            <p>Lo que el sistema comprobó por su cuenta, sin depender de lo que declaró el auditor.</p>
          </div>
          <div className="row" style={{ gap: 16, flexWrap: "nowrap" }}>
            <Ring value={enRegla} total={aplican} small caption="en regla" />
            <div className={fallan ? "tone-bad" : avisos ? "tone-warn" : "tone-ok"} style={{ fontWeight: 500, fontSize: 14, lineHeight: 1.35 }}>
              {fallan ? `${fallan} ${fallan === 1 ? "control no se cumple" : "controles no se cumplen"}` : avisos ? `${avisos} ${avisos === 1 ? "punto" : "puntos"} por revisar` : "Todo en orden"}
              <span style={{ display: "block", fontWeight: 400, color: "var(--muted)", fontSize: 12.5 }}>{enRegla} de {aplican} controles</span>
            </div>
          </div>
        </div>
        <div className="checks">{controles.map((c) => <Check key={c.title} {...c} />)}</div>
      </section>

      <div className="workbench">
        <aside aria-label="Evidencia de la visita"><Evidencias visita={visita} /></aside>
        <div>
          <Tabs name="visita" tabs={tabs} value={tab} onChange={setTab} />
          <TabPanel name="visita" id={tab}>
            {tab === "ficha" ? <FichaEntrevista visita={visita} esMype={esMype} /> : null}
            {tab === "base" ? <DatosBase e={e} esMype={esMype} conformidad={visita.conformidad_financiera} /> : null}
            {tab === "trazabilidad" ? <Trazabilidad visita={visita} e={e} /> : null}
          </TabPanel>
        </div>
      </div>
    </>
  );
}
