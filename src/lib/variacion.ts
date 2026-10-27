// Cuánto subió o bajó una cifra frente al tramo anterior, para las tarjetas y el ranking del Resumen.
// Sin nada antes no hay porcentaje que calcular: si ahora hay algo, es «nuevo»; si no hay nada en ninguno, un guion.
export type Variacion = { texto: string; tono: "sube" | "baja" | "igual" | "nuevo" | "nada" };

export function variacion(actual: number, anterior: number): Variacion {
  if (!anterior) return actual ? { texto: "nuevo", tono: "nuevo" } : { texto: "–", tono: "nada" };
  const pct = Math.round(((actual - anterior) / anterior) * 100);
  if (pct === 0) return { texto: "= igual", tono: "igual" };
  const abs = Math.abs(pct) > 999 ? "999+" : String(Math.abs(pct)); // con muy pocas visitas antes, el porcentaje no dice nada: se acota
  return pct > 0 ? { texto: `▲ ${abs} %`, tono: "sube" } : { texto: `▼ ${abs} %`, tono: "baja" };
}
