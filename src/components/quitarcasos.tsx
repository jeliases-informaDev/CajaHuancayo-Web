import { useEffect, useMemo, useState } from "react";
import { request } from "../api";
import { Modal } from "./kit";
import { Field } from "./ui";
import { MOTIVOS, MOTIVOS_ELEGIBLES } from "../lib/casos";

// Quitar los casos abiertos de un asesor (se enfermó, se retiró…): se devuelven a «Disponibles» o pasan a otro asesor. Las asignaciones quitadas no se
// borran: quedan en el historial con el motivo, quién las quitó y cuándo.

const num = (n: number) => n.toLocaleString("es-PE");
type Asesor = { id: string; nombre: string };
type Resultado = { quitadas: number; devueltas: number; reasignadas: number; sin_cambio: number; de: string | null; a: string | null };
const nombreDe = (a: any) => `${a?.nombres || ""} ${a?.apellidos || ""}`.trim() || a?.username || "";

export function QuitarCasosModal({ auditor, autoasignacionActiva, topeCasos, onClose, onHecho }: {
  auditor: Asesor; autoasignacionActiva?: boolean; topeCasos?: number; onClose: () => void; onHecho: (r: Resultado) => void;
}) {
  const [fase, setFase] = useState<"cargando" | "listo" | "quitando" | "hecho">("cargando");
  const [activas, setActivas] = useState(0);
  const [receptores, setReceptores] = useState<{ id: string; nombre: string; activas: number }[]>([]);
  const [motivo, setMotivo] = useState("ENFERMEDAD");
  const [nota, setNota] = useState("");
  const [destino, setDestino] = useState<"DISPONIBLES" | "ASESOR">("DISPONIBLES");
  const [receptor, setReceptor] = useState("");
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let vigente = true;
    Promise.all([request<{ data: any[] }>("/api/asignaciones/carga"), request<{ data: any[] }>("/api/usuarios/auditores")])
      .then(([carga, auditores]) => {
        if (!vigente) return;
        const porId = new Map<string, number>(carga.data.map((x: any) => [x.id_usuario_auditor, x.activas]));
        setActivas(porId.get(auditor.id) || 0);
        setReceptores(auditores.data.filter((a: any) => a.id !== auditor.id).map((a: any) => ({ id: a.id, nombre: nombreDe(a), activas: porId.get(a.id) || 0 }))
          .sort((a, b) => a.activas - b.activas || a.nombre.localeCompare(b.nombre, "es")));
        setFase("listo");
      })
      .catch((e: Error) => { if (vigente) { setError(e.message || "No se pudo leer los casos del asesor."); setFase("listo"); } });
    return () => { vigente = false; };
  }, [auditor.id]);

  const valido = fase === "listo" && activas > 0 && (destino === "DISPONIBLES" || Boolean(receptor));
  const destinatario = useMemo(() => receptores.find((r) => r.id === receptor), [receptores, receptor]);

  const quitar = async () => {
    setFase("quitando"); setError("");
    try {
      const r = await request<{ data: Resultado }>("/api/asignaciones/quitar", {
        method: "POST",
        body: JSON.stringify({ id_usuario_auditor: auditor.id, motivo, destino, ...(nota.trim() ? { nota: nota.trim() } : {}), ...(destino === "ASESOR" ? { id_usuario_destino: receptor } : {}) }),
      });
      setResultado(r.data); setFase("hecho");
    } catch (e: any) { setError(e?.message || "No se pudieron quitar los casos."); setFase("listo"); }
  };
  const cerrar = () => { if (fase === "quitando") return; if (fase === "hecho" && resultado) onHecho(resultado); else onClose(); };

  return (
    <Modal title={`Quitar casos a ${auditor.nombre}`} onClose={cerrar}
      footer={
        fase === "hecho" ? <button className="btn" onClick={cerrar}>Cerrar</button> : (
          <>
            <button className="btn ghost" onClick={onClose} disabled={fase === "quitando"}>Cancelar</button>
            <button className="btn danger" onClick={quitar} disabled={!valido}>{fase === "quitando" ? "Quitando…" : activas > 0 ? `Quitar ${num(activas)} ${activas === 1 ? "caso" : "casos"}` : "Quitar casos"}</button>
          </>
        )
      }>
      <div className="mp-cuerpo">
        {fase === "cargando" ? <p role="status" className="subtle">Revisando sus casos…</p> : null}
        {error ? <div role="alert" className="error-box">{error}</div> : null}

        {fase === "listo" || fase === "quitando" ? (
          activas === 0 && !error ? <p className="subtle">{auditor.nombre} no tiene casos abiertos: no hay nada que quitar.</p> : (
            <>
              <p className="mp-resumen">{auditor.nombre} tiene <b>{num(activas)}</b> {activas === 1 ? "caso abierto" : "casos abiertos"}.</p>
              <p className="subtle" style={{ margin: 0 }}>No se pierde nada: los casos quedan en el historial con el motivo y quién los quitó.</p>

              <Field label="Motivo">
                <select name="motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} disabled={fase === "quitando"}>
                  {MOTIVOS_ELEGIBLES.map((m) => <option key={m} value={m}>{MOTIVOS[m]}</option>)}
                </select>
              </Field>
              <Field label="Nota (opcional)">
                <input name="nota" type="text" maxLength={200} autoComplete="off" placeholder="Por ejemplo: reposo médico hasta el 30…" value={nota} onChange={(e) => setNota(e.target.value)} disabled={fase === "quitando"} />
              </Field>

              <fieldset className="mp-opciones" disabled={fase === "quitando"}>
                <legend>¿A dónde van sus casos?</legend>
                <label>
                  <input type="radio" name="destino" checked={destino === "DISPONIBLES"} onChange={() => setDestino("DISPONIBLES")} />
                  <span><b>Volver a «Disponibles»</b>Cualquier asesor podrá tomarlos.</span>
                </label>
                <label>
                  <input type="radio" name="destino" checked={destino === "ASESOR"} onChange={() => setDestino("ASESOR")} />
                  <span><b>Pasarlos a otro asesor</b>Se los asignas ahora, con la misma prioridad.</span>
                </label>
              </fieldset>

              {destino === "ASESOR" ? (
                <Field label="Asesor que los recibe">
                  <select name="receptor" value={receptor} onChange={(e) => setReceptor(e.target.value)} disabled={fase === "quitando"}>
                    <option value="">Elige un asesor…</option>
                    {receptores.map((r) => <option key={r.id} value={r.id}>{r.nombre} · {num(r.activas)} {r.activas === 1 ? "caso" : "casos"}</option>)}
                  </select>
                </Field>
              ) : null}
              {destino === "ASESOR" && destinatario && topeCasos && destinatario.activas + activas > topeCasos ? (
                <div role="status" className="callout aviso">{destinatario.nombre} tendría {num(destinatario.activas + activas)} casos abiertos (el máximo al tomarlos por su cuenta es {num(topeCasos)}). Quizá convenga repartirlos entre varios asesores.</div>
              ) : null}
              {destino === "DISPONIBLES" && autoasignacionActiva === false ? (
                <div role="status" className="callout aviso">La toma de casos por cuenta propia está desactivada: quedarán pendientes hasta que tú los asignes.</div>
              ) : null}
            </>
          )
        ) : null}

        {fase === "hecho" && resultado ? (
          <>
            <div role="status" className="callout ok">
              Listo: se {resultado.quitadas === 1 ? "quitó 1 caso" : `quitaron ${num(resultado.quitadas)} casos`} a {resultado.de || auditor.nombre}.
            </div>
            <ul className="mp-lineas ok">
              {resultado.devueltas ? <li><b>{num(resultado.devueltas)}</b> volvieron a «Disponibles»</li> : null}
              {resultado.reasignadas ? <li><b>{num(resultado.reasignadas)}</b> pasaron a {resultado.a}</li> : null}
              {resultado.sin_cambio ? <li><b>{num(resultado.sin_cambio)}</b> ya estaban visitados y no cambian de estado</li> : null}
            </ul>
          </>
        ) : null}
      </div>
    </Modal>
  );
}
