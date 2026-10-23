import { useEffect, useId, useState, type FormEvent, type ReactNode } from "react";
import { ApiError, request } from "../../api";
import { Icon } from "../icons";
import UbicacionPicker from "../UbicacionPicker";
import type { Coordenadas } from "../../lib/coordenadas";
import Ventana from "./Ventana";
import { Franja } from "./problemas";

// Nuevo expediente (diseño de Figma): registro individual con lo mínimo para asignarlo y visitarlo. Lo demás (oficina, teléfono, provincia, monto y la
// ubicación en el mapa) queda en «Más datos», porque para cargas grandes se usa «Cargar archivo». Crear un expediente no lo asigna a nadie.

const VACIO = {
  codigo_expediente: "", numero_documento_cliente: "", nombres_cliente: "", tipo_credito: "CONSUMO", asesor_responsable: "", distrito: "", direccion_domicilio: "",
  oficina: "", telefono_cliente: "", provincia: "", departamento: "", monto_desembolso: "", moneda: "PEN",
};
type Form = typeof VACIO;
const OBLIGATORIOS: [keyof Form, string][] = [["codigo_expediente", "Escribe el número de crédito."], ["numero_documento_cliente", "Escribe el documento del cliente."], ["nombres_cliente", "Escribe el nombre completo del cliente."], ["asesor_responsable", "Escribe o elige el asesor del crédito."]];

// El tipo de documento no se pregunta: se deduce del largo (11 = RUC, 9 = carné de extranjería, el resto DNI), como en la base del core.
const tipoDocumento = (numero: string) => { const d = numero.replace(/\D/g, ""); return d.length === 11 ? "RUC" : d.length === 9 ? "CE" : "DNI"; };

export default function NuevoExpediente({ onClose, onCreado }: { onClose: () => void; onCreado: () => void }) {
  const id = useId();
  const [form, setForm] = useState<Form>(VACIO);
  const [ubicacion, setUbicacion] = useState<Coordenadas | null>(null);
  const [mas, setMas] = useState(false);
  const [asesores, setAsesores] = useState<string[]>([]);
  const [faltan, setFaltan] = useState<Partial<Record<keyof Form, string>>>({});
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);
  const sucio = JSON.stringify(form) !== JSON.stringify(VACIO) || Boolean(ubicacion);

  // Sugerencias de asesor: los que ya figuran en los expedientes (el asesor es el del crédito, no un usuario del sistema).
  useEffect(() => { request<{ data: string[] }>("/api/expedientes/asesores?limit=100").then((r) => setAsesores(r.data)).catch(() => {}); }, []);

  const cerrar = () => { if (guardando) return; if (sucio && !window.confirm("Hay datos sin guardar. ¿Cerrar y descartarlos?")) return; onClose(); };
  const poner = (k: keyof Form, v: string) => { setForm((f) => ({ ...f, [k]: v })); if (faltan[k]) setFaltan((x) => ({ ...x, [k]: undefined })); };

  const crear = async (ev: FormEvent) => {
    ev.preventDefault();
    const sin: Partial<Record<keyof Form, string>> = {};
    for (const [k, mensaje] of OBLIGATORIOS) if (!form[k].trim()) sin[k] = mensaje;
    setFaltan(sin);
    if (Object.keys(sin).length) { document.getElementById(`${id}-${Object.keys(sin)[0]}`)?.focus(); return; }
    setError(""); setGuardando(true);
    try {
      const payload: Record<string, unknown> = {};
      (Object.keys(form) as (keyof Form)[]).forEach((k) => { const v = form[k].trim(); if (v !== "") payload[k] = v; });
      payload.tipo_documento_cliente = tipoDocumento(form.numero_documento_cliente);
      if (payload.monto_desembolso !== undefined) payload.monto_desembolso = Number(payload.monto_desembolso);
      if (ubicacion) { payload.latitud = ubicacion.latitud; payload.longitud = ubicacion.longitud; }
      const r = await request<{ data?: { id_expediente?: number } }>("/api/expedientes", { method: "POST", body: JSON.stringify(payload) });
      // Sin punto marcado, si este servidor tiene encendida la búsqueda de ubicaciones, se busca la dirección escrita de inmediato.
      const creado = r?.data?.id_expediente;
      if (!ubicacion && form.direccion_domicilio.trim() && creado) {
        request<{ data: { activa: boolean } }>("/api/expedientes/geocodificacion/resumen").then((g) => (g.data.activa ? request(`/api/expedientes/${creado}/geocodificar`, { method: "POST" }) : null)).catch(() => {});
      }
      onCreado(); onClose();
    } catch (e: any) {
      setError(e instanceof ApiError && e.status === 409 ? "Ya existe un expediente con ese número de crédito. Revisa el número o búscalo en la lista." : e?.message || "No se pudo crear el expediente.");
    } finally { setGuardando(false); }
  };

  const campo = (k: keyof Form, etiqueta: string, opciones: { obligatorio?: boolean; ayuda?: string; lista?: string; modo?: "decimal" | "tel"; columnas?: boolean } = {}): ReactNode => (
    <div className={`ex-campo${opciones.columnas ? " ancho" : ""}`}>
      <label htmlFor={`${id}-${k}`}>{etiqueta}{opciones.obligatorio ? <span className="req" aria-hidden="true"> *</span> : null}</label>
      <input id={`${id}-${k}`} name={k} type="text" autoComplete="off" spellCheck={false} inputMode={opciones.modo} list={opciones.lista} value={form[k]} onChange={(e) => poner(k, e.target.value)}
        aria-invalid={faltan[k] ? true : undefined} aria-describedby={faltan[k] ? `${id}-${k}-e` : undefined} required={opciones.obligatorio} />
      {faltan[k] ? <span id={`${id}-${k}-e`} className="ex-error-campo" role="alert">{faltan[k]}</span> : null}
    </div>
  );

  return (
    <Ventana migas={["Nuevo expediente"]} titulo="Nuevo expediente" subtitulo="Registro individual" ocupada={guardando} onClose={cerrar}
      acciones={<><button type="button" className="ex-boton claro" onClick={cerrar} disabled={guardando}>Cancelar</button><button type="submit" form={`${id}-form`} className="ex-boton primario" disabled={guardando}>{guardando ? "Guardando…" : "Crear expediente"}</button></>}>
      <form id={`${id}-form`} className="ex-formulario" onSubmit={crear} noValidate>
        {error ? <div role="alert" className="error-box">{error}</div> : null}
        <fieldset>
          <legend>Cliente y crédito</legend>
          <div className="ex-rejilla">
            {campo("codigo_expediente", "Número de crédito", { obligatorio: true })}
            {campo("numero_documento_cliente", "Documento", { obligatorio: true, modo: "tel" })}
            {campo("nombres_cliente", "Nombre completo del cliente", { obligatorio: true, columnas: true })}
          </div>
        </fieldset>
        <fieldset>
          <legend>Datos del expediente</legend>
          <div className="ex-rejilla">
            <div className="ex-campo">
              <span className="et" id={`${id}-tipo`}>Tipo de crédito</span>
              <div className="ex-seg grande" role="group" aria-labelledby={`${id}-tipo`}>
                {[["CONSUMO", "Consumo"], ["OTROS", "MYPE"]].map(([v, et]) => <button key={v} type="button" className={form.tipo_credito === v ? "on" : ""} aria-pressed={form.tipo_credito === v} onClick={() => poner("tipo_credito", v)}>{et}</button>)}
              </div>
            </div>
            <div className="ex-campo">
              <label htmlFor={`${id}-asesor_responsable`}>Asesor<span className="req" aria-hidden="true"> *</span></label>
              <input id={`${id}-asesor_responsable`} name="asesor_responsable" type="text" autoComplete="off" spellCheck={false} list={`${id}-asesores`} placeholder="Seleccionar asesor" value={form.asesor_responsable} onChange={(e) => poner("asesor_responsable", e.target.value)}
                aria-invalid={faltan.asesor_responsable ? true : undefined} aria-describedby={faltan.asesor_responsable ? `${id}-asesor-e` : undefined} required />
              <datalist id={`${id}-asesores`}>{asesores.map((a) => <option key={a} value={a} />)}</datalist>
              {faltan.asesor_responsable ? <span id={`${id}-asesor-e`} className="ex-error-campo" role="alert">{faltan.asesor_responsable}</span> : null}
            </div>
          </div>
        </fieldset>
        <fieldset>
          <legend>Ubicación</legend>
          <div className="ex-rejilla">
            {campo("distrito", "Distrito")}
            {campo("direccion_domicilio", "Dirección")}
          </div>
        </fieldset>

        <button type="button" className="ex-enlace ex-mas-datos" aria-expanded={mas} aria-controls={`${id}-mas`} onClick={() => setMas((v) => !v)}><Icon name={mas ? "arriba" : "abajo"} size={16} />Más datos (opcional)</button>
        {mas ? (
          <div id={`${id}-mas`} className="ex-mas-cuerpo">
            <div className="ex-rejilla">
              {campo("oficina", "Oficina")}
              {campo("telefono_cliente", "Teléfono", { modo: "tel" })}
              {campo("provincia", "Provincia")}
              {campo("departamento", "Departamento")}
              {campo("monto_desembolso", "Monto desembolsado", { modo: "decimal" })}
              {campo("moneda", "Moneda")}
            </div>
            <UbicacionPicker valor={ubicacion} onChange={setUbicacion} />
          </div>
        ) : null}

        <Franja tono="info" titulo="La asignación de auditor se realiza por separado">Crear el expediente no equivale a asignar un auditor. El alta no incluye una selección de estado de visita.</Franja>
      </form>
    </Ventana>
  );
}
