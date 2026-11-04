import { useState, type ReactNode } from "react";
import { ApiError, request } from "../../api";
import Dialogo, { type TonoDialogo } from "../Dialogo";
import { Icon } from "../icons";
import { iniciales } from "../../lib/format";
import { refrescarLicencia, textoCupo, type Licencia } from "../../lib/licencia";
import { ROL, nombreDe, type Usuario } from "../../lib/usuarios";

// Ventanas de Usuarios (diseño de Figma): nuevo usuario, cambiar contraseña y las confirmaciones de desactivar, activar, restablecer la verificación en dos pasos y
// liberar el dispositivo. Cada una pide al servidor, muestra su error dentro de la ventana y avisa a la pantalla con el mensaje de lo que pasó.

// La persona a la que afecta la acción, como en el diseño: avatar, nombre, «@usuario · Rol · Zona» y su estado.
export function TarjetaPersona({ u }: { u: Usuario }) {
  const nombre = nombreDe(u);
  const zona = u.zona?.departamento || u.zona?.texto || u.departamento;
  return (
    <div className="pa-persona">
      <span className="pa-avatar" aria-hidden="true">{iniciales(nombre)}</span>
      <div><b>{nombre}</b><span className="sub" translate="no">@{u.username} · {ROL[u.rol]?.etiqueta || u.rol}{u.rol === "AUDITOR" && zona ? ` · ${zona}` : ""}</span></div>
      <span className={`pa-pastilla ${u.estado === "ACTIVO" ? "ok" : "gris"}`}>{u.estado === "ACTIVO" ? "Activo" : "Inactivo"}</span>
    </div>
  );
}

const Requerido = () => <span className="req" aria-hidden="true">*</span>;

// Contraseña con el ojo para verla o taparla; la ayuda cambia por el error cuando lo hay.
function CampoClave({ id, etiqueta, valor, onChange, ayuda, error }: { id: string; etiqueta: string; valor: string; onChange: (v: string) => void; ayuda: string; error?: string }) {
  const [ver, setVer] = useState(false);
  return (
    <div className="pa-campo">
      <label htmlFor={id}>{etiqueta} <Requerido /></label>
      <div className="pa-clave">
        <input id={id} name={id} className="pa-entrada" type={ver ? "text" : "password"} autoComplete="new-password" spellCheck={false} required maxLength={128}
          value={valor} onChange={(e) => onChange(e.target.value)} aria-invalid={Boolean(error)} aria-describedby={`${id}-ayuda`} />
        <button type="button" className="pa-ojo" onClick={() => setVer((v) => !v)} aria-label={ver ? "Ocultar la contraseña" : "Mostrar la contraseña"} aria-pressed={ver}><Icon name={ver ? "ojo" : "ojoCerrado"} size={19} /></button>
      </div>
      <small id={`${id}-ayuda`} className={error ? "mal" : ""} role={error ? "alert" : undefined}>{error || ayuda}</small>
    </div>
  );
}

const pideConfirmar = (hay: boolean) => !hay || window.confirm("Hay datos sin guardar. ¿Cerrar y descartarlos?");

// Error de una ventana: el texto del servidor y, si vino de la licencia (sin cupo, solo lectura…), el enlace a Sulotec para resolverlo.
type ErrorVentana = { texto: string; enlace?: string; accion: string } | null;
const errorDe = (x: any, porDefecto: string): ErrorVentana => {
  const data = x instanceof ApiError ? x.data : undefined;
  // Si el servidor rechazó por la licencia (sin cupo, solo lectura…), lo que el panel sabía de ella quedó viejo: se vuelve a pedir.
  if (String(data?.code || "").startsWith("LICENCIA_")) void refrescarLicencia();
  return { texto: x?.message || porDefecto, enlace: typeof data?.enlace === "string" ? data.enlace : undefined, accion: data?.code === "LICENCIA_SIN_CUPO" ? "Ampliar mi licencia" : "Ver mi licencia" };
};
const AvisoError = ({ error }: { error: ErrorVentana }) => (error
  ? <div role="alert" className="pa-error">{error.texto}{error.enlace ? <>{" "}<a href={error.enlace} target="_blank" rel="noreferrer">{error.accion}</a></> : null}</div>
  : null);

// ---------------------------------------------------------------- Nuevo usuario
const VACIO = { username: "", nombres: "", apellidos: "", email: "", rol: "AUDITOR", password: "", confirmar: "" };
const AYUDA_ROL: Record<string, string> = {
  AUDITOR: "Sale a campo con la app del celular.", SUPERVISOR: "Asigna y revisa desde este panel; no sale a campo.", ADMINISTRADOR: "Gestiona usuarios, reglas y seguridad de la empresa.",
  UNIVERSAL: "Administra todas las empresas de Sulotec.",
};

// `puedeCrear` y `licencia`: sin cupo en la licencia la ventana lo avisa y no deja crear (el servidor también lo rechazaría).
export function NuevoUsuario({ prefijo, esUniversal, puedeCrear = true, licencia = null, onClose, onCreado }: {
  prefijo?: string | null; esUniversal: boolean; puedeCrear?: boolean; licencia?: Licencia | null; onClose: () => void; onCreado: (mensaje: string) => void;
}) {
  const [form, setForm] = useState(VACIO);
  const [mfa, setMfa] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<ErrorVentana>(null);
  const [intento, setIntento] = useState(false);
  const cambia = (k: keyof typeof VACIO) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const sucio = JSON.stringify(form) !== JSON.stringify(VACIO) || !mfa;
  const cerrar = () => { if (pideConfirmar(sucio)) onClose(); };
  const conPrefijo = Boolean(prefijo) && form.rol !== "UNIVERSAL";
  const errClave = form.password && form.password.length < 12 ? "Debe tener al menos 12 caracteres." : "";
  const errConfirmar = form.confirmar && form.confirmar !== form.password ? "No coincide con la contraseña temporal." : "";

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setIntento(true);
    if (!puedeCrear || form.password.length < 12 || form.confirmar !== form.password) return;
    setGuardando(true); setError(null);
    try {
      await request("/api/usuarios", { method: "POST", body: JSON.stringify({ username: form.username.trim(), password: form.password, rol: form.rol, nombres: form.nombres.trim(), apellidos: form.apellidos.trim(), email: form.email.trim(), mfa_habilitado: mfa }) });
      onCreado("Usuario creado.");
    } catch (x: any) { setError(errorDe(x, "No se pudo crear el usuario.")); } finally { setGuardando(false); }
  };

  return (
    <Dialogo icono="usuarioMas" titulo="Nuevo usuario" subtitulo="Completa los datos para dar acceso al sistema." ancho={720} ocupado={guardando} onClose={cerrar}
      pie={<><button type="button" className="pa-boton" onClick={cerrar} disabled={guardando}>Cancelar</button><button type="submit" form="form-nuevo-usuario" className="pa-boton primario" disabled={guardando || !puedeCrear}>{guardando ? "Creando…" : "Crear usuario"}</button></>}>
      <form id="form-nuevo-usuario" onSubmit={enviar} noValidate style={{ display: "grid", gap: 16 }}>
        <p className="nota"><span className="req">*</span> Campo obligatorio · Opcionales indicados</p>
        {!puedeCrear && licencia ? (
          <div className="pa-alerta aviso" role="alert"><Icon name="alertaCirculo" size={19} /><div><b>Sin cupo de usuarios</b><p>{textoCupo(licencia)}{licencia.enlace ? <>{" "}<a href={licencia.enlace} target="_blank" rel="noreferrer">Ampliar mi licencia</a></> : null}</p></div></div>
        ) : null}
        <AvisoError error={error} />
        <div className="pa-seccion"><h3>Identidad</h3><span>Datos de la persona</span></div>
        <div className="pa-campos">
          <div className="pa-campo">
            <label htmlFor="nu-nombres">Nombres <Requerido /></label>
            <input id="nu-nombres" name="nombres" className="pa-entrada" autoComplete="off" required maxLength={150} value={form.nombres} onChange={cambia("nombres")} placeholder="Valeria…" aria-invalid={intento && !form.nombres.trim()} />
            {intento && !form.nombres.trim() ? <small className="mal" role="alert">Escribe los nombres.</small> : null}
          </div>
          <div className="pa-campo">
            <label htmlFor="nu-apellidos">Apellidos <Requerido /></label>
            <input id="nu-apellidos" name="apellidos" className="pa-entrada" autoComplete="off" required maxLength={200} value={form.apellidos} onChange={cambia("apellidos")} placeholder="Torres Ejemplo…" aria-invalid={intento && !form.apellidos.trim()} />
            {intento && !form.apellidos.trim() ? <small className="mal" role="alert">Escribe los apellidos.</small> : null}
          </div>
          <div className="pa-campo">
            <label htmlFor="nu-usuario">Nombre de usuario <Requerido /></label>
            {conPrefijo ? (
              // La abreviatura de la empresa va fija delante: se escribe solo su parte (jorge → arq.jorge).
              <div className="pa-prefijo"><span translate="no" aria-hidden="true">{prefijo}.</span><input id="nu-usuario" name="username" className="pa-entrada" autoComplete="off" spellCheck={false} autoCapitalize="none" required maxLength={40} value={form.username} onChange={cambia("username")} placeholder="valeria.torres…" aria-describedby="nu-usuario-ayuda" aria-invalid={intento && !form.username.trim()} /></div>
            ) : <input id="nu-usuario" name="username" className="pa-entrada" autoComplete="off" spellCheck={false} autoCapitalize="none" required maxLength={50} value={form.username} onChange={cambia("username")} placeholder="auditor.valeria…" aria-describedby="nu-usuario-ayuda" aria-invalid={intento && !form.username.trim()} />}
            <small id="nu-usuario-ayuda" className={intento && !form.username.trim() ? "mal" : ""}>{intento && !form.username.trim() ? "Escribe el nombre de usuario." : `Identificador para ingresar al sistema.${conPrefijo ? ` Quedará como ${prefijo}.…` : ""}`}</small>
          </div>
          <div className="pa-campo">
            <label htmlFor="nu-correo">Correo electrónico <Requerido /></label>
            <input id="nu-correo" name="email" type="email" className="pa-entrada" autoComplete="off" spellCheck={false} required maxLength={150} value={form.email} onChange={cambia("email")} placeholder="valeria.torres@ejemplo.com…" aria-describedby="nu-correo-ayuda" aria-invalid={intento && !/^\S+@\S+\.\S+$/.test(form.email.trim())} />
            <small id="nu-correo-ayuda" className={intento && !/^\S+@\S+\.\S+$/.test(form.email.trim()) ? "mal" : ""}>{intento && !/^\S+@\S+\.\S+$/.test(form.email.trim()) ? "Escribe un correo válido." : "Usa un correo válido de la persona."}</small>
          </div>
        </div>
        <hr className="pa-regla" />
        <div className="pa-seccion"><h3>Acceso</h3><span>Rol y credenciales iniciales</span></div>
        <div className="pa-campos">
          <div className="pa-campo">
            <label htmlFor="nu-rol">Rol <Requerido /></label>
            <select id="nu-rol" name="rol" className="pa-entrada" value={form.rol} onChange={cambia("rol")} aria-describedby="nu-rol-ayuda">
              <option value="AUDITOR">Auditor</option><option value="SUPERVISOR">Supervisor</option><option value="ADMINISTRADOR">Administrador</option>
              {esUniversal ? <option value="UNIVERSAL">Administrador universal (Sulotec)</option> : null}
            </select>
            <small id="nu-rol-ayuda">{AYUDA_ROL[form.rol]}</small>
          </div>
          <div className="pa-campo">
            <label htmlFor="nu-zona">Zona de trabajo</label>
            <input id="nu-zona" className="pa-entrada" disabled value={form.rol === "AUDITOR" ? "Se toma al iniciar su jornada" : "No aplica"} aria-describedby="nu-zona-ayuda" readOnly />
            <small id="nu-zona-ayuda">{form.rol === "AUDITOR" ? "Queda sola con el GPS del celular al iniciar la jornada; no limita sus casos." : "Solo los auditores de campo tienen zona."}</small>
          </div>
          <CampoClave id="nu-clave" etiqueta="Contraseña temporal" valor={form.password} onChange={(v) => setForm((f) => ({ ...f, password: v }))} ayuda="Mínimo 12 caracteres. Usa una contraseña única y segura." error={errClave || (intento && !form.password ? "Escribe la contraseña temporal." : "")} />
          <CampoClave id="nu-confirmar" etiqueta="Confirmar contraseña" valor={form.confirmar} onChange={(v) => setForm((f) => ({ ...f, confirmar: v }))} ayuda="Debe coincidir con la contraseña temporal." error={errConfirmar || (intento && !form.confirmar ? "Repite la contraseña temporal." : "")} />
        </div>
        <label className="pa-chk-fila">
          <input type="checkbox" className="pa-chk" name="mfa_habilitado" checked={mfa} onChange={(e) => setMfa(e.target.checked)} />
          <span><b>Exigir verificación en dos pasos (recomendado)</b><small>En su primer ingreso configurará una app autenticadora.</small></span>
        </label>
        <div className="pa-alerta info"><p>La aceptación de términos corresponde al usuario en su primer acceso. No se registra una aceptación desde este formulario.</p></div>
      </form>
    </Dialogo>
  );
}

// ---------------------------------------------------------------- Cambiar contraseña
export function CambiarClave({ usuario, onClose, onHecho }: { usuario: Usuario; onClose: () => void; onHecho: (mensaje: string) => void }) {
  const [nueva, setNueva] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [intento, setIntento] = useState(false);
  const cerrar = () => { if (pideConfirmar(!nueva && !confirmar)) onClose(); };
  const errNueva = nueva && nueva.length < 12 ? "Debe tener al menos 12 caracteres." : "";
  const errConfirmar = confirmar && confirmar !== nueva ? "No coincide con la nueva contraseña." : "";
  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setIntento(true);
    if (nueva.length < 12 || confirmar !== nueva) return;
    setGuardando(true); setError("");
    try {
      await request(`/api/usuarios/${usuario.id}`, { method: "PATCH", body: JSON.stringify({ password: nueva }) });
      onHecho(`Contraseña de @${usuario.username} actualizada. Sus sesiones abiertas se cerraron.`);
    } catch (x: any) { setError(x?.message || "No se pudo cambiar la contraseña."); } finally { setGuardando(false); }
  };
  return (
    <Dialogo icono="llave" titulo="Cambiar contraseña" subtitulo="Gestión de credenciales" ocupado={guardando} onClose={cerrar}
      pie={<><button type="button" className="pa-boton" onClick={cerrar} disabled={guardando}>Cancelar</button><button type="submit" form="form-cambiar-clave" className="pa-boton primario" disabled={guardando}>{guardando ? "Guardando…" : "Cambiar contraseña"}</button></>}>
      <TarjetaPersona u={usuario} />
      <form id="form-cambiar-clave" onSubmit={enviar} noValidate style={{ display: "grid", gap: 16 }}>
        <p>La nueva contraseña reemplazará la contraseña de acceso de este usuario y cerrará sus sesiones abiertas. No necesitas su contraseña actual.</p>
        {error ? <div role="alert" className="pa-error">{error}</div> : null}
        <CampoClave id="cc-nueva" etiqueta="Nueva contraseña" valor={nueva} onChange={setNueva} ayuda="Mínimo 12 caracteres. Usa una contraseña única y evita datos personales." error={errNueva || (intento && !nueva ? "Escribe la nueva contraseña." : "")} />
        <CampoClave id="cc-confirmar" etiqueta="Confirmar contraseña" valor={confirmar} onChange={setConfirmar} ayuda="Debe coincidir con la nueva contraseña." error={errConfirmar || (intento && !confirmar ? "Repite la nueva contraseña." : "")} />
      </form>
    </Dialogo>
  );
}

// ---------------------------------------------------------------- Confirmaciones (desactivar, activar, restablecer verificación, liberar dispositivo)
type Alerta = { tono: "mal" | "aviso"; icono: string; titulo: string; texto: ReactNode };
export function ConfirmarAccion({ usuario, icono, tono = "normal", titulo, subtitulo, pregunta, alerta, nota, boton, botonPeligro = false, ejecutar, onClose, onHecho }: {
  usuario: Usuario; icono: string; tono?: TonoDialogo; titulo: string; subtitulo: string; pregunta: ReactNode; alerta?: Alerta; nota?: ReactNode; boton: string; botonPeligro?: boolean;
  ejecutar: () => Promise<string>; onClose: () => void; onHecho: (mensaje: string) => void;
}) {
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<ErrorVentana>(null);
  const confirmar = async () => {
    setGuardando(true); setError(null);
    try { onHecho(await ejecutar()); } catch (x: any) { setError(errorDe(x, "No se pudo completar la acción.")); setGuardando(false); }
  };
  return (
    <Dialogo icono={icono} tono={tono} titulo={titulo} subtitulo={subtitulo} ocupado={guardando} onClose={onClose}
      pie={<><button type="button" className="pa-boton" onClick={onClose} disabled={guardando}>Cancelar</button><button type="button" className={"pa-boton " + (botonPeligro ? "peligro" : "primario")} onClick={confirmar} disabled={guardando}>{guardando ? "Un momento…" : boton}</button></>}>
      <TarjetaPersona u={usuario} />
      <p>{pregunta}</p>
      {alerta ? <div className={`pa-alerta ${alerta.tono}`} role="note"><Icon name={alerta.icono} size={19} /><div><b>{alerta.titulo}</b><p>{alerta.texto}</p></div></div> : null}
      {nota ? <p className="nota">{nota}</p> : null}
      <AvisoError error={error} />
    </Dialogo>
  );
}
