import { useEffect, useId, useRef, useState } from "react";
import { Icon } from "./icons";
import { CLAVES_FICHA, CLAVES_RESULTADO, FICHAS, RESULTADOS, atajosDeFecha, gruposActivos, hoyLocal, normalizar, type Filtros } from "../lib/filtrosVisitas";

// Botón FILTROS y su panel flotante (diseño de Figma). Funciona como las burbujas de Seguimiento: el panel se abre y se cierra con el botón, así no tapa
// la tabla mientras no se usa; los filtros puestos se ven como etiquetas encima de la tabla (las pinta la pantalla) y el botón lleva la cuenta.
// Lo que se marca dentro del panel es un borrador: solo cuenta al pulsar «Aplicar filtros».

type Auditor = { id: string; nombres?: string | null; username: string };
type Borrador = Omit<Filtros, "q">;

// Sin filtro puesto, todas las casillas se ven marcadas; desmarcar una la excluye.
const aBorrador = (f: Filtros): Borrador => ({ resultado: f.resultado.length ? f.resultado : CLAVES_RESULTADO, tipo: f.tipo.length ? f.tipo : CLAVES_FICHA, desde: f.desde, hasta: f.hasta, auditor: f.auditor, alertas: f.alertas });
const deBorrador = (b: Borrador): Borrador => {
  let { desde, hasta } = b;
  if (desde && hasta && desde > hasta) [desde, hasta] = [hasta, desde]; // si las fechas quedaron al revés, se acomodan
  return { resultado: normalizar(b.resultado, CLAVES_RESULTADO), tipo: normalizar(b.tipo, CLAVES_FICHA), desde, hasta, auditor: b.auditor, alertas: b.alertas };
};

function CampoFecha({ id, etiqueta, valor, min, max, onCambio }: { id: string; etiqueta: string; valor: string; min?: string; max?: string; onCambio: (v: string) => void }) {
  const entrada = useRef<HTMLInputElement>(null);
  const abrir = () => { try { entrada.current?.showPicker(); } catch { entrada.current?.focus(); } };
  return (
    <div className="vi-fecha-campo">
      <label htmlFor={id}>{etiqueta}</label>
      <div className="vi-campo">
        <button type="button" className="abrir" onClick={abrir} aria-label={`Abrir el calendario de «${etiqueta}»`}><Icon name="calendario" size={16} /></button>
        <input ref={entrada} id={id} name={`fecha-${etiqueta.toLowerCase()}`} type="date" value={valor} min={min} max={max} autoComplete="off" onChange={(e) => onCambio(e.target.value)} />
      </div>
    </div>
  );
}

export default function FiltrosVisitas({ filtros, conteos, auditores, onAplicar, onLimpiar }: {
  filtros: Filtros; conteos: Record<string, number>; auditores: Auditor[];
  onAplicar: (f: Borrador) => void; onLimpiar: () => void;
}) {
  const id = useId();
  const [abierto, setAbierto] = useState(false);
  const [b, setB] = useState<Borrador>(() => aBorrador(filtros));
  const raiz = useRef<HTMLDivElement>(null);
  const boton = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const activos = gruposActivos(filtros);
  const hoy = hoyLocal();
  const atajos = atajosDeFecha();
  const atajoActivo = atajos.find((a) => a.desde === b.desde && a.hasta === b.hasta)?.clave;

  // Abierto: el foco entra al panel; se cierra con Escape, al hacer clic fuera o al llevar el foco a otra parte de la página.
  useEffect(() => {
    if (!abierto) return;
    panel.current?.focus({ preventScroll: true });
    const fuera = (e: Event) => { if (raiz.current && !raiz.current.contains(e.target as Node)) setAbierto(false); };
    const tecla = (e: KeyboardEvent) => { if (e.key === "Escape") { e.preventDefault(); setAbierto(false); boton.current?.focus(); } };
    document.addEventListener("mousedown", fuera);
    document.addEventListener("focusin", fuera);
    document.addEventListener("keydown", tecla);
    return () => { document.removeEventListener("mousedown", fuera); document.removeEventListener("focusin", fuera); document.removeEventListener("keydown", tecla); };
  }, [abierto]);

  const alternar = () => { if (!abierto) setB(aBorrador(filtros)); setAbierto((v) => !v); };
  const cerrarYVolver = () => { setAbierto(false); boton.current?.focus(); };
  const marcar = (campo: "resultado" | "tipo", clave: string, marcada: boolean) => setB((x) => ({ ...x, [campo]: marcada ? [...x[campo], clave] : x[campo].filter((c) => c !== clave) }));
  const aplicar = () => { onAplicar(deBorrador(b)); cerrarYVolver(); };
  const limpiar = () => { setB(aBorrador({ ...filtros, resultado: [], tipo: [], desde: "", hasta: "", auditor: "", alertas: false })); onLimpiar(); cerrarYVolver(); };
  const nombreDe = (a: Auditor) => a.nombres || a.username;

  return (
    <div className="vi-filtros" ref={raiz}>
      <button ref={boton} type="button" className={`vi-boton${abierto ? " on" : ""}`} aria-haspopup="dialog" aria-expanded={abierto} aria-controls={`${id}-panel`} onClick={alternar}>
        <Icon name="filtro" size={15} /><span>Filtros</span>
        {activos > 0 ? <span className="vi-cuenta"><span aria-hidden="true">{activos}</span><span className="sr-only">{activos === 1 ? "1 filtro puesto" : `${activos} filtros puestos`}</span></span> : null}
      </button>
      {abierto ? (
        <>
          <div className="vi-velo" aria-hidden="true" onClick={() => setAbierto(false)} />
          <div className="vi-pop" id={`${id}-panel`} ref={panel} role="dialog" aria-label="Filtros de visitas" tabIndex={-1}>
            <div className="vi-pop-cab">
              <h2>Filtros</h2>
              <button type="button" className="vi-pop-x" onClick={cerrarYVolver} aria-label="Cerrar los filtros"><Icon name="cerrar" size={18} /></button>
            </div>
            <div className="vi-pop-cuerpo">
              <div className="vi-seccion" role="group" aria-labelledby={`${id}-res`}>
                <h3 id={`${id}-res`}>Resultado</h3>
                {RESULTADOS.map((r) => (
                  <label key={r.clave} className="vi-opcion">
                    <input type="checkbox" className="vi-chk" name="resultado" value={r.clave} checked={b.resultado.includes(r.clave)} onChange={(e) => marcar("resultado", r.clave, e.target.checked)} />
                    <i className="punto" style={{ ["--c" as any]: r.color }} aria-hidden="true" />
                    <span>{r.plural}</span>
                    <span className="n">{(conteos[r.clave] ?? 0).toLocaleString("es-PE")}<span className="sr-only"> visitas</span></span>
                  </label>
                ))}
                <p className="vi-ayuda">Puedes elegir uno o varios resultados</p>
              </div>

              <div className="vi-seccion" role="group" aria-labelledby={`${id}-fic`}>
                <h3 id={`${id}-fic`}>Tipo de ficha</h3>
                <div className="vi-fichas">
                  {FICHAS.map((f) => (
                    <label key={f.clave} className={`vi-ficha-op ${f.clase}${b.tipo.includes(f.clave) ? " on" : ""}`}>
                      <input type="checkbox" className="vi-chk" name="tipo" value={f.clave} checked={b.tipo.includes(f.clave)} onChange={(e) => marcar("tipo", f.clave, e.target.checked)} />
                      <span>{f.etiqueta}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="vi-seccion" role="group" aria-labelledby={`${id}-fec`}>
                <h3 id={`${id}-fec`}>Fecha de visita</h3>
                <div className="vi-rapidos">
                  {atajos.map((a) => (
                    <button key={a.clave} type="button" className={`vi-rapido${atajoActivo === a.clave ? " on" : ""}`} aria-pressed={atajoActivo === a.clave}
                      onClick={() => setB((x) => (atajoActivo === a.clave ? { ...x, desde: "", hasta: "" } : { ...x, desde: a.desde, hasta: a.hasta }))}>{a.etiqueta}</button>
                  ))}
                </div>
                <div className="vi-fechas">
                  <CampoFecha id={`${id}-desde`} etiqueta="Desde" valor={b.desde} max={b.hasta || hoy} onCambio={(v) => setB((x) => ({ ...x, desde: v }))} />
                  <CampoFecha id={`${id}-hasta`} etiqueta="Hasta" valor={b.hasta} min={b.desde || undefined} max={hoy} onCambio={(v) => setB((x) => ({ ...x, hasta: v }))} />
                </div>
              </div>

              <div className="vi-seccion" role="group" aria-labelledby={`${id}-aud`}>
                <h3 id={`${id}-aud`}>Auditor</h3>
                <select name="auditor" className="vi-select" aria-labelledby={`${id}-aud`} value={b.auditor} onChange={(e) => setB((x) => ({ ...x, auditor: e.target.value }))}>
                  <option value="">Todos</option>
                  {b.auditor && !auditores.some((a) => a.id === b.auditor) ? <option value={b.auditor}>Auditor elegido</option> : null}
                  {auditores.map((a) => <option key={a.id} value={a.id}>{nombreDe(a)}</option>)}
                </select>
                <label className="vi-opcion solo">
                  <input type="checkbox" className="vi-chk" name="alertas" checked={b.alertas} onChange={(e) => setB((x) => ({ ...x, alertas: e.target.checked }))} />
                  <span>Solo con alertas de seguridad</span>
                </label>
              </div>
            </div>
            <div className="vi-pop-pie">
              <button type="button" className="vi-limpiar" onClick={limpiar}>Limpiar filtros</button>
              <button type="button" className="vi-aplicar" onClick={aplicar}>Aplicar filtros</button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
