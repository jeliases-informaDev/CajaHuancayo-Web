import { useCallback, useEffect, useState } from "react";
import { request } from "../api";
import { useAuth } from "../AuthContext";
import { Modal } from "./kit";
import { Field } from "./ui";
import { cambiarModoPruebas, correrHastaTerminar, useModoPruebas, type Totales } from "../lib/limpieza";

// Borrar empleados y limpiar datos de prueba (solo con el modo pruebas encendido). Todo pasa por una ventana que muestra primero QUÉ se va a borrar,
// pide escribir una palabra (y la contraseña cuando son muchos datos) y borra con avance a la vista.

const num = (n: number) => n.toLocaleString("es-PE");
const ROL: Record<string, string> = { ADMINISTRADOR: "Administrador", SUPERVISOR: "Supervisor", AUDITOR: "Asesor de campo" };
const ETIQUETA: Record<string, string> = {
  usuarios: "usuarios", visitas: "visitas", fotos: "fotos", asignaciones: "asignaciones", ubicaciones: "puntos de ubicación",
  avisos_campo: "avisos de llegada y salida", dispositivos: "dispositivos", terminos: "aceptaciones de términos", expedientes: "expedientes",
  cargas_excel: "cargas de Excel", expedientes_a_pendiente: "expedientes vueltos a Pendiente",
};

// Administrador de la empresa, o el universal de Sulotec ya dentro de una empresa.
export function useEsAdmin() {
  const { user, empresaElegida } = useAuth();
  return user?.rol === "ADMINISTRADOR" || (user?.rol === "UNIVERSAL" && Boolean(empresaElegida));
}

type Vista = {
  resumen: string;
  lineas: { clave: string; valor: number }[];
  lista?: { texto: string; sub: string }[];
  mas?: number;
  quedan?: string[];
  bloqueo?: string;
};
type Confirmacion = { palabra: string; etiqueta: string; pedirClave: boolean };

function ModalBorrado({ titulo, boton, ruta, vista, confirmacion, cuerpo, encabezado, onClose, onHecho }: {
  titulo: string; boton: string; ruta: string; vista: () => Promise<Vista>; confirmacion: Confirmacion;
  cuerpo: (clave: string, escrito: string) => unknown; encabezado?: (bloqueado: boolean) => React.ReactNode; onClose: () => void; onHecho: () => void;
}) {
  const [fase, setFase] = useState<"cargando" | "listo" | "borrando" | "hecho" | "error">("cargando");
  const [datos, setDatos] = useState<Vista | null>(null);
  const [escrito, setEscrito] = useState("");
  const [clave, setClave] = useState("");
  const [total, setTotal] = useState<Totales>({});
  const [sinBorrar, setSinBorrar] = useState(0);
  const [error, setError] = useState("");

  const cargar = useCallback(() => {
    let vigente = true;
    setFase("cargando"); setError("");
    vista().then((d) => { if (vigente) { setDatos(d); setFase("listo"); } })
      .catch((e: Error) => { if (vigente) { setError(e.message || "No se pudo preparar la vista previa."); setFase("error"); } });
    return () => { vigente = false; };
  }, [vista]);
  useEffect(() => cargar(), [cargar]);

  const valido = fase === "listo" && Boolean(datos) && !datos?.bloqueo
    && escrito.trim().toLowerCase() === confirmacion.palabra.toLowerCase() && (!confirmacion.pedirClave || clave.length > 0);

  const borrar = async () => {
    setFase("borrando"); setError(""); setTotal({});
    try {
      const r = await correrHastaTerminar(ruta, cuerpo(clave, escrito.trim()), setTotal);
      setTotal(r.total); setSinBorrar(r.sinBorrar); setFase("hecho");
    } catch (e: any) { setError(e?.message || "No se pudo borrar."); setFase("error"); }
    setClave("");
  };
  // Mientras borra no se puede cerrar la ventana (quedaría a medias sin que se vea).
  const cerrar = () => { if (fase === "borrando") return; if (fase === "hecho") onHecho(); else onClose(); };
  const lineasTotal = Object.entries(total).filter(([, v]) => v > 0);

  return (
    <Modal title={titulo} onClose={cerrar}
      footer={
        fase === "listo" ? <><button className="btn ghost" onClick={onClose}>Cancelar</button><button className="btn danger" onClick={borrar} disabled={!valido}>{boton}</button></>
          : fase === "borrando" ? <button className="btn danger" disabled>Borrando…</button>
          : fase === "hecho" ? <button className="btn" onClick={onHecho}>Cerrar</button>
          : fase === "error" ? <><button className="btn ghost" onClick={onClose}>Cerrar</button><button className="btn" onClick={() => { setEscrito(""); cargar(); }}>Volver a revisar</button></>
          : <button className="btn ghost" onClick={onClose}>Cancelar</button>
      }>
      <div className="mp-cuerpo">
        {fase === "cargando" ? <p role="status" className="subtle">Preparando la vista previa…</p> : null}
        {error ? <div role="alert" className="error-box">{error}</div> : null}
        {fase === "listo" || fase === "borrando" ? (
          <>
            {encabezado ? encabezado(fase !== "listo") : null}
            {datos ? (
              <>
                <p className="mp-resumen">{datos.resumen}</p>
                {datos.lineas.length ? <ul className="mp-lineas">{datos.lineas.map((l) => <li key={l.clave}><b>{num(l.valor)}</b> {ETIQUETA[l.clave] || l.clave}</li>)}</ul>
                  : <p className="subtle">Solo se borra la cuenta: no tiene visitas, fotos ni otros datos.</p>}
                {datos.lista?.length ? (
                  <>
                    <h3 className="mp-sub">Quiénes</h3>
                    <ul className="mp-lista">
                      {datos.lista.map((u) => <li key={u.sub}><b>{u.texto}</b><span>{u.sub}</span></li>)}
                      {datos.mas ? <li className="mp-mas">y {num(datos.mas)} más…</li> : null}
                    </ul>
                  </>
                ) : null}
                {datos.quedan?.length ? <p className="mp-quedan"><b>Se queda:</b> {datos.quedan.join(", ")}</p> : null}
                {datos.bloqueo ? <div role="alert" className="error-box">{datos.bloqueo}</div> : (
                  <>
                    <div className="callout aviso">No se puede deshacer. Las fotos también se borran del almacenamiento. El registro de seguridad (accesos y operaciones) no se toca.</div>
                    <Field label={confirmacion.etiqueta}><input name="confirmar" type="text" autoComplete="off" spellCheck={false} value={escrito} onChange={(e) => setEscrito(e.target.value)} disabled={fase !== "listo"} /></Field>
                    {confirmacion.pedirClave ? <Field label="Tu contraseña"><input name="clave" type="password" autoComplete="current-password" spellCheck={false} value={clave} onChange={(e) => setClave(e.target.value)} disabled={fase !== "listo"} /></Field> : null}
                  </>
                )}
              </>
            ) : null}
          </>
        ) : null}
        {fase === "borrando" ? (
          <div role="status" aria-live="polite" className="mp-progreso">
            <p><span className="mp-giro" aria-hidden="true" />Borrando… no cierres esta ventana.</p>
            {lineasTotal.length ? <ul className="mp-lineas">{lineasTotal.map(([k, v]) => <li key={k}><b>{num(v)}</b> {ETIQUETA[k] || k}</li>)}</ul> : null}
          </div>
        ) : null}
        {fase === "hecho" ? (
          <>
            <div role="status" className="callout ok">Listo: se borró todo lo indicado.</div>
            {lineasTotal.length ? <ul className="mp-lineas">{lineasTotal.map(([k, v]) => <li key={k}><b>{num(v)}</b> {ETIQUETA[k] || k}</li>)}</ul> : <p className="subtle">No había nada más que borrar.</p>}
            {sinBorrar ? <div className="callout aviso">{num(sinBorrar)} {sinBorrar === 1 ? "foto no se pudo borrar" : "fotos no se pudieron borrar"} del almacenamiento (la cuenta del almacén no tiene permiso de borrar). Ya no están ligadas a ninguna visita; sus claves quedaron en el registro del servidor para quitarlas a mano.</div> : null}
          </>
        ) : null}
      </div>
    </Modal>
  );
}

const sumaConteos = (c: Record<string, unknown>) => Object.entries(c).map(([clave, valor]) => ({ clave, valor: Number(valor) || 0 })).filter((l) => l.valor > 0);

// ---------------------------------------------------------------- un empleado
export function BorrarUsuarioModal({ usuario, onClose, onHecho }: { usuario: { id: string; username: string }; onClose: () => void; onHecho: () => void }) {
  const vista = useCallback(async (): Promise<Vista> => {
    const r = await request<{ data: any }>(`/api/limpieza/usuarios/${usuario.id}/vista-previa`);
    const d = r.data;
    return { resumen: `Se borrará a @${d.usuario.username} (${ROL[d.usuario.rol] || d.usuario.rol}) y todo lo suyo.`, lineas: sumaConteos(d.conteos), bloqueo: d.bloqueo?.mensaje };
  }, [usuario.id]);
  return (
    <ModalBorrado titulo="Eliminar definitivamente" boton="Eliminar definitivamente" ruta={`/api/limpieza/usuarios/${usuario.id}`} vista={vista}
      confirmacion={{ palabra: usuario.username, etiqueta: `Para confirmar escribe ${usuario.username}`, pedirClave: false }}
      cuerpo={(_clave, escrito) => ({ confirmar: escrito })} onClose={onClose} onHecho={onHecho} />
  );
}

// ---------------------------------------------------------------- todos los asesores y supervisores
export function BorrarEmpleadosModal({ onClose, onHecho }: { onClose: () => void; onHecho: () => void }) {
  const vista = useCallback(async (): Promise<Vista> => {
    const r = await request<{ data: any }>("/api/limpieza/empleados/vista-previa");
    const d = r.data;
    const asesores = d.por_rol?.AUDITOR || 0; const supervisores = d.por_rol?.SUPERVISOR || 0;
    return {
      resumen: d.total ? `Se borrarán ${num(d.total)} usuarios (${num(asesores)} ${asesores === 1 ? "asesor" : "asesores"} y ${num(supervisores)} ${supervisores === 1 ? "supervisor" : "supervisores"}) con todo lo suyo.` : "No hay asesores ni supervisores que borrar.",
      lineas: sumaConteos({ usuarios: d.total, ...d.conteos }),
      lista: d.usuarios.map((u: any) => ({ texto: u.nombre, sub: `@${u.username} · ${ROL[u.rol] || u.rol}` })),
      mas: Math.max(0, d.total - d.mostrando),
      quedan: d.quedan.map((u: any) => `@${u.username} (${ROL[u.rol] || u.rol})`),
      bloqueo: d.total ? undefined : "No hay asesores ni supervisores que borrar.",
    };
  }, []);
  return (
    <ModalBorrado titulo="Borrar a todos los asesores y supervisores" boton="Borrar a todos" ruta="/api/limpieza/empleados" vista={vista}
      confirmacion={{ palabra: "BORRAR", etiqueta: "Para confirmar escribe BORRAR", pedirClave: true }}
      cuerpo={(clave, escrito) => ({ confirmar: escrito, clave })} onClose={onClose} onHecho={onHecho} />
  );
}

// ---------------------------------------------------------------- datos de prueba
export function LimpiarDatosModal({ onClose, onHecho }: { onClose: () => void; onHecho: () => void }) {
  const [alcance, setAlcance] = useState<"campo" | "todo">("campo");
  const vista = useCallback(async (): Promise<Vista> => {
    const r = await request<{ data: any }>(`/api/limpieza/datos/vista-previa?alcance=${alcance}`);
    return {
      resumen: alcance === "campo" ? "Se borra la actividad de campo; los expedientes se quedan y vuelven a Pendiente." : "Se borra la actividad de campo y también todos los expedientes cargados.",
      lineas: sumaConteos(r.data.conteos),
    };
  }, [alcance]);
  const opciones = (bloqueado: boolean) => (
    <fieldset className="mp-opciones" disabled={bloqueado}>
      <legend>Qué se limpia</legend>
      <label><input type="radio" name="alcance" checked={alcance === "campo"} onChange={() => setAlcance("campo")} />
        <span><b>Solo la actividad de campo</b>Visitas con sus fotos, asignaciones, ubicaciones y avisos. Los expedientes se quedan.</span></label>
      <label><input type="radio" name="alcance" checked={alcance === "todo"} onChange={() => setAlcance("todo")} />
        <span><b>Todo lo cargado</b>Lo anterior más los expedientes y el historial de cargas de Excel. Los usuarios y los ajustes no se tocan.</span></label>
    </fieldset>
  );
  return (
    <ModalBorrado titulo="Limpiar datos de prueba" boton="Limpiar datos" ruta="/api/limpieza/datos" vista={vista} encabezado={opciones}
      confirmacion={{ palabra: "BORRAR", etiqueta: "Para confirmar escribe BORRAR", pedirClave: true }}
      cuerpo={(clave, escrito) => ({ alcance, confirmar: escrito, clave })} onClose={onClose} onHecho={onHecho} />
  );
}

// ---------------------------------------------------------------- tarjeta de Seguridad
export function ModoPruebasTarjeta() {
  const esAdmin = useEsAdmin();
  const { activo, cargado } = useModoPruebas(esAdmin);
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [abierto, setAbierto] = useState<null | "datos" | "empleados">(null);
  if (!esAdmin) return null;

  const alternar = async (nuevo: boolean) => {
    if (nuevo && !window.confirm("¿Encender el modo pruebas?\n\nPermite borrar empleados y datos de prueba (visitas, fotos, asignaciones, expedientes). No se puede deshacer. Apágalo cuando la empresa trabaje con datos reales.")) return;
    setTrabajando(true); setError(""); setOk("");
    try { await cambiarModoPruebas(nuevo); } catch (e: any) { setError(e?.message || "No se pudo cambiar el modo pruebas."); } finally { setTrabajando(false); }
  };

  return (
    <section className="section" aria-labelledby="mp-titulo">
      <div className="section-head"><h2 id="mp-titulo">Modo pruebas</h2><span className={`state ${activo ? "warn" : "ok"}`}>{cargado ? (activo ? "Encendido" : "Apagado") : "…"}</span></div>
      <div className="mp-tarjeta">
        <p>Mientras está encendido puedes borrar empleados por completo y limpiar los datos de prueba (visitas con sus fotos, asignaciones, ubicaciones y, si quieres, los expedientes cargados). Es lo único del sistema que borra visitas y fotos, y no se puede deshacer. Viene apagado: enciéndelo para probar y apágalo cuando la empresa trabaje con datos reales.</p>
        {error ? <div role="alert" className="error-box">{error}</div> : null}
        {ok ? <div role="status" className="callout ok">{ok}</div> : null}
        <label className="mp-interruptor">
          <input type="checkbox" role="switch" checked={activo} disabled={!cargado || trabajando} onChange={(e) => alternar(e.target.checked)} />
          <span className="mp-pista" aria-hidden="true"><span className="mp-bolita" /></span>
          <span>{activo ? "Encendido" : "Apagado"}</span>
        </label>
        {activo ? (
          <div className="mp-acciones">
            <button className="btn ghost" onClick={() => setAbierto("empleados")}>Borrar a todos los asesores y supervisores…</button>
            <button className="btn ghost" onClick={() => setAbierto("datos")}>Limpiar datos de prueba…</button>
            <p className="subtle">Para borrar a un solo empleado, en Usuarios usa «Eliminar definitivamente» en el menú de su fila.</p>
          </div>
        ) : null}
      </div>
      {abierto === "empleados" ? <BorrarEmpleadosModal onClose={() => setAbierto(null)} onHecho={() => { setAbierto(null); setOk("Listo: se borraron los asesores y supervisores."); }} /> : null}
      {abierto === "datos" ? <LimpiarDatosModal onClose={() => setAbierto(null)} onHecho={() => { setAbierto(null); setOk("Listo: se limpiaron los datos de prueba."); }} /> : null}
    </section>
  );
}
