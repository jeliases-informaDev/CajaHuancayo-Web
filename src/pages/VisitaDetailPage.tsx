import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { downloadWordExport, fetchEvidenceBlobUrl, request } from "../api";
import { Badge, Button, Card, InfoRow, Loading, Origen, Tabs } from "../components/ui";
import { ClienteSeccion, CreditoSeccion, EndeudamientoSeccion, EvaluacionMype, IngresosConsumo, NegocioSeccion } from "../components/ficha/Secciones";
import { ESTADO_NEGOCIO, PLANTILLA_NOMBRE, PROPIEDAD_LOCAL, ORIGEN_UBICACION, dash, fecha, fechaHora, n2 } from "../lib/format";

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
      <img src={url} alt={tipo} className="photo-thumb" />
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
            <thead><tr><th>Nombre</th><th>Parentesco</th><th>Actividad</th><th>Antigüedad del negocio</th></tr></thead>
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
      <Tabs tabs={tabs} value={sub} onChange={setSub} />
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

export default function VisitaDetailPage() {
  const { id } = useParams();
  const [visita, setVisita] = useState<any>(null);
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [tab, setTab] = useState("resultado");

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
  if (error) return <Card><p style={{ color: "var(--danger)" }}>{error}</p></Card>;
  if (!visita || !e) return <Loading />;

  const esMype = (visita.plantilla || (e.tipo_credito === "OTROS" ? "MYPE_V1" : "CONSUMO_V1")) === "MYPE_V1";
  const conAlerta = visita.mock_location || !visita.device_integrity_ok;
  const tabs = [
    { id: "resultado", label: "Resultado", badge: conAlerta },
    { id: "ficha", label: "Ficha de entrevista" },
    { id: "base", label: "Datos de la base" },
    { id: "evidencias", label: `Evidencias (${visita.evidencias?.length || 0})` },
    { id: "trazabilidad", label: "Trazabilidad" },
  ];

  return (
    <>
      <div className="page-header">
        <div>
          <p><Link to="/visitas">← Visitas</Link></p>
          <h1>{e.nombres_cliente}</h1>
          <p>
            {e.codigo_expediente} · {fechaHora(visita.fecha_hora_checkin)} <Badge label={visita.resultado} />{" "}
            <span className={`tag ${esMype ? "aviso" : "base"}`}>{esMype ? "Ficha MYPE" : "Ficha Consumo"}</span>
          </p>
        </div>
        <Button title={downloading ? "Generando…" : "Descargar ficha en Word"} onClick={descargarWord} disabled={downloading} />
      </div>

      {conAlerta ? (
        <div className="error-box">
          {visita.mock_location ? "⚠ Se detectó ubicación simulada (Fake GPS) reportada por el dispositivo. " : ""}
          {!visita.device_integrity_ok ? "⚠ El dispositivo no pasó el chequeo de integridad." : ""}
        </div>
      ) : null}

      <Tabs tabs={tabs} value={tab} onChange={setTab} />

      {tab === "resultado" ? (
        <Card>
          <p className="section-title">Datos de la visita</p>
          <InfoRow k="Auditor" v={`${visita.auditor?.nombres || ""} ${visita.auditor?.apellidos || ""} (@${visita.auditor?.username})`} />
          <InfoRow k="Resultado" v={<Badge label={visita.resultado} />} />
          <InfoRow k="Coordenadas registradas" v={`${visita.latitud}, ${visita.longitud} (±${visita.precision_metros ?? "?"} m)`} />
          <InfoRow k="Distancia al domicilio registrado" v={visita.distancia_domicilio_m != null ? `${Math.round(visita.distancia_domicilio_m)} m` : "No calculada (expediente sin coordenadas)"} />
          <InfoRow k="Ubicación simulada (Fake GPS)" v={visita.mock_location ? "SÍ — bloqueado" : "No detectada"} />
          <InfoRow k="Integridad del dispositivo" v={visita.device_integrity_ok ? "OK" : "Con observaciones"} />
          <InfoRow k="Hora recibida por el servidor" v={fechaHora(visita.server_received_at)} />
          <InfoRow k="Fecha de desembolso del crédito" v={fecha(e.datos_credito?.fecha_desembolso)} />
          <p style={{ marginTop: 10 }}><Link to={`/expedientes/${visita.id_expediente}`}>Ver expediente actual →</Link></p>
        </Card>
      ) : null}

      {tab === "ficha" ? <FichaEntrevista visita={visita} esMype={esMype} /> : null}
      {tab === "base" ? <DatosBase e={e} esMype={esMype} conformidad={visita.conformidad_financiera} /> : null}

      {tab === "evidencias" ? (
        <Card>
          <p className="section-title">Evidencia fotográfica <Origen tipo="campo" /></p>
          <div className="row">
            {(visita.evidencias || []).map((ev: any) => <EvidencePhoto key={ev.id_evidencia} idEvidencia={ev.id_evidencia} tipo={ev.tipo} />)}
            {!visita.evidencias?.length ? <p className="muted">Sin fotos subidas para esta visita.</p> : null}
          </div>
          {visita.firma_evidencia ? (
            <div style={{ marginTop: 14 }}>
              <p style={{ fontWeight: 700, fontSize: 12, color: "var(--muted)" }}>Firma del cliente</p>
              <img src={visita.firma_evidencia} alt="firma" style={{ maxWidth: 260, border: "1px solid var(--border)", borderRadius: 8, marginTop: 4 }} />
            </div>
          ) : null}
        </Card>
      ) : null}

      {tab === "trazabilidad" ? <Trazabilidad visita={visita} e={e} /> : null}
    </>
  );
}
