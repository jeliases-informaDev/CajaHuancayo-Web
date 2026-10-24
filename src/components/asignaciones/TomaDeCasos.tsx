import { useEffect, useRef, useState } from "react";
import { request } from "../../api";
import { Icon } from "../icons";

// Burbuja «Toma de casos» de Asignaciones: lo que ya existía arriba de la pantalla (cuántos casos tomaron los propios auditores, el interruptor para que puedan tomarlos,
// el máximo de casos abiertos por asesor y liberar los pendientes que solo asigna un supervisor) ahora en una burbuja que se abre y se cierra, para no abultar el
// diseño de tres columnas. El interruptor y el máximo son solo del administrador y pasan por una confirmación, porque afectan a todos los auditores.
export default function TomaDeCasos({ esAdmin, refrescar, onAviso }: { esAdmin: boolean; refrescar: number; onAviso: (texto: string) => void }) {
  const [abierto, setAbierto] = useState(false);
  const [resumen, setResumen] = useState<any>(null);
  const [error, setError] = useState("");
  const [confirmar, setConfirmar] = useState(false);
  const [cambiando, setCambiando] = useState(false);
  const [topeEditado, setTopeEditado] = useState<string | null>(null); // lo que se va escribiendo; null = mostrar el valor guardado
  const [guardandoTope, setGuardandoTope] = useState(false);
  const [liberando, setLiberando] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);
  const boton = useRef<HTMLButtonElement>(null);

  const cargar = async () => {
    try { const r: any = await request("/api/asignaciones/resumen-origen"); setResumen(r.data); setError(""); }
    catch (e: any) { setError(e?.message || "No se pudo cargar el resumen."); }
  };
  useEffect(() => { cargar(); }, []);
  useEffect(() => { if (abierto) cargar(); }, [abierto, refrescar]);
  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => { if (raiz.current && !raiz.current.contains(e.target as Node)) setAbierto(false); };
    const tecla = (e: KeyboardEvent) => { if (e.key === "Escape") { setAbierto(false); boton.current?.focus(); } };
    document.addEventListener("mousedown", fuera); document.addEventListener("keydown", tecla);
    return () => { document.removeEventListener("mousedown", fuera); document.removeEventListener("keydown", tecla); };
  }, [abierto]);

  const topeTexto = topeEditado ?? (typeof resumen?.tope_casos === "number" ? String(resumen.tope_casos) : "");
  const topeNuevo = topeTexto.trim() === "" ? NaN : Number(topeTexto);
  const topeValido = Number.isInteger(topeNuevo) && topeNuevo >= 0 && topeNuevo <= 1000;

  const cambiarInterruptor = async (activa: boolean) => {
    setCambiando(true);
    try {
      const r: any = await request("/api/asignaciones/autoasignacion", { method: "PUT", body: JSON.stringify({ activa }) });
      setResumen(r.data); setConfirmar(false); setError("");
      onAviso(activa ? "Los auditores ya pueden tomar casos disponibles." : "Los auditores ya no pueden tomar casos por su cuenta: solo trabajan los que asignes tú.");
    } catch (e: any) { setError(e?.message || "No se pudo cambiar."); } finally { setCambiando(false); }
  };
  const guardarTope = async () => {
    if (!topeValido) return;
    setGuardandoTope(true);
    try {
      const r: any = await request("/api/asignaciones/tope-casos", { method: "PUT", body: JSON.stringify({ maximo: topeNuevo }) });
      setResumen(r.data); setTopeEditado(null); setError("");
      onAviso(topeNuevo === 0 ? "Sin máximo: los asesores pueden tomar todos los casos que quieran." : `Cada asesor puede tener hasta ${topeNuevo.toLocaleString("es-PE")} casos abiertos al tomarlos por su cuenta.`);
    } catch (e: any) { setError(e?.message || "No se pudo guardar el máximo."); } finally { setGuardandoTope(false); }
  };
  const liberar = async () => {
    if (!window.confirm(`¿Dejar ${Number(resumen?.pendientes_reservados || 0).toLocaleString("es-PE")} casos pendientes disponibles para que los auditores los tomen?`)) return;
    setLiberando(true);
    try {
      const r: any = await request("/api/asignaciones/liberar", { method: "POST" });
      setResumen(r.data.resumen); setError("");
      onAviso(`Se liberaron ${r.data.liberados.toLocaleString("es-PE")} casos: los auditores ya pueden tomarlos.`);
    } catch (e: any) { setError(e?.message || "No se pudieron liberar."); } finally { setLiberando(false); }
  };

  const activa = Boolean(resumen?.autoasignacion_activa);
  return (
    <div className="as-toma" ref={raiz}>
      <button ref={boton} type="button" className={"as-enlace" + (abierto ? " activo" : "")} aria-expanded={abierto} aria-controls="as-toma-pop" onClick={() => setAbierto((v) => !v)}>
        <span className={"as-punto " + (resumen ? (activa ? "ok" : "off") : "")} aria-hidden="true" />Toma de casos
      </button>
      {abierto ? (
        <div className="as-pop" id="as-toma-pop" role="dialog" aria-label="Toma de casos por los auditores">
          <h3>Toma de casos</h3>
          {!resumen ? <p className="as-txt">{error || "Cargando…"}</p> : (
            <>
              <p className="as-txt" role="status">
                {resumen.total > 0 ? <b>Casos tomados por el propio auditor: {resumen.autoasignadas.toLocaleString("es-PE")} de {resumen.total.toLocaleString("es-PE")} ({resumen.porcentaje} %).</b> : <b>Aún no hay casos asignados.</b>}{" "}
                {activa
                  ? `Los asesores pueden tomar cualquier caso disponible, de cualquier distrito.${resumen.tope_casos > 0 ? ` Cada uno puede tener hasta ${resumen.tope_casos.toLocaleString("es-PE")} casos abiertos al tomarlos por su cuenta.` : " No hay máximo de casos abiertos."}`
                  : "La toma de casos por cuenta propia está desactivada: solo trabajan lo que asigna un supervisor."}
              </p>
              {resumen.pendientes_reservados > 0 ? (
                <p className="as-txt">Hay {resumen.pendientes_reservados.toLocaleString("es-PE")} casos pendientes que solo asigna un supervisor (se cargaron sin marcar «disponibles»): los auditores no los ven en «Disponibles».{" "}
                  {esAdmin ? <button type="button" className="as-enlace en-linea" disabled={liberando} onClick={liberar}>{liberando ? "Liberando…" : "Liberarlos a los auditores"}</button> : "Pide al administrador que los libere."}</p>
              ) : null}
              {resumen.auditores.some((x: any) => x.autoasignadas > 0) ? (
                <ul className="as-top" aria-label="Casos tomados por auditor">
                  {resumen.auditores.filter((x: any) => x.autoasignadas > 0).slice(0, 6).map((x: any) => <li key={x.id}><span>{x.nombre}</span><b>{x.autoasignadas} de {x.total} ({x.porcentaje} %)</b></li>)}
                </ul>
              ) : null}
              {esAdmin ? (
                <div className="as-ajustes">
                  <button type="button" role="switch" aria-checked={activa} className={"as-interruptor" + (activa ? " on" : "")} disabled={cambiando} onClick={() => setConfirmar(true)}>
                    <span className="pista" aria-hidden="true"><span className="perilla" /></span><span>Los auditores pueden tomar casos</span>
                  </button>
                  {confirmar ? (
                    <div className="as-confirma" role="alert">
                      <span>{activa ? "¿Desactivarlo para todos los auditores?" : "¿Activarlo para todos los auditores?"}</span>
                      <button type="button" className="as-mini-boton primario" disabled={cambiando} onClick={() => cambiarInterruptor(!activa)}>{cambiando ? "Guardando…" : "Sí, cambiar"}</button>
                      <button type="button" className="as-mini-boton" onClick={() => setConfirmar(false)}>Cancelar</button>
                    </div>
                  ) : null}
                  <form className="as-tope" onSubmit={(e) => { e.preventDefault(); guardarTope(); }}>
                    <label htmlFor="as-tope">Máximo de casos abiertos por asesor</label>
                    <div>
                      <input id="as-tope" name="tope" type="number" inputMode="numeric" min={0} max={1000} step={1} autoComplete="off" value={topeTexto} onChange={(e) => setTopeEditado(e.target.value)} aria-describedby="as-tope-ayuda" />
                      <button type="submit" className="as-mini-boton primario" disabled={guardandoTope || !topeValido || topeNuevo === resumen.tope_casos}>{guardandoTope ? "Guardando…" : "Guardar"}</button>
                    </div>
                    <small id="as-tope-ayuda">0 = sin máximo. Vale cuando el asesor toma casos por su cuenta; un supervisor puede asignarle más.</small>
                  </form>
                </div>
              ) : null}
              {error ? <div role="alert" className="error-box" style={{ margin: 0 }}>{error}</div> : null}
            </>
          )}
          <button type="button" className="as-cerrar-pop" onClick={() => { setAbierto(false); boton.current?.focus(); }} aria-label="Cerrar"><Icon name="cerrar" size={16} /></button>
        </div>
      ) : null}
    </div>
  );
}
