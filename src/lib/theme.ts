import { useCallback, useEffect, useState } from "react";

// Tema claro, oscuro o automático (según el sistema). La preferencia se guarda en el navegador y el
// atributo data-theme del <html> —que ya fija index.html antes de pintar— es lo que lee el CSS.
export type Tema = "light" | "dark" | "auto";

const aplicar = (pref: Tema) => {
  const oscuro = pref === "dark" || (pref === "auto" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = oscuro ? "dark" : "light";
  document.documentElement.dataset.themePref = pref;
};

const leer = (): Tema => {
  try { const v = localStorage.getItem("ch_theme"); if (v === "light" || v === "dark" || v === "auto") return v; } catch { /* sin almacenamiento */ }
  return "auto";
};

export function useTheme(): [Tema, (t: Tema) => void] {
  const [pref, setPref] = useState<Tema>(leer);
  useEffect(() => {
    aplicar(pref);
    if (pref !== "auto") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const alCambiar = () => aplicar("auto");
    mq.addEventListener("change", alCambiar);
    return () => mq.removeEventListener("change", alCambiar);
  }, [pref]);
  const fijar = useCallback((t: Tema) => {
    try { localStorage.setItem("ch_theme", t); } catch { /* sin almacenamiento */ }
    setPref(t);
  }, []);
  return [pref, fijar];
}

export function useRail(): [boolean, () => void] {
  const [rail, setRail] = useState(() => document.documentElement.dataset.rail === "1");
  const alternar = useCallback(() => {
    setRail((v) => {
      const nuevo = !v;
      if (nuevo) document.documentElement.dataset.rail = "1"; else delete document.documentElement.dataset.rail;
      try { localStorage.setItem("ch_rail", nuevo ? "1" : "0"); } catch { /* sin almacenamiento */ }
      return nuevo;
    });
  }, []);
  return [rail, alternar];
}
