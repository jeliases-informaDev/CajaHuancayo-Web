import { useEffect, useMemo, useState } from "react";
import { request } from "../../api";
import { Icon } from "../icons";
import { Skeleton } from "../ui";
import { iniciales } from "../../lib/format";
import { AUDITORES_POR_PAGINA, nombreAuditor, zonaAuditor, type Auditor } from "../../lib/asignaciones";
import { enteroDe, useParametros } from "../../lib/useParametros";

// Columna «Auditores» de Asignaciones (diseño de Figma): buscador, zona y una tarjeta por auditor con sus casos activos. Se pide por páginas al servidor (ocho por página,
// con la búsqueda y la zona resueltas allá), así que la lista no crece sin límite; la búsqueda, la zona y la página viven en la URL (aq, zona, ap).
export default function ColumnaAuditores({ auditorId, onElegir, refrescar }: { auditorId: string; onElegir: (a: Auditor | null) => void; refrescar: number }) {
  const { params, fijar } = useParametros();
  const zona = params.get("zona") || "";
  const aq = (params.get("aq") || "").trim().slice(0, 100);
  const pagina = enteroDe(params, "ap", 1);
  const [texto, setTexto] = useState(aq);
  const [lista, setLista] = useState<Auditor[]>([]);
  const [total, setTotal] = useState(0);
  const [paginas, setPaginas] = useState(1);
  const [zonas, setZonas] = useState<{ zona: string; n: number }[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  const consulta = useMemo(() => {
    const p = new URLSearchParams({ limit: String(AUDITORES_POR_PAGINA), page: String(pagina) });
    if (aq) p.set("q", aq);
    if (zona) p.set("zona", zona);
    return p.toString();
  }, [aq, zona, pagina]);

  useEffect(() => {
    let vigente = true;
    setCargando(true);
    request<{ data: Auditor[]; pagination: { total: number; pages: number } }>(`/api/usuarios/auditores?${consulta}`)
      .then((r) => {
        if (!vigente) return;
        if (!r.data.length && r.pagination.total > 0 && pagina > 1) { fijar({ ap: Math.max(1, r.pagination.pages) > 1 ? r.pagination.pages : null }); return; }
        setLista(r.data); setTotal(r.pagination.total); setPaginas(r.pagination.pages); setError("");
      })
      .catch((e) => { if (vigente) setError(e?.message || "No se pudieron cargar los auditores."); })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [consulta, refrescar]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let vigente = true;
    request<{ data: { zona: string; n: number }[] }>("/api/usuarios/auditores/zonas").then((r) => { if (vigente) setZonas(r.data); }).catch(() => {});
    return () => { vigente = false; };
  }, [refrescar]);

  // Búsqueda por texto: espera un momento después de la última tecla y se guarda en la URL (vuelve a la página 1).
  useEffect(() => {
    if (texto.trim() === aq) return;
    const t = setTimeout(() => fijar({ aq: texto.trim(), ap: null }), 300);
    return () => clearTimeout(t);
  }, [texto]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setTexto((t) => (t.trim() === aq ? t : aq)); }, [aq]);

  return (
    <section className="as-col as-auditores" aria-labelledby="as-tit-aud">
      <header className="as-cab">
        <h2 id="as-tit-aud">Auditores</h2>
        <span className="as-cuenta" role="status">{total.toLocaleString("es-PE")} {total === 1 ? "auditor" : "auditores"}</span>
      </header>
      <div className="as-busca">
        <Icon name="buscar" size={16} />
        <label className="sr-only" htmlFor="as-aq">Buscar auditor</label>
        <input id="as-aq" name="aq" type="search" placeholder="Buscar auditor…" autoComplete="off" spellCheck={false} maxLength={100} value={texto} onChange={(e) => setTexto(e.target.value)} />
      </div>
      <label className="sr-only" htmlFor="as-zona">Zona</label>
      <select id="as-zona" name="zona" className="as-zona" value={zona} onChange={(e) => fijar({ zona: e.target.value, ap: null })}>
        <option value="">Zona: todas</option>
        {zonas.map((z) => <option key={z.zona} value={z.zona}>{z.zona} ({z.n.toLocaleString("es-PE")})</option>)}
        {zona && !zonas.some((z) => z.zona === zona) ? <option value={zona}>{zona}</option> : null}
      </select>

      {error ? <div role="alert" className="error-box" style={{ margin: 0 }}>{error}</div> : null}
      <div className="as-lista-aud" aria-busy={cargando}>
        {cargando && !lista.length ? (
          <div className="as-esqueleto">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} height={72} radius={10} style={{ display: "block" }} />)}</div>
        ) : !lista.length ? (
          <p className="as-vacio">{aq || zona ? "Ningún auditor coincide con la búsqueda." : "No hay auditores activos."}</p>
        ) : (
          <ul>
            {lista.map((a) => {
              const elegido = a.id === auditorId;
              const nombre = nombreAuditor(a);
              return (
                <li key={a.id}>
                  <button type="button" className={"as-aud" + (elegido ? " on" : "")} aria-pressed={elegido} onClick={() => onElegir(elegido ? null : a)}>
                    <span className="as-aud-fila"><span className="as-avatar" aria-hidden="true">{iniciales(nombre)}</span><b>{nombre}</b><span className="as-radio" aria-hidden="true">{elegido ? <Icon name="ok" size={11} strokeWidth={2.6} /> : null}</span></span>
                    <span className="as-aud-fila as-aud-pie"><span className="as-zona-txt"><Icon name="seguimiento" size={14} /><span>{zonaAuditor(a)}</span></span><span className="as-activos"><b>{(a.activos ?? 0).toLocaleString("es-PE")}</b> activos</span></span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {paginas > 1 ? (
        <nav className="as-mini" aria-label="Páginas de auditores">
          <button type="button" onClick={() => fijar({ ap: pagina - 1 > 1 ? pagina - 1 : null })} disabled={pagina <= 1} aria-label="Página anterior de auditores"><Icon name="izquierda" size={15} /></button>
          <span>{pagina} de {paginas}</span>
          <button type="button" onClick={() => fijar({ ap: pagina + 1 })} disabled={pagina >= paginas} aria-label="Página siguiente de auditores"><Icon name="derecha" size={15} /></button>
        </nav>
      ) : null}
      <p className="as-nota">Puedes cambiar de auditor antes de confirmar la asignación.</p>
    </section>
  );
}
