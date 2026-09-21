import React, { useEffect, useState } from "react";
import { request } from "../api";
import { Badge, Button, Card, Field, SkeletonTable } from "../components/ui";

const emptyForm = { username: "", password: "", rol: "AUDITOR", nombres: "", apellidos: "", email: "", departamento: "" };

export default function UsuariosPage() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try { const r: any = await request("/api/usuarios"); setData(r.data); }
    catch (e: any) { setError(e.message); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const crear = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setSaving(true);
    try {
      await request("/api/usuarios", { method: "POST", body: JSON.stringify(form) });
      setShowForm(false); setForm(emptyForm);
      await load();
    } catch (e: any) { setError(e.message); } finally { setSaving(false); }
  };

  const resetMfa = async (id: string) => {
    try { await request(`/api/usuarios/${id}/mfa/reset`, { method: "POST" }); setOk("MFA restablecido."); await load(); }
    catch (e: any) { setError(e.message); }
  };
  const resetDevice = async (id: string) => {
    try { await request(`/api/usuarios/${id}/device/reset`, { method: "POST" }); setOk("Dispositivo liberado."); }
    catch (e: any) { setError(e.message); }
  };
  const desactivar = async (id: string, estado: string) => {
    try { await request(`/api/usuarios/${id}`, { method: "PATCH", body: JSON.stringify({ estado: estado === "ACTIVO" ? "INACTIVO" : "ACTIVO" }) }); await load(); }
    catch (e: any) { setError(e.message); }
  };

  return (
    <>
      <div className="page-header">
        <h1>Usuarios</h1>
        <p>Administradores, supervisores y auditores del sistema.</p>
      </div>
      {error ? <div className="error-box">{error}</div> : null}
      {ok ? <div className="error-box" style={{ background: "#eafbf5", color: "var(--success)" }}>{ok}</div> : null}
      <Card>
        <Button title={showForm ? "Cancelar" : "Nuevo usuario"} onClick={() => setShowForm((v) => !v)} />
        {showForm ? (
          <form onSubmit={crear} style={{ marginTop: 14 }}>
            <div className="grid grid-2">
              <Field label="Usuario"><input required value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} /></Field>
              <Field label="Contraseña (mín. 12 caracteres)"><input required type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></Field>
              <Field label="Rol">
                <select value={form.rol} onChange={(e) => setForm({ ...form, rol: e.target.value })}>
                  <option value="AUDITOR">Auditor</option><option value="SUPERVISOR">Supervisor</option><option value="ADMINISTRADOR">Administrador</option>
                </select>
              </Field>
              <Field label="Email"><input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
              <Field label="Nombres"><input value={form.nombres} onChange={(e) => setForm({ ...form, nombres: e.target.value })} /></Field>
              <Field label="Apellidos"><input value={form.apellidos} onChange={(e) => setForm({ ...form, apellidos: e.target.value })} /></Field>
              {form.rol === "AUDITOR" ? (
                <Field label="Departamento donde trabaja">
                  <input
                    value={form.departamento}
                    onChange={(e) => setForm({ ...form, departamento: e.target.value })}
                    placeholder="Ej. Junín, Lima"
                  />
                </Field>
              ) : null}
            </div>
            {form.rol === "AUDITOR" ? (
              <p className="muted" style={{ fontSize: 11.5, marginTop: -6, marginBottom: 12 }}>
                Si lo dejas vacío, el sistema no podrá impedir que le asignen clientes de otra ciudad.
              </p>
            ) : null}
            <Button type="submit" title={saving ? "Creando…" : "Crear usuario"} disabled={saving} />
          </form>
        ) : null}
      </Card>
      <Card>
        {loading ? <SkeletonTable rows={6} cols={5} /> : (
          <table>
            <thead><tr><th>Usuario</th><th>Nombre</th><th>Rol</th><th>Estado</th><th></th></tr></thead>
            <tbody>
              {data.map((u) => (
                <tr key={u.id}>
                  <td>@{u.username}</td>
                  <td>{u.nombres} {u.apellidos}</td>
                  <td><Badge label={u.rol} /></td>
                  <td><Badge label={u.estado} /></td>
                  <td>
                    <div className="row">
                      {u.rol !== "ADMINISTRADOR" ? <Button kind="ghost" title="Liberar dispositivo" onClick={() => resetDevice(u.id)} /> : null}
                      <Button kind="ghost" title="Reset MFA" onClick={() => resetMfa(u.id)} />
                      <Button kind={u.estado === "ACTIVO" ? "danger" : "primary"} title={u.estado === "ACTIVO" ? "Desactivar" : "Activar"} onClick={() => desactivar(u.id, u.estado)} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}
