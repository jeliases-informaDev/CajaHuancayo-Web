import { useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";

// Estado de pantalla (filtros, pestañas, página) guardado en la URL: se puede compartir el enlace,
// recargar o volver atrás sin perder lo que se estaba viendo. El valor por defecto no ensucia la URL.
// Al escribir se parte de la URL actual (no de la del último render), así varias llamadas seguidas en un
// mismo evento —por ejemplo cambiar un filtro y volver a la página 1— se acumulan en vez de pisarse.
export function useQueryParam(clave: string, porDefecto = ""): [string, (valor: string) => void] {
  const { search } = useLocation();
  const navigate = useNavigate();
  const valor = new URLSearchParams(search).get(clave) ?? porDefecto;
  const fijar = useCallback((nuevo: string) => {
    const siguiente = new URLSearchParams(window.location.search);
    if (!nuevo || nuevo === porDefecto) siguiente.delete(clave); else siguiente.set(clave, nuevo);
    const texto = siguiente.toString();
    navigate({ search: texto ? `?${texto}` : "" }, { replace: true });
  }, [clave, porDefecto, navigate]);
  return [valor, fijar];
}
