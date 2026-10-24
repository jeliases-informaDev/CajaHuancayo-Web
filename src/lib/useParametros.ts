import { useCallback, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";

// Estado de pantalla en la URL para varios parámetros a la vez (filtros, búsqueda, página): se puede compartir el enlace, recargar o volver atrás sin perder
// lo que se estaba viendo. `fijar` cambia varios parámetros en una sola navegación (un valor vacío o null borra el parámetro) y siempre parte de la URL de ese
// instante, no de la del último render: varias llamadas seguidas en un mismo evento se acumulan en vez de pisarse.
export function useParametros() {
  const { search } = useLocation();
  const navigate = useNavigate();
  const params = useMemo(() => new URLSearchParams(search), [search]);
  const fijar = useCallback((cambios: Record<string, string | number | null | undefined>) => {
    const p = new URLSearchParams(window.location.search);
    for (const [clave, valor] of Object.entries(cambios)) {
      if (valor === null || valor === undefined || valor === "") p.delete(clave); else p.set(clave, String(valor));
    }
    const texto = p.toString();
    navigate({ search: texto ? `?${texto}` : "" }, { replace: true });
  }, [navigate]);
  return { params, fijar };
}

// Número entero de la URL entre dos límites (la página o las filas pedidas): lo que no sea un número válido vuelve al valor por defecto.
export function enteroDe(params: URLSearchParams, clave: string, porDefecto: number, minimo = 1, maximo = 100000) {
  const n = parseInt(params.get(clave) || "", 10);
  return Number.isFinite(n) ? Math.max(minimo, Math.min(maximo, n)) : porDefecto;
}
