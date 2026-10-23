import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { request } from "../../api";
import { Badge, Skeleton } from "../ui";
import { Drawer } from "../kit";
import { PastillaTipo } from "./pastillas";
import { dash, fechaHora, n2 } from "../../lib/format";

// Vista rápida de un expediente (panel lateral) al hacer clic en una fila de la lista: lo esencial y el botón para abrir el expediente completo.
export default function VistaExpediente({ id, onClose }: { id: number; onClose: () => void }) {
  const [e, setE] = useState<any>(null);
  const [error, setError] = useState("");
  useEffect(() => { request<any>(`/api/expedientes/${id}`).then((r) => setE(r.data)).catch((x) => setError(x.message)); }, [id]);
  const c = e?.datos_cliente || {};
  const tieneUbicacion = e?.latitud != null && e?.longitud != null;
  return (
    <Drawer
      title={e ? e.nombres_cliente : "Expediente"}
      subtitle={e ? `${e.tipo_documento_cliente} ${e.numero_documento_cliente}` : undefined}
      onClose={onClose}
      footer={e ? <Link className="btn" to={`/expedientes/${id}`}>Abrir expediente completo</Link> : null}
    >
      {error ? <div role="alert" className="error-box">{error}</div> : null}
      {!e && !error ? <Skeleton height={160} radius={4} style={{ display: "block" }} /> : null}
      {e ? (
        <>
          <div className="row" style={{ marginBottom: 16 }}>
            <PastillaTipo tipo={e.tipo_credito} />
            <Badge label={e.estado} />
          </div>
          <div className="info-row"><span className="k">Crédito</span><span className="v">{e.codigo_expediente}</span></div>
          <div className="info-row"><span className="k">Dirección</span><span className="v">{dash(e.direccion_domicilio)}</span></div>
          <div className="info-row"><span className="k">Distrito</span><span className="v">{dash(e.distrito)}</span></div>
          <div className="info-row"><span className="k">Teléfono</span><span className="v">{dash(e.telefono_cliente)}</span></div>
          <div className="info-row"><span className="k">Monto desembolsado</span><span className="v">{e.monto_desembolso ? `${e.moneda === "USD" ? "US$" : "S/"} ${n2(e.monto_desembolso)}` : "-"}</span></div>
          <div className="info-row"><span className="k">Asesor responsable</span><span className="v">{dash(e.asesor_responsable)}</span></div>
          <div className="info-row"><span className="k">Referencia</span><span className="v">{dash(c.referencia_domicilio)}</span></div>
          <div className="info-row"><span className="k">Ubicación</span><span className="v"><span className={`state ${tieneUbicacion ? "ok" : "warn"}`}>{tieneUbicacion ? "Con coordenadas" : "Sin coordenadas"}</span></span></div>
          {e.importacion ? <div className="info-row"><span className="k">Origen</span><span className="v">{e.importacion.archivo}<span className="sub">{fechaHora(e.importacion.fecha_creacion)}</span></span></div> : null}
        </>
      ) : null}
    </Drawer>
  );
}
