import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { request } from "../api";
import { Badge, Card, InfoRow, Loading } from "../components/ui";

function JsonSection({ title, value }: { title: string; value: any }) {
  if (!value || (typeof value === "object" && !Object.keys(value).length)) return null;
  return (
    <Card>
      <p className="section-title">{title}</p>
      {Array.isArray(value) ? (
        value.length ? (
          <table>
            <thead><tr>{Object.keys(value[0]).map((k) => <th key={k}>{k.replaceAll("_", " ")}</th>)}</tr></thead>
            <tbody>{value.map((row: any, i: number) => <tr key={i}>{Object.values(row).map((v: any, j) => <td key={j}>{String(v ?? "-")}</td>)}</tr>)}</tbody>
          </table>
        ) : <p className="muted">Sin datos.</p>
      ) : (
        Object.entries(value).map(([k, v]) => {
          if (v && typeof v === "object") return <JsonSection key={k} title={k.replaceAll("_", " ")} value={v} />;
          return <InfoRow key={k} k={k.replaceAll("_", " ")} v={String(v ?? "-")} />;
        })
      )}
    </Card>
  );
}

export default function ExpedienteDetailPage() {
  const { id } = useParams();
  const [expediente, setExpediente] = useState<any>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    request(`/api/expedientes/${id}`).then((r: any) => setExpediente(r.data)).catch((e) => setError(e.message));
  }, [id]);

  if (error) return <Card><p style={{ color: "var(--danger)" }}>{error}</p></Card>;
  if (!expediente) return <Loading />;

  return (
    <>
      <div className="page-header">
        <p><Link to="/expedientes">← Expedientes</Link></p>
        <h1>{expediente.nombres_cliente}</h1>
        <p>{expediente.codigo_expediente} · {expediente.tipo_credito} <Badge label={expediente.estado} /></p>
      </div>
      <Card>
        <p className="section-title">Datos del cliente</p>
        <InfoRow k="Documento" v={`${expediente.tipo_documento_cliente} ${expediente.numero_documento_cliente}`} />
        <InfoRow k="Teléfono" v={expediente.telefono_cliente || "-"} />
        <InfoRow k="Dirección" v={expediente.direccion_domicilio || "-"} />
        <InfoRow k="Distrito / Provincia" v={`${expediente.distrito || "-"} / ${expediente.provincia || "-"}`} />
        <InfoRow k="Coordenadas del domicilio" v={expediente.latitud && expediente.longitud ? `${expediente.latitud}, ${expediente.longitud}` : "No registradas"} />
      </Card>
      <Card>
        <p className="section-title">Datos del crédito</p>
        <InfoRow k="Asesor responsable" v={expediente.asesor_responsable} />
        <InfoRow k="Oficina" v={expediente.oficina || "-"} />
        <InfoRow k="Monto desembolsado" v={expediente.monto_desembolso ? `${expediente.moneda || "PEN"} ${expediente.monto_desembolso}` : "-"} />
      </Card>
      <JsonSection title="Datos adicionales del cliente" value={expediente.datos_cliente} />
      <JsonSection title="Datos del negocio" value={expediente.datos_negocio} />
      <JsonSection title="Historial crediticio / participantes" value={expediente.datos_credito} />
      <JsonSection title="Evaluación financiera" value={expediente.evaluacion_financiera} />
      <JsonSection title="Endeudamiento" value={expediente.endeudamiento} />
    </>
  );
}
