import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { request } from "../api";
import { Empty, Skeleton } from "../components/ui";
import { Icon } from "../components/icons";
import CargarArchivo from "../components/expedientes/CargarArchivo";
import DireccionesMapa from "../components/expedientes/DireccionesMapa";
import HistorialCargas from "../components/expedientes/HistorialCargas";
import NuevoExpediente from "../components/expedientes/NuevoExpediente";
import PlantillasModal from "../components/expedientes/PlantillasModal";
import VistaExpediente from "../components/expedientes/VistaExpediente";
import { PastillaEstado, PastillaTipo, PastillaUbicacion } from "../components/expedientes/pastillas";
import { refrescarResumen, useResumen } from "../lib/resumen";
import { dash, GEO_ESTADO, nombrePropio } from "../lib/format";
import { ESTADOS, SIN_FILTROS_EXP, consultaExpedientes, useFiltrosExpedientes } from "../lib/filtrosExpedientes";
import { TAMANOS, paginasVisibles } from "../lib/paginas";
import "../expedientes.css";

// Expedientes — diseño de Figma: buscador y acciones arriba (historial, plantillas, nuevo expediente y cargar archivo), filtros en una fila y la tabla en una
// tarjeta con su pie de paginación. Los filtros viven en la URL y la paginación la hace el servidor. Las ventanas (cargar archivo, historial, plantillas y
// nuevo expediente) están en components/expedientes. Lo que ya había se conserva: la vista rápida de cada expediente, los enlaces con filtros y la calidad
// de las direcciones en el mapa (ahora en la burbuja «Direcciones»).

type Ventana = null | "cargar" | "historial" | "plantillas" | "nuevo";

export default function ExpedientesPage() {
  const { search } = useLocation();
  const { filtros, pagina, filas, fijarFiltros, irAPagina, fijarFilas, quitarParametro } = useFiltrosExpedientes();
  const { resumen } = useResumen();
  const [data, setData] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [paginas, setPaginas] = useState(1);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [ventana, setVentana] = useState<Ventana>(null);
  const [vista, setVista] = useState<number | null>(null);
  const [recarga, setRecarga] = useState(0);
  const [texto, setTexto] = useState(filtros.q);
  const entradaBusca = useRef<HTMLInputElement>(null);
  const tarjeta = useRef<HTMLDivElement>(null);

  const consulta = useMemo(() => consultaExpedientes(filtros, pagina, filas).toString(), [filtros, pagina, filas]);
  useEffect(() => {
    let vigente = true; // si llega una respuesta vieja después de cambiar un filtro, se ignora
    setCargando(true);
    request<{ data: any[]; pagination: { total: number; pages: number } }>(`/api/expedientes?${consulta}`)
      .then((r) => {
        if (!vigente) return;
        // Si los filtros dejaron menos páginas que la que se miraba, se vuelve a la última.
        if (!r.data.length && r.pagination.total > 0 && pagina > 1) { irAPagina(Math.max(1, r.pagination.pages)); return; }
        setData(r.data); setTotal(r.pagination.total); setPaginas(r.pagination.pages); setError("");
      })
      .catch((e) => { if (vigente) setError(e?.message || "No se pudieron cargar los expedientes."); })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [consulta, recarga]); // eslint-disable-line react-hooks/exhaustive-deps

  // Después de cargar, crear o procesar direcciones: se vuelve a pedir la lista y las cifras de las fichas de estado.
  const recargar = useCallback(() => { setRecarga((n) => n + 1); refrescarResumen(); }, []);

  // Búsqueda por texto: espera un momento después de la última tecla (o Enter) y se guarda en la URL. Con menos de 2 letras no filtra.
  const aplicarTexto = (t: string) => { const limpio = t.trim(); fijarFiltros({ q: limpio.length >= 2 ? limpio : "" }); };
  useEffect(() => {
    const limpio = texto.trim();
    if ((limpio.length >= 2 ? limpio : "") === filtros.q) return;
    const t = setTimeout(() => aplicarTexto(texto), 300);
    return () => clearTimeout(t);
  }, [texto]); // eslint-disable-line react-hooks/exhaustive-deps
  // Si la URL cambia desde afuera (por ejemplo «Limpiar filtros»), la caja la sigue; sin pisar lo que se está escribiendo.
  useEffect(() => { setTexto((t) => (t.trim() === filtros.q || (t.trim().length < 2 && filtros.q === "") ? t : filtros.q)); }, [filtros.q]);

  // «?nuevo=1» (la paleta y otros enlaces) abre el alta de un expediente.
  useEffect(() => { if (new URLSearchParams(search).get("nuevo") === "1") { setVentana("nuevo"); quitarParametro("nuevo"); } }, [search, quitarParametro]);

  // Ctrl/Cmd + K lleva al buscador de esta pantalla (en vez de abrir la paleta general), como en Seguimiento y Visitas.
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
  const limpiarTodo = () => { setTexto(""); fijarFiltros({ ...SIN_FILTROS_EXP }); };
  const hayFiltros = Boolean(filtros.q || filtros.tipo || filtros.estado || filtros.sinUbicacion || filtros.geo);
  const desdeN = (pagina - 1) * filas + 1;
  const anuncio = cargando ? "Cargando expedientes…" : `${total.toLocaleString("es-PE")} ${total === 1 ? "expediente encontrado" : "expedientes encontrados"}`;

  const fichas = resumen ? [
    { v: "", etiqueta: "Todos", n: resumen.expedientes.total, color: "var(--ex-indigo)" },
    { v: "PENDIENTE", etiqueta: "Sin asignar", n: resumen.expedientes.por_estado.PENDIENTE || 0, color: "#9aa0bb" },
    { v: "ASIGNADO", etiqueta: "Asignados", n: resumen.expedientes.por_estado.ASIGNADO || 0, color: "#8a2fa0" },
    { v: "VISITADO", etiqueta: "Visitados", n: resumen.expedientes.por_estado.VISITADO || 0, color: "var(--ok)" },
  ] : [];

  return (
    <div className="ex-pagina">
      <h1 className="sr-only">Expedientes</h1>
      <p className="sr-only" role="status" aria-live="polite">{anuncio}</p>

      <div className="ex-barra">
        <div className="ex-busca">
          <Icon name="buscar" size={16} />
          <label className="sr-only" htmlFor="ex-q">Buscar cliente, crédito o asesor</label>
          <input ref={entradaBusca} id="ex-q" name="q" type="search" placeholder="Buscar cliente, crédito o asesor…" autoComplete="off" spellCheck={false} maxLength={150}
            value={texto} onChange={(e) => setTexto(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") aplicarTexto(texto); }} />
          <kbd aria-hidden="true">Ctrl K</kbd>
        </div>
        <div className="ex-acciones">
          <div className="ex-enlaces">
            <DireccionesMapa geo={filtros.geo} onGeo={(v) => fijarFiltros({ geo: v })} onCambio={recargar} />
            <button type="button" className="ex-enlace" onClick={() => setVentana("historial")}><Icon name="reloj" size={15} />Historial de cargas</button>
            <button type="button" className="ex-enlace" onClick={() => setVentana("plantillas")}><Icon name="descargar" size={15} />Plantillas</button>
          </div>
          <div className="ex-botones">
            <button type="button" className="ex-boton" onClick={() => setVentana("nuevo")}><Icon name="mas" size={15} /><span>Nuevo expediente</span></button>
            <button type="button" className="ex-boton primario" onClick={() => setVentana("cargar")}><Icon name="subir" size={15} /><span>Cargar archivo</span></button>
          </div>
        </div>
      </div>
      <hr className="ex-regla" />

      <div className="ex-filtros">
        <div className="ex-grupo">
          <span className="ex-et" id="ex-et-asig">Estado de asignación</span>
          <div className="ex-fichas" role="group" aria-labelledby="ex-et-asig">
            {fichas.length ? fichas.map((x) => (
              <button key={x.v} type="button" className={`ex-ficha${filtros.estado === x.v ? " on" : ""}`} aria-pressed={filtros.estado === x.v} onClick={() => fijarFiltros({ estado: x.v })} style={{ ["--c" as any]: x.color }}>
                <i aria-hidden="true" /><b>{x.n.toLocaleString("es-PE")}</b>{x.etiqueta}
              </button>
            )) : <Skeleton width={420} height={28} radius={14} />}
          </div>
        </div>
        <div className="ex-grupo">
          <span className="ex-et" id="ex-et-tipo">Tipo de crédito</span>
          <div className="ex-seg" role="group" aria-labelledby="ex-et-tipo">
            {([["", "Todos"], ["OTROS", "MYPE"], ["CONSUMO", "Consumo"]] as const).map(([v, et]) => <button key={v} type="button" className={filtros.tipo === v ? "on" : ""} aria-pressed={filtros.tipo === v} onClick={() => fijarFiltros({ tipo: v })}>{et}</button>)}
          </div>
        </div>
        <div className="ex-grupo">
          <label className="ex-et" htmlFor="ex-estado">Estado</label>
          <select id="ex-estado" name="estado" className="ex-select" value={filtros.estado} onChange={(e) => fijarFiltros({ estado: e.target.value })}>
            <option value="">Todos</option>
            {ESTADOS.map((e) => <option key={e.clave} value={e.clave}>{e.etiqueta}</option>)}
          </select>
        </div>
        <div className="ex-grupo">
          <span className="ex-et" id="ex-et-ubic">Ubicación</span>
          <label className="ex-opcion-fila" aria-labelledby="ex-et-ubic ex-txt-ubic">
            <input type="checkbox" className="ex-chk" name="sin_coordenadas" checked={filtros.sinUbicacion} onChange={(e) => fijarFiltros({ sinUbicacion: e.target.checked })} />
            <span id="ex-txt-ubic">Solo sin coordenadas</span>
          </label>
        </div>
      </div>

      {error ? <div role="alert" className="error-box">{error}</div> : null}

      {cargando && !data.length ? (
        <div className="ex-tarjeta" aria-busy="true"><div className="ex-esqueleto">{[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} height={40} radius={10} style={{ display: "block" }} />)}</div></div>
      ) : !data.length ? (
        <Empty tipo={hayFiltros ? "busqueda" : "vacio"} title="Sin expedientes"
          text={hayFiltros ? "Ningún expediente coincide con estos filtros." : "Carga un archivo de Excel para empezar (en «Plantillas» tienes el formato listo para llenar)."}
          action={hayFiltros ? <button type="button" className="btn ghost" onClick={limpiarTodo}>Limpiar filtros</button>
            : <div className="row" style={{ justifyContent: "center", gap: 10 }}><button type="button" className="btn" onClick={() => setVentana("cargar")}><Icon name="subir" size={17} />Cargar archivo</button><button type="button" className="btn ghost" onClick={() => setVentana("plantillas")}><Icon name="descargar" size={17} />Plantillas</button></div>} />
      ) : (
        <div className="ex-tarjeta" ref={tarjeta} aria-busy={cargando}>
          <div className="ex-scroll">
            <table className="ex-tabla">
              <caption className="sr-only">Expedientes cargados</caption>
              <colgroup><col style={{ width: "14.4%" }} /><col style={{ width: "21.6%" }} /><col style={{ width: "7.8%" }} /><col style={{ width: "12.5%" }} /><col style={{ width: "18.6%" }} /><col style={{ width: "14.2%" }} /><col style={{ width: "10.9%" }} /></colgroup>
              <thead><tr><th scope="col">Crédito</th><th scope="col">Cliente</th><th scope="col" className="c">Tipo</th><th scope="col">Distrito</th><th scope="col">Asesor</th><th scope="col">Ubicación</th><th scope="col">Estado</th></tr></thead>
              <tbody>
                {data.map((x) => {
                  const conCoordenadas = x.latitud != null && x.longitud != null;
                  return (
                    <tr key={x.id_expediente} className={vista === x.id_expediente ? "on" : ""} onClick={() => setVista(x.id_expediente)}>
                      <td className="ex-cod" translate="no">{x.codigo_expediente}</td>
                      <td><div className="ex-cliente"><button type="button" className="ex-nombre" onClick={(e) => { e.stopPropagation(); setVista(x.id_expediente); }} title={x.nombres_cliente}>{nombrePropio(x.nombres_cliente)}</button><small translate="no">{x.numero_documento_cliente}</small></div></td>
                      <td className="c"><PastillaTipo tipo={x.tipo_credito} /></td>
                      <td className="ex-texto">{dash(x.distrito)}</td>
                      <td className="ex-texto">{dash(x.asesor_responsable)}</td>
                      <td>
                        <PastillaUbicacion con={conCoordenadas} />
                        {x.geo_estado ? <small className="ex-geo">{GEO_ESTADO[x.geo_estado]?.etiqueta || x.geo_estado}{x.geo_confianza && x.geo_estado === "LOCALIZADO" ? ` · ${x.geo_confianza === "ALTA" ? "precisa" : "aproximada"}` : ""}</small> : null}
                      </td>
                      <td><PastillaEstado estado={x.estado} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="ex-pie">
            <label className="ex-filas">Mostrar resultado
              <select name="filas" value={filas} onChange={(e) => fijarFilas(Number(e.target.value))}>
                {TAMANOS.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
            <span className="ex-rango">{desdeN.toLocaleString("es-PE")}–{(desdeN + data.length - 1).toLocaleString("es-PE")} de {total.toLocaleString("es-PE")}</span>
            {paginas > 1 ? (
              <nav className="ex-paginas" aria-label="Paginación">
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

      {vista !== null ? <VistaExpediente id={vista} onClose={() => setVista(null)} /> : null}
      {ventana === "cargar" ? <CargarArchivo onClose={() => setVentana(null)} onDone={recargar} onVerPlantillas={() => setVentana("plantillas")} /> : null}
      {ventana === "historial" ? <HistorialCargas onClose={() => setVentana(null)} /> : null}
      {ventana === "plantillas" ? <PlantillasModal onClose={() => setVentana(null)} onCargar={() => setVentana("cargar")} /> : null}
      {ventana === "nuevo" ? <NuevoExpediente onClose={() => setVentana(null)} onCreado={recargar} /> : null}
    </div>
  );
}
