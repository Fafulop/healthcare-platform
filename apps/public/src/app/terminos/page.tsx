import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Términos de Servicio | tusalud.pro",
  description: "Términos y condiciones de uso de la plataforma tusalud.pro.",
};

export default function TerminosPage() {
  return (
    <main className="max-w-3xl mx-auto px-6 py-16" style={{ fontFamily: 'Inter, sans-serif', color: '#1a1a1a' }}>
      <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '0.5rem' }}>
        Términos de Servicio
      </h1>
      <p style={{ color: '#6b7280', marginBottom: '2.5rem', fontSize: '0.95rem' }}>
        Última actualización: 19 de marzo de 2026
      </p>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.75rem' }}>1. Aceptación de los términos</h2>
        <p style={{ lineHeight: 1.7 }}>
          Al acceder o utilizar la plataforma <strong>tusalud.pro</strong> — incluyendo su sitio web,
          herramientas para médicos y cualquier servicio relacionado — aceptas estos Términos de Servicio
          en su totalidad. Si no estás de acuerdo con alguno de estos términos, no utilices la plataforma.
        </p>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.75rem' }}>2. Descripción del servicio</h2>
        <p style={{ lineHeight: 1.7, marginBottom: '0.75rem' }}>
          tusalud.pro es una plataforma digital que:
        </p>
        <ul style={{ lineHeight: 1.8, paddingLeft: '1.5rem' }}>
          <li>Permite a pacientes encontrar médicos, consultar perfiles y agendar citas en línea</li>
          <li>Proporciona a médicos herramientas de gestión de citas, expedientes clínicos, práctica médica y presencia digital</li>
          <li>Facilita la comunicación entre pacientes y consultorios</li>
        </ul>
        <p style={{ lineHeight: 1.7, marginTop: '0.75rem' }}>
          tusalud.pro es una plataforma de intermediación. No es un proveedor de servicios médicos,
          no da consultas, no emite diagnósticos y no es responsable de la atención clínica brindada
          por los médicos registrados.
        </p>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.75rem' }}>3. Registro y cuentas</h2>
        <p style={{ lineHeight: 1.7, marginBottom: '0.75rem' }}>
          Los médicos se registran mediante Google OAuth. Al registrarte como médico, declaras que:
        </p>
        <ul style={{ lineHeight: 1.8, paddingLeft: '1.5rem' }}>
          <li>La información de tu perfil es veraz, completa y actualizada</li>
          <li>Posees la cédula profesional y habilitaciones legales requeridas para ejercer la especialidad declarada en México</li>
          <li>Eres el único responsable de la información clínica que registras en la plataforma</li>
          <li>Mantendrás la confidencialidad de tu cuenta y notificarás de inmediato cualquier uso no autorizado</li>
        </ul>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.75rem' }}>4. Uso permitido</h2>
        <p style={{ lineHeight: 1.7, marginBottom: '0.75rem' }}>Al usar tusalud.pro, te comprometes a:</p>
        <ul style={{ lineHeight: 1.8, paddingLeft: '1.5rem' }}>
          <li>Utilizar la plataforma únicamente con fines lícitos y conforme a estos términos</li>
          <li>No publicar información falsa, engañosa o que infrinja derechos de terceros</li>
          <li>No intentar acceder a cuentas ajenas ni a datos a los que no tienes autorización</li>
          <li>No usar la plataforma para actividades de spam, phishing u otras prácticas abusivas</li>
          <li>No interferir con el funcionamiento técnico del servicio</li>
          <li>Cumplir con la legislación mexicana aplicable y, en su caso, con la normativa de protección de datos de salud</li>
        </ul>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.75rem' }}>5. Citas y pagos</h2>
        <p style={{ lineHeight: 1.7 }}>
          tusalud.pro facilita el agendamiento de citas pero no procesa pagos directamente entre pacientes
          y médicos. Cada médico establece sus propias tarifas y condiciones de pago. Las disputas sobre
          honorarios, cancelaciones y reembolsos son responsabilidad del médico y el paciente involucrados.
          tusalud.pro no es parte de esa relación económica.
        </p>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.75rem' }}>6. Contenido del usuario</h2>
        <p style={{ lineHeight: 1.7 }}>
          Los médicos son responsables del contenido que publican en su perfil (foto, descripción,
          artículos, etc.). Al publicar contenido, otorgas a tusalud.pro una licencia no exclusiva,
          gratuita y mundial para mostrar ese contenido dentro de la plataforma con el propósito de
          prestar el servicio. No reclamamos propiedad sobre tu contenido.
        </p>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.75rem' }}>7. Propiedad intelectual</h2>
        <p style={{ lineHeight: 1.7 }}>
          El diseño, código, marca, logotipos y contenidos propios de tusalud.pro son propiedad exclusiva
          de tusalud.pro y están protegidos por la legislación aplicable. Queda prohibida su reproducción
          total o parcial sin autorización escrita.
        </p>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.75rem' }}>8. Descargo de responsabilidad médica</h2>
        <p style={{ lineHeight: 1.7 }}>
          La información contenida en los perfiles de médicos y artículos publicados en tusalud.pro
          tiene carácter informativo general y no constituye consejo médico, diagnóstico ni tratamiento.
          Consulta siempre a un profesional de la salud calificado ante cualquier duda sobre tu condición
          médica. tusalud.pro no es responsable de las decisiones médicas tomadas con base en el contenido
          de la plataforma.
        </p>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.75rem' }}>9. Limitación de responsabilidad</h2>
        <p style={{ lineHeight: 1.7 }}>
          En la medida permitida por la ley, tusalud.pro no será responsable por daños indirectos,
          incidentales, especiales o consecuentes derivados del uso o imposibilidad de uso de la
          plataforma, incluyendo pérdida de datos, pérdida de ingresos o interrupciones del servicio.
          La responsabilidad total de tusalud.pro frente a cualquier usuario no excederá MX$500 o el
          importe pagado por ese usuario a tusalud.pro en los doce meses anteriores al evento que originó
          el reclamo, lo que sea mayor.
        </p>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.75rem' }}>10. Suspensión y terminación</h2>
        <p style={{ lineHeight: 1.7 }}>
          tusalud.pro se reserva el derecho de suspender o eliminar cuentas que violen estos términos,
          que contengan información falsa o que realicen usos abusivos de la plataforma, con o sin
          previo aviso. El usuario puede solicitar la eliminación de su cuenta en cualquier momento
          escribiendo a{" "}
          <a href="mailto:privacidad@tusalud.pro" style={{ color: '#2563eb' }}>
            privacidad@tusalud.pro
          </a>.
        </p>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.75rem' }}>11. Modificaciones</h2>
        <p style={{ lineHeight: 1.7 }}>
          Podemos modificar estos términos en cualquier momento publicando la versión actualizada en esta
          página. La fecha de última actualización refleja los cambios más recientes. El uso continuado
          de la plataforma tras la publicación de cambios implica la aceptación de los términos
          modificados.
        </p>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.75rem' }}>12. Ley aplicable</h2>
        <p style={{ lineHeight: 1.7 }}>
          Estos términos se rigen por las leyes de los Estados Unidos Mexicanos. Cualquier controversia
          derivada de estos términos se someterá a los tribunales competentes de la Ciudad de México,
          renunciando expresamente a cualquier otro fuero que pudiera corresponder.
        </p>
      </section>

      <section>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.75rem' }}>13. Contacto</h2>
        <p style={{ lineHeight: 1.7 }}>
          Para preguntas sobre estos términos, escríbenos a:{" "}
          <a href="mailto:privacidad@tusalud.pro" style={{ color: '#2563eb' }}>
            privacidad@tusalud.pro
          </a>
        </p>
      </section>
    </main>
  );
}
