import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { request } from "../api";
import { Badge, Button, Card, InfoRow, Loading, Tabs } from "../components/ui";
import { ClienteSeccion, CreditoSeccion, EndeudamientoSeccion, EvaluacionMype, IngresosConsumo, NegocioSeccion } from "../components/ficha/Secciones";
import { ADVERTENCIAS, ORIGEN_UBICACION, dash, fecha, fechaHora } from "../lib/format";

function TrazabilidadDato({ e, onSaved }: { e: any; onSaved: () => void }) {
  const [lat, setLat] = useState(e.latitud ?? "");
  const [lng, setLng] = useState(e.longitud ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const imp = e.importacion;
  const advertencias: string[] = Array.isArray(e.advertencias_origen) ? e.advertencias_origen : [];
  const tieneUbicacion = e.latitud != null && e.longitud != null;

  const guardar = async () => {
    setError("");
    const la = Number(lat);
    const lo = Number(lng);
    if (!Number.isFinite(la) || !Number.isFinite(lo) || Math.abs(la) > 90 || Math.abs(lo) > 180) { setError("Escribe coordenadas válidas (ej. -12.119400 y -77.029500)."); return; }
    setSaving(true);
    try {
      await request(`/api/expedientes/${e.id_expediente}`, { method: "PUT", body: JSON.stringify({ latitud: la, longitud: lo }) });
      onSaved();
    } catch (err: any) { setError(err.message); } finally { setSaving(false); }
  };

  return (
    <>
      {advertencias.length ? (
        <Card>
          <p className="section-title">Avisos de calidad del dato</p>
          {advertencias.map((a) => <div key={a} className="callout aviso">{ADVERTENCIAS[a] || a}</div>)}
        </Card>
      ) : null}

      <Card>
        <p className="section-title">Origen del dato</p>
        {imp ? (
          <>
            <InfoRow k="Archivo" v={imp.archivo} />
            <InfoRow k="Formato detectado" v={imp.formato === "CORE_262" ? "Base MYPE del core (262 columnas)" : dash(imp.formato)} />
            <InfoRow k="Importado por / cuándo" v={`${dash(imp.actor)} · ${fechaHora(imp.fecha_creacion)}`} />
            <InfoRow k="Fila en el archivo" v={dash(e.fila_origen)} />
            <InfoRow k="Huella del archivo (SHA-256)" v={<code style={{ fontSize: 11 }}>{imp.archivo_sha256 ? imp.archivo_sha256.slice(0, 24) + "…" : "-"}</code>} />
            <InfoRow k="Huella de la fila" v={<code style={{ fontSize: 11 }}>{e.hash_origen ? e.hash_origen.slice(0, 24) + "…" : "-"}</code>} />
          </>
        ) : <p className="subtle">Este expediente se creó o editó manualmente: no tiene archivo de origen.</p>}
      </Card>

      <Card>
        <p className="section-title">Ubicación del domicilio</p>
        <InfoRow k="Estado" v={tieneUbicacion ? <span className="tag campo">Con coordenadas</span> : <span className="tag alerta">Sin coordenadas</span>} />
        <InfoRow k="Origen de la ubicación" v={e.ubicacion_origen ? ORIGEN_UBICACION[e.ubicacion_origen] || e.ubicacion_origen : "-"} />
        {!tieneUbicacion ? (
          <div className="callout info" style={{ marginTop: 10 }}>
            Sin coordenadas no se puede calcular la distancia al domicilio. Puedes fijarlas aquí; si no, la primera visita limpia las tomará como referencia y quedará registrado.
          </div>
        ) : null}
        <div className="row" style={{ marginTop: 10 }}>
          <input placeholder="Latitud" value={lat} onChange={(ev) => setLat(ev.target.value)} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: "9px 12px", minHeight: 38, width: 150, fontFamily: "inherit" }} />
          <input placeholder="Longitud" value={lng} onChange={(ev) => setLng(ev.target.value)} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: "9px 12px", minHeight: 38, width: 150, fontFamily: "inherit" }} />
          <Button title={saving ? "Guardando…" : tieneUbicacion ? "Corregir ubicación" : "Fijar ubicación"} onClick={guardar} disabled={saving} />
        </div>
        {error ? <div className="error-box" style={{ marginTop: 10 }}>{error}</div> : null}
      </Card>

      <Card>
        <p className="section-title">Historial de cambios del dato</p>
        {e.cambios?.length ? (
          <ul className="timeline">
            {e.cambios.map((c: any) => {
              const entradas = Object.entries(c.cambios || {}).filter(([k]) => k !== "origen" && k !== "id_visita");
              return (
                <li key={String(c.id_cambio)}>
                  <div><b>{c.tipo === "CREADO" ? "Creado por importación" : c.tipo === "UBICACION" ? "Ubicación modificada" : "Actualizado por reimportación"}</b> <span className="when">· {fechaHora(c.fecha)}{c.actor ? ` · ${c.actor}` : ""}</span></div>
                  {c.tipo === "CREADO" && c.cambios?.origen ? <div className="subtle">Archivo «{c.cambios.origen.archivo}», hoja {c.cambios.origen.hoja}, fila {c.cambios.origen.fila}</div> : null}
                  {entradas.length ? (
                    <details>
                      <summary className="subtle" style={{ cursor: "pointer" }}>{entradas.length} campo(s) cambiado(s)</summary>
                      {entradas.map(([campo, d]: any) => (
                        <div key={campo} style={{ fontSize: 12, padding: "2px 0" }}>
                          <span className="subtle">{campo.replaceAll("_", " ")}:</span> <span className="diff-old">{dash(d.antes)}</span> → <span className="diff-new">{dash(d.despues)}</span>
                        </div>
                      ))}
                    </details>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : <p className="subtle">Sin cambios registrados.</p>}
      </Card>

      <Card>
        <p className="section-title">Asignaciones y visitas</p>
        {e.asignaciones?.length ? e.asignaciones.map((a: any) => (
          <InfoRow key={a.id_asignacion} k={fecha(a.fecha_asignacion)} v={<span>{a.auditor?.nombres || a.auditor?.username} · {a.origen === "AUTOASIGNADA" ? "la tomó el propio auditor" : "asignada por un supervisor"} · <Badge label={a.estado} /></span>} />
        )) : <p className="subtle">Aún no fue asignado.</p>}
        {e.visitas?.map((v: any) => (
          <InfoRow key={v.id_visita} k={`Visita ${v.id_visita}`} v={<span><Link to={`/visitas/${v.id_visita}`}>{fechaHora(v.fecha_hora_checkin)}</Link> · <Badge label={v.resultado} /></span>} />
        ))}
      </Card>
    </>
  );
}

export default function ExpedienteDetailPage() {
  const { id } = useParams();
  const [expediente, setExpediente] = useState<any>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("resumen");

  const cargar = () => request(`/api/expedientes/${id}`).then((r: any) => setExpediente(r.data)).catch((e) => setError(e.message));
  useEffect(() => { cargar(); }, [id]);

  const esMype = expediente?.tipo_credito === "OTROS";
  const advertencias: string[] = Array.isArray(expediente?.advertencias_origen) ? expediente.advertencias_origen : [];
  const tabs = useMemo(() => [
    { id: "resumen", label: "Cliente" },
    { id: "credito", label: "Crédito e historial" },
    ...(esMype ? [{ id: "negocio", label: "Negocio" }] : []),
    { id: "evaluacion", label: esMype ? "Evaluación financiera" : "Ingresos" },
    { id: "deuda", label: "Endeudamiento" },
    { id: "trazabilidad", label: "Trazabilidad", badge: advertencias.length > 0 },
  ], [esMype, advertencias.length]);

  if (error) return <Card><p style={{ color: "var(--danger)" }}>{error}</p></Card>;
  if (!expediente) return <Loading />;

  return (
    <>
      <div className="page-header">
        <div>
          <p><Link to="/expedientes">← Expedientes</Link></p>
          <h1>{expediente.nombres_cliente}</h1>
          <p>
            {expediente.codigo_expediente} · <span className={`tag ${esMype ? "aviso" : "base"}`}>{esMype ? "MYPE · Créditos Otros" : "Consumo"}</span> <Badge label={expediente.estado} />
          </p>
        </div>
      </div>
      <Tabs tabs={tabs} value={tab} onChange={setTab} />
      {tab === "resumen" ? <ClienteSeccion e={expediente} /> : null}
      {tab === "credito" ? <CreditoSeccion e={expediente} /> : null}
      {tab === "negocio" && esMype ? <NegocioSeccion e={expediente} /> : null}
      {tab === "evaluacion" ? (esMype ? <EvaluacionMype e={expediente} /> : <IngresosConsumo e={expediente} />) : null}
      {tab === "deuda" ? <EndeudamientoSeccion e={expediente} /> : null}
      {tab === "trazabilidad" ? <TrazabilidadDato e={expediente} onSaved={cargar} /> : null}
    </>
  );
}
