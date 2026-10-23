import { useEffect, useId, useState } from "react";
import type { Actividad, Periodo } from "../lib/resumen";

// Gráficos propios del Resumen (sin librerías): área de la serie elegida con ejes y aviso al pasar el cursor, y el anillo del avance.
// Los colores del área vienen de --serie y --serie-linea, que pone la tarjeta elegida (cada una tiene su color en el diseño).
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sept", "oct", "nov", "dic"];
const fecha = (iso: string) => { const [y, m, d] = iso.split("-").map(Number); return { y, m: m - 1, d }; };
const dia2 = (iso: string) => String(fecha(iso).d).padStart(2, "0");
const diaMes = (iso: string) => { const f = fecha(iso); return `${f.d} ${MESES[f.m]}`; };

// Tope del eje: el menor paso «redondo» que, en 3 tramos, cubre el valor más alto con un poco de aire (91 → 150 con pasos de 50).
export function ejeY(max: number) {
  const pasos = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500];
  let paso = pasos.find((p) => p * 3 >= max * 1.05) ?? 500;
  while (paso * 3 < max * 1.05) paso += 500;
  return [0, 1, 2, 3].map((i) => i * paso);
}

export function rotuloPeriodo(d: Actividad) {
  const a = fecha(d.desde), b = fecha(d.hasta);
  if (d.periodo === "diario") return `Últimos 7 días | ${diaMes(d.desde)} - ${diaMes(d.hasta)}`;
  if (d.periodo === "semanal") return `Últimas 8 semanas | ${diaMes(d.desde)} - ${diaMes(d.hasta)}`;
  return `Últimos 6 meses | ${MESES[a.m]} - ${MESES[b.m]}`;
}
// Lo que abarca el total del gráfico, para leerlo junto a lo que se cuenta: «101 cargados en 7 días».
export const ventanaPeriodo: Record<Periodo, string> = { diario: "en 7 días", semanal: "en 8 semanas", mensual: "en 6 meses" };

function etiquetaEje(d: Actividad, i: number): { principal: string; mes?: string } {
  const p = d.puntos[i], f = fecha(p.inicio);
  if (d.periodo === "mensual") return { principal: MESES[f.m] };
  const previo = i > 0 ? fecha(d.puntos[i - 1].inicio) : null;
  if (d.periodo === "diario") return i === 0 || (previo && previo.m !== f.m) ? { principal: dia2(p.inicio), mes: MESES[f.m] } : { principal: dia2(p.inicio) };
  return { principal: dia2(p.inicio), mes: MESES[f.m] };
}
function textoAviso(d: Actividad, i: number) {
  const p = d.puntos[i], a = fecha(p.inicio);
  if (d.periodo === "diario") return diaMes(p.inicio);
  if (d.periodo === "semanal") return `${diaMes(p.inicio)} – ${diaMes(p.fin)}`;
  return `${MESES[a.m]} ${a.y}`;
}

export type NombreSerie = { titulo: string; singular: string; plural: string };

export function GraficoArea({ datos, nombre }: { datos: Actividad; nombre: NombreSerie }) {
  const id = useId().replace(/:/g, "");
  const [activo, setActivo] = useState<number | null>(null);
  const n = datos.puntos.length;
  const max = Math.max(0, ...datos.puntos.map((p) => p.total));
  const ticks = ejeY(max);
  const tope = ticks[3] || 1;
  const x = (i: number) => (n > 1 ? (i / (n - 1)) * 100 : 50);
  const y = (v: number) => 100 - (v / tope) * 100;
  const linea = datos.puntos.map((p, i) => `${x(i)},${y(p.total)}`).join(" ");
  const resumen = datos.puntos.map((p, i) => `${textoAviso(datos, i)}: ${p.total}`).join("; ");
  const cuenta = (n: number) => `${n.toLocaleString("es-PE")} ${n === 1 ? nombre.singular : nombre.plural}`;
  return (
    <div className="rs-plot" role="img" aria-label={`${nombre.titulo}. ${rotuloPeriodo(datos)}. ${resumen}`}>
      <div className="rs-plot-area">
        {ticks.map((t) => <div key={t} className="rs-linea" style={{ bottom: `${(t / tope) * 100}%` }} />)}
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0" style={{ stopColor: "var(--serie)" }} stopOpacity="0.42" /><stop offset="1" style={{ stopColor: "var(--serie)" }} stopOpacity="0" /></linearGradient>
          </defs>
          <polygon points={`0,100 ${linea} 100,100`} fill={`url(#${id})`} />
          <polyline points={linea} fill="none" style={{ stroke: "var(--serie-linea, var(--serie))" }} strokeWidth="1.3" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        </svg>
        {datos.puntos.map((p, i) => (
          <button key={p.inicio} type="button" className="rs-hover" style={{ left: `${x(i) - 50 / Math.max(1, n - 1)}%`, width: `${100 / Math.max(1, n - 1)}%` }} tabIndex={-1}
            onMouseEnter={() => setActivo(i)} onMouseLeave={() => setActivo(null)} onFocus={() => setActivo(i)} onBlur={() => setActivo(null)} aria-label={`${textoAviso(datos, i)}: ${cuenta(p.total)}`} />
        ))}
        {activo !== null ? (
          <>
            <span className="rs-punto" style={{ left: `${x(activo)}%`, top: `${y(datos.puntos[activo].total)}%` }} />
            <span className="rs-tip" style={{ left: `${Math.min(88, Math.max(12, x(activo)))}%`, top: `${y(datos.puntos[activo].total)}%` }}>
              <i>{textoAviso(datos, activo)}</i>{cuenta(datos.puntos[activo].total)}
            </span>
          </>
        ) : null}
      </div>
      {ticks.map((t) => <span key={t} className="rs-eje-y" style={{ top: `calc((100% - 49px) * ${1 - t / tope})` }}>{t.toLocaleString("es-PE")}</span>)}
      <div className="rs-eje-x" aria-hidden="true">
        {datos.puntos.map((_, i) => { const e = etiquetaEje(datos, i); return <span key={i} style={{ left: `${x(i)}%` }}>{e.principal}{e.mes ? <em>{e.mes}</em> : null}</span>; })}
      </div>
    </div>
  );
}

// Anillo del avance: gris de fondo y un arco indigo desde las 12 en punto.
export function Anillo({ valor, total, titulo }: { valor: number; total: number; titulo: string }) {
  const R = 74;
  const C = 2 * Math.PI * R;
  const pct = total > 0 ? Math.min(1, valor / total) : 0;
  const [dibujado, setDibujado] = useState(0);
  useEffect(() => { const t = requestAnimationFrame(() => setDibujado(pct)); return () => cancelAnimationFrame(t); }, [pct]);
  return (
    <div className="rs-donut" role="img" aria-label={`${valor} de ${total} ${titulo}, ${Math.round(pct * 100)} %`}>
      <svg viewBox="0 0 160 160" aria-hidden="true">
        <circle className="pista" cx="80" cy="80" r={R} fill="none" strokeWidth="12.5" />
        <circle className="arco" cx="80" cy="80" r={R} fill="none" strokeWidth="12.5" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - dibujado)} />
      </svg>
      <div className="centro"><b>{Math.round(pct * 100)}%</b><span>{titulo}</span></div>
    </div>
  );
}
