import { Link } from "react-router-dom";
import { Icon, Marca } from "../components/icons";

export default function PrivacyPage() {
  return (
    <div className="doc">
      <div className="sheet">
        <p className="eyebrow"><Marca size={22} /> Informa Perú · Caja Huancayo</p>
        <h1>Política de privacidad de Auditoría de Visitas</h1>
        <p className="subtle">Última actualización: 22 de setiembre de 2026</p>

        <p style={{ marginTop: 22 }}>
          Esta aplicación («Auditoría de Visitas — Caja Huancayo») es una herramienta interna, usada
          exclusivamente por personal autorizado de Caja Huancayo (auditores de campo, supervisores y
          administradores) para verificar en campo las visitas de crédito reportadas por los asesores.
          No está dirigida al público general ni se usa para captar datos de terceros ajenos a esta operación.
        </p>

        <h2>Qué información recopila la app</h2>
        <ul>
          <li><b>Ubicación (GPS):</b> se registra durante el checkin de cada visita, para verificar que el auditor estuvo físicamente en el domicilio o negocio del cliente. Además, solo entre «Iniciar jornada» y «Terminar jornada», la app comparte la posición de forma continua, incluso con la pantalla apagada o usando otra aplicación de mapas, para que su supervisor pueda ubicarlo en el mapa de seguimiento. Mientras dure, Android muestra una notificación fija; fuera de la jornada no se comparte la ubicación y la jornada se cierra sola al cerrar sesión.</li>
          <li><b>Cámara:</b> para tomar las fotografías obligatorias de evidencia de cada visita. La app no permite adjuntar fotos de la galería.</li>
          <li><b>Identificador del dispositivo:</b> un identificador de instalación (no el IMEI ni datos de hardware), usado para vincular la cuenta del auditor a un único dispositivo autorizado.</li>
          <li><b>Datos del cliente auditado:</b> nombre, documento, dirección y respuestas del cuestionario de verificación, provistos por Caja Huancayo, no por el usuario de la app.</li>
        </ul>

        <h2>Cómo se usa esta información</h2>
        <p>
          Únicamente para el fin de auditar visitas de crédito: verificar la ubicación real de la visita,
          registrar evidencia, y permitir la supervisión del equipo de campo. No se vende, alquila ni
          comparte con terceros ajenos a Caja Huancayo e Informa Perú, y no se usa con fines publicitarios
          ni de perfilamiento comercial.
        </p>

        <h2>Almacenamiento y seguridad</h2>
        <p>
          La información viaja cifrada (HTTPS/TLS) y se almacena en una base de datos con acceso
          restringido. Mientras el dispositivo está sin conexión, los datos de una visita quedan cifrados
          (AES-256) directamente en el celular del auditor hasta que se sincronizan.
        </p>

        <h2>Retención y eliminación</h2>
        <p>
          Los datos se conservan mientras dure la relación de Informa Perú con Caja Huancayo para este
          servicio. Un usuario puede solicitar la eliminación de su cuenta y de sus datos personales
          asociados escribiendo a <a href="mailto:serviciosdigitales@informaperu.com">serviciosdigitales@informaperu.com</a>.
        </p>

        <h2>Contacto</h2>
        <p>
          Informa Perú — <a href="mailto:serviciosdigitales@informaperu.com">serviciosdigitales@informaperu.com</a>
        </p>
        <p style={{ marginTop: 28 }}><Link to="/" className="btn ghost"><Icon name="volver" size={16} />Volver al panel</Link></p>
      </div>
    </div>
  );
}
