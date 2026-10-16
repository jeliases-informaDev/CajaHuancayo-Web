import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQueryParam } from "../lib/useQueryParam";
import { request } from "../api";
import { Avatar, Badge, Empty, Field, Skeleton } from "../components/ui";
import { Drawer, Seg } from "../components/kit";
import ImportModal from "../components/ImportModal";
import { Icon } from "../components/icons";
import { useResumen } from "../lib/resumen";
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
      {error ? <div role="alert" className="error-box">{error}</div> : null}
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
  const [data, setData] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  // Filtros y página en la URL (se comparten, sobreviven a recargar y al botón "atrás"). Cambiar un filtro vuelve a la página 1.
  const [search, fijarBusqueda] = useQueryParam("q");
  const [tipoRaw, fijarTipo] = useQueryParam("tipo");
  const [estado, fijarEstado] = useQueryParam("estado");
  const [sinRaw, fijarSin] = useQueryParam("sin_coordenadas");
  const [paginaRaw, fijarPagina] = useQueryParam("pagina", "1");
  const tipo = tipoRaw as "" | "OTROS" | "CONSUMO";
  const sinUbicacion = sinRaw === "1";
  const pagina = Math.max(1, Number(paginaRaw) || 1);
  const setPagina = (siguiente: (p: number) => number) => fijarPagina(String(siguiente(pagina)));
  const setSearch = (v: string) => { fijarBusqueda(v); fijarPagina("1"); };
  const setTipo = (v: "" | "OTROS" | "CONSUMO") => { fijarTipo(v); fijarPagina("1"); };
  const setEstado = (v: string) => { fijarEstado(v); fijarPagina("1"); };
  const setSinUbicacion = (v: boolean) => { fijarSin(v ? "1" : ""); fijarPagina("1"); };
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [vista, setVista] = useState<number | null>(null);
  const [importando, setImportando] = useState(false);
  const [nuevo, setNuevo] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [guardando, setGuardando] = useState(false);
  const [historial, setHistorial] = useState<any[] | null>(null);
  const { resumen } = useResumen();

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

  const cerrarNuevo = () => {
    if (JSON.stringify(form) !== JSON.stringify(emptyForm) && !window.confirm("Hay datos sin guardar. ¿Cerrar y descartarlos?")) return;
    setNuevo(false); setForm(emptyForm);
  };
  const paginas = Math.max(1, Math.ceil(total / LIMITE));
  const campo = (k: keyof typeof emptyForm, etiqueta: string, requerido = false, tipoInput = "text") => (
    <Field label={etiqueta}><input name={k} required={requerido} type={tipoInput} autoComplete="off" spellCheck={false} inputMode={["latitud", "longitud", "monto_desembolso"].includes(k) ? "decimal" : undefined} value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} /></Field>
  );

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Expedientes</h1>
          <p>{total.toLocaleString("es-PE")} {total === 1 ? "expediente" : "expedientes"} {search || tipo || estado || sinUbicacion ? "con estos filtros" : "cargados"}.</p>
        </div>
        <div className="actions">
          <button className="btn quiet" onClick={verHistorial}><Icon name="reloj" size={17} />Historial de cargas</button>
          <button className="btn ghost" onClick={() => setNuevo(true)}><Icon name="mas" size={17} />Nuevo expediente</button>
          <button className="btn" onClick={() => setImportando(true)}><Icon name="subir" size={17} />Cargar archivo</button>
        </div>
      </div>

      {error ? <div role="alert" className="error-box">{error}</div> : null}

      {resumen ? (
        <div className="chips" role="group" aria-label="Filtrar por estado">
          {[
            { v: "", label: "Todos", n: resumen.expedientes.total, c: "var(--brand)" },
            { v: "PENDIENTE", label: "Sin asignar", n: resumen.expedientes.por_estado.PENDIENTE || 0, c: "var(--faint)" },
            { v: "ASIGNADO", label: "Asignados", n: resumen.expedientes.por_estado.ASIGNADO || 0, c: "var(--violet)" },
            { v: "VISITADO", label: "Visitados", n: resumen.expedientes.por_estado.VISITADO || 0, c: "var(--ok)" },
          ].map((x) => (
            <button key={x.v} type="button" className={`chipbtn${estado === x.v ? " on" : ""}`} aria-pressed={estado === x.v} onClick={() => setEstado(x.v)} style={{ ["--c" as any]: x.c }}>
              <i aria-hidden="true" /><b>{x.n.toLocaleString("es-PE")}</b>{x.label}
            </button>
          ))}
        </div>
      ) : null}

      <div className="filters">
        <div className="fgroup grow">
          <label className="lbl" htmlFor="buscar-exp">Buscar</label>
          <input id="buscar-exp" name="q" type="search" autoComplete="off" spellCheck={false} className="input" placeholder="Crédito, cliente, documento o asesor…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="fgroup">
          <span className="lbl">Tipo de crédito</span>
          <Seg label="Tipo de crédito" value={tipo} onChange={setTipo} options={[{ value: "", label: "Todos" }, { value: "OTROS", label: "MYPE" }, { value: "CONSUMO", label: "Consumo" }]} />
        </div>
        <div className="fgroup">
          <label className="lbl" htmlFor="estado-exp">Estado</label>
          <select id="estado-exp" name="estado" className="select" value={estado} onChange={(e) => setEstado(e.target.value)}>
            <option value="">Todos</option><option value="PENDIENTE">Pendiente</option><option value="ASIGNADO">Asignado</option><option value="VISITADO">Visitado</option><option value="CERRADO">Cerrado</option>
          </select>
        </div>
        <label className="check-inline"><input type="checkbox" checked={sinUbicacion} onChange={(e) => setSinUbicacion(e.target.checked)} />Solo sin coordenadas</label>
      </div>

      {loading && !data.length ? (
        <div className="table-wrap" style={{ padding: 18 }}>{[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} height={26} radius={8} style={{ display: "block", margin: "14px 0" }} />)}</div>
      ) : !data.length ? (
        <Empty tipo={search || tipo || estado || sinUbicacion ? "busqueda" : "vacio"} title="Sin expedientes" text={search || tipo || estado || sinUbicacion ? "Ningún expediente coincide con estos filtros." : "Carga un archivo de Excel para empezar."} />
      ) : (
        <>
          <div className="table-wrap" style={{ opacity: loading ? 0.55 : 1 }}>
            <table>
              <thead><tr><th scope="col">Crédito</th><th scope="col">Cliente</th><th scope="col">Tipo</th><th scope="col">Distrito</th><th scope="col">Asesor</th><th scope="col">Ubicación</th><th scope="col">Estado</th></tr></thead>
              <tbody>
                {data.map((x) => (
                  <tr key={x.id_expediente} className={`clickable${vista === x.id_expediente ? " selected" : ""}`} onClick={() => setVista(x.id_expediente)}>
                    <td className="code" translate="no">{x.codigo_expediente}</td>
                    <td><div className="who-cell"><Avatar nombre={x.nombres_cliente} /><div><button type="button" className="linklike" onClick={(e) => { e.stopPropagation(); setVista(x.id_expediente); }}>{x.nombres_cliente}</button><span className="sub" translate="no">{x.numero_documento_cliente}</span></div></div></td>
                    <td><span className={`tag ${x.tipo_credito === "OTROS" ? "aviso" : "base"}`}>{x.tipo_credito === "OTROS" ? "MYPE" : "Consumo"}</span></td>
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
            <button className="btn ghost small" disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)}><Icon name="izquierda" size={15} />Anterior</button>
            <button className="btn ghost small" disabled={pagina >= paginas} onClick={() => setPagina((p) => p + 1)}>Siguiente<Icon name="derecha" size={15} /></button>
          </div>
        </>
      )}

      {vista !== null ? <Vista id={vista} onClose={() => setVista(null)} /> : null}
      {importando ? <ImportModal onClose={() => setImportando(false)} onDone={cargar} /> : null}

      {nuevo ? (
        <Drawer title="Nuevo expediente" subtitle="Para cargas grandes usa «Cargar archivo»." onClose={cerrarNuevo}
          footer={<><button className="btn ghost" onClick={cerrarNuevo}>Cancelar</button><button className="btn" form="form-expediente" type="submit" disabled={guardando}>{guardando ? "Guardando…" : "Guardar expediente"}</button></>}>
          <form id="form-expediente" onSubmit={crear}>
            {campo("codigo_expediente", "Número de crédito", true)}
            <Field label="Tipo de crédito">
              <select name="tipo_credito" value={form.tipo_credito} onChange={(e) => setForm({ ...form, tipo_credito: e.target.value })}><option value="CONSUMO">Consumo</option><option value="OTROS">MYPE (Otros)</option></select>
            </Field>
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
              <thead><tr><th scope="col">Cuándo</th><th scope="col">Archivo</th><th scope="col" className="num">Filas</th><th scope="col" className="num">Nuevos</th><th scope="col" className="num">Error</th></tr></thead>
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
