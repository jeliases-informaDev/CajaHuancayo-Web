import { useCallback, useEffect, useState } from "react";
import { request } from "../../api";
import { Icon } from "../icons";
import Ventana from "./Ventana";
import { PastillaCarga, etiquetaCarga, type ResultadoCarga } from "./pastillas";
import { AvisosDeCalidad, BotonReporte, Franja, NotaTope, TablaProblemas, filasConError, lineasDeError, num, validasDe, type Carga } from "./problemas";

// Historial de cargas (diseño de Figma): una tabla con cada archivo importado o validado y, debajo, el detalle del que se elija: cifras, qué pasó y la
// lista de lo que había que corregir. Es por páginas (las cargas se acumulan con los años).

type Fila = Pick<Carga, "id_importacion" | "archivo" | "simulacion" | "estado" | "resultado" | "actor" | "fecha_creacion" | "procesadas" | "insertadas" | "actualizadas" | "omitidas" | "errores"> & { total_filas: number };
const POR_PAGINA = 20;
const dia = (v: string) => new Intl.DateTimeFormat("es-PE", { day: "numeric", month: "short", year: "numeric" }).format(new Date(v));
const hora = (v: string) => new Intl.DateTimeFormat("es-PE", { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(v));

function Detalle({ carga }: { carga: Carga }) {
  const errores = lineasDeError(carga);
  const validas = validasDe(carga);
  const r: ResultadoCarga = carga.resultado;
  const creadas = carga.simulacion ? 0 : carga.insertadas; // una validación no crea nada: sus «nuevas» son las que se crearían
  const actualizadas = carga.simulacion ? 0 : carga.actualizadas;
  return (
    <section className="ex-detalle" aria-label={`Detalle de ${carga.archivo}`}>
      <div className="ex-archivo">
        <Icon name="planilla" size={26} />
        <div><b>Detalle · {carga.archivo}</b><span>{dia(carga.fecha_creacion)}, {hora(carga.fecha_creacion)} · {carga.actor || "—"}</span></div>
        <PastillaCarga resultado={r} />
      </div>
      <dl className="ex-franja-cifras">
        <div><dd>{num(carga.procesadas)}</dd><dt>filas detectadas</dt></div>
        <div><dd>{num(validas)}</dd><dt>válidas</dt></div>
        <div><dd>{num(carga.errores)}</dd><dt>con errores</dt></div>
        <div><dd>{num(creadas)}</dd><dt>{creadas === 1 ? "creada" : "creadas"}</dt></div>
        {actualizadas ? <div><dd>{num(actualizadas)}</dd><dt>{actualizadas === 1 ? "actualizada" : "actualizadas"}</dt></div> : null}
      </dl>
      {r === "CON_ERRORES" ? (
        <Franja tono="mal" titulo="No se importó este archivo">
          {carga.simulacion ? "La validación detectó" : "Antes de guardar se detectaron"} {filasConError(carga.errores)}. No se creó ningún expediente, tampoco a partir de las {num(validas)} filas válidas. Corrige los datos indicados y vuelve a validar el archivo.
        </Franja>
      ) : r === "IMPORTADA" ? (
        <Franja tono="ok" titulo="Se importó este archivo">
          Se {creadas === 1 ? "creó" : "crearon"} {num(creadas)} {creadas === 1 ? "expediente nuevo" : "expedientes nuevos"} y se {actualizadas === 1 ? "actualizó" : "actualizaron"} {num(actualizadas)}.
          {carga.omitidas ? ` ${num(carga.omitidas)} ${carga.omitidas === 1 ? "fila quedó" : "filas quedaron"} sin cambios u omitidas.` : ""}
          {carga.errores ? ` Esta carga es de antes del «todo o nada»: ${filasConError(carga.errores)} se dejaron fuera.` : ""}
        </Franja>
      ) : r === "VALIDADA" ? (
        <Franja tono="info" titulo="Validado sin errores, falta importarlo">La validación no encontró errores, pero el archivo no se importó. Para guardarlo, vuelve a cargarlo y confirma la importación.</Franja>
      ) : r === "INTERRUMPIDA" ? (
        <Franja tono="mal" titulo="La carga se interrumpió">El servidor se reinició mientras se procesaba. Vuelve a cargar el archivo: lo que ya se guardó saldrá como «sin cambios».</Franja>
      ) : r === "EN_PROCESO" ? (
        <Franja tono="info" titulo="Esta carga sigue en proceso">Vuelve a abrir el historial en un momento.</Franja>
      ) : (
        <Franja tono="mal" titulo="No se pudo leer este archivo">{errores[0]?.problema || errores[0]?.motivo || "Revisa el archivo y vuelve a cargarlo."}</Franja>
      )}
      <AvisosDeCalidad avisos={carga.advertencias} />
      <TablaProblemas lineas={errores} titulo="Qué había que corregir" />
      <NotaTope carga={carga} />
      {errores.length ? <div className="ex-acciones-validacion"><BotonReporte carga={carga} /></div> : null}
    </section>
  );
}

export default function HistorialCargas({ onClose }: { onClose: () => void }) {
  const [filas, setFilas] = useState<Fila[]>([]);
  const [pagina, setPagina] = useState(1);
  const [paginas, setPaginas] = useState(1);
  const [total, setTotal] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [elegida, setElegida] = useState<string | null>(null);
  const [detalle, setDetalle] = useState<Carga | null>(null);
  const [errorDetalle, setErrorDetalle] = useState("");

  const pedir = useCallback(async (p: number) => {
    setCargando(true); setError("");
    try {
      const r = await request<{ data: Fila[]; pagination: { pages: number; total: number } }>(`/api/expedientes/importaciones?limit=${POR_PAGINA}&page=${p}`);
      setFilas((antes) => (p === 1 ? r.data : [...antes, ...r.data])); setPagina(p); setPaginas(r.pagination.pages); setTotal(r.pagination.total);
      if (p === 1 && r.data[0]) setElegida(r.data[0].id_importacion);
    } catch (e: any) { setError(e?.message || "No se pudo cargar el historial."); } finally { setCargando(false); }
  }, []);
  useEffect(() => { void pedir(1); }, [pedir]);

  useEffect(() => {
    if (!elegida) { setDetalle(null); return; }
    let vigente = true;
    setErrorDetalle("");
    request<{ data: Carga }>(`/api/expedientes/importaciones/${elegida}`).then((r) => { if (vigente) setDetalle(r.data); }).catch((e) => { if (vigente) setErrorDetalle(e?.message || "No se pudo cargar el detalle."); });
    return () => { vigente = false; };
  }, [elegida]);

  return (
    <Ventana migas={["Historial de cargas"]} titulo="Historial de cargas" subtitulo="Seguimiento de archivos y resultado de cada carga." ancho={1100} onClose={onClose}
      nota="Las filas válidas y con errores forman parte del total; no son cargas adicionales." acciones={<button type="button" className="ex-boton claro" onClick={onClose}>Cerrar</button>}>
      {error ? <div role="alert" className="error-box">{error}</div> : null}
      {!cargando && !filas.length && !error ? <p className="ex-vacio-chico">Aún no hay cargas. Cuando cargues un archivo, aparecerá aquí con su resultado.</p> : null}
      {filas.length ? (
        <div className="ex-tabla-caja ex-historial">
          <table>
            <caption className="sr-only">Cargas de archivos, de la más reciente a la más antigua</caption>
            <thead><tr><th scope="col">Fecha / hora</th><th scope="col">Archivo</th><th scope="col">Responsable</th><th scope="col">Estado</th><th scope="col" className="n">Total</th><th scope="col" className="n">Creadas</th><th scope="col" className="n">Errores</th><th scope="col">Acción</th></tr></thead>
            <tbody>
              {filas.map((f) => (
                <tr key={f.id_importacion} className={f.id_importacion === elegida ? "on" : ""} onClick={() => setElegida(f.id_importacion)}>
                  <td className="fecha">{dia(f.fecha_creacion)}<small>{hora(f.fecha_creacion)}</small></td>
                  <td className="archivo">{f.archivo}</td>
                  <td>{f.actor || "—"}</td>
                  <td className={`estado ${etiquetaCarga(f.resultado).tono}`}>{etiquetaCarga(f.resultado).corta.split(" / ").map((x, i, a) => <span key={x}>{x}{i < a.length - 1 ? " /" : ""}</span>)}</td>
                  <td className="n">{num(f.procesadas || f.total_filas || 0)}</td>
                  <td className="n">{num(f.simulacion ? 0 : f.insertadas)}</td>
                  <td className="n">{num(f.errores)}</td>
                  <td><button type="button" className="ex-enlace chico" aria-pressed={f.id_importacion === elegida} aria-label={`Ver detalle de ${f.archivo}`} onClick={(e) => { e.stopPropagation(); setElegida(f.id_importacion); }}>Ver detalle</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {pagina < paginas ? <div className="ex-mas"><button type="button" className="ex-boton claro" disabled={cargando} onClick={() => pedir(pagina + 1)}>{cargando ? "Cargando…" : `Ver más cargas (${num(Math.max(0, total - filas.length))} más)`}</button></div> : null}
      {errorDetalle ? <div role="alert" className="error-box">{errorDetalle}</div> : null}
      {elegida && detalle && detalle.id_importacion === elegida ? <Detalle carga={detalle} /> : null}
    </Ventana>
  );
}
