import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { request } from "../api";
import { useAuth } from "../AuthContext";
import { Empty, Skeleton } from "../components/ui";
import { Icon } from "../components/icons";
import MenuFila, { type OpcionMenu } from "../components/MenuFila";
import Paginador from "../components/Paginador";
import { CambiarClave, ConfirmarAccion, NuevoUsuario } from "../components/usuarios/DialogosUsuario";
import { BorrarEmpleadosModal, BorrarUsuarioModal } from "../components/limpieza";
import { QuitarCasosModal } from "../components/quitarcasos";
import { JornadasDrawer } from "../components/jornadas";
import { useModoPruebas } from "../lib/limpieza";
import { TAMANOS } from "../lib/paginas";
import { iniciales } from "../lib/format";
import { ROL, fechaHoraCorta, nombreDe, ultimoAcceso, useFiltrosUsuarios, zonaDe, type Usuario } from "../lib/usuarios";
import "../pantalla.css";
import "../usuarios.css";

// Usuarios — diseño de Figma: «NUEVO USUARIO» arriba a la derecha, buscador con pestañas por rol y la tabla en una tarjeta con su pie de páginas. La lista la pagina el
// servidor (la búsqueda, el rol y la página viven en la URL), así que crece sin que nadie tenga que desplazarse por cientos de filas. Cada acción de la fila (⋯) abre su
// ventana del diseño; lo que ya existía se conserva: liberar dispositivo, quitar casos, ver jornadas, activar y el borrado del modo pruebas.

type Dialogo = null | { tipo: "nuevo" } | { tipo: "clave" | "desactivar" | "activar" | "mfa" | "dispositivo"; u: Usuario };

export default function UsuariosPage() {
  const { user, empresa } = useAuth();
  const { q, rol, pagina, filas, fijarQ, fijarRol, irAPagina, fijarFilas } = useFiltrosUsuarios();
  const [data, setData] = useState<Usuario[]>([]);
  const [total, setTotal] = useState(0);
  const [paginas, setPaginas] = useState(1);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [recarga, setRecarga] = useState(0);
  const [dialogo, setDialogo] = useState<Dialogo>(null);
  const [jornadasDe, setJornadasDe] = useState<Usuario | null>(null); // auditor del que se ve el historial de jornadas
  const [borrarA, setBorrarA] = useState<Usuario | null>(null); // usuario que se va a borrar por completo (modo pruebas)
  const [borrarTodos, setBorrarTodos] = useState(false);
  const [quitarCasosA, setQuitarCasosA] = useState<Usuario | null>(null); // asesor al que se le quitan los casos abiertos
  const { activo: modoPruebas } = useModoPruebas(true); // esta pantalla es solo del administrador
  const [texto, setTexto] = useState(q);
  const entradaBusca = useRef<HTMLInputElement>(null);
  const tarjeta = useRef<HTMLDivElement>(null);

  const consulta = useMemo(() => {
    const p = new URLSearchParams({ limit: String(filas), page: String(pagina) });
    if (q) p.set("q", q);
    if (rol) p.set("rol", rol);
    return p.toString();
  }, [q, rol, pagina, filas]);

  useEffect(() => {
    let vigente = true; // si llega una respuesta vieja después de cambiar un filtro, se ignora
    setCargando(true);
    request<{ data: Usuario[]; pagination: { total: number; pages: number } }>(`/api/usuarios?${consulta}`)
      .then((r) => {
        if (!vigente) return;
        // Si el filtro o un borrado dejaron menos páginas que la que se miraba, se vuelve a la última.
        if (!r.data.length && r.pagination.total > 0 && pagina > 1) { irAPagina(Math.max(1, r.pagination.pages)); return; }
        setData(r.data); setTotal(r.pagination.total); setPaginas(r.pagination.pages); setError("");
      })
      .catch((e) => { if (vigente) setError(e?.message || "No se pudieron cargar los usuarios."); })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [consulta, recarga]); // eslint-disable-line react-hooks/exhaustive-deps

  const recargar = useCallback(() => setRecarga((n) => n + 1), []);
  const hecho = (mensaje: string) => { setDialogo(null); setError(""); setOk(mensaje); recargar(); };

  // Búsqueda por texto: espera un momento después de la última tecla (o Enter) y se guarda en la URL.
  useEffect(() => {
    if (texto.trim() === q) return;
    const t = setTimeout(() => fijarQ(texto), 300);
    return () => clearTimeout(t);
  }, [texto]); // eslint-disable-line react-hooks/exhaustive-deps
  // Si la URL cambia desde afuera (por ejemplo «Limpiar filtros»), la caja la sigue; sin pisar lo que se está escribiendo.
  useEffect(() => { setTexto((t) => (t.trim() === q ? t : q)); }, [q]);

  // Ctrl/Cmd + K lleva al buscador de esta pantalla (en vez de abrir la paleta general), como en Seguimiento, Visitas y Expedientes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); e.stopImmediatePropagation(); entradaBusca.current?.focus(); entradaBusca.current?.select(); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const irPagina = (n: number) => {
    irAPagina(n);
    const arriba = tarjeta.current?.getBoundingClientRect().top ?? 0;
    if (arriba < 60) window.scrollBy({ top: arriba - 70 });
  };
  const hayFiltros = Boolean(q || rol);
  const limpiar = () => { setTexto(""); fijarQ(""); fijarRol(""); };
  const anuncio = cargando ? "Cargando usuarios…" : `${total.toLocaleString("es-PE")} ${total === 1 ? "usuario encontrado" : "usuarios encontrados"}`;

  const opciones = (u: Usuario): OpcionMenu[] => [
    { etiqueta: "Cambiar contraseña", icono: "llave", onClick: () => { setOk(""); setDialogo({ tipo: "clave", u }); } },
    { etiqueta: "Restablecer verificación en dos pasos", icono: "escudoOk", onClick: () => { setOk(""); setDialogo({ tipo: "mfa", u }); } },
    { etiqueta: "Liberar dispositivo", icono: "celular", oculto: u.rol === "ADMINISTRADOR", onClick: () => { setOk(""); setDialogo({ tipo: "dispositivo", u }); } },
    { etiqueta: "Ver jornadas", icono: "reloj", oculto: u.rol !== "AUDITOR", onClick: () => { setOk(""); setJornadasDe(u); } },
    { etiqueta: "Quitar casos…", icono: "cambiar", oculto: u.rol !== "AUDITOR", onClick: () => { setOk(""); setQuitarCasosA(u); } },
    u.estado === "ACTIVO"
      ? { etiqueta: "Desactivar usuario", icono: "usuarioX", peligro: true, oculto: u.id === user?.id, onClick: () => { setOk(""); setDialogo({ tipo: "desactivar", u }); } }
      : { etiqueta: "Activar usuario", icono: "usuarioOk", onClick: () => { setOk(""); setDialogo({ tipo: "activar", u }); } },
    { etiqueta: "Eliminar definitivamente", icono: "papelera", peligro: true, oculto: !modoPruebas || u.id === user?.id, onClick: () => { setOk(""); setBorrarA(u); } },
  ];

  return (
    <div className="pa-pagina us-pagina">
      <h1 className="sr-only">Usuarios</h1>
      <p className="sr-only" role="status" aria-live="polite">{anuncio}</p>

      <div className="us-acciones">
        {modoPruebas ? <button type="button" className="pa-boton chico suave mp-borrar" onClick={() => setBorrarTodos(true)}>Borrar a todos los asesores y supervisores…</button> : null}
        <button type="button" className="pa-boton cabecera primario" onClick={() => { setOk(""); setDialogo({ tipo: "nuevo" }); }}><Icon name="mas" size={15} /><span>Nuevo usuario</span></button>
      </div>

      <div className="us-barra">
        <div className="pa-busca">
          <Icon name="buscar" size={16} />
          <label className="sr-only" htmlFor="us-q">Buscar usuario, nombre o correo</label>
          <input ref={entradaBusca} id="us-q" name="q" type="search" placeholder="Buscar usuario, nombre o correo…" autoComplete="off" spellCheck={false} maxLength={100}
            value={texto} onChange={(e) => setTexto(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") fijarQ(texto); }} />
          <kbd aria-hidden="true">Ctrl K</kbd>
        </div>
        <div className="pa-seg" role="group" aria-label="Filtrar por rol">
          {([["", "Todos"], ["AUDITOR", "Auditores"], ["SUPERVISOR", "Supervisores"], ["ADMINISTRADOR", "Administradores"]] as const).map(([v, et]) => (
            <button key={v} type="button" className={rol === v ? "on" : ""} aria-pressed={rol === v} onClick={() => fijarRol(v)}>{et}</button>
          ))}
        </div>
      </div>

      {error ? <div role="alert" className="error-box">{error}</div> : null}
      {ok ? <div role="status" className="callout ok">{ok}</div> : null}

      {cargando && !data.length ? (
        <div className="pa-tarjeta" aria-busy="true"><div className="pa-esqueleto">{[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} height={44} radius={10} style={{ display: "block" }} />)}</div></div>
      ) : !data.length ? (
        <Empty tipo={hayFiltros ? "busqueda" : "vacio"} title="Sin usuarios" text={hayFiltros ? "Ningún usuario coincide con la búsqueda." : "Todavía no hay usuarios en esta empresa."}
          action={hayFiltros ? <button type="button" className="btn ghost" onClick={limpiar}>Limpiar filtros</button> : undefined} />
      ) : (
        <div className="pa-tarjeta" ref={tarjeta} aria-busy={cargando}>
          <div className="pa-scroll">
            <table className="pa-tabla us-tabla">
              <caption className="sr-only">Usuarios con acceso al sistema</caption>
              <colgroup><col style={{ width: "25%" }} /><col style={{ width: "12%" }} /><col style={{ width: "13%" }} /><col style={{ width: "8%" }} /><col style={{ width: "12.5%" }} /><col style={{ width: "23.5%" }} /><col style={{ width: "6%" }} /></colgroup>
              <thead><tr><th scope="col">Usuario</th><th scope="col" className="c">Rol</th><th scope="col">Zona</th><th scope="col" className="c">Estado</th><th scope="col" className="c">Último acceso</th><th scope="col">Términos</th><th scope="col"><span className="sr-only">Acciones</span></th></tr></thead>
              <tbody>
                {data.map((u) => {
                  const nombre = nombreDe(u); const r = ROL[u.rol]; const z = zonaDe(u); const acceso = ultimoAcceso(u.ultimo_acceso);
                  return (
                    <tr key={u.id}>
                      <td><div className="us-quien"><span className="pa-avatar" aria-hidden="true">{iniciales(nombre)}</span><div><b>{nombre}</b><small translate="no">@{u.username}</small></div></div></td>
                      <td className="c"><span className={`pa-pastilla ${r?.clase || "gris"}`}>{r?.etiqueta || u.rol}</span></td>
                      <td className="us-zona"><span>{z.texto}</span>{z.sub ? <small>{z.sub}</small> : null}</td>
                      <td className="c"><span className={`pa-pastilla ${u.estado === "ACTIVO" ? "ok" : "gris"}`}>{u.estado === "ACTIVO" ? "Activo" : "Inactivo"}</span></td>
                      <td className="c" title={acceso.titulo}>{acceso.texto === "Nunca" ? <span className="us-nunca">Nunca</span> : acceso.texto}</td>
                      <td>
                        {u.rol === "UNIVERSAL" ? <span className="us-nunca">No aplica</span>
                          : u.terminos ? <span className="pa-pastilla punto ok" title={`Aceptados desde ${u.terminos.plataforma === "MOVIL" ? "la app" : "el panel"}`}><i aria-hidden="true" />v{u.terminos.version} - {fechaHoraCorta(u.terminos.fecha)}</span>
                          : <span className="pa-pastilla punto aviso"><i aria-hidden="true" />Pendiente</span>}
                      </td>
                      <td className="us-fin"><MenuFila etiqueta={`Acciones de ${nombre}`} encabezado={{ titulo: nombre, sub: `@${u.username}` }} opciones={opciones(u)} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Paginador pagina={pagina} paginas={paginas} filas={filas} total={total} mostrados={data.length} tamanos={TAMANOS} onPagina={irPagina} onFilas={fijarFilas} />
        </div>
      )}

      {!modoPruebas ? <p className="us-ayuda">Para borrar usuarios de prueba, enciende el <Link to="/seguridad">modo pruebas</Link> en Seguridad.</p> : null}

      {dialogo?.tipo === "nuevo" ? <NuevoUsuario prefijo={empresa?.prefijo} esUniversal={user?.rol === "UNIVERSAL"} onClose={() => setDialogo(null)} onCreado={hecho} /> : null}
      {dialogo?.tipo === "clave" ? <CambiarClave usuario={dialogo.u} onClose={() => setDialogo(null)} onHecho={hecho} /> : null}
      {dialogo?.tipo === "mfa" ? (
        <ConfirmarAccion usuario={dialogo.u} icono="escudoOk" titulo="Restablecer verificación de dos pasos" subtitulo="Confirmación de seguridad" boton="Restablecer verificación"
          pregunta={<>Se eliminará la configuración actual de verificación de dos pasos de {nombreDe(dialogo.u)}. El usuario deberá configurar de nuevo la verificación para proteger su cuenta.</>}
          alerta={{ tono: "aviso", icono: "escudoOk", titulo: "Verifica su identidad antes de continuar", texto: "Confirma que la solicitud corresponde a esta persona antes de restablecer su verificación de dos pasos." }}
          nota="Esta acción no cambia la contraseña del usuario."
          ejecutar={async () => { await request(`/api/usuarios/${dialogo.u.id}/mfa/reset`, { method: "POST" }); return `Verificación en dos pasos de @${dialogo.u.username} restablecida.`; }}
          onClose={() => setDialogo(null)} onHecho={hecho} />
      ) : null}
      {dialogo?.tipo === "dispositivo" ? (
        <ConfirmarAccion usuario={dialogo.u} icono="celular" titulo="Liberar dispositivo" subtitulo="Confirma el cambio de celular" boton="Liberar dispositivo"
          pregunta={<>¿Quieres liberar el dispositivo de {nombreDe(dialogo.u)}? Podrá iniciar sesión desde otro teléfono.</>}
          nota="Esta acción no cambia su contraseña ni sus casos."
          ejecutar={async () => { await request(`/api/usuarios/${dialogo.u.id}/device/reset`, { method: "POST" }); return "Dispositivo liberado: podrá iniciar sesión desde otro teléfono."; }}
          onClose={() => setDialogo(null)} onHecho={hecho} />
      ) : null}
      {dialogo?.tipo === "desactivar" ? (
        <ConfirmarAccion usuario={dialogo.u} icono="usuarioX" tono="peligro" titulo="Desactivar usuario" subtitulo="Confirma el cambio de acceso" boton="Desactivar usuario" botonPeligro
          pregunta={<>¿Quieres desactivar la cuenta de {nombreDe(dialogo.u)}? El usuario dejará de tener acceso al sistema.</>}
          alerta={{ tono: "mal", icono: "usuarioX", titulo: "Se impedirá su acceso", texto: `Se conservarán su historial y sus registros de auditoría. Desactivar la cuenta no elimina al usuario de forma permanente.${dialogo.u.rol === "AUDITOR" ? " Sus casos activos se liberan para que otro asesor los tome." : ""}` }}
          ejecutar={async () => { await request(`/api/usuarios/${dialogo.u.id}`, { method: "PATCH", body: JSON.stringify({ estado: "INACTIVO" }) }); return `Usuario @${dialogo.u.username} desactivado.`; }}
          onClose={() => setDialogo(null)} onHecho={hecho} />
      ) : null}
      {dialogo?.tipo === "activar" ? (
        <ConfirmarAccion usuario={dialogo.u} icono="usuarioOk" titulo="Activar usuario" subtitulo="Confirma el cambio de acceso" boton="Activar usuario"
          pregunta={<>¿Quieres activar la cuenta de {nombreDe(dialogo.u)}? El usuario podrá volver a iniciar sesión.</>}
          ejecutar={async () => { await request(`/api/usuarios/${dialogo.u.id}`, { method: "PATCH", body: JSON.stringify({ estado: "ACTIVO" }) }); return `Usuario @${dialogo.u.username} activado.`; }}
          onClose={() => setDialogo(null)} onHecho={hecho} />
      ) : null}

      {jornadasDe ? <JornadasDrawer usuario={{ id: jornadasDe.id, nombre: nombreDe(jornadasDe), username: jornadasDe.username }} onClose={() => setJornadasDe(null)} /> : null}
      {quitarCasosA ? (
        <QuitarCasosModal auditor={{ id: quitarCasosA.id, nombre: nombreDe(quitarCasosA) }} onClose={() => setQuitarCasosA(null)}
          onHecho={(r) => { const u = quitarCasosA; setQuitarCasosA(null); setOk(`Se ${r.quitadas === 1 ? "quitó 1 caso" : `quitaron ${r.quitadas.toLocaleString("es-PE")} casos`} a @${u.username}.`); }} />
      ) : null}
      {borrarA ? <BorrarUsuarioModal usuario={borrarA} onClose={() => setBorrarA(null)} onHecho={() => { const u = borrarA; setBorrarA(null); hecho(`@${u.username} se borró por completo.`); }} /> : null}
      {borrarTodos ? <BorrarEmpleadosModal onClose={() => setBorrarTodos(false)} onHecho={() => { setBorrarTodos(false); hecho("Listo: se borraron los asesores y supervisores."); }} /> : null}
    </div>
  );
}
