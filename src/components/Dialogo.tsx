import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./icons";
import { useDialogFocus } from "./kit";

// Ventana del diseño de Figma para Usuarios y Asignaciones: casilla con el ícono, título, subtítulo, cuerpo y pie con los botones a la derecha. Mientras
// `ocupado` (guardando) no se puede cerrar: quedaría a medias sin que se vea. El tono del ícono avisa de qué clase de acción es.
export type TonoDialogo = "normal" | "peligro" | "aviso";

export default function Dialogo({ icono, tono = "normal", titulo, subtitulo, ancho = 560, ocupado = false, onClose, pie, children, id }: {
  icono: string; tono?: TonoDialogo; titulo: string; subtitulo?: string; ancho?: number; ocupado?: boolean; onClose: () => void; pie?: ReactNode; children: ReactNode; id?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const idTitulo = useId();
  useDialogFocus(ref, ".pa-d-cuerpo input:not([type=hidden]), .pa-d-cuerpo select, .pa-d-cuerpo button");
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !ocupado) onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [ocupado, onClose]);
  return createPortal(
    <>
      <div className="pa-velo" onClick={() => { if (!ocupado) onClose(); }} aria-hidden="true" />
      <div className="pa-dialogo" id={id} ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={idTitulo} style={{ ["--pa-ancho" as string]: `${ancho}px` }}>
        <header className="pa-d-cab">
          <span className={`pa-d-icono ${tono}`} aria-hidden="true"><Icon name={icono} size={20} /></span>
          <div><h2 id={idTitulo}>{titulo}</h2>{subtitulo ? <p>{subtitulo}</p> : null}</div>
          <button type="button" className="pa-d-x" onClick={onClose} disabled={ocupado} aria-label="Cerrar la ventana"><Icon name="cerrar" size={18} /></button>
        </header>
        <div className="pa-d-cuerpo">{children}</div>
        {pie ? <footer className="pa-d-pie">{pie}</footer> : null}
      </div>
    </>,
    document.body,
  );
}
