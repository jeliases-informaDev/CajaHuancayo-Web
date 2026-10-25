import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { descargarArchivo, request } from "../api";
import { useAuth } from "../AuthContext";
import { Avatar, Badge, Empty, Skeleton } from "../components/ui";
import { Pips } from "../components/kit";
import { Icon } from "../components/icons";
import FiltrosVisitas from "../components/FiltrosVisitas";
import { senalesDeLista } from "../lib/senales";
import { fechaCorta, horaCorta, nombrePropio } from "../lib/format";
import { FICHAS, RESULTADOS, SIN_FILTROS, TAMANOS, consultaApi, etiquetaRango, hoyLocal, paginasVisibles, useFiltrosVisitas } from "../lib/filtrosVisitas";
import "../visitas.css";

// Visitas — diseño de Figma: buscador, EXPORTAR y FILTROS arriba; la tabla en una tarjeta con su pie de paginación. Los filtros viven en la URL y salen en un
// panel que se abre y se cierra con el botón (no tapa la tabla mientras no se usa); los puestos se ven como etiquetas encima. Todo lo filtra el servidor, y la
// paginación también, así que la lista aguanta miles de visitas sin cargarlas de golpe.

type Auditor = { id: string; nombres?: string | null; username: string };
type Respuesta = { data: any[]; pagination: { page: number; limit: number; total: number; pages: number }; conteos?: Record<string, number> };

const distanciaTexto = (m: any) => (m == null ? "-" : Number(m) >= 1000 ? `${(Number(m) / 1000).toFixed(1)} km` : `${Math.round(Number(m))} m`);

export default function VisitasPage() {
  const navigate = useNavigate();
  const { search } = useLocation();
  const { user, empresaElegida } = useAuth();
  const esAdmin = user?.rol === "ADMINISTRADOR" || (user?.rol === "UNIVERSAL" && Boolean(empresaElegida));
  const { filtros, pagina, filas, fijarFiltros, irAPagina, fijarFilas } = useFiltrosVisitas();
  const [data, setData] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [paginas, setPaginas] = useState(1);
  const [conteos, setConteos] = useState<Record<string, number>>({});
  const [auditores, setAuditores] = useState<Auditor[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [exportando, setExportando] = useState(false);
  const [errorExportar, setErrorExportar] = useState("");
  const [texto, setTexto] = useState(filtros.q);
  const entradaBusca = useRef<HTMLInputElement>(null);
  const tarjeta = useRef<HTMLDivElement>(null);
  // Minutos que el navegador está detrás de UTC (300 en Perú): el servidor cuenta los días «Hoy», «Ayer»… con el reloj del usuario.
  const desfase = useMemo(() => new Date().getTimezoneOffset(), []);

  useEffect(() => { request<{ data: Auditor[] }>("/api/usuarios/auditores").then((r) => setAuditores(r.data)).catch(() => {}); }, []);

  const consulta = useMemo(() => {
    const p = consultaApi(filtros, desfase);
    p.set("page", String(pagina)); p.set("limit", String(filas));
    return p.toString();
  }, [filtros, desfase, pagina, filas]);

  useEffect(() => {
    let vigente = true; // si llega una respuesta vieja después de cambiar un filtro, se ignora
    setCargando(true);
    request<Respuesta>(`/api/visitas?${consulta}`)
      .then((r) => {
        if (!vigente) return;
        // Si los filtros dejaron menos páginas que la que se miraba, se vuelve a la última.
        if (!r.data.length && r.pagination.total > 0 && pagina > 1) { irAPagina(Math.max(1, r.pagination.pages)); return; }
        setData(r.data); setTotal(r.pagination.total); setPaginas(r.pagination.pages); setConteos(r.conteos || {}); setError("");
      })
      .catch((e) => { if (vigente) setError(e?.message || "No se pudieron cargar las visitas."); })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [consulta]); // eslint-disable-line react-hooks/exhaustive-deps

  // La mesa de revisión recorre esta misma lista con «anterior / siguiente»: se guarda el orden que se está viendo y los filtros, para volver a ellos.
  useEffect(() => {
    try { sessionStorage.setItem("ch_cola_visitas", JSON.stringify(data.map((v) => v.id_visita))); } catch { /* sin almacenamiento */ }
  }, [data]);
  useEffect(() => {
    try { sessionStorage.setItem("ch_visitas_url", search); } catch { /* sin almacenamiento */ }
  }, [search]);

  // Búsqueda por texto: espera un momento después de la última tecla (o Enter) y se guarda en la URL. Con menos de 2 letras no filtra.
  const aplicarTexto = (t: string) => { const limpio = t.trim(); fijarFiltros({ q: limpio.length >= 2 ? limpio : "" }); };
  useEffect(() => {
    const limpio = texto.trim();
    if ((limpio.length >= 2 ? limpio : "") === filtros.q) return;
    const t = setTimeout(() => aplicarTexto(texto), 300);
    return () => clearTimeout(t);
  }, [texto]); // eslint-disable-line react-hooks/exhaustive-deps
  // Si la URL cambia desde afuera (por ejemplo «Limpiar»), la caja la sigue; sin pisar lo que se está escribiendo.
  useEffect(() => { setTexto((t) => (t.trim() === filtros.q || (t.trim().length < 2 && filtros.q === "") ? t : filtros.q)); }, [filtros.q]);

  // Ctrl/Cmd + K lleva al buscador de esta pantalla (en vez de abrir la paleta general), como en Seguimiento.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); e.stopImmediatePropagation(); entradaBusca.current?.focus(); entradaBusca.current?.select(); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const exportar = async () => {
    setExportando(true); setErrorExportar("");
    try { await descargarArchivo(`/api/visitas/exportar?${consultaApi(filtros, desfase).toString()}`, `visitas-${hoyLocal()}.xlsx`); }
    catch (e: any) { setErrorExportar(e?.message || "No se pudo exportar. Intenta de nuevo."); }
    finally { setExportando(false); }
  };

  const irPagina = (n: number) => {
    irAPagina(n);
    const arriba = tarjeta.current?.getBoundingClientRect().top ?? 0;
    if (arriba < 60) window.scrollBy({ top: arriba - 70 });
  };
  const limpiarTodo = () => { setTexto(""); fijarFiltros({ ...SIN_FILTROS }); };

  // Etiquetas de los filtros puestos, cada una con su equis.
  const nombreAuditor = auditores.find((a) => a.id === filtros.auditor);
  const etiquetas: { clave: string; texto: string; quitar: () => void }[] = [];
  if (filtros.resultado.length) etiquetas.push({ clave: "resultado", texto: `Resultado: ${filtros.resultado.map((c) => RESULTADOS.find((r) => r.clave === c)?.plural).join(", ")}`, quitar: () => fijarFiltros({ resultado: [] }) });
  if (filtros.tipo.length) etiquetas.push({ clave: "tipo", texto: `Ficha: ${filtros.tipo.map((c) => FICHAS.find((f) => f.clave === c)?.etiqueta).join(", ")}`, quitar: () => fijarFiltros({ tipo: [] }) });
  if (filtros.desde || filtros.hasta) etiquetas.push({ clave: "fecha", texto: `Fecha: ${etiquetaRango(filtros.desde, filtros.hasta)}`, quitar: () => fijarFiltros({ desde: "", hasta: "" }) });
  if (filtros.auditor) etiquetas.push({ clave: "auditor", texto: `Auditor: ${nombreAuditor ? nombreAuditor.nombres || nombreAuditor.username : "elegido"}`, quitar: () => fijarFiltros({ auditor: "" }) });
  if (filtros.alertas) etiquetas.push({ clave: "alertas", texto: "Con alertas de seguridad", quitar: () => fijarFiltros({ alertas: false }) });
  const hayFiltros = etiquetas.length > 0 || Boolean(filtros.q);

  const desdeN = (pagina - 1) * filas + 1;
  const anuncio = cargando ? "Cargando visitas…" : `${total.toLocaleString("es-PE")} ${total === 1 ? "visita encontrada" : "visitas encontradas"}`;

  return (
    <div className="vi-pagina">
      <h1 className="sr-only">Visitas</h1>
      <p className="sr-only" role="status" aria-live="polite">{anuncio}</p>

      <div className="vi-barra">
        <div className="vi-busca">
          <Icon name="buscar" size={16} />
          <label className="sr-only" htmlFor="vi-q">Buscar cliente o crédito</label>
          <input ref={entradaBusca} id="vi-q" name="q" type="search" placeholder="Buscar cliente o crédito…" autoComplete="off" spellCheck={false} maxLength={100}
            value={texto} onChange={(e) => setTexto(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") aplicarTexto(texto); }} />
          <kbd aria-hidden="true">Ctrl K</kbd>
        </div>
        <div className="vi-acciones">
          <button type="button" className="vi-boton" onClick={exportar} disabled={exportando || (!cargando && total === 0)} aria-busy={exportando}>
            <Icon name="descargar" size={15} /><span>{exportando ? "Exportando…" : "Exportar Excel"}</span>
          </button>
          <FiltrosVisitas filtros={filtros} conteos={conteos} auditores={auditores}
            onAplicar={(f) => fijarFiltros(f)} onLimpiar={() => fijarFiltros({ resultado: [], tipo: [], desde: "", hasta: "", auditor: "", alertas: false })} />
        </div>
      </div>

      {error ? <div role="alert" className="error-box">{error}</div> : null}
      {errorExportar ? <div role="alert" className="error-box">{errorExportar}</div> : null}

      {etiquetas.length ? (
        <div className="vi-etiquetas" role="group" aria-label="Filtros puestos">
          {etiquetas.map((e) => (
            <span key={e.clave} className="vi-etiqueta">{e.texto}
              <button type="button" onClick={e.quitar} aria-label={`Quitar el filtro «${e.texto}»`}><Icon name="cerrar" size={12} strokeWidth={2.2} /></button>
            </span>
          ))}
          {etiquetas.length > 1 ? <button type="button" className="vi-limpiar-todo" onClick={() => fijarFiltros({ resultado: [], tipo: [], desde: "", hasta: "", auditor: "", alertas: false })}>Limpiar filtros</button> : null}
        </div>
      ) : null}

      {cargando && !data.length ? (
        <div className="vi-tarjeta" aria-busy="true">
          <div className="vi-esqueleto">{[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} height={40} radius={10} style={{ display: "block" }} />)}</div>
        </div>
      ) : !data.length ? (
        <Empty tipo={hayFiltros ? "busqueda" : "visitas"} title="Sin visitas"
          text={hayFiltros ? "No hay visitas con estos filtros. Prueba con otros." : "Cuando los auditores registren visitas desde la app, aparecerán aquí."}
          action={hayFiltros ? <button type="button" className="btn ghost" onClick={limpiarTodo}>Limpiar filtros</button>
            : esAdmin ? <p className="subtle">Para ver esta pantalla con información de ejemplo, enciende el modo pruebas en <Link to="/seguridad">Seguridad</Link> y carga las visitas de ejemplo.</p> : undefined} />
      ) : (
        <div className="vi-tarjeta" ref={tarjeta} aria-busy={cargando}>
          <div className="vi-scroll">
            <table className="vi-tabla">
              <caption className="sr-only">Visitas registradas en campo</caption>
              <colgroup><col style={{ width: "28.5%" }} /><col style={{ width: "11%" }} /><col style={{ width: "13%" }} /><col style={{ width: "13%" }} /><col style={{ width: "14%" }} /><col style={{ width: "10%" }} /><col style={{ width: "10.5%" }} /></colgroup>
              <thead><tr><th scope="col">Clientes</th><th scope="col">Ficha</th><th scope="col">Auditor</th><th scope="col">Resultado</th><th scope="col">Señales</th><th scope="col">Distancia</th><th scope="col">Fecha</th></tr></thead>
              <tbody>
                {data.map((v) => {
                  const cliente = v.expediente?.nombres_cliente;
                  const auditor = v.auditor?.nombres || v.auditor?.username;
                  const mype = v.expediente?.tipo_credito === "OTROS";
                  return (
                    <tr key={v.id_visita} onClick={() => navigate(`/visitas/${v.id_visita}`)}>
                      <td>
                        <div className="vi-cliente">
                          <Avatar nombre={cliente} />
                          <div><Link to={`/visitas/${v.id_visita}`} onClick={(e) => e.stopPropagation()} title={cliente}>{nombrePropio(cliente)}</Link><small translate="no">{v.expediente?.codigo_expediente}</small></div>
                        </div>
                      </td>
                      <td><span className={`vi-ficha ${mype ? "mype" : "consumo"}`}>{mype ? "MYPE" : "Consumo"}</span></td>
                      <td><div className="vi-auditor"><Avatar nombre={auditor} size="sm" /><span title={auditor}>{auditor}</span></div></td>
                      <td><Badge label={v.resultado} /></td>
                      <td><Pips senales={senalesDeLista(v)} /></td>
                      <td className="vi-num">{distanciaTexto(v.distancia_domicilio_m)}</td>
                      <td className="vi-fecha"><b>{fechaCorta(v.fecha_hora_checkin)}</b><small>{horaCorta(v.fecha_hora_checkin)}</small></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="vi-pie">
            <label className="vi-filas">Mostrar resultado
              <select name="filas" value={filas} onChange={(e) => fijarFilas(Number(e.target.value))}>
                {TAMANOS.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
            <span className="vi-rango">{desdeN.toLocaleString("es-PE")}–{(desdeN + data.length - 1).toLocaleString("es-PE")} de {total.toLocaleString("es-PE")}</span>
            {paginas > 1 ? (
              <nav className="vi-paginas" aria-label="Paginación">
                {pagina > 1 ? <button type="button" className="mas" onClick={() => irPagina(pagina - 1)}>Anterior</button> : null}
                {paginasVisibles(pagina, paginas).map((p, i) => p === "…"
                  ? <span key={`e${i}`} className="elipsis" aria-hidden="true">…</span>
                  : <button key={p} type="button" aria-current={p === pagina ? "page" : undefined} aria-label={`Página ${p}`} onClick={() => irPagina(p)}>{p}</button>)}
                {pagina < paginas ? <button type="button" className="mas" onClick={() => irPagina(pagina + 1)}>Siguiente</button> : null}
              </nav>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
