import { useState } from "react";
import { descargarArchivo } from "../../api";
import { useAuth } from "../../AuthContext";
import { Icon } from "../icons";
import Ventana from "./Ventana";

// Plantillas de Excel para la carga masiva: los dos modelos COMPLETOS (MYPE y Consumo) traen todas las columnas que pide la ficha de entrevista del banco, con los
// mismos nombres del core; la carga rápida es solo lo mínimo para asignar y visitar (la ficha queda con los datos básicos). Debajo, cómo se completa la carga rápida.
// Solo se ofrece lo que la empresa tiene permitido (los completos son el formato del core; la carga rápida, el formato simple).

type Modelo = { clave: string; formato: "SIMPLE" | "CORE_262"; tipo?: "CONSUMO" | "OTROS"; titulo: string; detalle: string; archivo: string };
const MODELOS: Modelo[] = [
  { clave: "mype", formato: "CORE_262", tipo: "OTROS", titulo: "Modelo MYPE completo", detalle: "Las 262 columnas de la base del core: toda la ficha MYPE (historial, evaluación financiera, endeudamiento, cónyuge). Pon las filas en la hoja OTROS.", archivo: "plantilla-expedientes-core_262-mype.xlsx" },
  { clave: "consumo", formato: "CORE_262", tipo: "CONSUMO", titulo: "Modelo Consumo completo", detalle: "Las 297 columnas de la base de Consumo del banco, con sus mismos nombres: cliente y empleador, historial con hasta 4 créditos anteriores, ingresos y endeudamiento del cliente y del cónyuge. Cada fila debe traer todos sus datos juntos. Pon las filas en la hoja CONSUMO.", archivo: "plantilla-expedientes-core_262-consumo.xlsx" },
  { clave: "rapida", formato: "SIMPLE", titulo: "Carga rápida (solo lo mínimo)", detalle: "16 columnas para asignar y visitar: cliente, dirección, asesor y monto. La ficha queda sin historial, evaluación ni endeudamiento. Completa Tipo con «Consumo» o «MYPE».", archivo: "plantilla-expedientes-simple.xlsx" },
];

const COLUMNAS: { columna: string; tecnica: string; ejemplo: string; como: string }[] = [
  { columna: "Crédito", tecnica: "codigo_expediente", ejemplo: "CR-2026-000101", como: "Número de crédito, como texto. Obligatorio." },
  { columna: "Cliente / Documento", tecnica: "nombres_cliente · numero_documento_cliente", ejemplo: "QUISPE HUAMAN, MARIA ELENA / 45678912", como: "Nombre completo y documento como texto. Obligatorios." },
  { columna: "Tipo", tecnica: "tipo_credito", ejemplo: "Consumo o MYPE", como: "Usa uno de estos dos valores. Obligatorio." },
  { columna: "Distrito / Asesor", tecnica: "distrito · asesor_responsable", ejemplo: "COMAS / RIVAS/LAUREANO,LORENA MEDALI", como: "Distrito y nombre del asesor del crédito (el asesor es obligatorio)." },
  { columna: "Dirección", tecnica: "direccion_domicilio", ejemplo: "AV. SAN MARTIN 840 INT. 2", como: "Dirección de referencia del cliente; con el distrito ayuda a ubicarla en el mapa." },
  { columna: "Ubicación", tecnica: "latitud · longitud", ejemplo: "-11.9332 / -77.0541", como: "Opcional. En grados decimales y las dos juntas." },
  { columna: "Otros datos", tecnica: "tipo_documento_cliente · oficina · telefono_cliente · provincia · departamento · monto_desembolso · moneda", ejemplo: "DNI · AG. COMAS · 987654321 · LIMA · LIMA · 12500.50 · PEN", como: "Opcionales; la plantilla ya trae las columnas." },
];

export default function PlantillasModal({ onClose, onCargar }: { onClose: () => void; onCargar: () => void }) {
  const { empresa } = useAuth();
  const aceptados: string[] = empresa?.reglas?.formatos_importacion?.length ? empresa.reglas.formatos_importacion : ["SIMPLE", "CORE_262"];
  const modelos = MODELOS.filter((m) => aceptados.includes(m.formato));
  const [bajando, setBajando] = useState("");
  const [error, setError] = useState("");
  const descargar = async (m: Modelo) => {
    setBajando(m.clave); setError("");
    try { await descargarArchivo(`/api/expedientes/plantilla?formato=${m.formato}${m.tipo ? `&tipo=${m.tipo}` : ""}`, m.archivo); }
    catch (e: any) { setError(e?.message || "No se pudo descargar la plantilla."); } finally { setBajando(""); }
  };
  const hayModeloSimple = modelos.some((m) => m.formato === "SIMPLE");

  return (
    <Ventana migas={["Plantillas"]} titulo="Plantillas" subtitulo="Elige un modelo para preparar el archivo que luego revisarás en Cargar archivo." onClose={onClose}
      nota={<>Después de completar el modelo, vuelve a <button type="button" className="ex-enlace en-linea" onClick={onCargar}>Cargar archivo</button> para validarlo.</>}
      acciones={<button type="button" className="ex-boton claro" onClick={onClose}>Cerrar</button>}>
      {error ? <div role="alert" className="error-box">{error}</div> : null}
      <p className="ex-nota-chica">Para que la ficha del auditor salga completa usa un modelo completo. Si un crédito ya existe, volver a cargarlo con el modelo completo le agrega lo que faltaba (mientras nadie lo haya visitado).</p>
      <div className="ex-modelos">
        {modelos.map((m) => (
          <article key={m.clave} className={`ex-modelo${m.formato === "SIMPLE" ? " ancho" : ""}`}>
            <h3><Icon name="planilla" size={26} />{m.titulo}</h3>
            <p>{m.detalle}</p>
            <button type="button" className="ex-boton claro" disabled={Boolean(bajando)} onClick={() => descargar(m)}><Icon name="descargar" size={17} />{bajando === m.clave ? "Descargando…" : "Descargar XLSX"}</button>
          </article>
        ))}
        {!modelos.length ? <p className="ex-vacio-chico">Tu empresa no tiene plantillas habilitadas. Pídele a Sulotec que active un formato de importación.</p> : null}
      </div>
      {hayModeloSimple ? (
        <section className="ex-problemas" aria-label="Cómo completar las columnas">
          <h3>Cómo completar la carga rápida</h3>
          <div className="ex-tabla-caja ex-columnas">
            <table>
              <caption className="sr-only">Cómo completar las columnas de la carga rápida</caption>
              <thead><tr><th scope="col">Columna(s)</th><th scope="col">Ejemplo</th><th scope="col">Cómo rellenar</th></tr></thead>
              <tbody>{COLUMNAS.map((c) => <tr key={c.columna}><th scope="row">{c.columna}<small translate="no">{c.tecnica}</small></th><td>{c.ejemplo}</td><td>{c.como}</td></tr>)}</tbody>
            </table>
          </div>
        </section>
      ) : null}
    </Ventana>
  );
}
