import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { downloadWordExport, fetchEvidenceBlobUrl, request } from "../api";
import { Badge, Button, Card, InfoRow, Loading } from "../components/ui";

const ETIQUETAS: Record<string, string> = {
  donde_realiza_pagos: "¿Dónde realiza sus pagos?",
  conyuge_conoce_prestamo: "¿Cónyuge tiene conocimiento del préstamo?",
  entrego_dinero_asesor: "¿Alguna vez entregó dinero al asesor por alguna razón?",
  creditos_paralelos: "¿Tiene créditos paralelos?",
  pago_comision_adicional: "¿Pagó alguna comisión adicional por el desembolso?",
  recibio_monto_total: "¿Recibió el total del monto solicitado?",
  comparte_dinero_credito: "¿Comparte el dinero del crédito con otra persona?",
  titular_administra_negocio: "¿Titular administra el negocio?",
  tiene_microseguro: "¿Tiene microseguro?",
  recibio_info_microseguro: "¿Recibió información antes de comprar el microseguro?",
  conforme_microseguro: "¿Está conforme con el microseguro?",
  comentario_microseguro: "Comentario sobre microseguro",
};

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

export default function VisitaDetailPage() {
  const { id } = useParams();
  const [visita, setVisita] = useState<any>(null);
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    request(`/api/visitas/${id}`).then((r: any) => setVisita(r.data)).catch((e) => setError(e.message));
  }, [id]);

  const descargarWord = async () => {
    setDownloading(true);
    try { await downloadWordExport(Number(id), `ficha-visita-${id}.docx`); }
    catch (e: any) { setError(e.message); }
    finally { setDownloading(false); }
  };

  if (error) return <Card><p style={{ color: "var(--danger)" }}>{error}</p></Card>;
  if (!visita) return <Loading />;

  const respuestas = visita.respuestas_cuestionario || {};

  return (
    <>
      <div className="page-header">
        <p><Link to="/visitas">← Visitas</Link></p>
        <h1>{visita.expediente?.nombres_cliente}</h1>
        <p>{visita.expediente?.codigo_expediente} · {new Date(visita.fecha_hora_checkin).toLocaleString("es-PE")} <Badge label={visita.resultado} /></p>
      </div>

      {visita.mock_location || !visita.device_integrity_ok ? (
        <div className="error-box">
          {visita.mock_location ? "⚠ Se detectó ubicación simulada (Fake GPS) reportada por el dispositivo. " : ""}
          {!visita.device_integrity_ok ? "⚠ El dispositivo no pasó el chequeo de integridad." : ""}
        </div>
      ) : null}

      <Card>
        <p className="section-title">Datos de la visita</p>
        <InfoRow k="Auditor" v={`${visita.auditor?.nombres || ""} ${visita.auditor?.apellidos || ""} (@${visita.auditor?.username})`} />
        <InfoRow k="Coordenadas registradas" v={`${visita.latitud}, ${visita.longitud} (±${visita.precision_metros ?? "?"} m)`} />
        <InfoRow k="Distancia al domicilio registrado" v={visita.distancia_domicilio_m != null ? `${Math.round(visita.distancia_domicilio_m)} m` : "No calculada (expediente sin coordenadas)"} />
        <InfoRow k="Ubicación simulada (Fake GPS)" v={visita.mock_location ? "SÍ — bloqueado" : "No detectada"} />
        <InfoRow k="Integridad del dispositivo" v={visita.device_integrity_ok ? "OK" : "Con observaciones"} />
        <InfoRow k="Hora recibida por el servidor" v={new Date(visita.server_received_at).toLocaleString("es-PE")} />
      </Card>

      <Card>
        <p className="section-title">Expediente de referencia</p>
        <InfoRow k="Documento" v={`${visita.expediente?.tipo_documento_cliente} ${visita.expediente?.numero_documento_cliente}`} />
        <InfoRow k="Dirección" v={visita.expediente?.direccion_domicilio || "-"} />
        <InfoRow k="Asesor responsable" v={visita.expediente?.asesor_responsable} />
        <p><Link to={`/expedientes/${visita.id_expediente}`}>Ver expediente completo →</Link></p>
      </Card>

      <Card>
        <p className="section-title">Cuestionario al cliente</p>
        {Object.entries(respuestas).map(([k, v]) => (
          <InfoRow key={k} k={ETIQUETAS[k] || k} v={typeof v === "boolean" ? (v ? "SI" : "NO") : String(v ?? "-")} />
        ))}
      </Card>

      <Card>
        <p className="section-title">Comentarios</p>
        <p style={{ fontWeight: 700, fontSize: 12, color: "var(--muted)" }}>Negocio</p>
        <p style={{ marginTop: 4 }}>{visita.comentario_negocio || "-"}</p>
        <p style={{ fontWeight: 700, fontSize: 12, color: "var(--muted)", marginTop: 12 }}>Auditor</p>
        <p style={{ marginTop: 4 }}>{visita.comentario_auditor || "-"}</p>
      </Card>

      <Card>
        <p className="section-title">Evidencia fotográfica</p>
        <div className="row">
          {(visita.evidencias || []).map((ev: any) => <EvidencePhoto key={ev.id_evidencia} idEvidencia={ev.id_evidencia} tipo={ev.tipo} />)}
          {!visita.evidencias?.length ? <p className="muted">Sin fotos.</p> : null}
        </div>
        {visita.firma_evidencia ? (
          <div style={{ marginTop: 14 }}>
            <p style={{ fontWeight: 700, fontSize: 12, color: "var(--muted)" }}>Firma del cliente</p>
            <img src={visita.firma_evidencia} alt="firma" style={{ maxWidth: 260, border: "1px solid var(--border)", borderRadius: 8, marginTop: 4 }} />
          </div>
        ) : null}
      </Card>

      <Button title={downloading ? "Generando…" : "Descargar ficha en Word"} onClick={descargarWord} disabled={downloading} />
    </>
  );
}
