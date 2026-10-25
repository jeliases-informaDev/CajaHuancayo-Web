import { useCallback, useEffect, useRef, useState } from "react";
import { request } from "../api";
import { Empty, Skeleton } from "../components/ui";
import { Icon } from "../components/icons";
import { ModoPruebasTarjeta } from "../components/limpieza";
import { AvisosSeguridad, ExportarModal, FiltrosRegistro, MetricasSeguridad, TablaRegistro } from "../components/seguridad";
import { useQueryParam } from "../lib/useQueryParam";
import { SIN_FILTROS, consultaDe, diaLocal, hayFiltros, textoRetencion, type Aviso, type Filtros, type Integridad, type Metricas, type Registro } from "../lib/seguridad";

type Pagina = { data: Registro[]; siguiente: string | null; total?: number; total_es_minimo?: boolean };

export default function SeguridadPage() {
  // Los filtros viven en la URL: se puede compartir lo que se está viendo y recargar sin perderlo.
  const [q, setQ] = useQueryParam("q");
  const [categoria, setCategoria] = useQueryParam("categoria");
  const [severidad, setSeveridad] = useQueryParam("severidad");
  const [resultado, setResultado] = useQueryParam("resultado");
  const [desde, setDesde] = useQueryParam("desde");
  const [hasta, setHasta] = useQueryParam("hasta");
  const [cambios, setCambios] = useQueryParam("cambios");
  const [actor, setActor] = useQueryParam("actor");
  const [accion, setAccion] = useQueryParam("accion");
  const filtros: Filtros = { q, categoria, severidad, resultado, desde, hasta, cambios: cambios === "1", actor, accion };
  const cambiar = (parcial: Partial<Filtros>) => {
    const poner: { [K in keyof Filtros]: (v: string) => void } = {
      q: setQ, categoria: setCategoria, severidad: setSeveridad, resultado: setResultado, desde: setDesde, hasta: setHasta, actor: setActor, accion: setAccion, cambios: (v) => setCambios(v),
    };
    for (const [k, v] of Object.entries(parcial) as [keyof Filtros, string | boolean][]) poner[k](k === "cambios" ? (v ? "1" : "") : String(v ?? ""));
  };
  const limpiar = () => cambiar(SIN_FILTROS);
  const clave = consultaDe(filtros).toString(); // lo que cambia cuando cambia algún filtro: dispara una consulta nueva

  // ---------------------------------------------------------------- cifras y avisos
  const [ventana, setVentana] = useState("24h");
  const [metricas, setMetricas] = useState<Metricas | null>(null);
  const [avisos, setAvisos] = useState<Aviso[] | null>(null);
  const [errorResumen, setErrorResumen] = useState("");
  const resumen = useCallback(async (fresco = false) => {
    const f = fresco ? "&fresco=true" : "";
    try {
      const [m, a] = await Promise.all([
        request<{ data: Metricas }>(`/api/seguridad/metricas?ventana=${ventana}${f}`),
        request<{ data: Aviso[] }>(`/api/seguridad/alertas${fresco ? "?fresco=true" : ""}`),
      ]);
      setMetricas(m.data); setAvisos(a.data); setErrorResumen("");
    } catch (e: any) { setErrorResumen(e.message || "No se pudieron leer las cifras de seguridad."); }
  }, [ventana]);
  useEffect(() => { resumen(); }, [resumen]);

  // ---------------------------------------------------------------- sello de integridad (cadena de huellas del registro)
  const [integridad, setIntegridad] = useState<Integridad | null>(null);
  const [verificandoSello, setVerificandoSello] = useState(false);
  const [errorSello, setErrorSello] = useState("");
  const verificarSello = async () => {
    setVerificandoSello(true); setErrorSello("");
    try { setIntegridad((await request<{ data: Integridad }>("/api/seguridad/integridad?ultimas=10000")).data); }
    catch (e: any) { setErrorSello(e.message || "No se pudo verificar el sello."); }
    finally { setVerificandoSello(false); }
  };
  const cifra = (x: number | null | undefined) => (x ?? 0).toLocaleString("es-PE");

  // ---------------------------------------------------------------- el registro, por páginas con cursor
  const [filas, setFilas] = useState<Registro[]>([]);
  const [siguiente, setSiguiente] = useState<string | null>(null);
  const [total, setTotal] = useState<{ n: number; minimo: boolean } | null>(null);
  const [cargando, setCargando] = useState(true);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [error, setError] = useState("");
  const peticion = useRef(0);
  const pedir = useCallback(async (cursor?: string) => {
    const id = ++peticion.current;
    if (cursor) setCargandoMas(true); else setCargando(true);
    try {
      const p = new URLSearchParams(clave);
      p.set("limit", "50");
      if (cursor) p.set("cursor", cursor); else if (p.has("desde")) p.set("contar", "true"); // el total solo se pide con un rango de fechas: sin él contaría millones
      const r = await request<Pagina>("/api/seguridad/auditoria?" + p.toString());
      if (id !== peticion.current) return; // llegó tarde: ya se pidió otra cosa
      setFilas((previas) => (cursor ? [...previas, ...r.data] : r.data));
      setSiguiente(r.siguiente);
      if (!cursor) setTotal(r.total != null ? { n: r.total, minimo: Boolean(r.total_es_minimo) } : null);
      setError("");
    } catch (e: any) { if (id === peticion.current) setError(e.message || "No se pudo leer el registro."); } finally { if (id === peticion.current) { setCargando(false); setCargandoMas(false); } }
  }, [clave]);
  useEffect(() => { pedir(); }, [pedir]);

  const actualizar = () => { resumen(true); pedir(); };
  // «Ver registros» de un aviso: se aplican sus filtros y se baja al registro.
  const verAviso = (a: Aviso) => {
    if (!a.filtro) return;
    cambiar({ ...SIN_FILTROS, categoria: a.filtro.categoria || "", accion: a.filtro.accion || "", actor: a.filtro.actor || "", desde: a.filtro.desde ? diaLocal(a.filtro.desde) : "" });
    document.getElementById("registro")?.scrollIntoView({ block: "start" });
  };

  const [exportando, setExportando] = useState(false);
  const retencion = textoRetencion(metricas?.retencion_dias ?? 0);
  const conteo = cargando ? "Cargando…"
    : total ? `${total.minimo ? "Más de " : ""}${total.n.toLocaleString("es-PE")} ${total.n === 1 && !total.minimo ? "registro" : "registros"}${filas.length < total.n ? ` · ${filas.length.toLocaleString("es-PE")} a la vista` : ""}`
    : `${filas.length.toLocaleString("es-PE")} ${filas.length === 1 ? "registro a la vista" : "registros a la vista"}${siguiente ? " (hay más)" : ""}`;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Seguridad</h1>
          <p>Quién hizo qué, cuándo y desde dónde. Nadie puede editar ni borrar estos registros desde el sistema{retencion ? `; se conservan ${retencion} y luego se depuran` : ""}.</p>
        </div>
        <div className="actions">
          <button type="button" className="btn quiet" onClick={actualizar}>Actualizar</button>
          <button type="button" className="btn" onClick={() => setExportando(true)}><Icon name="descargar" size={17} />Exportar registro</button>
        </div>
      </div>

      {errorResumen ? <div role="alert" className="error-box">{errorResumen}</div> : null}
      <MetricasSeguridad metricas={metricas} ventana={ventana} onVentana={setVentana} cargando={!errorResumen && !metricas} />
      <AvisosSeguridad avisos={avisos} cargando={!errorResumen && !avisos} onVer={verAviso} />

      <section className="section seg-sello" aria-labelledby="seg-sello-t">
        <div className="section-head">
          <h2 id="seg-sello-t">Sello de integridad</h2>
          <button type="button" className="btn quiet" onClick={verificarSello} disabled={verificandoSello} aria-busy={verificandoSello}>{verificandoSello ? "Verificando…" : "Verificar ahora"}</button>
        </div>
        <p className="seg-sello-texto">Cada anotación lleva una huella encadenada con la anterior. Si alguien modifica, borra o inserta una anotación directamente en la base de datos, la cadena se rompe y aquí se ve.</p>
        {integridad ? (integridad.ok ? (
          <div role="status" className="callout ok">
            <b>Intacto.</b> Las últimas {cifra(integridad.revisadas)} anotaciones (n.° {cifra(integridad.desde)} a {cifra(integridad.hasta)}) coinciden con sus sellos
            {integridad.sin_sellar ? `; ${cifra(integridad.sin_sellar)} anotaciones antiguas siguen sin sellar y se sellan solas` : ""}. Sello actual: <code translate="no">{integridad.sello_actual?.slice(0, 16)}…</code> · verificado a las {new Date(integridad.verificado_en).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" })}.
          </div>
        ) : (
          <div role="alert" className="error-box">
            <b>Cadena rota en la anotación n.° {integridad.rotura?.secuencia ?? "?"}:</b> {integridad.rotura?.detalle}. Alguien tocó el registro fuera del sistema: exporta el registro y avisa al responsable de seguridad.
          </div>
        )) : null}
        {errorSello ? <div role="alert" className="error-box">{errorSello}</div> : null}
      </section>

      <div id="modo-pruebas"><ModoPruebasTarjeta /></div>

      <section className="section" id="registro" aria-labelledby="seg-registro">
        <div className="section-head"><h2 id="seg-registro">Registro de auditoría</h2><span className="meta" role="status" aria-live="polite">{conteo}</span></div>
        <FiltrosRegistro filtros={filtros} onCambio={cambiar} onLimpiar={limpiar} />
        {cargando && !filas.length ? <Skeleton height={260} radius={16} style={{ display: "block" }} /> : error ? <div role="alert" className="error-box">{error}</div> : !filas.length ? (
          <Empty tipo="busqueda" title="Sin registros" text={hayFiltros(filtros) ? "Ningún registro coincide con estos filtros." : "Todavía no hay registros."} />
        ) : (
          <TablaRegistro filas={filas} />
        )}
        {siguiente && !error ? <button type="button" className="btn quiet" style={{ marginTop: 10 }} disabled={cargandoMas} onClick={() => pedir(siguiente)}>{cargandoMas ? "Cargando…" : "Ver más registros"}</button> : null}
      </section>

      {exportando ? <ExportarModal filtros={filtros} onClose={() => setExportando(false)} /> : null}
    </>
  );
}
