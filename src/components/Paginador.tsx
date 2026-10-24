import { paginasVisibles } from "../lib/paginas";

// Pie de las listas por páginas (Usuarios, Asignaciones): cuántas filas por página, qué filas se ven del total y los números de página. La paginación la hace
// el servidor; aquí solo se muestra y se avisa de qué página o tamaño se pidió. Con una sola página no hay números.
export default function Paginador({ pagina, paginas, filas, total, mostrados, tamanos, etiqueta = "Mostrar resultado", sufijo = "", onPagina, onFilas, compacto = false }: {
  pagina: number; paginas: number; filas: number; total: number; mostrados: number; tamanos: number[]; etiqueta?: string; sufijo?: string;
  onPagina: (n: number) => void; onFilas?: (n: number) => void; compacto?: boolean;
}) {
  const desde = total === 0 ? 0 : (pagina - 1) * filas + 1;
  const hasta = total === 0 ? 0 : desde + Math.max(0, mostrados) - 1;
  return (
    <div className={"pa-pie" + (compacto ? " compacto" : "")}>
      {onFilas ? (
        <label className="pa-filas">{etiqueta}
          <select name="filas" value={filas} onChange={(e) => onFilas(Number(e.target.value))}>
            {tamanos.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
      ) : null}
      <span className="pa-rango">{desde.toLocaleString("es-PE")}–{hasta.toLocaleString("es-PE")} de {total.toLocaleString("es-PE")}{sufijo ? ` ${sufijo}` : ""}</span>
      {paginas > 1 ? (
        <nav className="pa-paginas" aria-label="Paginación">
          {pagina > 1 ? <button type="button" className="mas" onClick={() => onPagina(pagina - 1)}>Anterior</button> : null}
          {paginasVisibles(pagina, paginas).map((p, i) => p === "…"
            ? <span key={`e${i}`} className="elipsis" aria-hidden="true">…</span>
            : <button key={p} type="button" aria-current={p === pagina ? "page" : undefined} aria-label={`Página ${p}`} onClick={() => onPagina(p)}>{p}</button>)}
          {pagina < paginas ? <button type="button" className="mas" onClick={() => onPagina(pagina + 1)}>Siguiente</button> : null}
        </nav>
      ) : null}
    </div>
  );
}
