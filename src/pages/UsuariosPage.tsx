import React, { useEffect, useMemo, useState } from "react";
import { request } from "../api";
import { Badge, Empty, Skeleton } from "../components/ui";
import { ActionMenu, Drawer, Seg } from "../components/kit";
import { dash, fechaHora } from "../lib/format";

const emptyForm = { username: "", password: "", rol: "AUDITOR", nombres: "", apellidos: "", email: "", departamento: "" };
const nombreDe = (u: any) => `${u.nombres || ""} ${u.apellidos || ""}`.trim();

export default function UsuariosPage() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [nuevo, setNuevo] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [rol, setRol] = useState<string>("");
  const [busqueda, setBusqueda] = useState("");

  const cargar = async () => {
    try { const r: any = await request("/api/usuarios"); setData(r.data); setError(""); }
    catch (e: any) { setError(e.message); } finally { setLoading(false); }
  };
  useEffect(() => { cargar(); }, []);

  const crear = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setSaving(true);
    try {
      await request("/api/usuarios", { method: "POST", body: JSON.stringify(form) });
      setNuevo(false); setForm(emptyForm); setOk("Usuario creado.");
      await cargar();
    } catch (x: any) { setError(x.message); } finally { setSaving(false); }
  };

  const accion = async (fn: () => Promise<unknown>, mensaje: string) => {
    try { await fn(); setError(""); setOk(mensaje); await cargar(); } catch (x: any) { setOk(""); setError(x.message); }
  };

  const q = busqueda.trim().toLowerCase();
  const visibles = useMemo(
    () => data.filter((u) => (!rol || u.rol === rol) && (!q || [u.username, u.nombres, u.apellidos, u.email].some((v) => String(v || "").toLowerCase().includes(q)))),
    [data, rol, q],
  );

  const campo = (k: keyof typeof emptyForm, etiqueta: string, tipo = "text", extra: Partial<React.InputHTMLAttributes<HTMLInputElement>> = {}) => (
    <div className="field"><label>{etiqueta}</label><input type={tipo} value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} {...extra} /></div>
  );

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Usuarios</h1>
          <p>Administradores, supervisores y auditores con acceso al sistema.</p>
        </div>
        <div className="actions"><button className="btn" onClick={() => { setNuevo(true); setOk(""); }}>Nuevo usuario</button></div>
      </div>
      {error ? <div className="error-box">{error}</div> : null}
      {ok ? <div className="callout ok">{ok}</div> : null}

      <div className="filters">
        <div className="fgroup grow"><label className="lbl" htmlFor="b-user">Buscar</label><input id="b-user" className="input" placeholder="Usuario, nombre o correo" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} /></div>
        <div className="fgroup"><span className="lbl">Rol</span>
          <Seg label="Rol" value={rol} onChange={setRol} options={[{ value: "", label: "Todos" }, { value: "AUDITOR", label: "Auditores" }, { value: "SUPERVISOR", label: "Supervisores" }, { value: "ADMINISTRADOR", label: "Administradores" }]} />
        </div>
      </div>

      {loading ? (
        <div style={{ paddingTop: 18 }}>{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} height={22} radius={3} style={{ display: "block", margin: "16px 0" }} />)}</div>
      ) : !visibles.length ? (
        <Empty title="Sin usuarios" text="Ningún usuario coincide con la búsqueda." />
      ) : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Usuario</th><th>Rol</th><th>Zona</th><th>Estado</th><th>Último acceso</th><th style={{ width: 48 }}></th></tr></thead>
            <tbody>
              {visibles.map((u) => (
                <tr key={u.id}>
                  <td><b style={{ fontWeight: 500 }}>{nombreDe(u) || u.username}</b><span className="sub">@{u.username}</span></td>
                  <td><Badge label={u.rol} /></td>
                  <td>{dash(u.departamento)}</td>
                  <td><Badge label={u.estado} /></td>
                  <td>{u.ultimo_acceso ? fechaHora(u.ultimo_acceso) : <span className="muted">Nunca</span>}</td>
                  <td style={{ textAlign: "right" }}>
                    <ActionMenu
                      header={{ title: nombreDe(u) || u.username, sub: `@${u.username}` }}
                      items={[
                        { label: "Liberar dispositivo", hidden: u.rol === "ADMINISTRADOR", onClick: () => accion(() => request(`/api/usuarios/${u.id}/device/reset`, { method: "POST" }), "Dispositivo liberado: podrá iniciar sesión desde otro teléfono.") },
                        { label: "Restablecer verificación en dos pasos", onClick: () => { if (window.confirm(`¿Restablecer la verificación en dos pasos de @${u.username}? Tendrá que configurarla de nuevo.`)) accion(() => request(`/api/usuarios/${u.id}/mfa/reset`, { method: "POST" }), "Verificación en dos pasos restablecida."); } },
                        u.estado === "ACTIVO"
                          ? { label: "Desactivar usuario", tone: "bad", separatorBefore: true, onClick: () => { if (window.confirm(`¿Desactivar a @${u.username}? No podrá iniciar sesión y sus casos activos se liberan.`)) accion(() => request(`/api/usuarios/${u.id}`, { method: "PATCH", body: JSON.stringify({ estado: "INACTIVO" }) }), "Usuario desactivado."); } }
                          : { label: "Activar usuario", separatorBefore: true, onClick: () => accion(() => request(`/api/usuarios/${u.id}`, { method: "PATCH", body: JSON.stringify({ estado: "ACTIVO" }) }), "Usuario activado.") },
                      ]}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {nuevo ? (
        <Drawer title="Nuevo usuario" subtitle="La contraseña debe tener al menos 12 caracteres." onClose={() => setNuevo(false)}
          footer={<><button className="btn ghost" onClick={() => setNuevo(false)}>Cancelar</button><button className="btn" type="submit" form="form-usuario" disabled={saving}>{saving ? "Creando…" : "Crear usuario"}</button></>}>
          <form id="form-usuario" onSubmit={crear}>
            {campo("username", "Usuario", "text", { required: true, autoCapitalize: "none" })}
            {campo("password", "Contraseña", "password", { required: true, minLength: 12, autoComplete: "new-password" })}
            <div className="field"><label>Rol</label>
              <select value={form.rol} onChange={(e) => setForm({ ...form, rol: e.target.value })}><option value="AUDITOR">Auditor de campo</option><option value="SUPERVISOR">Supervisor</option><option value="ADMINISTRADOR">Administrador</option></select>
            </div>
            {campo("nombres", "Nombres")}
            {campo("apellidos", "Apellidos")}
            {campo("email", "Correo electrónico", "email")}
            {form.rol === "AUDITOR" ? (
              <>
                {campo("departamento", "Departamento donde trabaja", "text", { placeholder: "Ej. Junín, Lima" })}
                <p className="subtle" style={{ marginTop: -6 }}>Si lo dejas vacío, el sistema no podrá impedir que le asignen clientes de otra ciudad.</p>
              </>
            ) : null}
          </form>
        </Drawer>
      ) : null}
    </>
  );
}
