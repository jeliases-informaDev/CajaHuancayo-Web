import { useRef, useState } from "react";
import { API_URL, getToken, request } from "../api";
import { Modal } from "./kit";
import { Icon } from "./icons";
import { ADVERTENCIAS, fechaHora } from "../lib/format";

// Carga de expedientes en tres pasos: elegir el archivo, revisar el reporte de validación (no guarda
// nada) y confirmar la importación. El servidor procesa en segundo plano; aquí se muestra el avance.

type Estado = "elegir" | "validando" | "revision" | "importando" | "listo";
const PASOS = ["Archivo", "Revisión", "Importación"];

const pausa = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function ImportModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [archivo, setArchivo] = useState<File | null>(null);
  const [estado, setEstado] = useState<Estado>("elegir");
  const [autoasignable, setAutoasignable] = useState(false);
  const [avance, setAvance] = useState(0);
  const [reporte, setReporte] = useState<any>(null);
  const [repetido, setRepetido] = useState<any>(null);
  const [liberados, setLiberados] = useState<number | null>(null);
  const [error, setError] = useState("");
  const entrada = useRef<HTMLInputElement>(null);

  const ejecutar = async (file: File, simular: boolean) => {
    setError(""); setAvance(0);
    setEstado(simular ? "validando" : "importando");
    try {
      const fd = new FormData();
      fd.append("archivo", file);
      const token = getToken();
      const q = new URLSearchParams({ simular: String(simular), autoasignable: String(autoasignable) });
      const resp = await fetch(`${API_URL}/api/expedientes/importar?${q}`, { method: "POST", headers: { "x-client-platform": "web", ...(token ? { Authorization: "Bearer " + token } : {}) }, body: fd });
      const body = await resp.json();
      if (!resp.ok) throw new Error(body.error || "No se pudo leer el archivo.");
      setRepetido(body.data.archivo_repetido || null);
      let actual: any = body.data;
      for (;;) {
        await pausa(1200);
        actual = (await request<any>(`/api/expedientes/importaciones/${body.data.id_importacion}`)).data;
        setAvance(actual.procesadas || 0);
        if (actual.estado !== "PROCESANDO") break;
      }
      setReporte(actual);
      setEstado(simular ? "revision" : "listo");
      if (!simular) onDone();
    } catch (e: any) {
      setError(e.message);
      setEstado(simular ? "elegir" : "revision");
    }
  };

  const liberar = async () => {
    try {
      const r: any = await request(`/api/expedientes/importaciones/${reporte.id_importacion}/liberar`, { method: "POST" });
      setLiberados(r.data.liberados);
      onDone();
    } catch (e: any) { setError(e.message); }
  };

  const paso = estado === "elegir" || estado === "validando" ? 0 : estado === "revision" ? 1 : 2;
  const trabajando = estado === "validando" || estado === "importando";
  const errores = (reporte?.detalle_error || []).filter((d: any) => d.resultado === "ERROR" || d.resultado === "OMITIDA" || d.resultado === "HOJA_IGNORADA");
  const avisos = Object.entries(reporte?.advertencias || {}) as [string, number][];

  const resumen = reporte ? (
    <>
      <table style={{ marginBottom: 14 }}>
        <tbody>
          <tr><td>Filas leídas</td><td className="num">{reporte.procesadas}</td></tr>
          <tr><td>Expedientes nuevos</td><td className="num">{reporte.insertadas}</td></tr>
          <tr><td>Actualizados</td><td className="num">{reporte.actualizadas}</td></tr>
          <tr><td>Omitidos o sin cambios</td><td className="num">{reporte.omitidas}</td></tr>
          <tr><td>Con error</td><td className="num" style={{ color: reporte.errores ? "var(--bad)" : undefined, fontWeight: reporte.errores ? 600 : undefined }}>{reporte.errores}</td></tr>
        </tbody>
      </table>
      {avisos.length ? (
        <div role="status" className="callout aviso">
          <b>Avisos de calidad del dato</b>
          {avisos.map(([codigo, n]) => <div key={codigo}>{n} fila(s): {ADVERTENCIAS[codigo] || codigo}</div>)}
        </div>
      ) : null}
      {errores.length ? (
        <details>
          <summary className="subtle" style={{ cursor: "pointer" }}>Ver filas omitidas o con error ({errores.length})</summary>
          <table className="compact" style={{ marginTop: 8 }}>
            <thead><tr><th scope="col">Hoja</th><th scope="col">Fila</th><th scope="col">Crédito</th><th scope="col">Motivo</th></tr></thead>
            <tbody>{errores.slice(0, 40).map((d: any, i: number) => <tr key={i}><td>{d.hoja || "-"}</td><td>{d.fila ?? "-"}</td><td>{d.codigo || "-"}</td><td>{d.motivo}</td></tr>)}</tbody>
          </table>
        </details>
      ) : null}
    </>
  ) : null;

  return (
    <Modal
      title="Cargar expedientes"
      steps={PASOS}
      step={paso}
      onClose={trabajando ? () => {} : onClose}
      footer={
        estado === "revision" ? (
          <>
            <button className="btn ghost" onClick={() => { setReporte(null); setArchivo(null); setEstado("elegir"); }}>Elegir otro archivo</button>
            <button className="btn" disabled={!archivo || reporte?.errores === reporte?.procesadas} onClick={() => archivo && ejecutar(archivo, false)}>Importar y guardar</button>
          </>
        ) : estado === "listo" ? (
          <button className="btn" onClick={onClose}>Terminar</button>
        ) : (
          <button className="btn ghost" disabled={trabajando} onClick={onClose}>Cancelar</button>
        )
      }
    >
      {error ? <div role="alert" className="error-box">{error}</div> : null}

      {estado === "elegir" ? (
        <>
          <div className="dropzone" role="button" tabIndex={0} onClick={() => entrada.current?.click()} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && entrada.current?.click()}>
            <Icon name="subir" size={26} /><b style={{ marginTop: 8 }}>Elegir archivo de Excel (.xlsx)</b>
            <span>{archivo ? archivo.name : "La base MYPE del core o la plantilla de expedientes"}</span>
          </div>
          <input ref={entrada} type="file" accept=".xlsx" aria-label="Archivo de Excel" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) { setArchivo(f); ejecutar(f, true); } }} />
          <p className="subtle" style={{ marginTop: 14 }}>Primero se revisa todo el archivo sin guardar nada. Después decides si importarlo.</p>
          <label className="check-inline" style={{ height: "auto", marginTop: 12, alignItems: "flex-start" }}>
            <input type="checkbox" checked={autoasignable} onChange={(e) => setAutoasignable(e.target.checked)} style={{ marginTop: 3 }} />
            <span>Dejar los expedientes nuevos disponibles para que los auditores de su zona los tomen por su cuenta. Si no lo marcas, solo un supervisor los asigna.</span>
          </label>
        </>
      ) : null}

      {trabajando ? (
        <div role="status" aria-live="polite" style={{ padding: "26px 0", textAlign: "center" }}>
          <div className="figure" style={{ fontSize: 38 }}>{avance.toLocaleString("es-PE")}</div>
          <p className="subtle" style={{ marginTop: 8 }}>{estado === "validando" ? "filas revisadas. No se está guardando nada." : "filas procesadas. No cierres esta ventana."}</p>
        </div>
      ) : null}

      {estado === "revision" && reporte ? (
        <>
          {repetido ? <div role="status" className="callout aviso">Este mismo archivo ya se importó el {fechaHora(repetido.fecha_creacion)}. Si no cambió, todo saldrá como «sin cambios».</div> : null}
          <p style={{ marginBottom: 12 }}>Así quedaría la importación de <b style={{ fontWeight: 600 }}>{archivo?.name}</b>. Aún no se guardó nada.</p>
          {resumen}
        </>
      ) : null}

      {estado === "listo" && reporte ? (
        <>
          <div className={`callout ${reporte.errores ? "aviso" : "ok"}`}>Importación terminada: {reporte.insertadas} nuevos y {reporte.actualizadas} actualizados.</div>
          {resumen}
          {reporte.insertadas > 0 && !autoasignable ? (
            <div role="status" className="callout info">
              Los expedientes nuevos solo los asigna un supervisor.{" "}
              {liberados != null ? `Se liberaron ${liberados} para que los auditores los tomen.` : <button className="btn quiet small" onClick={liberar}>Liberarlos a los auditores</button>}
            </div>
          ) : null}
        </>
      ) : null}
    </Modal>
  );
}
