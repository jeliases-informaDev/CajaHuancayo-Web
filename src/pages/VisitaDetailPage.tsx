import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { downloadWordExport, fetchEvidenceBlobUrl, request } from "../api";
import { Badge, Card, InfoRow, Loading, Origen, TabPanel, Tabs } from "../components/ui";
import { useQueryParam } from "../lib/useQueryParam";
import { Check } from "../components/kit";
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

function EvidencePhoto({ idEvidencia, tipo }: { idEvidencia: string; tipo: string }) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState(false);
  useEffect(() => {
    let objectUrl = "";
    fetchEvidenceBlobUrl(idEvidencia).then((u) => { objectUrl = u; setUrl(u); }).catch(() => setError(true));
    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [idEvidencia]);
  if (error) return <p className="muted">No se pudo cargar {tipo}.</p>;
  if (!url) return <p className="muted">Cargando {tipo}…</p>;
  return (
    <div>
      <img src={url} alt={tipo} className="photo-thumb" width={1024} height={768} loading="lazy" decoding="async" />
      <p className="muted" style={{ fontSize: 11, marginTop: 4 }}>{tipo}</p>
    </div>
  );
}

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
          const filas = g.items.filter(([k]) => r[k] !== undefined);
          if (!filas.length) return null;
          return (
            <div key={g.titulo} style={{ marginBottom: 10 }}>
              <p className="subtle" style={{ fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5, margin: "6px 0 2px" }}>{g.titulo}</p>
              {filas.map(([k, etiqueta]) => <InfoRow key={k} k={etiqueta} v={respuesta(r[k])} />)}
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
    ...(esMype ? [{ id: "negocio", label: "Negocio" }] : []),
    { id: "eval", label: esMype ? "Evaluación" : "Ingresos" }, { id: "deuda", label: "Endeudamiento" },
  ];
  return (
    <>
      <div className="callout info">Estos son los datos de la base tal como los vio el auditor al hacer la visita. Si el expediente se reimporta después, esta ficha no cambia.</div>
      <Tabs name="base" tabs={tabs} value={sub} onChange={setSub} />
      {sub === "cliente" ? <ClienteSeccion e={e} /> : null}
      {sub === "credito" ? <CreditoSeccion e={e} /> : null}
      {sub === "negocio" ? <NegocioSeccion e={e} /> : null}
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
        <InfoRow k="Distancia al domicilio de la base" v={visita.distancia_domicilio_m != null ? `${Math.round(visita.distancia_domicilio_m)} m` : "No calculada (el domicilio no tenía coordenadas)"} />
        <InfoRow k="Origen de la ubicación de referencia" v={e.ubicacion_origen ? ORIGEN_UBICACION[e.ubicacion_origen] || e.ubicacion_origen : "-"} />
        <InfoRow k="Ubicación simulada (Fake GPS)" v={visita.mock_location ? "SÍ — detectada" : "No detectada"} />
        <InfoRow k="Integridad del dispositivo" v={visita.device_integrity_ok ? "OK" : "Con observaciones"} />
        <InfoRow k="Identificador del dispositivo" v={<code style={{ fontSize: 11 }}>{dash(visita.device_id)}</code>} />
        <InfoRow k="Plantilla" v={dash(PLANTILLA_NOMBRE[visita.plantilla] || visita.plantilla)} />
        <InfoRow k="Huella de la fila de la base" v={<code style={{ fontSize: 11 }}>{e.hash_origen ? e.hash_origen.slice(0, 24) + "…" : "-"}</code>} />
      </Card>
      {t.cambios_ubicacion?.length ? (
        <Card>
          <p className="section-title">Cambios de ubicación del expediente</p>
          {t.cambios_ubicacion.map((c: any) => <InfoRow key={c.id_cambio} k={fechaHora(c.fecha)} v={`${c.cambios?.ubicacion_origen?.despues || "-"}: ${c.cambios?.latitud?.despues}, ${c.cambios?.longitud?.despues}`} />)}
        </Card>
      ) : null}
      <p className="subtle">Todas las acciones de esta visita quedan además en el registro de auditoría de seguridad (menú Seguridad).</p>
    </>
  );
}

// Controles que el revisor comprueba antes de dar por buena una visita. Salen de lo que ya guarda el sistema.
function controlesDe(visita: any, esMype: boolean) {
  const radio = Number(visita.trazabilidad?.geocerca_m) || 300;
  const llegoAlCliente = ["CONFORME", "OBSERVADO"].includes(visita.resultado);
  const r = visita.respuestas_cuestionario || {};
  const tresRespuestas = ["entrego_dinero_asesor", "pago_comision_adicional", "recibio_monto_total"].every((k) => typeof r[k] === "boolean");
  const fotos = visita.evidencias?.length || 0;
  const distancia = visita.distancia_domicilio_m != null ? Math.round(Number(visita.distancia_domicilio_m)) : null;
  const lista: { tone: "ok" | "warn" | "bad" | "na"; title: string; detail: string }[] = [
    distancia == null
      ? { tone: "na", title: "Distancia al domicilio", detail: "El domicilio no tenía coordenadas en la base" }
      : distancia <= radio
        ? { tone: "ok", title: `A ${distancia} m del domicilio`, detail: `Máximo permitido: ${radio} m` }
        : { tone: "bad", title: `A ${distancia} m del domicilio`, detail: `Supera el máximo de ${radio} m` },
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
  const lat = Number(visita.latitud);
  const lng = Number(visita.longitud);
  return (
    <>
      <div className="section-head" style={{ borderBottom: "none", paddingBottom: 0 }}><h2>Evidencia</h2></div>
      <div style={{ marginTop: 14 }}>
        {(visita.evidencias || []).map((ev: any) => (
          <figure key={ev.id_evidencia} className="evidence" style={{ margin: 0 }}>
            <EvidencePhoto idEvidencia={ev.id_evidencia} tipo={ev.tipo === "FOTO_PRINCIPAL" ? "Fotografía principal" : "Fotografía adicional"} />
          </figure>
        ))}
        {!visita.evidencias?.length ? <p className="subtle">Esta visita no tiene fotografías.</p> : null}
      </div>
      {visita.firma_evidencia ? (
        <div className="evidence" style={{ marginTop: 22 }}>
          <p className="lbl" style={{ marginBottom: 6 }}>Firma del cliente</p>
          <div className="signature"><img src={visita.firma_evidencia} alt="Firma del cliente" width={520} height={260} /></div>
        </div>
      ) : null}
      <div className="evidence" style={{ marginTop: 22 }}>
        <p className="lbl" style={{ marginBottom: 6 }}>Ubicación registrada</p>
        <p style={{ fontVariantNumeric: "tabular-nums" }}>{Number.isFinite(lat) ? `${lat.toFixed(6)}, ${lng.toFixed(6)}` : "-"}</p>
        <p className="subtle">Precisión de ±{visita.precision_metros != null ? Math.round(visita.precision_metros) : "?"} m</p>
        {Number.isFinite(lat) ? <a href={`https://www.google.com/maps?q=${lat},${lng}`} target="_blank" rel="noreferrer">Ver en el mapa</a> : null}
      </div>
    </>
  );
}

export default function VisitaDetailPage() {
  const { id } = useParams();
  const [visita, setVisita] = useState<any>(null);
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [tab, setTab] = useQueryParam("tab", "ficha");

  useEffect(() => {
    request(`/api/visitas/${id}`).then((r: any) => setVisita(r.data)).catch((e) => setError(e.message));
  }, [id]);

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
  const tabs = [
    { id: "ficha", label: "Ficha de entrevista" },
    { id: "base", label: "Datos de la base" },
    { id: "trazabilidad", label: "Trazabilidad" },
  ];

  return (
    <>
      <div className="page-head">
        <div>
          <p style={{ marginTop: 0, marginBottom: 8 }}><Link to="/visitas">Visitas</Link></p>
          <h1>{e.nombres_cliente}</h1>
          <p className="row" style={{ marginTop: 10, gap: 14 }}>
            <span className="code" style={{ color: "var(--ink-2)", fontVariantNumeric: "tabular-nums" }}>{e.codigo_expediente}</span>
            <span>{fechaHora(visita.fecha_hora_checkin)}</span>
            <Badge label={visita.resultado} />
            <span className={`tag ${esMype ? "aviso" : "base"}`}>{esMype ? "Ficha MYPE" : "Ficha Consumo"}</span>
          </p>
        </div>
        <div className="actions">
          <Link to={`/expedientes/${visita.id_expediente}`} className="btn ghost">Ver expediente</Link>
          <button className="btn" onClick={descargarWord} disabled={downloading}>{downloading ? "Generando…" : "Descargar ficha en Word"}</button>
        </div>
      </div>

      <section className="verdict" aria-label="Controles de la visita">
        <div className="verdict-head">
          <h2>Controles de la visita</h2>
          <span className={`state ${fallan ? "bad" : avisos ? "warn" : "ok"}`}>
            {fallan ? `${fallan} ${fallan === 1 ? "control no se cumple" : "controles no se cumplen"}` : avisos ? `${avisos} ${avisos === 1 ? "punto" : "puntos"} por revisar` : "Todos los controles en orden"}
          </span>
        </div>
        <div className="checks">{controles.map((c) => <Check key={c.title} {...c} />)}</div>
      </section>

      <div className="workbench">
        <aside><Evidencias visita={visita} /></aside>
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
