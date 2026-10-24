import { useCallback, useEffect, useState } from "react";
import { request } from "../api";
import { useAuth } from "../AuthContext";
import { Icon } from "../components/icons";
import { QuitarCasosModal } from "../components/quitarcasos";
import ColumnaAuditores from "../components/asignaciones/ColumnaAuditores";
import ColumnaExpedientes from "../components/asignaciones/ColumnaExpedientes";
import ListaAsignaciones from "../components/asignaciones/ListaAsignaciones";
import ResumenAsignacion from "../components/asignaciones/ResumenAsignacion";
import TomaDeCasos from "../components/asignaciones/TomaDeCasos";
import { LOTE_ASIGNAR, expedientes, nombreAuditor, trozos, type Auditor, type Pendiente, type Seleccion } from "../lib/asignaciones";
import { useParametros } from "../lib/useParametros";
import "../pantalla.css";
import "../asignaciones.css";

// Asignaciones — diseño de Figma en tres columnas: «Auditores», «Expedientes sin asignar» y «Resumen de asignación». Elegir un auditor, marcar expedientes (de la página que se
// quiera: lo marcado se conserva al cambiar de página o de filtro) y confirmar. Las dos listas largas se piden por páginas al servidor, con la búsqueda y los filtros allá.
// Lo que ya existía arriba de la pantalla (toma de casos por los auditores) y la tabla de asignaciones salen cuando se necesitan: burbuja «Toma de casos» y ventana «Asignaciones».

export default function AsignacionesPage() {
  const { user, empresaElegida } = useAuth();
  const esAdmin = user?.rol === "ADMINISTRADOR" || (user?.rol === "UNIVERSAL" && Boolean(empresaElegida));
  const { params, fijar } = useParametros();
  const auditorId = params.get("auditor") || "";
  const [auditor, setAuditor] = useState<Auditor | null>(null);
  const [seleccion, setSeleccion] = useState<Seleccion>(() => new Map());
  const [prioridad, setPrioridad] = useState("MEDIA");
  const [asignando, setAsignando] = useState(false);
  const [aviso, setAviso] = useState("");
  const [error, setError] = useState("");
  const [refrescar, setRefrescar] = useState(0);
  const [lista, setLista] = useState<null | "todas" | "auditor">(null); // ventana «Asignaciones» (todas) o «Casos de …» (las del auditor elegido)
  const [quitar, setQuitar] = useState<null | { autoasignacionActiva?: boolean; topeCasos?: number }>(null);

  // El auditor elegido (puede venir de un enlace con ?auditor= y no estar en la primera página de la lista): se pide por su id, y otra vez después de cada cambio para que
  // sus casos activos estén al día.
  useEffect(() => {
    if (!auditorId) { setAuditor(null); return; }
    let vigente = true;
    request<{ data: Auditor[] }>(`/api/usuarios/auditores?page=1&limit=1&id=${encodeURIComponent(auditorId)}`)
      .then((r) => { if (!vigente) return; if (r.data[0]) setAuditor(r.data[0]); else { setAuditor(null); fijar({ auditor: null }); } })
      .catch(() => {});
    return () => { vigente = false; };
  }, [auditorId, refrescar]); // eslint-disable-line react-hooks/exhaustive-deps

  const elegir = useCallback((a: Auditor | null) => { setAuditor(a); fijar({ auditor: a?.id ?? null }); }, [fijar]);

  const alternar = useCallback((p: Pendiente) => setSeleccion((prev) => {
    const s = new Map(prev);
    if (s.has(p.id_expediente)) s.delete(p.id_expediente); else s.set(p.id_expediente, { id: p.id_expediente, codigo: p.codigo_expediente, nombre: p.nombres_cliente });
    return s;
  }), []);
  const marcarPagina = useCallback((filas: Pendiente[], marcar: boolean) => setSeleccion((prev) => {
    const s = new Map(prev);
    for (const p of filas) { if (marcar) s.set(p.id_expediente, { id: p.id_expediente, codigo: p.codigo_expediente, nombre: p.nombres_cliente }); else s.delete(p.id_expediente); }
    return s;
  }), []);
  const quitarMarca = useCallback((id: number) => setSeleccion((prev) => { const s = new Map(prev); s.delete(id); return s; }), []);
  const limpiar = useCallback(() => setSeleccion(new Map()), []);

  const asignar = async () => {
    if (!auditor || !seleccion.size) return;
    setAsignando(true); setError(""); setAviso("");
    const fallidos: { id: number; error: string }[] = [];
    let hechos = 0;
    try {
      // El servidor recibe hasta 500 por pedido: una selección grande se manda en varios.
      for (const lote of trozos([...seleccion.keys()], LOTE_ASIGNAR)) {
        const r: any = await request("/api/asignaciones/masivo", { method: "POST", body: JSON.stringify({ id_usuario_auditor: auditor.id, id_expedientes: lote, prioridad }) });
        for (const x of r.data || []) { if (x.ok) hechos += 1; else fallidos.push({ id: x.id_expediente, error: x.error }); }
      }
      setAviso(fallidos.length
        ? `Se asignaron ${hechos.toLocaleString("es-PE")} y ${fallidos.length.toLocaleString("es-PE")} no se pudieron asignar: ${fallidos[0].error}`
        : `Se ${hechos === 1 ? "asignó 1 expediente" : `asignaron ${expedientes(hechos)}`} a ${nombreAuditor(auditor)}.`);
      // Lo que no se pudo asignar queda marcado para revisarlo; lo asignado sale de la selección.
      setSeleccion((prev) => { const s: Seleccion = new Map(); for (const f of fallidos) { const it = prev.get(f.id); if (it) s.set(f.id, it); } return s; });
    } catch (x: any) {
      setError(`${hechos ? `Se asignaron ${hechos.toLocaleString("es-PE")} antes del fallo. ` : ""}${x?.message || "No se pudo asignar."}`);
    } finally { setAsignando(false); setRefrescar((n) => n + 1); }
  };

  // «Quitar sus casos…»: se leen los ajustes de toma de casos para que la ventana avise de lo que cambia al devolverlos a «Disponibles».
  const abrirQuitar = async () => {
    setLista(null);
    let ajustes: { autoasignacionActiva?: boolean; topeCasos?: number } = {};
    try { const r: any = await request("/api/asignaciones/resumen-origen"); ajustes = { autoasignacionActiva: r.data?.autoasignacion_activa, topeCasos: r.data?.tope_casos }; } catch { /* la ventana funciona sin estos datos */ }
    setQuitar(ajustes);
  };

  return (
    <div className="pa-pagina as-pagina">
      <h1 className="sr-only">Asignaciones</h1>
      <div className="as-barra">
        <div className="as-mensajes">
          {error ? <div role="alert" className="as-msg mal"><Icon name="alertaCirculo" size={16} /><span>{error}</span><button type="button" onClick={() => setError("")} aria-label="Cerrar el aviso"><Icon name="cerrar" size={14} /></button></div> : null}
          {aviso ? <div role="status" className="as-msg ok"><Icon name="ok" size={16} /><span>{aviso}</span><button type="button" onClick={() => setAviso("")} aria-label="Cerrar el aviso"><Icon name="cerrar" size={14} /></button></div> : null}
        </div>
        <div className="as-enlaces">
          <TomaDeCasos esAdmin={esAdmin} refrescar={refrescar} onAviso={setAviso} />
          <button type="button" className="as-enlace" onClick={() => setLista("todas")}><Icon name="reloj" size={15} />Asignaciones</button>
        </div>
      </div>

      <div className="as-planner">
        <ColumnaAuditores auditorId={auditorId} onElegir={elegir} refrescar={refrescar} />
        <ColumnaExpedientes seleccion={seleccion} onAlternar={alternar} onPagina={marcarPagina} onLimpiar={limpiar} refrescar={refrescar} />
        <ResumenAsignacion auditor={auditor} seleccion={seleccion} prioridad={prioridad} onPrioridad={setPrioridad} onQuitar={quitarMarca} onLimpiar={limpiar} onAsignar={asignar} asignando={asignando} onVerCasos={() => setLista("auditor")} />
      </div>

      {lista ? <ListaAsignaciones auditor={lista === "auditor" ? auditor : null} onClose={() => setLista(null)} onCambio={() => setRefrescar((n) => n + 1)} onQuitar={abrirQuitar} /> : null}
      {quitar && auditor ? (
        <QuitarCasosModal auditor={{ id: auditor.id, nombre: nombreAuditor(auditor) }} autoasignacionActiva={quitar.autoasignacionActiva} topeCasos={quitar.topeCasos}
          onClose={() => setQuitar(null)}
          onHecho={(r) => { setQuitar(null); setAviso(`Se ${r.quitadas === 1 ? "quitó 1 caso" : `quitaron ${r.quitadas.toLocaleString("es-PE")} casos`} a ${nombreAuditor(auditor)}.`); setRefrescar((n) => n + 1); }} />
      ) : null}
    </div>
  );
}
