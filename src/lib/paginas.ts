// Paginación de las tablas del panel (Visitas, Expedientes): cuántas filas por página se ofrecen y qué números de página se muestran.
export const TAMANOS = [10, 25, 50, 100];
export const FILAS_POR_DEFECTO = 10;

// Números de página a mostrar: la primera, la última y las vecinas de la actual, con «…» donde se salta.
export function paginasVisibles(actual: number, total: number): (number | "…")[] {
  const orden = [...new Set([1, total, actual - 1, actual, actual + 1].filter((n) => n >= 1 && n <= total))].sort((a, b) => a - b);
  const salida: (number | "…")[] = [];
  orden.forEach((n, i) => { if (i && n - orden[i - 1] > 1) salida.push("…"); salida.push(n); });
  return salida;
}
