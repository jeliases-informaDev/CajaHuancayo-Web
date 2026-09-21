export default function PrivacyPage() {
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg, #F4F7FC)", padding: "48px 20px" }}>
      <div style={{ maxWidth: 780, margin: "0 auto", background: "#fff", borderRadius: 18, padding: "44px 40px", boxShadow: "0 1px 3px rgba(20,30,60,0.08)" }}>
        <p style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1, color: "var(--primary, #1236C7)", textTransform: "uppercase", margin: 0 }}>
          Informa Perú · Caja Huancayo
        </p>
        <h1 style={{ fontSize: 28, fontWeight: 800, margin: "8px 0 4px" }}>Política de privacidad — Auditoría de Visitas</h1>
        <p style={{ color: "#6D788A", fontSize: 13, margin: "0 0 28px" }}>Última actualización: 22 de setiembre de 2026</p>

        <p style={{ lineHeight: 1.7, fontSize: 14.5 }}>
          Esta aplicación ("Auditoría de Visitas — Caja Huancayo") es una herramienta interna, usada
          exclusivamente por personal autorizado de Caja Huancayo (auditores de campo, supervisores y
          administradores) para verificar en campo las visitas de crédito reportadas por los asesores.
          No está dirigida al público general ni se usa para captar datos de terceros ajenos a esta operación.
        </p>

        <h2 style={{ fontSize: 18, fontWeight: 800, marginTop: 32 }}>Qué información recopila la app</h2>
        <ul style={{ lineHeight: 1.8, fontSize: 14.5, paddingLeft: 20 }}>
          <li><b>Ubicación (GPS):</b> se registra durante el checkin de cada visita y, mientras la pantalla de mapa está abierta, de forma continua, para verificar que el auditor estuvo físicamente en el domicilio del cliente y para que su supervisor pueda ubicarlo en el mapa de seguimiento.</li>
          <li><b>Cámara:</b> para tomar las fotografías obligatorias de evidencia de cada visita. La app no permite adjuntar fotos de la galería.</li>
          <li><b>Identificador del dispositivo:</b> un identificador de instalación (no el IMEI ni datos de hardware), usado para vincular la cuenta del auditor a un único dispositivo autorizado.</li>
          <li><b>Datos del cliente auditado:</b> nombre, documento, dirección y respuestas del cuestionario de verificación, provistos por Caja Huancayo, no por el usuario de la app.</li>
        </ul>

        <h2 style={{ fontSize: 18, fontWeight: 800, marginTop: 32 }}>Cómo se usa esta información</h2>
        <p style={{ lineHeight: 1.7, fontSize: 14.5 }}>
          Únicamente para el fin de auditar visitas de crédito: verificar la ubicación real de la visita,
          registrar evidencia, y permitir la supervisión del equipo de campo. No se vende, alquila ni
          comparte con terceros ajenos a Caja Huancayo e Informa Perú, y no se usa con fines publicitarios
          ni de perfilamiento comercial.
        </p>

        <h2 style={{ fontSize: 18, fontWeight: 800, marginTop: 32 }}>Almacenamiento y seguridad</h2>
        <p style={{ lineHeight: 1.7, fontSize: 14.5 }}>
          La información viaja cifrada (HTTPS/TLS) y se almacena en una base de datos con acceso
          restringido. Mientras el dispositivo está sin conexión, los datos de una visita quedan cifrados
          (AES-256) directamente en el celular del auditor hasta que se sincronizan.
        </p>

        <h2 style={{ fontSize: 18, fontWeight: 800, marginTop: 32 }}>Retención y eliminación</h2>
        <p style={{ lineHeight: 1.7, fontSize: 14.5 }}>
          Los datos se conservan mientras dure la relación de Informa Perú con Caja Huancayo para este
          servicio. Un usuario puede solicitar la eliminación de su cuenta y de sus datos personales
          asociados escribiendo a <a href="mailto:serviciosdigitales@informaperu.com">serviciosdigitales@informaperu.com</a>.
        </p>

        <h2 style={{ fontSize: 18, fontWeight: 800, marginTop: 32 }}>Contacto</h2>
        <p style={{ lineHeight: 1.7, fontSize: 14.5 }}>
          Informa Perú — <a href="mailto:serviciosdigitales@informaperu.com">serviciosdigitales@informaperu.com</a>
        </p>
      </div>
    </div>
  );
}
