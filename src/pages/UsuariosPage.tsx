import React, { useEffect, useMemo, useState } from "react";
import { request } from "../api";
import { useAuth } from "../AuthContext";
import { Avatar, Badge, Empty, Field, Skeleton } from "../components/ui";
import { Icon } from "../components/icons";
import { ActionMenu, Drawer, Seg } from "../components/kit";
import { fechaHora } from "../lib/format";
import { Link } from "react-router-dom";
import { BorrarEmpleadosModal, BorrarUsuarioModal } from "../components/limpieza";
import { QuitarCasosModal } from "../components/quitarcasos";
import { useModoPruebas } from "../lib/limpieza";
import { useQueryParam } from "../lib/useQueryParam";
import { JornadasDrawer } from "../components/jornadas";

const emptyForm = { username: "", password: "", rol: "AUDITOR", nombres: "", apellidos: "", email: "" };
// La zona de trabajo no se escribe: la toma el celular del auditor al iniciar su jornada (ver «Ver jornadas»). No limita qué expedientes puede tomar.
const AYUDA_ZONA = "Su zona de trabajo no se escribe aquí: queda sola cuando inicia su jornada desde el celular (se toma con el GPS en ese momento y se guarda el historial). No limita qué expedientes puede tomar: puede elegir de cualquier distrito.";
const nombreDe = (u: any) => `${u.nombres || ""} ${u.apellidos || ""}`.trim();

// Zona de trabajo: la de su última jornada. Quien nunca inició una muestra la zona anterior (escrita a mano, si la tenía) con un aviso.
function ZonaDeTrabajo({ u }: { u: any }) {
  if (u.zona) return <><span>{u.zona.texto || <span className="muted">Posición sin nombre de zona</span>}</span><span className="sub">Jornada del {fechaHora(u.zona.en)}</span></>;
  if (u.rol !== "AUDITOR") return <span className="muted">—</span>;
  return <><span className="muted">{u.departamento ? `${u.departamento} (zona anterior)` : "—"}</span><span className="sub">Aún no inicia una jornada</span></>;
}

export default function UsuariosPage() {
  const { user, empresa } = useAuth();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [nuevo, setNuevo] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [mfa, setMfa] = useState(true);
  const [saving, setSaving] = useState(false);
  const [clave, setClave] = useState<any | null>(null); // usuario al que se le cambia la contraseña
  const [nuevaClave, setNuevaClave] = useState("");
  const [jornadasDe, setJornadasDe] = useState<any | null>(null); // auditor del que se ve el historial de jornadas
  const [rol, setRol] = useQueryParam("rol");
  const [busqueda, setBusqueda] = useQueryParam("q");
  const { activo: modoPruebas } = useModoPruebas(true); // esta pantalla es solo del administrador
  const [borrarA, setBorrarA] = useState<any | null>(null); // usuario que se va a borrar por completo
  const [borrarTodos, setBorrarTodos] = useState(false);
  const [quitarCasosA, setQuitarCasosA] = useState<any | null>(null); // asesor al que se le quitan los casos abiertos

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

  const cambiarClave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clave) return;
    setError(""); setSaving(true);
    try {
      await request(`/api/usuarios/${clave.id}`, { method: "PATCH", body: JSON.stringify({ password: nuevaClave }) });
      setOk(`Contraseña de @${clave.username} actualizada. Sus sesiones abiertas se cerraron.`); setClave(null); setNuevaClave("");
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
          <p>Administradores, supervisores y auditores con acceso al sistema.{!modoPruebas ? <> Para borrar usuarios de prueba, enciende el <Link to="/seguridad">modo pruebas</Link> en Seguridad.</> : null}</p>
        </div>
        <div className="actions">
          {modoPruebas ? <button className="btn ghost mp-borrar" onClick={() => setBorrarTodos(true)}>Borrar a todos los asesores y supervisores…</button> : null}
          <button className="btn" onClick={() => { setNuevo(true); setOk(""); }}><Icon name="mas" size={17} />Nuevo usuario</button>
        </div>
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
            <thead><tr><th scope="col">Usuario</th><th scope="col">Rol</th><th scope="col">Zona de trabajo</th><th scope="col">Estado</th><th scope="col">Último acceso</th><th scope="col">Términos</th><th scope="col" style={{ width: 48 }}></th></tr></thead>
            <tbody>
              {visibles.map((u) => (
                <tr key={u.id}>
                  <td><div className="who-cell"><Avatar nombre={nombreDe(u) || u.username} /><div><b style={{ fontWeight: 500 }}>{nombreDe(u) || u.username}</b><span className="sub">@{u.username}</span></div></div></td>
                  <td><Badge label={u.rol} /></td>
                  <td><ZonaDeTrabajo u={u} /></td>
                  <td><Badge label={u.estado} /></td>
                  <td>{u.ultimo_acceso ? fechaHora(u.ultimo_acceso) : <span className="muted">Nunca</span>}</td>
                  <td>{u.rol === "UNIVERSAL" ? <span className="muted">No aplica</span> : u.terminos ? <span className="state ok" title={`Aceptados desde ${u.terminos.plataforma === "MOVIL" ? "la app" : "el panel"}`}>v{u.terminos.version} · {fechaHora(u.terminos.fecha)}</span> : <span className="state warn">Pendientes</span>}</td>
                  <td style={{ textAlign: "right" }}>
                    <ActionMenu
                      header={{ title: nombreDe(u) || u.username, sub: `@${u.username}` }}
                      items={[
                        { label: "Liberar dispositivo", hidden: u.rol === "ADMINISTRADOR", onClick: () => { if (window.confirm(`¿Liberar el dispositivo de @${u.username}? Podrá iniciar sesión desde otro teléfono.`)) accion(() => request(`/api/usuarios/${u.id}/device/reset`, { method: "POST" }), "Dispositivo liberado: podrá iniciar sesión desde otro teléfono."); } },
                        { label: "Quitar casos…", hidden: u.rol !== "AUDITOR", onClick: () => { setQuitarCasosA(u); setOk(""); } },
                        { label: "Ver jornadas", hidden: u.rol !== "AUDITOR", onClick: () => { setJornadasDe(u); setOk(""); } },
                        { label: "Cambiar contraseña", onClick: () => { setClave(u); setNuevaClave(""); setOk(""); } },
                        { label: "Restablecer verificación en dos pasos", onClick: () => { if (window.confirm(`¿Restablecer la verificación en dos pasos de @${u.username}? Tendrá que configurarla de nuevo.`)) accion(() => request(`/api/usuarios/${u.id}/mfa/reset`, { method: "POST" }), "Verificación en dos pasos restablecida."); } },
                        u.estado === "ACTIVO"
                          ? { label: "Desactivar usuario", tone: "bad", separatorBefore: true, onClick: () => { if (window.confirm(`¿Desactivar a @${u.username}? No podrá iniciar sesión y sus casos activos se liberan.`)) accion(() => request(`/api/usuarios/${u.id}`, { method: "PATCH", body: JSON.stringify({ estado: "INACTIVO" }) }), "Usuario desactivado."); } }
                          : { label: "Activar usuario", separatorBefore: true, onClick: () => accion(() => request(`/api/usuarios/${u.id}`, { method: "PATCH", body: JSON.stringify({ estado: "ACTIVO" }) }), "Usuario activado.") },
                        { label: "Eliminar definitivamente", tone: "bad", hidden: !modoPruebas || u.id === user?.id, onClick: () => setBorrarA(u) },
                      ]}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {quitarCasosA ? (
        <QuitarCasosModal auditor={{ id: quitarCasosA.id, nombre: nombreDe(quitarCasosA) || quitarCasosA.username }} onClose={() => setQuitarCasosA(null)}
          onHecho={(r) => { const u = quitarCasosA; setQuitarCasosA(null); setOk(`Se ${r.quitadas === 1 ? "quitó 1 caso" : `quitaron ${r.quitadas.toLocaleString("es-PE")} casos`} a @${u.username}.`); }} />
      ) : null}
      {borrarA ? <BorrarUsuarioModal usuario={borrarA} onClose={() => setBorrarA(null)} onHecho={() => { const u = borrarA; setBorrarA(null); setOk(`@${u.username} se borró por completo.`); cargar(); }} /> : null}
      {borrarTodos ? <BorrarEmpleadosModal onClose={() => setBorrarTodos(false)} onHecho={() => { setBorrarTodos(false); setOk("Listo: se borraron los asesores y supervisores."); cargar(); }} /> : null}

      {clave ? (
        <Drawer title="Cambiar contraseña" subtitle={`@${clave.username} · mínimo 12 caracteres. Se cerrarán sus sesiones abiertas.`} onClose={() => setClave(null)}
          footer={<><button className="btn ghost" onClick={() => setClave(null)}>Cancelar</button><button className="btn" type="submit" form="form-clave" disabled={saving}>{saving ? "Guardando…" : "Guardar contraseña"}</button></>}>
          <form id="form-clave" onSubmit={cambiarClave}>
            <Field label="Nueva contraseña"><input name="password" type="password" autoComplete="new-password" spellCheck={false} required minLength={12} maxLength={128} value={nuevaClave} onChange={(e) => setNuevaClave(e.target.value)} /></Field>
          </form>
        </Drawer>
      ) : null}

      {jornadasDe ? <JornadasDrawer usuario={{ id: jornadasDe.id, nombre: nombreDe(jornadasDe), username: jornadasDe.username }} onClose={() => setJornadasDe(null)} /> : null}

      {nuevo ? (
        <Drawer title="Nuevo usuario" subtitle="La contraseña debe tener al menos 12 caracteres." onClose={cerrarNuevo}
          footer={<><button className="btn ghost" onClick={cerrarNuevo}>Cancelar</button><button className="btn" type="submit" form="form-usuario" disabled={saving}>{saving ? "Creando…" : "Crear usuario"}</button></>}>
          <form id="form-usuario" onSubmit={crear}>
            {empresa?.prefijo && form.rol !== "UNIVERSAL" ? (
              // La abreviatura de la empresa va fija delante: el usuario escribe solo su parte (jorge → arq.jorge).
              <Field label={"Usuario (quedará como " + empresa.prefijo + ".…)"}>
                <div className="prefijo-fijo"><span translate="no" aria-hidden="true">{empresa.prefijo}.</span><input name="username" type="text" autoComplete="off" spellCheck={false} required autoCapitalize="none" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="jorge" /></div>
              </Field>
            ) : campo("username", "Usuario", "text", { required: true, autoCapitalize: "none" })}
            {campo("password", "Contraseña", "password", { required: true, minLength: 12, autoComplete: "new-password", spellCheck: false })}
            <Field label="Rol">
              <select name="rol" value={form.rol} onChange={(e) => setForm({ ...form, rol: e.target.value })}><option value="AUDITOR">Auditor de campo</option><option value="SUPERVISOR">Supervisor</option><option value="ADMINISTRADOR">Administrador</option>{user?.rol === "UNIVERSAL" ? <option value="UNIVERSAL">Administrador universal (Sulotec)</option> : null}</select>
            </Field>
            {campo("nombres", "Nombres")}
            {campo("apellidos", "Apellidos")}
            {campo("email", "Correo electrónico", "email")}
            {form.rol === "AUDITOR" ? <p className="subtle" style={{ marginTop: -2 }}>{AYUDA_ZONA}</p> : null}
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
