import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Política de Privacidad | tusalud.pro",
  description: "Política de privacidad de tusalud.pro — cómo recopilamos, usamos y protegemos tus datos personales.",
};

export default function PrivacidadPage() {
  return (
    <main className="max-w-3xl mx-auto px-6 py-16" style={{ fontFamily: 'Inter, sans-serif', color: '#1a1a1a' }}>
      <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '0.5rem' }}>
        Política de Privacidad
      </h1>
      <p style={{ color: '#6b7280', marginBottom: '2.5rem', fontSize: '0.95rem' }}>
        Última actualización: 19 de marzo de 2026
      </p>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.75rem' }}>1. Quiénes somos</h2>
        <p style={{ lineHeight: 1.7, marginBottom: '1rem' }}>
          <strong>tusalud.pro</strong> es una plataforma digital en línea que conecta a pacientes con médicos
          en México. Permite a los pacientes consultar perfiles de médicos, leer artículos de salud, agendar
          citas y comunicarse con consultorios. A los médicos les proporciona herramientas para gestionar su
          práctica, expedientes clínicos y presencia en línea.
        </p>
        <p style={{ lineHeight: 1.7 }}>
          Responsable del tratamiento de datos: <strong>tusalud.pro</strong><br />
          Correo de contacto:{" "}
          <a href="mailto:privacidad@tusalud.pro" style={{ color: '#2563eb' }}>
            privacidad@tusalud.pro
          </a>
        </p>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.75rem' }}>2. Qué datos recopilamos</h2>

        <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem', marginTop: '1rem' }}>Pacientes</h3>
        <ul style={{ lineHeight: 1.8, paddingLeft: '1.5rem' }}>
          <li>Nombre completo</li>
          <li>Dirección de correo electrónico</li>
          <li>Número de teléfono</li>
          <li>Información de la cita (fecha, hora, médico, motivo de consulta)</li>
          <li>Código de confirmación de cita</li>
          <li>Datos de navegación (páginas visitadas, eventos de interacción) recopilados automáticamente</li>
        </ul>

        <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem', marginTop: '1.25rem' }}>Médicos</h3>
        <ul style={{ lineHeight: 1.8, paddingLeft: '1.5rem' }}>
          <li>Nombre, especialidad, fotografía y datos de perfil profesional</li>
          <li>Dirección y teléfono del consultorio</li>
          <li>Cuenta de Google (para autenticación vía Google OAuth)</li>
          <li>Token de acceso a Google Calendar (si el médico habilita la integración)</li>
          <li>Expedientes clínicos de sus pacientes (gestionados por el propio médico dentro de la plataforma)</li>
          <li>Datos de práctica: ventas, compras, cotizaciones, flujo de caja</li>
        </ul>

        <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem', marginTop: '1.25rem' }}>Datos recopilados automáticamente</h3>
        <ul style={{ lineHeight: 1.8, paddingLeft: '1.5rem' }}>
          <li>Dirección IP y tipo de navegador</li>
          <li>Páginas visitadas y tiempo de permanencia</li>
          <li>Eventos de conversión (clic en WhatsApp, cita completada) para análisis y publicidad</li>
        </ul>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.75rem' }}>3. Para qué usamos tus datos</h2>
        <ul style={{ lineHeight: 1.8, paddingLeft: '1.5rem' }}>
          <li>Prestación del servicio: agendar y gestionar citas, enviar confirmaciones y recordatorios</li>
          <li>Identificación y autenticación de médicos en la plataforma</li>
          <li>Comunicación contigo sobre tu cita o cuenta</li>
          <li>Mejora del servicio mediante análisis de uso (Google Analytics 4)</li>
          <li>Atribución de tráfico publicitario para médicos que usan Google Ads a través de la plataforma</li>
          <li>Sincronización de citas con Google Calendar (solo si el médico lo activa)</li>
          <li>Cumplimiento de obligaciones legales</li>
        </ul>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.75rem' }}>4. Terceros con acceso a tus datos</h2>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ backgroundColor: '#f3f4f6' }}>
                <th style={{ padding: '0.6rem 1rem', textAlign: 'left', border: '1px solid #e5e7eb' }}>Proveedor</th>
                <th style={{ padding: '0.6rem 1rem', textAlign: 'left', border: '1px solid #e5e7eb' }}>Propósito</th>
                <th style={{ padding: '0.6rem 1rem', textAlign: 'left', border: '1px solid #e5e7eb' }}>Datos compartidos</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['Google (OAuth)', 'Autenticación de médicos', 'Correo electrónico, nombre'],
                ['Google Analytics 4', 'Análisis de uso del sitio', 'Comportamiento de navegación (anonimizado)'],
                ['Google Ads', 'Atribución publicitaria por médico', 'Eventos de conversión'],
                ['Google Calendar', 'Sincronización de citas', 'Fecha, hora, título de cita (si está habilitado)'],
                ['Railway', 'Infraestructura y base de datos', 'Todos los datos en tránsito y en reposo'],
                ['UploadThing', 'Almacenamiento de archivos', 'Archivos subidos por médicos (documentos, imágenes)'],
                ['WhatsApp / Meta', 'Comunicación entre pacientes y médicos', 'Eventos de clic (no contenido del mensaje)'],
              ].map(([proveedor, proposito, datos]) => (
                <tr key={proveedor}>
                  <td style={{ padding: '0.6rem 1rem', border: '1px solid #e5e7eb', fontWeight: 500 }}>{proveedor}</td>
                  <td style={{ padding: '0.6rem 1rem', border: '1px solid #e5e7eb' }}>{proposito}</td>
                  <td style={{ padding: '0.6rem 1rem', border: '1px solid #e5e7eb', color: '#4b5563' }}>{datos}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p style={{ marginTop: '0.75rem', fontSize: '0.9rem', color: '#6b7280' }}>
          No vendemos tus datos personales a terceros.
        </p>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.75rem' }}>5. Retención de datos</h2>
        <p style={{ lineHeight: 1.7 }}>
          Conservamos los datos personales de pacientes mientras la cita esté activa y hasta por 2 años
          después de su última interacción con la plataforma, salvo que la ley exija un plazo mayor. Los
          médicos pueden eliminar sus expedientes y datos en cualquier momento desde su panel. Ante una
          solicitud de eliminación, procesamos la baja en un máximo de 30 días hábiles contados desde
          la verificación de identidad del solicitante.
        </p>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.75rem' }}>6. Tus derechos</h2>
        <p style={{ lineHeight: 1.7, marginBottom: '0.75rem' }}>
          De acuerdo con la Ley Federal de Protección de Datos Personales en Posesión de los Particulares
          (LFPDPPP) y, en lo aplicable, el RGPD, tienes derecho a:
        </p>
        <ul style={{ lineHeight: 1.8, paddingLeft: '1.5rem' }}>
          <li><strong>Acceso:</strong> conocer qué datos tenemos sobre ti</li>
          <li><strong>Rectificación:</strong> corregir datos inexactos</li>
          <li><strong>Cancelación:</strong> solicitar la eliminación de tus datos</li>
          <li><strong>Oposición:</strong> oponerte al tratamiento de tus datos</li>
          <li><strong>Portabilidad:</strong> recibir tus datos en formato estructurado</li>
        </ul>
        <p style={{ marginTop: '0.75rem', lineHeight: 1.7 }}>
          Para ejercer cualquiera de estos derechos, escríbenos a{" "}
          <a href="mailto:privacidad@tusalud.pro" style={{ color: '#2563eb' }}>
            privacidad@tusalud.pro
          </a>{" "}
          indicando tu nombre completo, correo registrado y la solicitud que deseas realizar.
          Responderemos en un máximo de 20 días hábiles.
        </p>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.75rem' }}>7. Eliminación de datos</h2>
        <p style={{ lineHeight: 1.7 }}>
          Puedes solicitar la eliminación de todos tus datos personales en cualquier momento. Consulta
          nuestras instrucciones detalladas en:{" "}
          <a href="/eliminacion-de-datos" style={{ color: '#2563eb' }}>
            tusalud.pro/eliminacion-de-datos
          </a>
        </p>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.75rem' }}>8. Cookies y rastreo</h2>
        <p style={{ lineHeight: 1.7 }}>
          Utilizamos Google Analytics 4 para análisis de tráfico. GA4 puede usar cookies de primera parte.
          No utilizamos cookies de terceros para publicidad comportamental dirigida a pacientes.
          Los médicos con Google Ads activo generan eventos de conversión anónimos para atribución de sus
          propias campañas.
        </p>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.75rem' }}>9. Seguridad</h2>
        <p style={{ lineHeight: 1.7 }}>
          Almacenamos los datos en servidores seguros de Railway (PostgreSQL con cifrado en tránsito).
          El acceso a datos sensibles requiere autenticación. Los tokens de acceso a Google se almacenan
          cifrados y se utilizan exclusivamente para la integración con Google Calendar.
        </p>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.75rem' }}>10. Cambios a esta política</h2>
        <p style={{ lineHeight: 1.7 }}>
          Podemos actualizar esta política en cualquier momento. La fecha de última actualización aparece
          al inicio del documento. El uso continuado de la plataforma tras la publicación de cambios
          implica la aceptación de los mismos.
        </p>
      </section>

      <section>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.75rem' }}>11. Contacto</h2>
        <p style={{ lineHeight: 1.7 }}>
          Para cualquier consulta relacionada con esta política o el tratamiento de tus datos personales,
          escríbenos a:{" "}
          <a href="mailto:privacidad@tusalud.pro" style={{ color: '#2563eb' }}>
            privacidad@tusalud.pro
          </a>
        </p>
      </section>
    </main>
  );
}
