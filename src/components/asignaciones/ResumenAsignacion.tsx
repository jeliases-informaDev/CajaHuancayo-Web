import { Icon } from "../icons";
import { iniciales } from "../../lib/format";
import { PRIORIDADES, expedientes, nombreAuditor, zonaAuditor, type Auditor, type Seleccion } from "../../lib/asignaciones";

// Columna «Resumen de asignación» de Asignaciones (diseño de Figma): el auditor elegido, los clientes marcados (cada uno se puede quitar), cuántos casos tendrá el auditor
// al confirmar, la prioridad y el botón para asignar. Mientras no se confirma no se guarda nada: es solo la revisión de lo que se va a hacer.
export default function ResumenAsignacion({ auditor, seleccion, prioridad, onPrioridad, onQuitar, onLimpiar, onAsignar, asignando, onVerCasos }: {
  auditor: Auditor | null; seleccion: Seleccion; prioridad: string; onPrioridad: (p: string) => void; onQuitar: (id: number) => void; onLimpiar: () => void;
  onAsignar: () => void; asignando: boolean; onVerCasos: () => void;
}) {
  const n = seleccion.size;
  const actuales = auditor?.activos ?? 0;
  const items = [...seleccion.values()];
  return (
    <aside className={"as-col as-resumen" + (auditor ? " con-auditor" : "")} aria-labelledby="as-tit-res">
      <header className="as-cab">
        <h2 id="as-tit-res">Resumen de asignación</h2>
        <Icon name="portapapeles" size={20} />
      </header>
      <div className="as-res-cuerpo">
        <p className="as-etiqueta" id="as-et-aud">Auditor seleccionado</p>
        {auditor ? (
          <div className="as-sel-aud" aria-labelledby="as-et-aud">
            <span className="as-avatar fuerte" aria-hidden="true">{iniciales(nombreAuditor(auditor))}</span>
            <div><b>{nombreAuditor(auditor)}</b><span>Zona: {zonaAuditor(auditor)}</span></div>
            <button type="button" className="as-enlace chico" onClick={onVerCasos}>Ver sus {actuales.toLocaleString("es-PE")} {actuales === 1 ? "caso" : "casos"}</button>
          </div>
        ) : <p className="as-vacio" aria-labelledby="as-et-aud">Elige un auditor en la lista de la izquierda.</p>}
        <hr className="as-regla" />
        <div className="as-fila-tit"><b>Clientes seleccionados</b><span className="as-n" aria-live="polite">{n.toLocaleString("es-PE")}</span></div>
        {n ? (
          <ul className="as-seleccionados" aria-label="Clientes seleccionados">
            {items.map((c) => (
              <li key={c.id}>
                <div><b>{c.nombre}</b><small translate="no">{c.codigo}</small></div>
                <button type="button" className="as-quitar" onClick={() => onQuitar(c.id)} aria-label={`Quitar a ${c.nombre} de la selección`}><Icon name="cerrar" size={13} strokeWidth={2} /></button>
              </li>
            ))}
          </ul>
        ) : <p className="as-vacio">Marca los expedientes que quieres asignar en la lista del centro.</p>}

        <div className="as-carga">
          <p className="as-et-azul">Carga tras confirmar</p>
          <div className="as-carga-fila">
            <div><b>{auditor ? actuales.toLocaleString("es-PE") : "—"}</b><span>Actuales</span></div>
            <div className="flecha" aria-hidden="true"><span>+{n.toLocaleString("es-PE")}</span><Icon name="siguiente" size={20} /></div>
            <div className="der"><b>{auditor ? (actuales + n).toLocaleString("es-PE") : "—"}</b><span>Previstos</span></div>
          </div>
        </div>
        <p className="as-info"><Icon name="info" size={15} /><span>{n ? <>Los {expedientes(n)} siguen sin asignar. El cambio se guardará al confirmar.</> : "Todavía no marcaste ningún expediente. No se guarda nada hasta que confirmes."}</span></p>

        <div className="as-prio">
          <p className="as-et-azul" id="as-et-prio">Prioridad de asignación</p>
          <p className="as-prio-txt">{n ? <>Se aplicará a {n === 1 ? "el expediente seleccionado" : `los ${n.toLocaleString("es-PE")} expedientes seleccionados`} del lote actual.</> : "Se aplicará a los expedientes del lote que asignes."}</p>
          <div className="as-prio-botones" role="radiogroup" aria-labelledby="as-et-prio">
            {PRIORIDADES.map(([v, et]) => <button key={v} type="button" role="radio" aria-checked={prioridad === v} className={prioridad === v ? "on" : ""} onClick={() => onPrioridad(v)}>{et}</button>)}
          </div>
        </div>
      </div>
      <div className="as-res-pie">
        {!auditor && n ? <p className="as-aviso-pie" role="status">Elige un auditor para poder asignar.</p> : null}
        <button type="button" className="as-asignar" disabled={asignando || !auditor || !n} onClick={onAsignar}>
          <Icon name="ok" size={17} strokeWidth={2.2} />{asignando ? "Asignando…" : n ? `Asignar ${expedientes(n)}` : "Asignar expedientes"}
        </button>
        <button type="button" className="as-enlace centro" onClick={onLimpiar} disabled={!n || asignando}>Limpiar selección</button>
      </div>
    </aside>
  );
}
