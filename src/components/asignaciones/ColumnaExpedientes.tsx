import { useEffect, useMemo, useRef, useState } from "react";
import { request } from "../../api";
import { Icon } from "../icons";
import { Skeleton } from "../ui";
import Paginador from "../Paginador";
import { FILAS_PLANNER, TAMANOS_PLANNER, type Pendiente, type Seleccion } from "../../lib/asignaciones";
import { dash } from "../../lib/format";
import { enteroDe, useParametros } from "../../lib/useParametros";

// Columna «Expedientes sin asignar» de Asignaciones (diseño de Figma): buscador, tipo de crédito, distrito, la franja de lo marcado y la tabla con su pie de páginas.
// La lista se pide por páginas al servidor (del más antiguo al más nuevo) y todo lo que se filtra vive en la URL (q, tipo, distrito, pagina, filas). Lo marcado
// se conserva al cambiar de página o de filtro: lo guarda la pantalla, no esta columna.
export default function ColumnaExpedientes({ seleccion, onAlternar, onPagina, onLimpiar, refrescar }: {
  seleccion: Seleccion; onAlternar: (p: Pendiente) => void; onPagina: (filas: Pendiente[], marcar: boolean) => void; onLimpiar: () => void; refrescar: number;
}) {
  const { params, fijar } = useParametros();
  const q = (params.get("q") || "").trim().slice(0, 100);
  const tipo = params.get("tipo") === "OTROS" || params.get("tipo") === "CONSUMO" ? (params.get("tipo") as "OTROS" | "CONSUMO") : "";
  const distrito = (params.get("distrito") || "").slice(0, 100);
  const pagina = enteroDe(params, "pagina", 1);
  const pedidas = enteroDe(params, "filas", FILAS_PLANNER, 1, 100);
  const filas = TAMANOS_PLANNER.includes(pedidas) ? pedidas : FILAS_PLANNER;
  const [texto, setTexto] = useState(q);
  const [data, setData] = useState<Pendiente[]>([]);
  const [total, setTotal] = useState(0);
  const [paginas, setPaginas] = useState(1);
  const [distritos, setDistritos] = useState<{ distrito: string; n: number }[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const marcador = useRef<HTMLInputElement>(null);
  const cuerpo = useRef<HTMLDivElement>(null);

  const consulta = useMemo(() => {
    const p = new URLSearchParams({ limit: String(filas), page: String(pagina) });
    if (q) p.set("q", q);
    if (tipo) p.set("tipo", tipo);
    if (distrito) p.set("distrito", distrito);
    return p.toString();
  }, [q, tipo, distrito, pagina, filas]);

  useEffect(() => {
    let vigente = true; // si llega una respuesta vieja después de cambiar un filtro, se ignora
    setCargando(true);
    request<{ data: Pendiente[]; pagination: { total: number; pages: number } }>(`/api/asignaciones/pendientes?${consulta}`)
      .then((r) => {
        if (!vigente) return;
        // Si al asignar o filtrar quedaron menos páginas que la que se miraba, se vuelve a la última.
        if (!r.data.length && r.pagination.total > 0 && pagina > 1) { fijar({ pagina: r.pagination.pages > 1 ? r.pagination.pages : null }); return; }
        setData(r.data); setTotal(r.pagination.total); setPaginas(r.pagination.pages); setError("");
        if (cuerpo.current) cuerpo.current.scrollTop = 0;
      })
      .catch((e) => { if (vigente) setError(e?.message || "No se pudieron cargar los expedientes."); })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [consulta, refrescar]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let vigente = true;
    request<{ data: { distrito: string; n: number }[] }>(`/api/asignaciones/pendientes/distritos${tipo ? `?tipo=${tipo}` : ""}`)
      .then((r) => { if (vigente) setDistritos([...r.data].sort((a, b) => a.distrito.localeCompare(b.distrito, "es-PE"))); }).catch(() => {});
    return () => { vigente = false; };
  }, [tipo, refrescar]);

  // Búsqueda por texto: espera un momento después de la última tecla y se guarda en la URL (vuelve a la página 1).
  useEffect(() => {
    if (texto.trim() === q) return;
    const t = setTimeout(() => fijar({ q: texto.trim(), pagina: null }), 300);
    return () => clearTimeout(t);
  }, [texto]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setTexto((t) => (t.trim() === q ? t : q)); }, [q]);

  // Casilla de la cabecera: marcada si están todas las filas de esta página, a medias si solo algunas.
  const marcadas = data.filter((x) => seleccion.has(x.id_expediente)).length;
  const todas = data.length > 0 && marcadas === data.length;
  useEffect(() => { if (marcador.current) marcador.current.indeterminate = marcadas > 0 && !todas; }, [marcadas, todas]);

  const hayFiltros = Boolean(q || tipo || distrito);
  const limpiarFiltros = () => { setTexto(""); fijar({ q: null, tipo: null, distrito: null, pagina: null }); };

  return (
    <section className="as-col as-pool" aria-labelledby="as-tit-exp">
      <header className="as-cab">
        <h2 id="as-tit-exp">Expedientes sin asignar</h2>
        <span className="as-cuenta" role="status">{total.toLocaleString("es-PE")} sin asignar</span>
      </header>
      <div className="as-herramientas">
        <div className="as-busca ancho">
          <Icon name="buscar" size={16} />
          <label className="sr-only" htmlFor="as-q">Buscar crédito, cliente o distrito</label>
          <input id="as-q" name="q" type="search" placeholder="Buscar crédito, cliente o distrito…" autoComplete="off" spellCheck={false} maxLength={100} value={texto} onChange={(e) => setTexto(e.target.value)} />
        </div>
        <div className="as-fila-filtros">
          <div className="as-seg" role="group" aria-label="Tipo de crédito">
            {([["", "Todos"], ["OTROS", "MYPE"], ["CONSUMO", "Consumo"]] as const).map(([v, et]) => (
              <button key={v} type="button" className={tipo === v ? "on" : ""} aria-pressed={tipo === v} onClick={() => fijar({ tipo: v, distrito: null, pagina: null })}>{et}</button>
            ))}
          </div>
          <div className="as-distrito">
            <Icon name="filtro" size={15} />
            <label className="sr-only" htmlFor="as-distrito">Distrito</label>
            <select id="as-distrito" name="distrito" value={distrito} onChange={(e) => fijar({ distrito: e.target.value, pagina: null })}>
              <option value="">Todos los distritos</option>
              {distritos.map((d) => <option key={d.distrito} value={d.distrito}>{d.distrito} ({d.n.toLocaleString("es-PE")})</option>)}
              {distrito && !distritos.some((d) => d.distrito === distrito) ? <option value={distrito}>{distrito}</option> : null}
            </select>
          </div>
        </div>
      </div>

      {seleccion.size > 0 ? (
        <div className="as-marcados" role="status">
          <span className="as-ok" aria-hidden="true"><Icon name="ok" size={11} strokeWidth={2.8} /></span>
          <span>{seleccion.size.toLocaleString("es-PE")} {seleccion.size === 1 ? "seleccionado" : "seleccionados"} · aún sin asignar</span>
          <button type="button" className="as-enlace" onClick={onLimpiar}>Limpiar selección</button>
        </div>
      ) : null}
      {error ? <div role="alert" className="error-box" style={{ margin: "0 16px 10px" }}>{error}</div> : null}

      <div className="as-tabla-caja" ref={cuerpo} aria-busy={cargando}>
        {cargando && !data.length ? (
          <div className="as-esqueleto">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} height={52} radius={10} style={{ display: "block" }} />)}</div>
        ) : !data.length ? (
          <div className="as-vacio grande">
            <p className="t">{hayFiltros ? "Ningún expediente coincide" : "No hay expedientes por asignar"}</p>
            <p>{hayFiltros ? "Prueba con otra búsqueda, tipo o distrito." : "Todos los expedientes ya tienen auditor o todavía no cargaste ninguno."}</p>
            {hayFiltros ? <button type="button" className="as-enlace" onClick={limpiarFiltros}>Limpiar filtros</button> : null}
          </div>
        ) : (
          <table className="as-tabla">
            <caption className="sr-only">Expedientes sin asignar</caption>
            <colgroup><col style={{ width: "13%" }} /><col style={{ width: "42%" }} /><col style={{ width: "17%" }} /><col style={{ width: "28%" }} /></colgroup>
            <thead>
              <tr>
                <th scope="col" className="chk"><input ref={marcador} type="checkbox" className="pa-chk" checked={todas} onChange={() => onPagina(data, !todas)} aria-label="Marcar todos los de esta página" /></th>
                <th scope="col">Cliente / Crédito</th><th scope="col">Tipo</th><th scope="col">Distrito</th>
              </tr>
            </thead>
            <tbody>
              {data.map((x) => {
                const on = seleccion.has(x.id_expediente);
                return (
                  <tr key={x.id_expediente} className={on ? "on" : ""} aria-selected={on} onClick={() => onAlternar(x)}>
                    <td className="chk"><input type="checkbox" className="pa-chk" checked={on} onChange={() => onAlternar(x)} onClick={(e) => e.stopPropagation()} aria-label={`Marcar ${x.nombres_cliente}`} /></td>
                    <td><div className="as-cliente"><b>{x.nombres_cliente}</b><small translate="no">{x.codigo_expediente}</small></div></td>
                    <td><span className={"as-tipo " + (x.tipo_credito === "OTROS" ? "mype" : "consumo")}>{x.tipo_credito === "OTROS" ? "MYPE" : "Consumo"}</span></td>
                    <td className="as-dist">{dash(x.distrito)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      <Paginador compacto pagina={pagina} paginas={paginas} filas={filas} total={total} mostrados={data.length} tamanos={TAMANOS_PLANNER} sufijo="sin asignar"
        onPagina={(n) => fijar({ pagina: n > 1 ? n : null })} onFilas={(n) => fijar({ filas: n !== FILAS_PLANNER ? n : null, pagina: null })} />
    </section>
  );
}
