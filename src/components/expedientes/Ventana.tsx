import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Icon } from "../icons";
import { useDialogFocus } from "../kit";

// Ventana del diseño de Figma para Expedientes: migas «EXPEDIENTES / …», título grande, subtítulo, cuerpo que se desplaza y pie con una nota a la
// izquierda y los botones a la derecha. Mientras `ocupada` (revisando o guardando un archivo) no se puede cerrar: quedaría a medias sin que se vea.

export default function Ventana({ migas, titulo, subtitulo, ancho = 960, ocupada = false, onClose, nota, acciones, children }: {
  migas: string[]; titulo: string; subtitulo?: string; ancho?: number; ocupada?: boolean; onClose: () => void;
  nota?: ReactNode; acciones?: ReactNode; children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();
  useDialogFocus(ref, ".ex-v-cuerpo button, .ex-v-cuerpo input, .ex-v-cuerpo select, .ex-v-cuerpo [tabindex='0']");
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !ocupada) onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [ocupada, onClose]);
  return createPortal(
    <>
      <div className="ex-velo" onClick={() => { if (!ocupada) onClose(); }} aria-hidden="true" />
      <div className="ex-ventana" ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={id} style={{ ["--ex-ancho" as any]: `${ancho}px` }}>
        <header className="ex-v-cab">
          <nav className="ex-migas" aria-label="Dónde estás">
            <span>Expedientes</span>
            {migas.map((m, i) => <span key={m} className="ex-miga">{" / "}<span aria-current={i === migas.length - 1 ? "page" : undefined}>{m}</span></span>)}
          </nav>
          <h2 id={id}>{titulo}</h2>
          {subtitulo ? <p>{subtitulo}</p> : null}
          <button type="button" className="ex-v-x" onClick={onClose} disabled={ocupada} aria-label="Cerrar la ventana"><Icon name="cerrar" size={18} /></button>
        </header>
        <div className="ex-v-cuerpo">{children}</div>
        {nota || acciones ? <footer className="ex-v-pie"><p>{nota}</p><div className="ex-v-acciones">{acciones}</div></footer> : null}
      </div>
    </>,
    document.body,
  );
}
