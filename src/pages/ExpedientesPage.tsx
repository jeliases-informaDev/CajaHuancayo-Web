import React, { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { request } from "../api";
import { Badge, Empty, Skeleton } from "../components/ui";
import { Drawer, Seg } from "../components/kit";
import ImportModal from "../components/ImportModal";
import { dash, fechaHora, n2 } from "../lib/format";

const LIMITE = 50;
const emptyForm = {
  codigo_expediente: "", tipo_credito: "CONSUMO", oficina: "", numero_documento_cliente: "", nombres_cliente: "", telefono_cliente: "",
  direccion_domicilio: "", distrito: "", provincia: "", latitud: "", longitud: "", asesor_responsable: "", monto_desembolso: "", moneda: "PEN",
};

function Vista({ id, onClose }: { id: number; onClose: () => void }) {
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
      {error ? <div className="error-box">{error}</div> : null}
      {!e && !error ? <Skeleton height={160} radius={4} style={{ display: "block" }} /> : null}
      {e ? (
        <>
          <div className="row" style={{ marginBottom: 16 }}>
            <span className={`tag ${e.tipo_credito === "OTROS" ? "aviso" : "base"}`}>{e.tipo_credito === "OTROS" ? "MYPE" : "Consumo"}</span>
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

export default function ExpedientesPage() {
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(1);
  const [search, setSearch] = useState(params.get("q") || "");
  const [tipo, setTipo] = useState<"" | "OTROS" | "CONSUMO">("");
  const [estado, setEstado] = useState("");
  const [sinUbicacion, setSinUbicacion] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [vista, setVista] = useState<number | null>(null);
  const [importando, setImportando] = useState(false);
  const [nuevo, setNuevo] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [guardando, setGuardando] = useState(false);
  const [historial, setHistorial] = useState<any[] | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ limit: String(LIMITE), page: String(pagina) });
      if (search) q.set("search", search);
      if (tipo) q.set("tipo_credito", tipo);
      if (estado) q.set("estado", estado);
      if (sinUbicacion) q.set("sin_ubicacion", "true");
      const r: any = await request(`/api/expedientes?${q}`);
      setData(r.data); setTotal(r.pagination.total);
      setError("");
    } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  }, [search, tipo, estado, sinUbicacion, pagina]);

  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => { setPagina(1); }, [search, tipo, estado, sinUbicacion]);
  useEffect(() => {
    const q = params.get("q");
    if (q !== null && q !== search) setSearch(q);
  }, [params]);

  const crear = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setError(""); setGuardando(true);
    try {
      const payload: any = { ...form };
      ["latitud", "longitud", "monto_desembolso"].forEach((k) => { if (!payload[k]) delete payload[k]; else payload[k] = Number(payload[k]); });
      await request("/api/expedientes", { method: "POST", body: JSON.stringify(payload) });
      setNuevo(false); setForm(emptyForm);
      await cargar();
    } catch (e: any) { setError(e.message); } finally { setGuardando(false); }
  };

  const verHistorial = async () => {
    try { const r: any = await request("/api/expedientes/importaciones?limit=20"); setHistorial(r.data); } catch (e: any) { setError(e.message); }
  };

  const paginas = Math.max(1, Math.ceil(total / LIMITE));
  const campo = (k: keyof typeof emptyForm, etiqueta: string, requerido = false, tipoInput = "text") => (
    <div className="field"><label>{etiqueta}</label><input required={requerido} type={tipoInput} value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} /></div>
  );

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Expedientes</h1>
          <p>{total.toLocaleString("es-PE")} {total === 1 ? "expediente" : "expedientes"} {search || tipo || estado || sinUbicacion ? "con estos filtros" : "cargados"}.</p>
        </div>
        <div className="actions">
          <button className="btn quiet" onClick={verHistorial}>Historial de cargas</button>
          <button className="btn ghost" onClick={() => setNuevo(true)}>Nuevo expediente</button>
          <button className="btn" onClick={() => setImportando(true)}>Cargar archivo</button>
        </div>
      </div>

      {error ? <div className="error-box">{error}</div> : null}

      <div className="filters">
        <div className="fgroup grow">
          <label className="lbl" htmlFor="buscar-exp">Buscar</label>
          <input id="buscar-exp" className="input" placeholder="Crédito, cliente, documento o asesor" value={search} onChange={(e) => { setSearch(e.target.value); if (params.get("q") !== null) setParams({}); }} />
        </div>
        <div className="fgroup">
          <span className="lbl">Tipo de crédito</span>
          <Seg label="Tipo de crédito" value={tipo} onChange={setTipo} options={[{ value: "", label: "Todos" }, { value: "OTROS", label: "MYPE" }, { value: "CONSUMO", label: "Consumo" }]} />
        </div>
        <div className="fgroup">
          <label className="lbl" htmlFor="estado-exp">Estado</label>
          <select id="estado-exp" className="select" value={estado} onChange={(e) => setEstado(e.target.value)}>
            <option value="">Todos</option><option value="PENDIENTE">Pendiente</option><option value="ASIGNADO">Asignado</option><option value="VISITADO">Visitado</option><option value="CERRADO">Cerrado</option>
          </select>
        </div>
        <label className="check-inline"><input type="checkbox" checked={sinUbicacion} onChange={(e) => setSinUbicacion(e.target.checked)} />Solo sin coordenadas</label>
      </div>

      {loading && !data.length ? (
        <div style={{ paddingTop: 18 }}>{[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} height={22} radius={3} style={{ display: "block", margin: "16px 0" }} />)}</div>
      ) : !data.length ? (
        <Empty title="Sin expedientes" text={search || tipo || estado || sinUbicacion ? "Ningún expediente coincide con estos filtros." : "Carga un archivo de Excel para empezar."} />
      ) : (
        <>
          <div className="table-wrap" style={{ opacity: loading ? 0.55 : 1 }}>
            <table>
              <thead><tr><th>Crédito</th><th>Cliente</th><th>Tipo</th><th>Distrito</th><th>Asesor</th><th>Ubicación</th><th>Estado</th></tr></thead>
              <tbody>
                {data.map((x) => (
                  <tr key={x.id_expediente} className={`clickable${vista === x.id_expediente ? " selected" : ""}`} onClick={() => setVista(x.id_expediente)}>
                    <td className="code">{x.codigo_expediente}</td>
                    <td><b style={{ fontWeight: 500 }}>{x.nombres_cliente}</b><span className="sub">{x.numero_documento_cliente}</span></td>
                    <td>{x.tipo_credito === "OTROS" ? "MYPE" : "Consumo"}</td>
                    <td>{dash(x.distrito)}</td>
                    <td>{x.asesor_responsable}</td>
                    <td><span className={`state ${x.latitud != null && x.longitud != null ? "ok" : "warn"}`}>{x.latitud != null && x.longitud != null ? "Con coordenadas" : "Sin coordenadas"}</span></td>
                    <td><Badge label={x.estado} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="pagination">
            <span className="muted">Página {pagina} de {paginas}</span>
            <button className="btn ghost small" disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)}>Anterior</button>
            <button className="btn ghost small" disabled={pagina >= paginas} onClick={() => setPagina((p) => p + 1)}>Siguiente</button>
          </div>
        </>
      )}

      {vista !== null ? <Vista id={vista} onClose={() => setVista(null)} /> : null}
      {importando ? <ImportModal onClose={() => setImportando(false)} onDone={cargar} /> : null}

      {nuevo ? (
        <Drawer title="Nuevo expediente" subtitle="Para cargas grandes usa «Cargar archivo»." onClose={() => setNuevo(false)}
          footer={<><button className="btn ghost" onClick={() => setNuevo(false)}>Cancelar</button><button className="btn" form="form-expediente" type="submit" disabled={guardando}>{guardando ? "Guardando…" : "Guardar expediente"}</button></>}>
          <form id="form-expediente" onSubmit={crear}>
            {campo("codigo_expediente", "Número de crédito", true)}
            <div className="field"><label>Tipo de crédito</label>
              <select value={form.tipo_credito} onChange={(e) => setForm({ ...form, tipo_credito: e.target.value })}><option value="CONSUMO">Consumo</option><option value="OTROS">MYPE (Otros)</option></select>
            </div>
            {campo("nombres_cliente", "Nombres del cliente", true)}
            {campo("numero_documento_cliente", "Documento del cliente", true)}
            {campo("asesor_responsable", "Asesor responsable", true)}
            {campo("oficina", "Oficina")}
            {campo("telefono_cliente", "Teléfono")}
            {campo("direccion_domicilio", "Dirección del domicilio")}
            {campo("distrito", "Distrito")}
            {campo("provincia", "Provincia")}
            <div className="grid grid-2">{campo("latitud", "Latitud")}{campo("longitud", "Longitud")}</div>
            <div className="grid grid-2">{campo("monto_desembolso", "Monto desembolsado")}{campo("moneda", "Moneda")}</div>
          </form>
        </Drawer>
      ) : null}

      {historial ? (
        <Drawer title="Historial de cargas" subtitle="Cada archivo importado o validado queda registrado." onClose={() => setHistorial(null)}>
          {!historial.length ? <p className="subtle">Aún no hay cargas.</p> : (
            <table className="compact">
              <thead><tr><th>Cuándo</th><th>Archivo</th><th className="num">Filas</th><th className="num">Nuevos</th><th className="num">Error</th></tr></thead>
              <tbody>
                {historial.map((h) => (
                  <tr key={h.id_importacion}>
                    <td>{fechaHora(h.fecha_creacion)}<span className="sub">{h.actor || "-"}</span></td>
                    <td>{h.archivo}{h.simulacion ? <span className="sub">Solo validación</span> : null}</td>
                    <td className="num">{h.total_filas}</td><td className="num">{h.insertadas}</td><td className="num">{h.errores}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Drawer>
      ) : null}
    </>
  );
}
