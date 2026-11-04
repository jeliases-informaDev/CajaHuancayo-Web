import { hayFranja, type Licencia } from "../lib/licencia";

// Franja de licencia entre la barra superior y el contenido. Explica lo que el servidor ya hace: con la licencia vencida (SOLO_LECTURA) se puede ver pero no
// registrar; suspendida o cancelada no se registra nada. A los administradores, además, les avisa cuando la empresa no tiene licencia registrada en Sulotec.
// Con la licencia al día, o sin información, no pinta nada.
const CORREO = "contacto@sulotec.com";
// Solo si el servidor mandó la dirección de Sulotec: sin ella no se pinta un enlace vacío.
const EnlaceSulotec = ({ licencia, children }: { licencia: Licencia; children: string }) => (licencia.enlace ? <a href={licencia.enlace} target="_blank" rel="noreferrer">{children}</a> : null);

// Pinta algo exactamente cuando hayFranja (lib/licencia) dice que sí: Layout usa esa misma función para avisar a las pantallas que miden su alto con la ventana.
export default function FranjaLicencia({ licencia, esAdmin }: { licencia: Licencia | null; esAdmin: boolean }) {
  if (!licencia || !hayFranja(licencia, esAdmin)) return null;
  if (licencia.estado === "SOLO_LECTURA") {
    return (
      <div className="lic-franja aviso" role="status">
        Licencia vencida: puedes ver la información, pero no registrar cambios. <EnlaceSulotec licencia={licencia}>Renovar en Sulotec</EnlaceSulotec>
      </div>
    );
  }
  if (licencia.estado === "SUSPENDIDA" || licencia.estado === "CANCELADA") {
    return (
      <div className="lic-franja mal" role="alert">
        Licencia {licencia.estado === "SUSPENDIDA" ? "suspendida" : "cancelada"}: no se pueden registrar cambios. Escribe a <a href={`mailto:${CORREO}`}>{CORREO}</a>
        {licencia.enlace ? <><span className="lic-sep" aria-hidden="true">·</span><EnlaceSulotec licencia={licencia}>Ver mi licencia en Sulotec</EnlaceSulotec></> : null}
      </div>
    );
  }
  if (licencia.estado === "SIN_LICENCIA" && esAdmin) {
    return <div className="lic-franja aviso" role="status">Esta empresa no tiene una licencia de GeoMatrix registrada en Sulotec: el cupo de usuarios no se controla hasta que Sulotec la registre.</div>;
  }
  return null;
}

// Pastilla de la barra superior (misma forma que la del modo pruebas), solo para administradores: la licencia activa vence en 7 días o menos.
export function PastillaLicencia({ licencia }: { licencia: Licencia | null }) {
  if (!licencia || licencia.estado !== "ACTIVA" || licencia.dias_para_vencer == null || licencia.dias_para_vencer > 7) return null;
  const dias = licencia.dias_para_vencer;
  const texto = dias <= 0 ? "Tu licencia vence hoy" : dias === 1 ? "Tu licencia vence en 1 día" : `Tu licencia vence en ${dias} días`;
  const titulo = "Renuévala en Sulotec para seguir registrando cambios después del vencimiento.";
  // Sin enlace del servidor la pastilla avisa igual, pero no lleva a ninguna parte.
  return licencia.enlace ? <a className="lic-pastilla" href={licencia.enlace} target="_blank" rel="noreferrer" title={titulo}>{texto}</a> : <span className="lic-pastilla" title={titulo}>{texto}</span>;
}
