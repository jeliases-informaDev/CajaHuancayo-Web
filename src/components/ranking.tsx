import { useState } from "react";
import { Avatar } from "./ui";
import { variacion } from "../lib/variacion";
import type { FilaRanking, NivelAuditor, ResultadoVisita, Tablero } from "../lib/resumen";

// Ranking de auditores del Resumen: quién hizo más visitas en el tramo elegido, con sus categorías (cuántas fueron conformes, observadas, no ubicadas y
// rechazadas, y de qué ficha: MYPE o Consumo), su efectividad y cómo está frente al promedio del equipo. Sale de la misma respuesta que las tarjetas y el
// gráfico, así las cifras coinciden. Los colores de las categorías son los de la barra de cada auditor y los de la leyenda.
const CATEGORIAS: { id: ResultadoVisita; titulo: string; corto: string; color: string }[] = [
  { id: "CONFORME", titulo: "Conformes", corto: "Conf.", color: "var(--c-conforme)" },
  { id: "OBSERVADO", titulo: "Observadas", corto: "Obs.", color: "var(--c-observado)" },
  { id: "NO_UBICADO", titulo: "No ubicados", corto: "No ubic.", color: "var(--c-noubicado)" },
  { id: "RECHAZADO", titulo: "Rechazadas", corto: "Rech.", color: "var(--c-rechazado)" },
];

const NIVELES: Record<NivelAuditor, { texto: string; ayuda: string }> = {
  DESTACADO: { texto: "Destacado", ayuda: "Hizo al menos 1,25 veces el promedio del equipo en este tramo." },
  PROMEDIO: { texto: "En el promedio", ayuda: "Está cerca del promedio del equipo en este tramo." },
  BAJO: { texto: "Por debajo", ayuda: "Hizo menos de 0,75 veces el promedio del equipo en este tramo." },
  SIN_VISITAS: { texto: "Sin visitas", ayuda: "No registró visitas en este tramo." },
};

const MAX_INICIAL = 10;
const num = (n: number) => n.toLocaleString("es-PE");

function Fila({ f, mayor }: { f: FilaRanking; mayor: number }) {
  const v = variacion(f.visitas, f.anterior);
  const nivel = NIVELES[f.nivel];
  const top = f.visitas > 0 && f.posicion <= 3 ? f.posicion : undefined;
  const detalle = CATEGORIAS.map((c) => `${f.resultados[c.id]} ${c.titulo.toLowerCase()}`).join(", ");
  return (
    <tr className={f.visitas ? undefined : "sin"}>
      <td><span className="rs-pos" data-top={top}>{f.posicion}</span></td>
      <td>
        <div className="rs-rank-quien">
          <Avatar nombre={f.nombre} />
          <span><b>{f.nombre}</b><i>{f.zona || "Sin zona"}{f.activo ? "" : " · inactivo"}</i></span>
        </div>
      </td>
      <td>
        <div className="rs-rank-visitas">
          <b>{num(f.visitas)}</b>
          <div className="rs-rank-pista">
            <div className="rs-rank-barra" role="img" aria-label={`${num(f.visitas)} visitas: ${detalle}`} style={{ width: `${mayor ? Math.max(f.visitas ? 4 : 0, (f.visitas / mayor) * 100) : 0}%` }}>
              {CATEGORIAS.filter((c) => f.resultados[c.id] > 0).map((c) => <i key={c.id} style={{ flexGrow: f.resultados[c.id], background: c.color }} title={`${f.resultados[c.id]} ${c.titulo.toLowerCase()}`} />)}
            </div>
          </div>
        </div>
      </td>
      {CATEGORIAS.map((c) => <td key={c.id} className={f.resultados[c.id] ? undefined : "cero"}>{num(f.resultados[c.id])}</td>)}
      <td className={`rs-rank-tipo${f.tipos.MYPE ? "" : " cero"}`}>{num(f.tipos.MYPE)}</td>
      <td className={`rs-rank-tipo${f.tipos.CONSUMO ? "" : " cero"}`}>{num(f.tipos.CONSUMO)}</td>
      <td className={f.efectividad == null ? "cero" : undefined}>{f.efectividad == null ? "–" : `${f.efectividad.toLocaleString("es-PE")} %`}</td>
      <td className="rs-rank-var"><span className={`rs-var ${v.tono}`} title={`Tramo anterior: ${num(f.anterior)} ${f.anterior === 1 ? "visita" : "visitas"}`}>{v.texto}</span></td>
      <td><span className="rs-nivel" data-nivel={f.nivel} title={nivel.ayuda}>{nivel.texto}</span></td>
    </tr>
  );
}

export function RankingAuditores({ ranking, resultados, rotulo, vigente }: { ranking: Tablero["ranking"]; resultados: Tablero["resultados"]; rotulo: string; vigente: boolean }) {
  const [todos, setTodos] = useState(false);
  const filas = todos ? ranking.auditores : ranking.auditores.slice(0, MAX_INICIAL);
  const mayor = Math.max(0, ...ranking.auditores.map((f) => f.visitas));
  const total = Object.values(resultados).reduce((s, n) => s + n, 0);
  return (
    <section className="rs-tarjeta rs-ranking" aria-label="Auditores con más visitas" aria-busy={!vigente}>
      <div className="rs-cab">
        <div>
          <h2 className="rs-titulo-tarjeta">Auditores con más visitas</h2>
          <span className="rs-apoyo">{rotulo}</span>
        </div>
        <div className="rs-rank-resumen">
          <b>{num(total)}</b><span>{total === 1 ? "visita" : "visitas"} del equipo · promedio {ranking.promedio.toLocaleString("es-PE")} por auditor · {ranking.con_visitas} de {ranking.total_auditores} con visitas</span>
        </div>
      </div>

      <ul className="rs-rank-leyenda" aria-label="Categorías de las visitas">
        {CATEGORIAS.map((c) => <li key={c.id} style={{ ["--c" as any]: c.color }}>{c.titulo} <b>{num(resultados[c.id])}</b></li>)}
      </ul>

      {!ranking.total_auditores ? (
        <p className="rs-vacio">Aún no hay auditores. Crea auditores en Usuarios para medir su desempeño.</p>
      ) : (
        <div className="rs-rank-scroll">
          <table className="rs-rank">
            <thead>
              <tr>
                <th scope="col" className="rs-rank-pos">#</th>
                <th scope="col">Auditor</th>
                <th scope="col">Visitas</th>
                {CATEGORIAS.map((c) => <th key={c.id} scope="col" title={c.titulo} style={{ ["--c" as any]: c.color }}><i aria-hidden="true" />{c.corto}</th>)}
                <th scope="col" className="rs-rank-tipo" title="Visitas con la ficha MYPE">MYPE</th>
                <th scope="col" className="rs-rank-tipo" title="Visitas con la ficha Consumo">Consumo</th>
                <th scope="col" title="Efectividad: porcentaje de visitas conformes">Efect.</th>
                <th scope="col" className="rs-rank-var" title="Cambio de sus visitas frente al tramo anterior, de los mismos días">Vs. ant.</th>
                <th scope="col" title="Sus visitas frente al promedio del equipo en este tramo">Nivel</th>
              </tr>
            </thead>
            <tbody>{filas.map((f) => <Fila key={f.id} f={f} mayor={mayor} />)}</tbody>
          </table>
        </div>
      )}

      {ranking.auditores.length > MAX_INICIAL ? (
        <button type="button" className="rs-rank-mas" onClick={() => setTodos((v) => !v)} aria-expanded={todos}>
          {todos ? `Ver solo los ${MAX_INICIAL} primeros` : `Ver los ${ranking.auditores.length} auditores`}
        </button>
      ) : null}
      <p className="rs-nota">Efectividad: porcentaje de visitas conformes. Nivel: compara las visitas de cada auditor con el promedio del equipo en este tramo (destacado desde el 125 %, por debajo bajo el 75 %).</p>
    </section>
  );
}
