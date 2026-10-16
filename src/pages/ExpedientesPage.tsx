import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_URL, getToken, request } from "../api";
import { Badge, Button, Card, Empty, Field, SkeletonTable } from "../components/ui";
import { ADVERTENCIAS, fechaHora } from "../lib/format";

const emptyForm = {
  codigo_expediente: "", tipo_credito: "CONSUMO", oficina: "",
  numero_documento_cliente: "", nombres_cliente: "", telefono_cliente: "",
  direccion_domicilio: "", distrito: "", provincia: "", latitud: "", longitud: "",
  asesor_responsable: "", monto_desembolso: "", moneda: "PEN",
};

export default function ExpedientesPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const [progreso, setProgreso] = useState<any>(null);
  const [autoasignable, setAutoasignable] = useState(false);
  const [tipo, setTipo] = useState("");
  const [sinUbicacion, setSinUbicacion] = useState(false);
  const [historial, setHistorial] = useState<any[] | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ limit: "50", ...(search ? { search } : {}), ...(tipo ? { tipo_credito: tipo } : {}), ...(sinUbicacion ? { sin_ubicacion: "true" } : {}) });
      const r: any = await request(`/api/expedientes?${q}`);
      setData(r.data); setTotal(r.pagination.total);
    } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [search, tipo, sinUbicacion]);

  const verHistorial = async () => {
    if (historial) { setHistorial(null); return; }
    try { const r: any = await request("/api/expedientes/importaciones?limit=15"); setHistorial(r.data); } catch (e: any) { setError(e.message); }
  };

  const crear = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      const payload: any = { ...form };
      if (!payload.latitud) delete payload.latitud; else payload.latitud = Number(payload.latitud);
      if (!payload.longitud) delete payload.longitud; else payload.longitud = Number(payload.longitud);
      if (!payload.monto_desembolso) delete payload.monto_desembolso; else payload.monto_desembolso = Number(payload.monto_desembolso);
      await request("/api/expedientes", { method: "POST", body: JSON.stringify(payload) });
      setShowForm(false); setForm(emptyForm);
      await load();
    } catch (e: any) { setError(e.message); }
  };

  // La carga corre en segundo plano en el servidor: se sube el archivo y se consulta el avance.
  // "simular" valida todo el archivo y devuelve el reporte sin guardar nada.
  const importar = async (file: File, simular: boolean) => {
    setImporting(true); setImportResult(null); setProgreso(null); setError("");
    try {
      const fd = new FormData();
      fd.append("archivo", file);
      const token = getToken();
      const q = new URLSearchParams({ simular: String(simular), autoasignable: String(autoasignable) });
      const response = await fetch(`${API_URL}/api/expedientes/importar?${q}`, {
        method: "POST", headers: { "x-client-platform": "web", ...(token ? { Authorization: "Bearer " + token } : {}) }, body: fd,
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "No se pudo importar el archivo.");
      const inicio = body.data;
      let actual: any = inicio;
      for (;;) {
        await new Promise((r) => setTimeout(r, 1500));
        actual = (await request<any>(`/api/expedientes/importaciones/${inicio.id_importacion}`)).data;
        setProgreso(actual);
        if (actual.estado !== "PROCESANDO") break;
      }
      setImportResult({ ...actual, archivo_repetido: inicio.archivo_repetido });
      if (!simular) await load();
    } catch (e: any) { setError(e.message); } finally { setImporting(false); setProgreso(null); }
  };

  const liberar = async (idImportacion: string) => {
    try {
      const r: any = await request(`/api/expedientes/importaciones/${idImportacion}/liberar`, { method: "POST" });
      setError("");
      setImportResult((prev: any) => (prev ? { ...prev, liberados: r.data.liberados } : prev));
      await load();
    } catch (e: any) { setError(e.message); }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Expedientes</h1>
          <p>{total.toLocaleString("es-PE")} expedientes cargados en el sistema.</p>
        </div>
        <div className="row">
<label className="btn ghost" style={{ cursor: "pointer" }} title="Revisa todo el archivo y muestra el reporte sin guardar nada">
              {importing ? "Procesando…" : "Validar archivo (sin guardar)"}
              <input type="file" accept=".xlsx" hidden disabled={importing} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) importar(f, true); }} />
            </label>
            <label className="btn ghost" style={{ cursor: "pointer" }}>
              {importing ? "Procesando…" : "Importar y guardar"}
              <input type="file" accept=".xlsx" hidden disabled={importing} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) importar(f, false); }} />
            </label>
            <Button title={showForm ? "Cancelar" : "Nuevo expediente"} onClick={() => setShowForm((v) => !v)} />
        </div>
      </div>
      {error ? <div className="error-box">{error}</div> : null}
      <Card>
        <div className="toolbar">
          <input
            placeholder="Buscar por código, cliente, documento o asesor…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input" style={{ flex: "1 1 260px", minWidth: 0, maxWidth: 420 }}
          />
        </div>
        <label className="subtle" style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 12 }}>
          <input type="checkbox" checked={autoasignable} onChange={(e) => setAutoasignable(e.target.checked)} />
          Al importar, dejar los expedientes nuevos disponibles para que los auditores de su zona los tomen por su cuenta (si no, solo un supervisor los asigna)
        </label>
        {importing ? <div className="callout info" style={{ marginTop: 10 }}>Procesando el archivo en el servidor… {progreso ? `${progreso.procesadas} filas revisadas.` : "iniciando."} Puedes esperar aquí; no cierres la página.</div> : null}
        <div className="row" style={{ marginTop: 12 }}>
          <button type="button" className={`chip${tipo === "" ? " on" : ""}`} onClick={() => setTipo("")}>Todos</button>
          <button type="button" className={`chip${tipo === "OTROS" ? " on" : ""}`} onClick={() => setTipo(tipo === "OTROS" ? "" : "OTROS")}>MYPE</button>
          <button type="button" className={`chip${tipo === "CONSUMO" ? " on" : ""}`} onClick={() => setTipo(tipo === "CONSUMO" ? "" : "CONSUMO")}>Consumo</button>
          <button type="button" className={`chip${sinUbicacion ? " on" : ""}`} onClick={() => setSinUbicacion((v) => !v)}>Sin coordenadas</button>
          <button type="button" className="chip" style={{ marginLeft: "auto" }} onClick={verHistorial}>{historial ? "Ocultar importaciones" : "Historial de importaciones"}</button>
        </div>
        {importResult ? (
          <div style={{ marginTop: 12 }}>
            {importResult.simulacion ? <div className="callout info"><b>Validación sin guardar:</b> esto es lo que pasaría al importar este archivo. No se guardó ningún dato.</div> : null}
            {importResult.archivo_repetido ? <div className="callout aviso">Este mismo archivo ya se importó el {fechaHora(importResult.archivo_repetido.fecha_creacion)}. Si no cambió, todo saldrá como «sin cambios».</div> : null}
            {importResult.estado === "ERROR" || importResult.estado === "INTERRUMPIDA" ? <div className="error-box">La importación no terminó ({importResult.estado.toLowerCase()}). Revisa el detalle abajo.</div> : null}
            <div className={`callout ${importResult.errores ? "aviso" : "ok"}`}>
              {importResult.simulacion ? "Resultado de la validación" : "Importación terminada"} ({importResult.formato === "CORE_262" ? "base MYPE del core" : "plantilla simple"}): {importResult.procesadas} filas · {importResult.insertadas} nuevos · {importResult.actualizadas} actualizados · {importResult.omitidas} omitidos o sin cambios · {importResult.errores} con error.
            </div>
            {!importResult.simulacion && importResult.insertadas > 0 && !autoasignable ? (
              <div className="callout info">
                Los {importResult.insertadas} expedientes nuevos solo los asigna un supervisor. {importResult.liberados != null ? `Se liberaron ${importResult.liberados} para que los auditores los tomen.` : null}
                {importResult.liberados == null ? <> <button type="button" className="tag base" style={{ border: "none", cursor: "pointer" }} onClick={() => liberar(importResult.id_importacion)}>Liberarlos a los auditores</button></> : null}
              </div>
            ) : null}
            {Object.keys(importResult.advertencias || {}).length ? (
              <div className="callout aviso">
                <b>Avisos de calidad del dato</b>
                {Object.entries(importResult.advertencias).map(([codigo, cantidad]: any) => (
                  <div key={codigo}>• {cantidad} fila(s): {ADVERTENCIAS[codigo] || codigo}</div>
                ))}
              </div>
            ) : null}
            {importResult.detalle_error?.filter((d: any) => d.resultado === "ERROR" || d.resultado === "OMITIDA").length ? (
              <details>
                <summary className="subtle" style={{ cursor: "pointer" }}>Ver filas omitidas o con error</summary>
                <table className="compact" style={{ marginTop: 8 }}>
                  <thead><tr><th>Hoja</th><th>Fila</th><th>Crédito</th><th>Resultado</th><th>Motivo</th></tr></thead>
                  <tbody>
                    {importResult.detalle_error.filter((d: any) => d.resultado === "ERROR" || d.resultado === "OMITIDA").slice(0, 30).map((d: any, i: number) => (
                      <tr key={i}><td>{d.hoja}</td><td>{d.fila}</td><td>{d.codigo || "-"}</td><td>{d.resultado}</td><td>{d.motivo}</td></tr>
                    ))}
                  </tbody>
                </table>
              </details>
            ) : null}
          </div>
        ) : null}
        {historial ? (
          <div style={{ marginTop: 12 }}>
            <table className="compact">
              <thead><tr><th>Fecha</th><th>Archivo</th><th>Por</th><th className="num">Filas</th><th className="num">Nuevos</th><th className="num">Actualiz.</th><th className="num">Omitidos</th><th className="num">Errores</th><th>Huella</th></tr></thead>
              <tbody>
                {historial.map((h) => (
                  <tr key={h.id_importacion}>
                    <td>{fechaHora(h.fecha_creacion)}</td><td>{h.archivo}{h.simulacion ? <> <span className="tag aviso">validación</span></> : null}</td><td>{h.actor || "-"}</td><td className="num">{h.total_filas}</td>
                    <td className="num">{h.insertadas}</td><td className="num">{h.actualizadas}</td><td className="num">{h.omitidas}</td><td className="num">{h.errores}</td>
                    <td><code style={{ fontSize: 11 }}>{h.archivo_sha256 ? h.archivo_sha256.slice(0, 10) : "-"}</code></td>
                  </tr>
                ))}
                {!historial.length ? <tr><td colSpan={9} className="subtle">Aún no hay importaciones.</td></tr> : null}
              </tbody>
            </table>
          </div>
        ) : null}
      </Card>

      {showForm ? (
        <Card>
          <p className="section-title">Nuevo expediente</p>
          <form onSubmit={crear}>
            <div className="grid grid-2">
              <Field label="Código de expediente"><input required value={form.codigo_expediente} onChange={(e) => setForm({ ...form, codigo_expediente: e.target.value })} /></Field>
              <Field label="Tipo de crédito">
                <select value={form.tipo_credito} onChange={(e) => setForm({ ...form, tipo_credito: e.target.value })}>
                  <option value="CONSUMO">Consumo</option><option value="OTROS">Otros (MYPE)</option>
                </select>
              </Field>
              <Field label="Oficina"><input value={form.oficina} onChange={(e) => setForm({ ...form, oficina: e.target.value })} /></Field>
              <Field label="Asesor responsable"><input required value={form.asesor_responsable} onChange={(e) => setForm({ ...form, asesor_responsable: e.target.value })} /></Field>
              <Field label="Documento del cliente"><input required value={form.numero_documento_cliente} onChange={(e) => setForm({ ...form, numero_documento_cliente: e.target.value })} /></Field>
              <Field label="Nombres del cliente"><input required value={form.nombres_cliente} onChange={(e) => setForm({ ...form, nombres_cliente: e.target.value })} /></Field>
              <Field label="Teléfono"><input value={form.telefono_cliente} onChange={(e) => setForm({ ...form, telefono_cliente: e.target.value })} /></Field>
              <Field label="Dirección"><input value={form.direccion_domicilio} onChange={(e) => setForm({ ...form, direccion_domicilio: e.target.value })} /></Field>
              <Field label="Distrito"><input value={form.distrito} onChange={(e) => setForm({ ...form, distrito: e.target.value })} /></Field>
              <Field label="Provincia"><input value={form.provincia} onChange={(e) => setForm({ ...form, provincia: e.target.value })} /></Field>
              <Field label="Latitud"><input value={form.latitud} onChange={(e) => setForm({ ...form, latitud: e.target.value })} /></Field>
              <Field label="Longitud"><input value={form.longitud} onChange={(e) => setForm({ ...form, longitud: e.target.value })} /></Field>
              <Field label="Monto desembolsado"><input value={form.monto_desembolso} onChange={(e) => setForm({ ...form, monto_desembolso: e.target.value })} /></Field>
              <Field label="Moneda"><input value={form.moneda} onChange={(e) => setForm({ ...form, moneda: e.target.value })} /></Field>
            </div>
            <Button type="submit" title="Guardar expediente" />
          </form>
        </Card>
      ) : null}

      {loading ? (
        <Card><SkeletonTable rows={7} cols={6} /></Card>
      ) : !data.length ? (
        <Empty title="Sin expedientes" text="Importa un Excel o crea uno manualmente para empezar." />
      ) : (
        <Card>
          <table>
            <thead><tr><th>Código</th><th>Cliente</th><th>Tipo</th><th>Distrito</th><th>Asesor</th><th>Ubicación</th><th>Estado</th></tr></thead>
            <tbody>
              {data.map((item) => (
                <tr key={item.id_expediente} className="clickable" onClick={() => navigate(`/expedientes/${item.id_expediente}`)}>
                  <td>{item.codigo_expediente}</td>
                  <td>{item.nombres_cliente}</td>
                  <td><span className={`tag ${item.tipo_credito === "OTROS" ? "aviso" : "base"}`}>{item.tipo_credito === "OTROS" ? "MYPE" : "Consumo"}</span></td>
                  <td>{item.distrito || "-"}</td>
                  <td>{item.asesor_responsable}</td>
                  <td>{item.latitud != null && item.longitud != null ? <span className="tag campo">Con coordenadas</span> : <span className="tag alerta">Sin coordenadas</span>}</td>
                  <td><Badge label={item.estado} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}
