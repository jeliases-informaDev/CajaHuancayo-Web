import { Fragment, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Modal, Seg } from "./kit";
import { Field, Skeleton } from "./ui";
import { Icon } from "./icons";
import { descargarArchivo } from "../api";
import { fechaHora } from "../lib/format";
import {
  CATEGORIAS, GRAVEDAD, cambiosDe, consultaDe, diaLocal, hayFiltros, nombreRol, type Aviso, type Filtros, type Metricas, type Registro,
} from "../lib/seguridad";

const num = (n?: number) => (n ?? 0).toLocaleString("es-PE");

// ---------------------------------------------------------------- cifras de arriba
function Metrica({ valor, etiqueta, alerta }: { valor?: number; etiqueta: string; alerta?: boolean }) {
  return (
    <div className={`metric${alerta && valor ? " alert" : ""}`}>
      <div className="figure">{num(valor)}</div>
      <p>{etiqueta}</p>
    </div>
  );
}

const VENTANAS = [{ value: "24h", label: "24 horas" }, { value: "7d", label: "7 días" }, { value: "30d", label: "30 días" }];
const TEXTO_VENTANA: Record<string, string> = { "24h": "las últimas 24 horas", "7d": "los últimos 7 días", "30d": "los últimos 30 días" };

export function MetricasSeguridad({ metricas, ventana, onVentana, cargando }: { metricas: Metricas | null; ventana: string; onVentana: (v: string) => void; cargando: boolean }) {
  const p = metricas?.postura;
  return (
    <section className="seg-resumen" aria-label="Resumen de seguridad">
      <div className="seg-periodo"><span className="lbl">Cifras de</span><Seg label="Periodo de las cifras" value={ventana} onChange={onVentana} options={VENTANAS} /></div>
      {cargando && !metricas ? <Skeleton height={120} radius={20} style={{ display: "block" }} /> : (
        <div className="metrics">
          <Metrica valor={metricas?.total_eventos} etiqueta={`Eventos en ${TEXTO_VENTANA[ventana] || "el periodo"}`} />
          <Metrica valor={metricas?.fallos_autenticacion} etiqueta="Accesos rechazados" alerta />
          <Metrica valor={metricas?.operaciones_criticas} etiqueta="Operaciones críticas" alerta />
          <Metrica valor={metricas?.cuentas_bloqueadas} etiqueta="Cuentas bloqueadas ahora" alerta />
        </div>
      )}
      {p ? (
        <p className="seg-postura">
          Verificación en dos pasos: <b>{num(p.oficina_con_mfa)} de {num(p.oficina_total)}</b> cuentas de oficina · Sin entrar hace más de 30 días: <b>{num(p.cuentas_sin_entrar_30d)}</b> {p.cuentas_sin_entrar_30d === 1 ? "cuenta" : "cuentas"}
        </p>
      ) : null}
    </section>
  );
}

// ---------------------------------------------------------------- requiere atención
export function AvisosSeguridad({ avisos, cargando, onVer }: { avisos: Aviso[] | null; cargando: boolean; onVer: (a: Aviso) => void }) {
  const n = avisos?.length ?? 0;
  return (
    <section className="section seg-avisos" aria-labelledby="seg-atencion">
      <div className="section-head"><h2 id="seg-atencion">Requiere atención</h2>{n ? <span className="meta">{n} {n === 1 ? "aviso" : "avisos"}</span> : null}</div>
      {cargando && !avisos ? <Skeleton height={86} radius={16} style={{ display: "block" }} /> : !n ? (
        <div role="status" className="callout ok">Todo en orden: no hay nada que revisar ahora.</div>
      ) : (
        <ul className="seg-lista-avisos">
          {avisos!.map((a) => (
            <li key={a.id} className={`seg-aviso ${a.severidad.toLowerCase()}`}>
              <span className="seg-punto" aria-hidden="true" />
              <div className="seg-aviso-cuerpo">
                <b>{a.titulo}</b>
                {a.detalle ? <span>{a.detalle}</span> : null}
                {a.ultima ? <small>Último: {fechaHora(a.ultima)}</small> : null}
              </div>
              <span className={`seg-grave ${a.severidad.toLowerCase()}`}>{GRAVEDAD[a.severidad]}</span>
              {a.filtro ? <button type="button" className="btn small ghost" onClick={() => onVer(a)}>Ver registros</button>
                : a.enlace ? <Link className="btn small ghost" to={a.enlace}>Abrir</Link>
                : a.ancla ? <a className="btn small ghost" href={`#${a.ancla}`}>Ir allí</a> : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ---------------------------------------------------------------- filtros del registro
const RESULTADOS = [{ value: "", label: "Todos" }, { value: "ok", label: "Correctos" }, { value: "error", label: "Rechazados" }];

export function FiltrosRegistro({ filtros, onCambio, onLimpiar }: { filtros: Filtros; onCambio: (parcial: Partial<Filtros>) => void; onLimpiar: () => void }) {
  // Lo que se escribe sube a la URL con una pequeña espera (no se pide al servidor en cada letra). Si la búsqueda cambia desde afuera (limpiar los filtros, un aviso,
  // «atrás» del navegador), el campo toma el nuevo valor: es el patrón de React para reiniciar un estado cuando cambia una propiedad.
  const [texto, setTexto] = useState(filtros.q);
  const [vista, setVista] = useState(filtros.q);
  if (filtros.q !== vista) { setVista(filtros.q); setTexto(filtros.q); }
  const espera = useRef<number | undefined>(undefined);
  const escribir = (valor: string) => {
    setTexto(valor);
    window.clearTimeout(espera.current);
    espera.current = window.setTimeout(() => onCambio({ q: valor }), 350);
  };
  return (
    <div className="filters seg-filtros">
      <div className="fgroup grow">
        <label className="lbl" htmlFor="seg-buscar">Buscar</label>
        <input id="seg-buscar" name="q" type="search" autoComplete="off" spellCheck={false} className="input" placeholder="Usuario, IP o número de expediente…" value={texto} onChange={(e) => escribir(e.target.value)} />
      </div>
      <div className="fgroup">
        <label className="lbl" htmlFor="seg-categoria">Categoría</label>
        <select id="seg-categoria" name="categoria" className="select" value={filtros.categoria} onChange={(e) => onCambio({ categoria: e.target.value })}>
          <option value="">Todas</option>
          {CATEGORIAS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      </div>
      <div className="fgroup">
        <label className="lbl" htmlFor="seg-gravedad">Gravedad</label>
        <select id="seg-gravedad" name="severidad" className="select" value={filtros.severidad} onChange={(e) => onCambio({ severidad: e.target.value })}>
          <option value="">Todas</option>
          {(["CRITICO", "AVISO", "INFO"] as const).map((g) => <option key={g} value={g}>{GRAVEDAD[g]}</option>)}
        </select>
      </div>
      <div className="fgroup">
        <span className="lbl">Resultado</span>
        <Seg label="Resultado" value={filtros.resultado} onChange={(v) => onCambio({ resultado: v })} options={RESULTADOS} />
      </div>
      <div className="fgroup">
        <label className="lbl" htmlFor="seg-desde">Desde</label>
        <input id="seg-desde" name="desde" type="date" className="input" value={filtros.desde} max={filtros.hasta || undefined} onChange={(e) => onCambio({ desde: e.target.value })} />
      </div>
      <div className="fgroup">
        <label className="lbl" htmlFor="seg-hasta">Hasta</label>
        <input id="seg-hasta" name="hasta" type="date" className="input" value={filtros.hasta} min={filtros.desde || undefined} onChange={(e) => onCambio({ hasta: e.target.value })} />
      </div>
      <label className="check-inline"><input type="checkbox" checked={filtros.cambios} onChange={(e) => onCambio({ cambios: e.target.checked })} />Solo cambios de datos</label>
      {filtros.actor || filtros.accion ? (
        <div className="seg-fichas" aria-label="Filtros aplicados desde un aviso">
          {filtros.actor ? <button type="button" className="seg-ficha" onClick={() => onCambio({ actor: "" })} aria-label={`Quitar el filtro de usuario ${filtros.actor}`}>Usuario: {filtros.actor} <Icon name="cerrar" size={13} /></button> : null}
          {filtros.accion ? <button type="button" className="seg-ficha" onClick={() => onCambio({ accion: "" })} aria-label="Quitar el filtro de acción">Acción: {filtros.accion.toLowerCase().replaceAll("_", " ")} <Icon name="cerrar" size={13} /></button> : null}
        </div>
      ) : null}
      {hayFiltros(filtros) ? <button type="button" className="btn small quiet seg-limpiar" onClick={onLimpiar}>Limpiar filtros</button> : null}
    </div>
  );
}

// ---------------------------------------------------------------- tabla
function Detalle({ r }: { r: Registro }) {
  const cambios = cambiosDe(r.valor_anterior, r.valor_nuevo);
  return (
    <div className="seg-detalle">
      <dl className="seg-datos">
        <div><dt>Fecha exacta</dt><dd>{new Date(r.fecha).toLocaleString("es-PE", { dateStyle: "full", timeStyle: "medium" })}</dd></div>
        <div><dt>Quién</dt><dd>{r.actor_nombre ? `${r.actor_nombre} (@${r.actor})` : r.actor || "Sin sesión"}{r.rol ? ` · ${nombreRol(r.rol)}` : ""}</dd></div>
        <div><dt>Desde</dt><dd><span translate="no">{r.ip_address || "—"}</span>{r.plataforma ? ` · ${r.plataforma === "MOVIL" ? "App del celular" : "Panel web"}` : ""}</dd></div>
        {r.device_id ? <div><dt>Dispositivo</dt><dd className="code" translate="no">{r.device_id}</dd></div> : null}
        <div><dt>Operación</dt><dd className="code" translate="no">{r.metodo} {r.ruta} → {r.estado_http}</dd></div>
        {r.request_id ? <div><dt>Id de la petición</dt><dd className="code" translate="no">{r.request_id}</dd></div> : null}
        {r.user_agent ? <div><dt>Navegador o app</dt><dd className="seg-ua" translate="no">{r.user_agent}</dd></div> : null}
      </dl>
      <div className="seg-cambios">
        <p className="lbl">Cambios</p>
        {r.con_cambios && cambios.length ? (
          <table className="seg-tabla-cambios">
            <thead><tr><th scope="col">Dato</th><th scope="col">Antes</th><th scope="col">Después</th></tr></thead>
            <tbody>{cambios.map((c) => <tr key={c.campo}><th scope="row">{c.nombre}</th><td>{c.antes}</td><td>{c.despues}</td></tr>)}</tbody>
          </table>
        ) : <p className="subtle">{r.con_cambios ? "No cambió ningún dato." : "Este evento no cambia datos."}</p>}
      </div>
    </div>
  );
}

export function TablaRegistro({ filas }: { filas: Registro[] }) {
  const [abierto, setAbierto] = useState<string | null>(null);
  return (
    <div className="table-wrap long">
      <table className="seg-tabla">
        <thead><tr><th scope="col" style={{ width: 40 }}><span className="sr-only">Detalle</span></th><th scope="col">Fecha</th><th scope="col">Quién</th><th scope="col">Qué pasó</th><th scope="col">Resultado</th><th scope="col">Desde</th></tr></thead>
        <tbody>
          {filas.map((r) => {
            const esta = abierto === r.id_auditoria;
            return (
              <Fragment key={r.id_auditoria}>
                <tr className={`clickable seg-fila ${r.severidad.toLowerCase()}${esta ? " abierta" : ""}`} onClick={() => setAbierto(esta ? null : r.id_auditoria)}>
                  <td>
                    <button type="button" className="kebab" aria-expanded={esta} aria-label={esta ? "Ocultar el detalle" : "Ver el detalle"} onClick={(e) => { e.stopPropagation(); setAbierto(esta ? null : r.id_auditoria); }}>
                      <Icon name={esta ? "arriba" : "abajo"} size={15} />
                    </button>
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>{fechaHora(r.fecha)}</td>
                  <td><b className="seg-quien">{r.actor_nombre || r.actor || "Sin sesión"}</b><span className="sub">{r.actor_nombre && r.actor ? `@${r.actor}` : ""}{r.rol ? `${r.actor_nombre && r.actor ? " · " : ""}${nombreRol(r.rol)}` : ""}</span></td>
                  <td>
                    <span className="seg-titulo">{r.titulo}</span>
                    <span className="sub"><span className="seg-cat">{r.categoria_texto}</span>{r.severidad !== "INFO" ? <span className={`seg-grave ${r.severidad.toLowerCase()}`}>{GRAVEDAD[r.severidad]}</span> : null}</span>
                  </td>
                  <td><span className={`state ${r.resultado === "ok" ? "ok" : "bad"}`}>{r.resultado === "ok" ? "Correcto" : `Rechazado ${r.estado_http}`}</span></td>
                  <td><span className="code" translate="no">{r.ip_address || "—"}</span><span className="sub">{r.plataforma === "MOVIL" ? "App del celular" : r.plataforma === "WEB" ? "Panel web" : ""}</span></td>
                </tr>
                {esta ? <tr className="seg-fila-detalle"><td /><td colSpan={5}><Detalle r={r} /></td></tr> : null}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------- exportar
const hoyLocal = () => diaLocal(new Date().toISOString());
const haceDias = (n: number) => diaLocal(new Date(Date.now() - n * 86_400_000).toISOString());

// Descarga el registro filtrado en CSV. El servidor exige un rango de fechas (de hasta un año) para que nunca sea un volcado sin límite.
export function ExportarModal({ filtros, onClose }: { filtros: Filtros; onClose: () => void }) {
  const [desde, setDesde] = useState(filtros.desde || haceDias(30));
  const [hasta, setHasta] = useState(filtros.hasta || hoyLocal());
  const [bajando, setBajando] = useState(false);
  const [error, setError] = useState("");
  const dias = (Date.parse(hasta) - Date.parse(desde)) / 86_400_000;
  const rangoMalo = !desde || !hasta || dias < 0 || dias > 366;

  const descargar = async () => {
    setBajando(true); setError("");
    try {
      const p = consultaDe({ ...filtros, desde, hasta });
      await descargarArchivo(`/api/seguridad/exportar?${p.toString()}`, `registro-de-seguridad-${desde}_a_${hasta}.csv`);
      onClose();
    } catch (e: any) { setError(e?.message || "No se pudo descargar el registro."); } finally { setBajando(false); }
  };
  const aplicados = [filtros.q && `búsqueda «${filtros.q}»`, filtros.categoria && `categoría ${CATEGORIAS.find((c) => c.value === filtros.categoria)?.label}`, filtros.severidad && `gravedad ${GRAVEDAD[filtros.severidad as keyof typeof GRAVEDAD]}`,
    filtros.resultado && (filtros.resultado === "ok" ? "solo correctos" : "solo rechazados"), filtros.cambios && "solo cambios de datos", filtros.actor && `usuario ${filtros.actor}`].filter(Boolean);
  return (
    <Modal title="Exportar el registro" onClose={() => { if (!bajando) onClose(); }}
      footer={<><button className="btn ghost" onClick={onClose} disabled={bajando}>Cancelar</button><button className="btn" onClick={descargar} disabled={bajando || rangoMalo}><Icon name="descargar" size={17} />{bajando ? "Preparando…" : "Descargar CSV"}</button></>}>
      <div className="mp-cuerpo">
        <p className="subtle" style={{ margin: 0 }}>Se descarga un archivo CSV (se abre en Excel) con los eventos del rango elegido{aplicados.length ? `, con los filtros aplicados: ${aplicados.join(", ")}` : ""}. La descarga también queda anotada en el registro.</p>
        {error ? <div role="alert" className="error-box">{error}</div> : null}
        <div className="seg-rango">
          <Field label="Desde"><input name="desde" type="date" value={desde} max={hasta || undefined} onChange={(e) => setDesde(e.target.value)} disabled={bajando} /></Field>
          <Field label="Hasta"><input name="hasta" type="date" value={hasta} min={desde || undefined} onChange={(e) => setHasta(e.target.value)} disabled={bajando} /></Field>
        </div>
        {rangoMalo ? <p role="alert" className="subtle" style={{ margin: 0, color: "var(--bad)" }}>{!desde || !hasta ? "Elige las dos fechas." : dias < 0 ? "La fecha final no puede ser anterior a la inicial." : "El rango máximo para exportar es de un año."}</p> : null}
      </div>
    </Modal>
  );
}
