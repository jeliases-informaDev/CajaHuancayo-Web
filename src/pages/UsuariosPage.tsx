import React, { useEffect, useMemo, useState } from "react";
import { request } from "../api";
import { Avatar, Badge, Empty, Field, Skeleton } from "../components/ui";
import { Icon } from "../components/icons";
import { ActionMenu, Drawer, Seg } from "../components/kit";
import { dash, fechaHora } from "../lib/format";
import { useQueryParam } from "../lib/useQueryParam";

const emptyForm = { username: "", password: "", rol: "AUDITOR", nombres: "", apellidos: "", email: "", departamento: "" };
const nombreDe = (u: any) => `${u.nombres || ""} ${u.apellidos || ""}`.trim();

export default function UsuariosPage() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [nuevo, setNuevo] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [mfa, setMfa] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rol, setRol] = useQueryParam("rol");
  const [busqueda, setBusqueda] = useQueryParam("q");

  const cargar = async () => {
    try { const r: any = await request("/api/usuarios"); setData(r.data); setError(""); }
    catch (e: any) { setError(e.message); } finally { setLoading(false); }
  };
  useEffect(() => { cargar(); }, []);

  const cerrarNuevo = () => {
    if (JSON.stringify(form) !== JSON.stringify(emptyForm) && !window.confirm("Hay datos sin guardar. ¿Cerrar y descartarlos?")) return;
    setNuevo(false); setForm(emptyForm); setMfa(true);
  };

  const crear = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setSaving(true);
    try {
      await request("/api/usuarios", { method: "POST", body: JSON.stringify({ ...form, mfa_habilitado: mfa }) });
      setNuevo(false); setForm(emptyForm); setMfa(true); setOk("Usuario creado.");
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
    <Field label={etiqueta}><input name={k} type={tipo} autoComplete="off" spellCheck={false} value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} {...extra} /></Field>
  );

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Usuarios</h1>
          <p>Administradores, supervisores y auditores con acceso al sistema.</p>
        </div>
        <div className="actions"><button className="btn" onClick={() => { setNuevo(true); setOk(""); }}><Icon name="mas" size={17} />Nuevo usuario</button></div>
      </div>
      {error ? <div role="alert" className="error-box">{error}</div> : null}
      {ok ? <div role="status" className="callout ok">{ok}</div> : null}

      <div className="filters">
        <div className="fgroup grow"><label className="lbl" htmlFor="b-user">Buscar</label><input id="b-user" name="q" type="search" autoComplete="off" spellCheck={false} className="input" placeholder="Usuario, nombre o correo…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} /></div>
        <div className="fgroup"><span className="lbl">Rol</span>
          <Seg label="Rol" value={rol} onChange={setRol} options={[{ value: "", label: "Todos" }, { value: "AUDITOR", label: "Auditores" }, { value: "SUPERVISOR", label: "Supervisores" }, { value: "ADMINISTRADOR", label: "Administradores" }]} />
        </div>
      </div>

      {loading ? (
        <div className="table-wrap" style={{ padding: 18 }}>{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} height={26} radius={8} style={{ display: "block", margin: "14px 0" }} />)}</div>
      ) : !visibles.length ? (
        <Empty tipo="busqueda" title="Sin usuarios" text="Ningún usuario coincide con la búsqueda." />
      ) : (
        <div className="table-wrap">
          <table>
            <thead><tr><th scope="col">Usuario</th><th scope="col">Rol</th><th scope="col">Zona</th><th scope="col">Estado</th><th scope="col">Último acceso</th><th scope="col" style={{ width: 48 }}></th></tr></thead>
            <tbody>
              {visibles.map((u) => (
                <tr key={u.id}>
                  <td><div className="who-cell"><Avatar nombre={nombreDe(u) || u.username} /><div><b style={{ fontWeight: 500 }}>{nombreDe(u) || u.username}</b><span className="sub">@{u.username}</span></div></div></td>
                  <td><Badge label={u.rol} /></td>
                  <td>{dash(u.departamento)}</td>
                  <td><Badge label={u.estado} /></td>
                  <td>{u.ultimo_acceso ? fechaHora(u.ultimo_acceso) : <span className="muted">Nunca</span>}</td>
                  <td style={{ textAlign: "right" }}>
                    <ActionMenu
                      header={{ title: nombreDe(u) || u.username, sub: `@${u.username}` }}
                      items={[
                        { label: "Liberar dispositivo", hidden: u.rol === "ADMINISTRADOR", onClick: () => { if (window.confirm(`¿Liberar el dispositivo de @${u.username}? Podrá iniciar sesión desde otro teléfono.`)) accion(() => request(`/api/usuarios/${u.id}/device/reset`, { method: "POST" }), "Dispositivo liberado: podrá iniciar sesión desde otro teléfono."); } },
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
        <Drawer title="Nuevo usuario" subtitle="La contraseña debe tener al menos 12 caracteres." onClose={cerrarNuevo}
          footer={<><button className="btn ghost" onClick={cerrarNuevo}>Cancelar</button><button className="btn" type="submit" form="form-usuario" disabled={saving}>{saving ? "Creando…" : "Crear usuario"}</button></>}>
          <form id="form-usuario" onSubmit={crear}>
            {campo("username", "Usuario", "text", { required: true, autoCapitalize: "none" })}
            {campo("password", "Contraseña", "password", { required: true, minLength: 12, autoComplete: "new-password", spellCheck: false })}
            <Field label="Rol">
              <select name="rol" value={form.rol} onChange={(e) => setForm({ ...form, rol: e.target.value })}><option value="AUDITOR">Auditor de campo</option><option value="SUPERVISOR">Supervisor</option><option value="ADMINISTRADOR">Administrador</option></select>
            </Field>
            {campo("nombres", "Nombres")}
            {campo("apellidos", "Apellidos")}
            {campo("email", "Correo electrónico", "email")}
            {form.rol === "AUDITOR" ? (
              <>
                {campo("departamento", "Departamento donde trabaja", "text", { placeholder: "Ej. Junín, Lima" })}
                <p className="subtle" style={{ marginTop: -6 }}>Si lo dejas vacío, el sistema no podrá impedir que le asignen clientes de otra ciudad.</p>
              </>
            ) : null}
            <label className="check-inline" style={{ height: "auto", marginTop: 12, alignItems: "flex-start" }}>
              <input type="checkbox" name="mfa_habilitado" checked={mfa} onChange={(e) => setMfa(e.target.checked)} style={{ marginTop: 3 }} />
              <span>Exigir verificación en dos pasos (recomendado). En su primer ingreso configurará una app autenticadora.</span>
            </label>
          </form>
        </Drawer>
      ) : null}
    </>
  );
}
