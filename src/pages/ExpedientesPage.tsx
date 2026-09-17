import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_URL, getToken, request } from "../api";
import { Badge, Button, Card, Field, Loading } from "../components/ui";

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

  const load = async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ limit: "50", ...(search ? { search } : {}) });
      const r: any = await request(`/api/expedientes?${q}`);
      setData(r.data); setTotal(r.pagination.total);
    } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [search]);

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

  const importar = async (file: File) => {
    setImporting(true); setImportResult(null); setError("");
    try {
      const fd = new FormData();
      fd.append("archivo", file);
      const token = getToken();
      const response = await fetch(`${API_URL}/api/expedientes/importar`, {
        method: "POST", headers: { "x-client-platform": "web", ...(token ? { Authorization: "Bearer " + token } : {}) }, body: fd,
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "No se pudo importar el archivo.");
      setImportResult(body.data);
      await load();
    } catch (e: any) { setError(e.message); } finally { setImporting(false); }
  };

  return (
    <>
      <div className="page-header">
        <h1>Expedientes</h1>
        <p>{total} expediente(s) cargados en el sistema.</p>
      </div>
      {error ? <div className="error-box">{error}</div> : null}
      <Card>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <input placeholder="Buscar por código, cliente, documento o asesor…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ minWidth: 320, border: "1px solid var(--border)", borderRadius: 10, padding: "9px 11px" }} />
          <div className="row">
            <label className="btn ghost" style={{ cursor: "pointer" }}>
              {importing ? "Importando…" : "Importar Excel"}
              <input type="file" accept=".xlsx" hidden disabled={importing} onChange={(e) => e.target.files?.[0] && importar(e.target.files[0])} />
            </label>
            <Button title={showForm ? "Cancelar" : "Nuevo expediente"} onClick={() => setShowForm((v) => !v)} />
          </div>
        </div>
        {importResult ? (
          <div className="error-box" style={{ background: "#eafbf5", color: "var(--success)" }}>
            Import: {importResult.insertadas} nuevos, {importResult.actualizadas} actualizados, {importResult.omitidas} omitidos, {importResult.errores} con error.
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

      <Card>
        {loading ? <Loading /> : (
          <table>
            <thead><tr><th>Código</th><th>Cliente</th><th>Tipo</th><th>Distrito</th><th>Asesor</th><th>Estado</th></tr></thead>
            <tbody>
              {data.map((item) => (
                <tr key={item.id_expediente} className="clickable" onClick={() => navigate(`/expedientes/${item.id_expediente}`)}>
                  <td>{item.codigo_expediente}</td>
                  <td>{item.nombres_cliente}</td>
                  <td>{item.tipo_credito}</td>
                  <td>{item.distrito || "-"}</td>
                  <td>{item.asesor_responsable}</td>
                  <td><Badge label={item.estado} /></td>
                </tr>
              ))}
              {!data.length ? <tr><td colSpan={6} className="muted">Sin expedientes. Importa un Excel o crea uno manualmente.</td></tr> : null}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}
