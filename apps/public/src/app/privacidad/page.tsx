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
        Última actualización: 27 de marzo de 2026
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

        <p style={{ lineHeight: 1.7, marginBottom: '0.75rem', fontSize: '0.9rem', color: '#4b5563' }}>
          Los datos marcados con <strong style={{ color: '#dc2626' }}>* dato sensible</strong> son datos personales
          de salud que reciben protección especial bajo la LFPDPPP y requieren tu consentimiento expreso para
          ser tratados.
        </p>

        <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem', marginTop: '1rem' }}>Pacientes</h3>
        <ul style={{ lineHeight: 1.8, paddingLeft: '1.5rem' }}>
          <li>Nombre completo</li>
          <li>Dirección de correo electrónico</li>
          <li>Número de teléfono y WhatsApp</li>
          <li>Fecha, hora y médico de la cita</li>
          <li>Motivo de consulta <strong style={{ color: '#dc2626' }}>* dato sensible</strong></li>
          <li>Información médica del formulario previo a la cita: síntomas, antecedentes, medicamentos, alergias, condiciones crónicas <strong style={{ color: '#dc2626' }}>* dato sensible</strong></li>
          <li>Código de confirmación de cita</li>
          <li>Nombre y calificación de reseña (si el paciente decide dejarla)</li>
          <li>Datos de navegación (páginas visitadas, eventos de interacción) recopilados automáticamente</li>
        </ul>

        <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem', marginTop: '1.25rem' }}>Médicos</h3>
        <ul style={{ lineHeight: 1.8, paddingLeft: '1.5rem' }}>
          <li>Nombre, especialidad, fotografía y datos de perfil profesional</li>
          <li>Dirección y teléfono del consultorio</li>
          <li>Cuenta de Google (para autenticación vía Google OAuth)</li>
          <li>Token de acceso a Google Calendar (si el médico habilita la integración)</li>
          <li>Expedientes clínicos de sus pacientes: diagnósticos, notas clínicas, recetas, tratamientos <strong style={{ color: '#dc2626' }}>* dato sensible</strong></li>
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

        <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem' }}>Finalidades que requieren tu consentimiento</h3>
        <p style={{ lineHeight: 1.7, marginBottom: '0.5rem', fontSize: '0.9rem', color: '#4b5563' }}>
          Para estas finalidades solicitamos tu consentimiento expreso en el formulario correspondiente.
          Puedes retirar tu consentimiento en cualquier momento escribiendo a{' '}
          <a href="mailto:privacidad@tusalud.pro" style={{ color: '#2563eb' }}>privacidad@tusalud.pro</a>.
        </p>
        <ul style={{ lineHeight: 1.8, paddingLeft: '1.5rem', marginBottom: '1.25rem' }}>
          <li>Tratamiento de tu información médica: motivo de consulta, síntomas, antecedentes, medicamentos y alergias del formulario previo a la cita — para ser compartidos con el médico que te atenderá</li>
          <li>Publicar tu reseña y nombre en el perfil del médico (si decides dejar una opinión)</li>
          <li>Sincronización de citas con Google Calendar (solo si el médico lo activa)</li>
        </ul>

        <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem' }}>Finalidades que no requieren consentimiento</h3>
        <p style={{ lineHeight: 1.7, marginBottom: '0.5rem', fontSize: '0.9rem', color: '#4b5563' }}>
          Estas finalidades se basan en obligación legal, ejecución del contrato de servicio o interés legítimo.
        </p>
        <ul style={{ lineHeight: 1.8, paddingLeft: '1.5rem' }}>
          <li>Agendar y gestionar tu cita médica: nombre, correo, teléfono (ejecución del contrato de servicio)</li>
          <li>Autenticación e identificación de médicos en la plataforma (ejecución del contrato)</li>
          <li>Envío de confirmaciones y recordatorios de cita (ejecución del contrato)</li>
          <li>Mejora del servicio mediante análisis de uso agregado — Google Analytics 4 (interés legítimo)</li>
          <li>Atribución de tráfico publicitario para médicos con Google Ads activo (interés legítimo, contrato con el médico)</li>
          <li>Cumplimiento de obligaciones legales: fiscales, clínicas y de seguridad</li>
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
        <p style={{ lineHeight: 1.7, marginBottom: '0.75rem' }}>
          Los plazos de retención varían según el tipo de dato:
        </p>
        <ul style={{ lineHeight: 1.8, paddingLeft: '1.5rem', marginBottom: '0.75rem' }}>
          <li>
            <strong>Datos de contacto de pacientes</strong> (nombre, correo, teléfono): se conservan mientras
            la cita esté activa y hasta por <strong>2 años</strong> después de la última interacción, salvo
            que la ley exija un plazo mayor.
          </li>
          <li>
            <strong>Expedientes clínicos y datos de salud</strong>: conforme a la NOM-004-SSA3-2012, se
            conservan por un mínimo de <strong>5 años</strong> a partir de la última consulta registrada,
            o hasta 3 años después de la mayoría de edad si el paciente es menor. Este plazo prevalece
            sobre cualquier solicitud de eliminación de datos clínicos.
          </li>
          <li>
            <strong>Registros fiscales y de facturación</strong>: conforme a la legislación fiscal mexicana
            (SAT), se conservan por el plazo legalmente requerido.
          </li>
        </ul>
        <p style={{ lineHeight: 1.7 }}>
          Los médicos pueden eliminar desde su panel los datos no clínicos de sus pacientes. Los expedientes
          clínicos están sujetos al plazo mínimo de conservación indicado arriba. Ante una solicitud de
          eliminación, procesamos la baja de los datos que no estén sujetos a retención legal en un máximo
          de 30 días hábiles contados desde la verificación de identidad del solicitante.
        </p>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.75rem' }}>6. Tus derechos</h2>
        <p style={{ lineHeight: 1.7, marginBottom: '0.75rem' }}>
          De acuerdo con la Ley Federal de Protección de Datos Personales en Posesión de los Particulares
          (LFPDPPP, publicada el 20 de marzo de 2025), tienes derecho a:
        </p>
        <ul style={{ lineHeight: 1.8, paddingLeft: '1.5rem' }}>
          <li><strong>Acceso:</strong> conocer qué datos tenemos sobre ti y cómo los usamos</li>
          <li><strong>Rectificación:</strong> corregir datos inexactos o incompletos</li>
          <li><strong>Cancelación:</strong> solicitar la eliminación de tus datos</li>
          <li><strong>Oposición:</strong> oponerte al uso de tus datos para finalidades específicas</li>
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

      <section id="cookies" style={{ marginBottom: '2rem' }}>
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
