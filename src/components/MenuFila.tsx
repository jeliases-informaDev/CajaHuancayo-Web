import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./icons";
import { useMenuKeys } from "./kit";

// Menú «⋯» de una fila (diseño de Figma de Usuarios). Se dibuja encima de todo, fuera de la tabla, para que no lo corten la tarjeta ni su desplazamiento, y se abre
// hacia arriba cuando abajo no cabe. Se cierra al elegir, con Esc, al hacer clic fuera, al desplazar o al cambiar el tamaño de la ventana.
export type OpcionMenu = { etiqueta: string; icono?: string; onClick: () => void; peligro?: boolean; oculto?: boolean };

export default function MenuFila({ encabezado, opciones, etiqueta = "Acciones" }: { encabezado?: { titulo: string; sub?: string }; opciones: OpcionMenu[]; etiqueta?: string }) {
  const [abierto, setAbierto] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const boton = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const cerrar = useCallback(() => { setAbierto(false); setPos(null); }, []);
  useMenuKeys(abierto, menu, boton, cerrar);

  useLayoutEffect(() => {
    if (!abierto || !boton.current || !menu.current) return;
    const b = boton.current.getBoundingClientRect();
    const alto = menu.current.offsetHeight; const ancho = menu.current.offsetWidth;
    const arriba = window.innerHeight - b.bottom < alto + 12 && b.top > alto + 12;
    setPos({ top: arriba ? b.top - alto - 6 : b.bottom + 6, left: Math.max(8, Math.min(window.innerWidth - ancho - 8, b.right - ancho)) });
  }, [abierto]);

  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => { if (!menu.current?.contains(e.target as Node) && !boton.current?.contains(e.target as Node)) cerrar(); };
    const alMover = (e: Event) => { if (!menu.current?.contains(e.target as Node)) cerrar(); };
    document.addEventListener("mousedown", fuera);
    window.addEventListener("resize", cerrar);
    window.addEventListener("scroll", alMover, true);
    return () => { document.removeEventListener("mousedown", fuera); window.removeEventListener("resize", cerrar); window.removeEventListener("scroll", alMover, true); };
  }, [abierto, cerrar]);

  return (
    <>
      <button ref={boton} type="button" className={"pa-kebab" + (abierto ? " abierto" : "")} aria-label={etiqueta} aria-haspopup="menu" aria-expanded={abierto} onClick={(e) => { e.stopPropagation(); if (abierto) cerrar(); else setAbierto(true); }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" /></svg>
      </button>
      {abierto ? createPortal(
        <div ref={menu} className="pa-menu" role="menu" aria-label={etiqueta} style={{ top: pos?.top ?? 0, left: pos?.left ?? 0, opacity: pos ? 1 : 0 }}>
          {encabezado ? <div className="pa-menu-cab"><b>{encabezado.titulo}</b>{encabezado.sub ? <span>{encabezado.sub}</span> : null}</div> : null}
          {opciones.filter((o) => !o.oculto).map((o) => (
            <button key={o.etiqueta} type="button" role="menuitem" tabIndex={-1} className={o.peligro ? "peligro" : ""}
              onClick={(e) => { e.stopPropagation(); cerrar(); o.onClick(); boton.current?.focus(); }}>
              {o.icono ? <Icon name={o.icono} size={18} /> : null}<span>{o.etiqueta}</span>
            </button>
          ))}
        </div>,
        document.body,
      ) : null}
    </>
  );
}
