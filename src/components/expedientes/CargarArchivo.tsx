import { useEffect, useRef, useState } from "react";
import { API_URL, getEmpresaElegida, getToken, request } from "../../api";
import { Icon } from "../icons";
import { fechaHora } from "../../lib/format";
import Ventana from "./Ventana";
import { PastillaCarga } from "./pastillas";
import { AvisosDeCalidad, BotonReporte, Cifras, FORMATOS, Franja, NotaTope, TablaProblemas, filasConError, lineasDeError, num, validasDe, type Carga } from "./problemas";

// Cargar archivo en tres pasos (diseño de Figma): 1 elegir el archivo, 2 validar los datos (no guarda nada) y 3 confirmar la importación.
// TODO O NADA: si una sola fila trae un error no se guarda ninguna (ni las válidas); el servidor lo garantiza y aquí se muestra qué corregir.

type Vista = "elegir" | "revisando" | "validacion" | "importando" | "listo";
const PASOS = ["Seleccionar archivo", "Validar datos", "Confirmar importación"];
const pausa = (ms: number) => new Promise((r) => setTimeout(r, ms));
const tamano = (bytes: number) => (bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

async function subir(archivo: File, simular: boolean, autoasignable: boolean) {
  const fd = new FormData();
  fd.append("archivo", archivo);
  const token = getToken(); const empresa = getEmpresaElegida();
  const q = new URLSearchParams({ simular: String(simular), autoasignable: String(autoasignable) });
  const resp = await fetch(`${API_URL}/api/expedientes/importar?${q}`, { method: "POST", headers: { "x-client-platform": "web", ...(token ? { Authorization: "Bearer " + token } : {}), ...(empresa ? { "x-empresa-id": empresa } : {}) }, body: fd });
  const cuerpo = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(cuerpo.error || "No se pudo leer el archivo.");
  return cuerpo.data as { id_importacion: string; archivo_repetido: Carga["archivo_repetido"] };
}

export default function CargarArchivo({ onClose, onDone, onVerPlantillas }: { onClose: () => void; onDone: () => void; onVerPlantillas: () => void }) {
  const [vista, setVista] = useState<Vista>("elegir");
  const [archivo, setArchivo] = useState<File | null>(null);
  const [autoasignable, setAutoasignable] = useState(true);
  const [carga, setCarga] = useState<Carga | null>(null);
  const [avance, setAvance] = useState<{ n: number; fase?: string | null }>({ n: 0 });
  const [bloqueada, setBloqueada] = useState(false); // la importación real se frenó por errores (después de una validación limpia: el archivo o los datos cambiaron)
  const [liberados, setLiberados] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [arrastrando, setArrastrando] = useState(false);
  const entrada = useRef<HTMLInputElement>(null);
  const vivo = useRef(true);
  // El modo estricto de React monta, desmonta y vuelve a montar: por eso «vivo» se enciende al montar (no basta con apagarlo al desmontar).
  useEffect(() => { vivo.current = true; return () => { vivo.current = false; }; }, []);

  const elegir = (f: File | null | undefined) => {
    if (!f) return;
    if (!/\.xlsx$/i.test(f.name)) { setError("Solo se aceptan archivos de Excel (.xlsx). Si tu archivo es de otro tipo, ábrelo en Excel y guárdalo como «Libro de Excel (.xlsx)»."); return; }
    setError(""); setArchivo(f);
  };

  // Sube el archivo y espera a que el servidor termine (corre en segundo plano); mientras tanto muestra el avance.
  const correr = async (simular: boolean) => {
    if (!archivo) return;
    setError(""); setAvance({ n: 0 }); setBloqueada(false);
    setVista(simular ? "revisando" : "importando");
    try {
      const inicio = await subir(archivo, simular, autoasignable);
      let actual: Carga;
      for (;;) {
        await pausa(800);
        actual = (await request<{ data: Carga }>(`/api/expedientes/importaciones/${inicio.id_importacion}`)).data;
        if (!vivo.current) return;
        setAvance({ n: actual.procesadas || 0, fase: actual.fase });
        if (actual.estado !== "PROCESANDO") break;
      }
      setCarga({ ...actual, archivo_repetido: inicio.archivo_repetido });
      if (simular) setVista("validacion");
      else if (actual.resultado === "IMPORTADA") { setVista("listo"); onDone(); }
      else { setBloqueada(true); setVista("validacion"); }
    } catch (e: any) {
      if (!vivo.current) return;
      setError(e?.message || "No se pudo procesar el archivo.");
      setVista(simular ? "elegir" : "validacion");
    }
  };

  const liberar = async () => {
    if (!carga) return;
    try { const r = await request<{ data: { liberados: number } }>(`/api/expedientes/importaciones/${carga.id_importacion}/liberar`, { method: "POST" }); setLiberados(r.data.liberados); onDone(); }
    catch (e: any) { setError(e?.message || "No se pudieron liberar."); }
  };

  const cambiarArchivo = () => { setCarga(null); setArchivo(null); setError(""); setBloqueada(false); setVista("elegir"); };
  const ocupada = vista === "revisando" || vista === "importando";
  const errores = carga ? lineasDeError(carga) : [];
  const conErrores = Boolean(carga && (carga.errores > 0 || carga.estado === "ERROR" || carga.estado === "BLOQUEADA"));
  const paso = vista === "elegir" ? 0 : vista === "listo" || vista === "importando" ? 2 : 1;

  const titulos: Record<Vista, { migas: string[]; titulo: string; subtitulo: string }> = {
    elegir: { migas: ["Cargar archivo"], titulo: "Cargar archivo", subtitulo: "Selecciona un archivo para revisar sus datos antes de importar expedientes." },
    revisando: { migas: ["Cargar archivo", "Validación"], titulo: "Validación de carga", subtitulo: "Revisa los resultados del archivo antes de continuar con la importación." },
    validacion: { migas: ["Cargar archivo", "Validación"], titulo: "Validación de carga", subtitulo: "Revisa los resultados del archivo antes de continuar con la importación." },
    importando: { migas: ["Cargar archivo", "Importación"], titulo: "Importación de expedientes", subtitulo: "El archivo se guarda solo si todas sus filas están correctas." },
    listo: { migas: ["Cargar archivo", "Importación"], titulo: "Importación de expedientes", subtitulo: "El archivo se guarda solo si todas sus filas están correctas." },
  };
  const t = titulos[vista];

  const pie = (() => {
    if (vista === "elegir") return { nota: archivo ? "Listo para validar: todavía no se guarda nada." : "Selecciona un archivo para habilitar la validación.", acciones: <><button type="button" className="ex-boton claro" onClick={onClose}>Cancelar</button><button type="button" className="ex-boton primario" disabled={!archivo} onClick={() => correr(true)}>Validar archivo</button></> };
    if (vista === "validacion") {
      const puede = Boolean(carga) && !conErrores && carga!.procesadas > 0;
      return {
        nota: conErrores ? "La confirmación se habilita cuando no quedan errores." : "Al confirmar se guardan todas las filas del archivo.",
        acciones: <><button type="button" className="ex-boton claro" onClick={onClose}>Cancelar</button><button type="button" className="ex-boton primario" disabled={!puede} onClick={() => correr(false)}>Confirmar importación</button></>,
      };
    }
    if (vista === "listo") return { nota: "El archivo quedó registrado en el historial de cargas.", acciones: <button type="button" className="ex-boton primario" onClick={onClose}>Terminar</button> };
    return { nota: vista === "revisando" ? "No se está guardando nada." : "No cierres esta ventana mientras se guarda.", acciones: null };
  })();

  return (
    <Ventana migas={t.migas} titulo={t.titulo} subtitulo={t.subtitulo} ocupada={ocupada} onClose={onClose} nota={pie.nota} acciones={pie.acciones}>
      {error ? <div role="alert" className="error-box">{error}</div> : null}

      {vista === "elegir" ? (
        <>
          <ol className="ex-pasos" aria-label="Pasos de la carga">
            {PASOS.map((p, i) => <li key={p} aria-current={i === paso ? "step" : undefined} className={i === paso ? "on" : ""}><span>{i + 1}</span> {p}</li>)}
          </ol>
          <div className={`ex-zona${arrastrando ? " sobre" : ""}`} onDragOver={(e) => { e.preventDefault(); setArrastrando(true); }} onDragLeave={() => setArrastrando(false)}
            onDrop={(e) => { e.preventDefault(); setArrastrando(false); elegir(e.dataTransfer.files?.[0]); }}>
            <span className="ex-zona-icono" aria-hidden="true"><Icon name="subir" size={22} /></span>
            <b>Arrastra tu archivo aquí o selecciónalo</b>
            <span>Formato: Excel (.xlsx)</span>
            <button type="button" className="ex-boton claro" onClick={() => entrada.current?.click()}><Icon name="expedientes" size={17} />Seleccionar archivo</button>
            <small aria-live="polite">{archivo ? <><Icon name="planilla" size={14} /> {archivo.name} · {tamano(archivo.size)}</> : "Ningún archivo seleccionado"}</small>
            <input ref={entrada} type="file" accept=".xlsx" aria-label="Archivo de Excel" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; elegir(f); }} />
          </div>
          <div className="ex-preparar">
            <div><b>¿Necesitas preparar tus datos?</b><span>Usa un modelo de Consumo o MYPE y conserva el crédito como texto.</span></div>
            <button type="button" className="ex-enlace" onClick={onVerPlantillas}><Icon name="descargar" size={17} />Ver plantillas</button>
          </div>
          <Franja tono="info" titulo="Primero validamos, después importamos">Seleccionar un archivo no crea registros. La siguiente acción revisará los datos y mostrará los errores antes de confirmar la importación. Si una sola fila tiene errores, no se importa ninguna.</Franja>
          <label className="ex-opcion"><input type="checkbox" className="ex-chk" checked={autoasignable} onChange={(e) => setAutoasignable(e.target.checked)} /><span>Dejar los expedientes nuevos disponibles para que los asesores los tomen por su cuenta, de cualquier distrito. Si lo desmarcas, solo un supervisor los asigna.</span></label>
        </>
      ) : null}

      {vista === "revisando" || vista === "importando" ? (
        <div className="ex-trabajando" role="status" aria-live="polite">
          <span className="ex-giro" aria-hidden="true" />
          <b>{vista === "revisando" ? "Revisando el archivo…" : avance.fase === "REVISANDO" ? "Revisando todo el archivo antes de guardar…" : "Guardando los expedientes…"}</b>
          <strong>{num(avance.n)}</strong>
          <span>{vista === "revisando" ? "filas revisadas. No se está guardando nada." : avance.fase === "REVISANDO" ? "filas revisadas. Si hay un error, no se guarda nada." : "filas guardadas. No cierres esta ventana."}</span>
        </div>
      ) : null}

      {vista === "validacion" && carga ? (
        <>
          <div className="ex-archivo">
            <Icon name="planilla" size={30} />
            <div><b>{carga.archivo}</b><span>{carga.formato ? `${FORMATOS[carga.formato] || carga.formato} · ` : ""}Paso 2 de 3: validar datos</span></div>
            <PastillaCarga resultado={bloqueada ? "CON_ERRORES" : conErrores ? (carga.estado === "ERROR" ? "ERROR" : "CON_ERRORES") : "VALIDADA"} />
          </div>
          {carga.archivo_repetido ? <div role="status" className="ex-aviso-repetido">Este mismo archivo ya se importó el {fechaHora(carga.archivo_repetido.fecha_creacion)}. Si no cambió, todo saldrá como «sin cambios».</div> : null}
          <Cifras carga={carga} importadas={0} />
          {carga.estado === "ERROR" ? (
            <Franja tono="mal" titulo="No se pudo leer el archivo">{errores[0]?.problema || errores[0]?.motivo || "Revisa el archivo y vuelve a intentarlo."}</Franja>
          ) : conErrores ? (
            <Franja tono="mal" titulo={bloqueada ? `No se importó: el archivo tiene ${filasConError(carga.errores)}` : `Importación bloqueada: corrige ${carga.errores === 1 ? "la fila con error" : `las ${num(carga.errores)} filas con errores`}`}>
              {bloqueada ? "No se creó ningún expediente: " : "Aún no se creó ningún expediente. "}Las {num(validasDe(carga))} filas válidas tampoco se {bloqueada ? "importaron" : "han importado"}. Corrige el archivo y vuelve a validarlo.
            </Franja>
          ) : (
            <Franja tono="ok" titulo="Listo para importar">
              Las {num(carga.procesadas)} filas están correctas. Al confirmar se crearán {num(carga.insertadas)} {carga.insertadas === 1 ? "expediente nuevo" : "expedientes nuevos"}
              {carga.actualizadas ? ` y se actualizarán ${num(carga.actualizadas)}` : ""}{carga.omitidas ? `; ${num(carga.omitidas)} quedan sin cambios u omitidas` : ""}.
            </Franja>
          )}
          <AvisosDeCalidad avisos={carga.advertencias} />
          <TablaProblemas lineas={errores} />
          <NotaTope carga={carga} />
          <div className="ex-acciones-validacion">
            <button type="button" className="ex-boton claro" onClick={cambiarArchivo}><Icon name="cambiar" size={17} />Cambiar archivo</button>
            {conErrores && errores.length ? <BotonReporte carga={carga} /> : null}
          </div>
        </>
      ) : null}

      {vista === "listo" && carga ? (
        <>
          <div className="ex-archivo">
            <Icon name="planilla" size={30} />
            <div><b>{carga.archivo}</b><span>{carga.formato ? `${FORMATOS[carga.formato] || carga.formato} · ` : ""}Paso 3 de 3: importación terminada</span></div>
            <PastillaCarga resultado="IMPORTADA" />
          </div>
          <Cifras carga={carga} importadas={carga.insertadas + carga.actualizadas} />
          <Franja tono="ok" titulo="Importación terminada">
            Se {carga.insertadas === 1 ? "creó" : "crearon"} {num(carga.insertadas)} {carga.insertadas === 1 ? "expediente nuevo" : "expedientes nuevos"} y se {carga.actualizadas === 1 ? "actualizó" : "actualizaron"} {num(carga.actualizadas)}.
            {carga.omitidas ? ` ${num(carga.omitidas)} ${carga.omitidas === 1 ? "fila quedó" : "filas quedaron"} sin cambios u omitidas.` : ""}
          </Franja>
          <AvisosDeCalidad avisos={carga.advertencias} />
          {carga.insertadas > 0 && !autoasignable ? (
            <div role="status" className="ex-liberar">
              Los expedientes nuevos solo los asigna un supervisor.{" "}
              {liberados != null ? <b>Se liberaron {num(liberados)} para que los auditores los tomen.</b> : <button type="button" className="ex-enlace" onClick={liberar}>Liberarlos a los auditores</button>}
            </div>
          ) : null}
        </>
      ) : null}
    </Ventana>
  );
}
