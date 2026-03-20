import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Eliminación de Datos | tusalud.pro",
  description: "Cómo solicitar la eliminación de tus datos personales en tusalud.pro.",
};

export default function EliminacionDeDatosPage() {
  return (
    <main className="max-w-3xl mx-auto px-6 py-16" style={{ fontFamily: 'Inter, sans-serif', color: '#1a1a1a' }}>
      <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '0.5rem' }}>
        Eliminación de Datos
      </h1>
      <p style={{ color: '#6b7280', marginBottom: '2.5rem', fontSize: '0.95rem' }}>
        Última actualización: 19 de marzo de 2026
      </p>

      <section style={{ marginBottom: '2rem' }}>
        <p style={{ lineHeight: 1.7, fontSize: '1.05rem' }}>
          En tusalud.pro tienes derecho a solicitar la eliminación de todos tus datos personales en
          cualquier momento. Esta página explica exactamente cómo hacerlo, qué ocurre después y en
          qué casos podríamos estar obligados a conservar ciertos datos por ley.
        </p>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.75rem' }}>Cómo solicitar la eliminación</h2>

        <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '8px', padding: '1.25rem 1.5rem', marginBottom: '1.5rem' }}>
          <p style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Opción 1 — Correo electrónico (recomendado)</p>
          <p style={{ lineHeight: 1.7, marginBottom: '0.5rem' }}>
            Envía un correo a{" "}
            <a href="mailto:privacidad@tusalud.pro" style={{ color: '#2563eb', fontWeight: 600 }}>
              privacidad@tusalud.pro
            </a>{" "}
            con el asunto: <strong>Solicitud de eliminación de datos</strong>
          </p>
          <p style={{ lineHeight: 1.7, color: '#374151' }}>Incluye en el cuerpo del correo:</p>
          <ul style={{ lineHeight: 1.8, paddingLeft: '1.5rem', color: '#374151' }}>
            <li>Tu nombre completo</li>
            <li>El correo electrónico con el que te registraste o agendaste una cita</li>
            <li>Una descripción breve de lo que deseas eliminar (toda tu información, solo las citas, etc.)</li>
          </ul>
        </div>

        <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '1.25rem 1.5rem' }}>
          <p style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Opción 2 — Médicos con cuenta activa</p>
          <p style={{ lineHeight: 1.7, color: '#374151' }}>
            Si eres médico con acceso al panel de tusalud.pro, puedes eliminar directamente desde tu
            cuenta los expedientes clínicos de tus pacientes. Para eliminar tu propia cuenta y todos
            los datos asociados, utiliza la Opción 1 (correo).
          </p>
        </div>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.75rem' }}>Qué pasa después de tu solicitud</h2>

        <ol style={{ lineHeight: 1.8, paddingLeft: '1.5rem' }}>
          <li style={{ marginBottom: '0.5rem' }}>
            <strong>Confirmación</strong> — Recibirás un correo de confirmación dentro de los <strong>3 días hábiles</strong> siguientes a tu solicitud.
          </li>
          <li style={{ marginBottom: '0.5rem' }}>
            <strong>Verificación de identidad</strong> — Podemos pedirte que confirmes tu identidad para protegerte de solicitudes de eliminación no autorizadas.
          </li>
          <li style={{ marginBottom: '0.5rem' }}>
            <strong>Eliminación</strong> — Procederemos a eliminar o anonimizar tus datos personales en un plazo máximo de <strong>30 días hábiles</strong> desde que verificamos tu identidad.
          </li>
          <li>
            <strong>Notificación final</strong> — Te avisaremos por correo cuando la eliminación se haya completado.
          </li>
        </ol>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.75rem' }}>Qué datos se eliminan</h2>
        <ul style={{ lineHeight: 1.8, paddingLeft: '1.5rem' }}>
          <li>Nombre, correo electrónico y teléfono</li>
          <li>Historial de citas agendadas</li>
          <li>Perfil de médico (si aplica)</li>
          <li>Expedientes clínicos asociados a tu cuenta (si aplica)</li>
          <li>Datos de práctica: ventas, compras, cotizaciones (si aplica)</li>
          <li>Tokens de acceso a servicios de Google vinculados a tu cuenta</li>
        </ul>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.75rem' }}>Casos en que podríamos no poder eliminar ciertos datos</h2>
        <p style={{ lineHeight: 1.7, marginBottom: '0.75rem' }}>
          En algunas situaciones estamos obligados por ley a conservar ciertos datos aunque recibamos
          una solicitud de eliminación:
        </p>
        <ul style={{ lineHeight: 1.8, paddingLeft: '1.5rem' }}>
          <li>
            <strong>Obligaciones fiscales o contables:</strong> registros de transacciones que deben
            conservarse conforme a la legislación fiscal mexicana (SAT) durante el plazo legal requerido.
          </li>
          <li>
            <strong>Cumplimiento de NOM-024-SSA3:</strong> expedientes clínicos que deban conservarse
            conforme a la normativa de salud aplicable.
          </li>
          <li>
            <strong>Disputas activas:</strong> si existe una reclamación, proceso legal o investigación
            en curso relacionada con tu cuenta.
          </li>
        </ul>
        <p style={{ lineHeight: 1.7, marginTop: '0.75rem' }}>
          En estos casos te notificaremos la razón específica por la que no podemos eliminar esos datos
          en este momento y el plazo estimado en que podremos hacerlo.
        </p>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.75rem' }}>Datos en servicios de terceros</h2>
        <p style={{ lineHeight: 1.7 }}>
          Eliminamos tus datos de nuestros sistemas. Sin embargo, algunos proveedores de servicios
          (como Google Analytics) pueden retener datos de navegación anonimizados conforme a sus
          propias políticas. Estos datos no te identifican individualmente. Para datos en Google,
          puedes gestionar tu historial directamente en{" "}
          <a href="https://myaccount.google.com" target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb' }}>
            myaccount.google.com
          </a>.
        </p>
      </section>

      <section>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.75rem' }}>Contacto</h2>
        <p style={{ lineHeight: 1.7 }}>
          Cualquier duda sobre este proceso, escríbenos a:{" "}
          <a href="mailto:privacidad@tusalud.pro" style={{ color: '#2563eb' }}>
            privacidad@tusalud.pro
          </a>
        </p>
        <p style={{ lineHeight: 1.7, marginTop: '0.5rem' }}>
          Para más información sobre cómo tratamos tus datos, consulta nuestra{" "}
          <a href="/privacidad" style={{ color: '#2563eb' }}>
            Política de Privacidad
          </a>.
        </p>
      </section>
    </main>
  );
}
