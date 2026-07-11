"use client";

// ⚠️ El asistente tiene un RESUMEN curado de esta guía (GUIAS.pagos en
// lib/agenda-agent/modules/facturas.ts) — si cambias contenido aquí, actualízalo.
import {
  CreditCard,
  LinkIcon,
  Building2,
  Receipt,
  AlertTriangle,
  Clock,
  DollarSign,
  Shield,
  Smartphone,
  HelpCircle,
  Banknote,
  Store,
  FileText,
  ExternalLink,
  Bell,
  Settings,
  XCircle,
  Unlink,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { SectionAccordion } from "./SectionAccordion";
import { WorkflowStep } from "./WorkflowStep";

function InfoBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800 leading-relaxed">
      {children}
    </div>
  );
}

function WarningBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 leading-relaxed">
      <span className="font-medium">Importante: </span>
      {children}
    </div>
  );
}

function FeeRow({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <div className="flex items-start justify-between py-2 px-3 bg-gray-50 rounded-lg">
      <div className="min-w-0">
        <span className="text-sm text-gray-700">{label}</span>
        {note && <p className="text-xs text-gray-500 mt-0.5">{note}</p>}
      </div>
      <span className="text-sm font-semibold text-gray-900 ml-3 whitespace-nowrap">
        {value}
      </span>
    </div>
  );
}

export function PagosGuide() {
  return (
    <div className="space-y-4">
      {/* Intro */}
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
        <p className="text-sm text-blue-800 leading-relaxed">
          <strong>Tienes dos opciones para cobrar a tus pacientes:</strong> Stripe y Mercado Pago.
          Puedes conectar uno o ambos proveedores. Cada uno tiene sus propias ventajas y metodos de pago.
          Selecciona un proveedor en la pestana de &ldquo;Mis pagos&rdquo; para configurarlo.
        </p>
      </div>

      {/* ═══════════ STRIPE ═══════════ */}
      <div className="pt-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-purple-500 mb-3 px-1">Stripe</p>
      </div>

      {/* 1. Que es y como funciona */}
      <SectionAccordion
        title="Que es Stripe y como funciona en tu cuenta"
        subtitle="Resumen general del sistema de pagos"
        icon={CreditCard}
        accentColor="purple"
      >
        <div className="space-y-3 text-sm text-gray-600 leading-relaxed">
          <p>
            Stripe es una plataforma de pagos internacional que te permite cobrar
            a tus pacientes con tarjeta de credito, tarjeta de debito, pagos en
            OXXO, y billeteras digitales como Apple Pay y Google Pay. Al activar Stripe, se crea una{" "}
            <strong>cuenta conectada a tu nombre</strong> donde tu recibes el
            dinero directamente.
          </p>
          <InfoBox>
            <strong>tusalud.pro no interviene en tus cobros.</strong> No
            retenemos dinero, no cobramos comision, y no aparecemos en los
            estados de cuenta de tus pacientes. Tu eres el titular de la cuenta
            de Stripe y el cobro se hace directamente a tu nombre.
          </InfoBox>
          <p>El flujo funciona asi:</p>
          <ol className="list-decimal list-inside space-y-1 text-sm text-gray-600 ml-1">
            <li>
              Tu creas un <strong>link de pago</strong> con el monto y
              descripcion.
            </li>
            <li>
              Compartes el link con tu paciente por WhatsApp, mensaje o como
              prefieras.
            </li>
            <li>
              El paciente abre el link, ve tu nombre como cobrador, y paga con
              tarjeta, Apple Pay, Google Pay, o genera un voucher de OXXO.
            </li>
            <li>
              El link solo puede usarse una vez. Una vez pagado, ya no acepta
              otro pago.
            </li>
            <li>
              Stripe deposita el dinero en tu cuenta bancaria segun el calendario
              de pagos (automatico).
            </li>
          </ol>
        </div>
      </SectionAccordion>

      {/* 2. Metodos de pago disponibles */}
      <SectionAccordion
        title="Metodos de pago disponibles"
        subtitle="Que opciones tiene tu paciente al abrir un link de pago"
        icon={Smartphone}
        accentColor="indigo"
      >
        <div className="space-y-3 text-sm text-gray-600 leading-relaxed">
          <p>
            Cuando un paciente abre tu link de pago, Stripe le muestra automaticamente
            los metodos de pago disponibles. Tu no necesitas configurar nada.
          </p>

          <div className="space-y-2">
            <PaymentMethodCard
              icon={CreditCard}
              title="Tarjeta de credito o debito"
              description="Visa, Mastercard, American Express y Carnet (tarjeta mexicana). El pago se confirma al instante."
              speed="Inmediato"
              limit="Segun limite de la tarjeta"
            />
            <PaymentMethodCard
              icon={Store}
              title="OXXO (efectivo)"
              description="El paciente recibe un voucher con codigo de barras y paga en cualquier OXXO. Ideal para pacientes sin tarjeta."
              speed="1 dia habil despues del pago"
              limit="Maximo $10,000 MXN por voucher"
            />
            <PaymentMethodCard
              icon={Smartphone}
              title="Apple Pay"
              description="Para pacientes con iPhone, iPad o Mac. Pagan con Face ID o Touch ID sin ingresar datos de tarjeta."
              speed="Inmediato"
              limit="Segun limite de la tarjeta vinculada"
            />
            <PaymentMethodCard
              icon={Smartphone}
              title="Google Pay"
              description="Para pacientes con Android. Pagan desde su billetera digital sin ingresar datos de tarjeta."
              speed="Inmediato"
              limit="Segun limite de la tarjeta vinculada"
            />
          </div>

          <InfoBox>
            Los metodos de pago se muestran automaticamente segun el dispositivo del paciente.
            Apple Pay solo aparece en dispositivos Apple, y Google Pay solo en Android.
            Las tarjetas y OXXO aparecen siempre.
          </InfoBox>

          <WarningBox>
            Si tu consulta cuesta mas de $10,000 MXN, el paciente no podra pagar con OXXO.
            Debe usar tarjeta o billetera digital. Para montos grandes, recomienda pago con tarjeta.
          </WarningBox>
        </div>
      </SectionAccordion>

      {/* 3. Activar cobros — paso a paso */}
      <SectionAccordion
        title="Activar cobros: paso a paso"
        subtitle="Como conectar tu cuenta de Stripe por primera vez"
        icon={Shield}
        accentColor="green"
      >
        <div className="space-y-1">
          <WorkflowStep number={1} title="Ir a Pagos" icon={CreditCard}>
            En el menu lateral, haz clic en <strong>Pagos</strong>. Veras un
            boton que dice &ldquo;Conectar con Stripe&rdquo;.
          </WorkflowStep>

          <WorkflowStep
            number={2}
            title="Crear cuenta de Stripe"
            icon={Building2}
          >
            Al hacer clic, seras redirigido a Stripe para crear tu cuenta
            Express. Stripe te pedira:
            <ul className="list-disc list-inside mt-1 space-y-0.5 text-xs text-gray-500">
              <li>Tu nombre completo y fecha de nacimiento</li>
              <li>Direccion de tu consultorio o domicilio fiscal</li>
              <li>Tu RFC (para verificacion fiscal)</li>
              <li>
                Tu CLABE bancaria (18 digitos) de la cuenta donde quieres recibir depositos
              </li>
              <li>
                Una identificacion oficial (INE, pasaporte) para verificacion de
                identidad
              </li>
            </ul>
          </WorkflowStep>

          <WorkflowStep
            number={3}
            title="Esperar verificacion"
            icon={Clock}
            tip="La verificacion suele completarse en minutos, pero puede tomar hasta 1-2 dias habiles en algunos casos."
          >
            Stripe verificara tu identidad y datos bancarios. Una vez aprobado,
            tu pagina de Pagos mostrara dos indicadores en verde:
            <ul className="list-disc list-inside mt-1 space-y-0.5 text-xs text-gray-500">
              <li>
                <strong>Cargos habilitados:</strong> puedes cobrar a pacientes
              </li>
              <li>
                <strong>Pagos habilitados:</strong> puedes recibir depositos en
                tu banco
              </li>
            </ul>
          </WorkflowStep>

          <WorkflowStep number={4} title="Listo para cobrar" icon={LinkIcon}>
            Con ambos indicadores activos, podras crear links de pago.
          </WorkflowStep>
        </div>

        <WarningBox>
          Si abandonas el proceso de registro a la mitad, no te preocupes.
          Regresa a Pagos y haz clic en &ldquo;Completar registro en
          Stripe&rdquo; para retomarlo donde lo dejaste.
        </WarningBox>
      </SectionAccordion>

      {/* 4. Tu panel de Stripe Express */}
      <SectionAccordion
        title="Tu panel de Stripe Express"
        subtitle="Administra tu cuenta, depositos, reembolsos y disputas directamente"
        icon={ExternalLink}
        accentColor="purple"
      >
        <div className="space-y-3 text-sm text-gray-600 leading-relaxed">
          <p>
            Al activar Stripe, se crea una <strong>cuenta Express a tu nombre</strong>.
            Esta cuenta tiene su propio panel de administracion donde puedes gestionar
            todo sin contactar a tusalud.pro.
          </p>

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
              Como acceder
            </p>
            <div className="p-3 bg-purple-50 rounded-lg border border-purple-200 space-y-2">
              <p className="text-xs text-purple-800">
                <strong>Opcion 1 (recomendada):</strong> En tu pagina de Pagos, haz clic en el
                boton <strong>&ldquo;Mi Stripe&rdquo;</strong>. Se abrira tu panel en una nueva pestana.
              </p>
              <p className="text-xs text-purple-800">
                <strong>Opcion 2:</strong> Ve a{" "}
                <strong>connect.stripe.com/express_login</strong> e ingresa el
                correo que usaste para crear tu cuenta. Stripe te enviara un codigo de
                verificacion por SMS o correo.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
              Que puedes hacer desde tu panel
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <PanelFeature icon={Banknote} label="Ver tu saldo y depositos" description="Balance disponible, depositos pendientes, historial completo" />
              <PanelFeature icon={Settings} label="Cambiar cuenta bancaria" description="Actualiza tu CLABE si cambias de banco" />
              <PanelFeature icon={Clock} label="Configurar frecuencia de depositos" description="Diario, semanal o mensual" />
              <PanelFeature icon={DollarSign} label="Ver detalle de cada pago" description="Monto, metodo, fecha, comision de Stripe" />
              <PanelFeature icon={AlertTriangle} label="Responder disputas" description="Sube evidencia si un paciente reclama un cargo" />
              <PanelFeature icon={XCircle} label="Emitir reembolsos" description="Devuelve dinero a la tarjeta del paciente" />
            </div>
          </div>

          <InfoBox>
            <strong>No necesitas contactar a tusalud.pro para ninguna de estas acciones.</strong>{" "}
            Tu panel de Stripe es independiente. Si necesitas cambiar tu cuenta bancaria,
            emitir un reembolso, o responder una disputa, hazlo directamente desde tu panel.
          </InfoBox>
        </div>
      </SectionAccordion>

      {/* 5. Crear y compartir links de pago */}
      <SectionAccordion
        title="Crear y compartir links de pago"
        subtitle="Como generar un link, copiarlo y enviarlo al paciente"
        icon={LinkIcon}
        accentColor="indigo"
      >
        <div className="space-y-1">
          <WorkflowStep
            number={1}
            title="Crear un link"
            icon={DollarSign}
          >
            En la seccion de Pagos, haz clic en <strong>Crear link</strong>.
            Llena el monto en pesos mexicanos (minimo $10 MXN, maximo $100,000 MXN)
            y opcionalmente una descripcion (ej: &ldquo;Consulta dermatologica&rdquo;,
            &ldquo;Seguimiento mensual&rdquo;).
          </WorkflowStep>

          <WorkflowStep
            number={2}
            title="Compartir el link"
            icon={Smartphone}
          >
            Una vez creado, tienes tres opciones:
            <ul className="list-disc list-inside mt-1 space-y-0.5 text-xs text-gray-500">
              <li>
                <strong>Copiar link:</strong> copia la URL para pegarla donde
                quieras
              </li>
              <li>
                <strong>WhatsApp:</strong> abre WhatsApp con el link listo para
                enviar
              </li>
              <li>
                <strong>Desactivar:</strong> cancela el link si ya no es
                necesario
              </li>
            </ul>
          </WorkflowStep>

          <WorkflowStep number={3} title="El paciente paga" icon={CreditCard}>
            El paciente abre el link en su navegador y elige como pagar:
            <ul className="list-disc list-inside mt-1 space-y-0.5 text-xs text-gray-500">
              <li>
                <strong>Tarjeta:</strong> el pago se confirma al instante
              </li>
              <li>
                <strong>Apple Pay / Google Pay:</strong> pago instantaneo desde
                la billetera digital del celular
              </li>
              <li>
                <strong>OXXO:</strong> se genera un voucher con codigo de
                barras. El paciente tiene 72 horas para pagar en cualquier OXXO.
                La confirmacion puede tardar hasta el siguiente dia habil.
              </li>
            </ul>
          </WorkflowStep>

          <WorkflowStep number={4} title="Recibiras una notificacion" icon={Bell}>
            Cuando el paciente paga, recibiras una notificacion por Telegram con
            el monto y concepto. El estado del link cambia automaticamente a
            &ldquo;Pagado&rdquo;.
          </WorkflowStep>
        </div>

        <InfoBox>
          Cada link de pago es de un solo uso. Una vez pagado, ya no acepta
          otro pago. Si un paciente necesita pagar otra vez, crea un link nuevo.
          Puedes crear los links que necesites sin limite.
        </InfoBox>
      </SectionAccordion>

      {/* 6. Estados de un link de pago */}
      <SectionAccordion
        title="Estados de un link de pago"
        subtitle="Que significa cada estado y cuando cambia"
        icon={FileText}
        accentColor="purple"
      >
        <div className="space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
              <p className="text-sm font-semibold text-yellow-700">Pendiente</p>
              <p className="text-xs text-yellow-600 mt-0.5">
                El link fue creado pero el paciente aun no ha pagado. Puedes
                compartirlo o desactivarlo.
              </p>
            </div>
            <div className="p-3 bg-green-50 rounded-lg border border-green-200">
              <p className="text-sm font-semibold text-green-700">Pagado</p>
              <p className="text-xs text-green-600 mt-0.5">
                El paciente pago exitosamente. Recibiras una notificacion por Telegram.
                El dinero se depositara segun tu calendario de pagos.
              </p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-sm font-semibold text-gray-600">Expirado</p>
              <p className="text-xs text-gray-500 mt-0.5">
                El paciente genero un voucher OXXO pero no pago en 72 horas.
                Crea un nuevo link si aun necesitas cobrar.
              </p>
            </div>
            <div className="p-3 bg-red-50 rounded-lg border border-red-200">
              <p className="text-sm font-semibold text-red-600">Cancelado</p>
              <p className="text-xs text-red-500 mt-0.5">
                Tu desactivaste el link manualmente. El paciente vera que el
                link ya no es valido.
              </p>
            </div>
          </div>

          <InfoBox>
            Los estados se actualizan automaticamente. No necesitas hacer nada
            despues de compartir el link: la plataforma recibe la confirmacion de
            Stripe en tiempo real.
          </InfoBox>
        </div>
      </SectionAccordion>

      {/* 7. Depositos y cuenta bancaria */}
      <SectionAccordion
        title="Depositos y cuenta bancaria"
        subtitle="Cuando llega el dinero y que hacer si hay problemas"
        icon={Banknote}
        accentColor="green"
      >
        <div className="space-y-3 text-sm text-gray-600 leading-relaxed">
          <p>
            Stripe deposita el dinero automaticamente en la cuenta bancaria (CLABE)
            que registraste durante el onboarding. Los depositos siguen un calendario
            automatico.
          </p>

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
              Tiempos de deposito
            </p>
            <FeeRow
              label="Primer deposito"
              value="~7 dias"
              note="Stripe retiene los fondos los primeros dias mientras verifica tu cuenta"
            />
            <FeeRow
              label="Depositos siguientes"
              value="2 dias habiles"
              note="Despues del periodo inicial, los depositos son automaticos"
            />
            <FeeRow
              label="Depositos instantaneos"
              value="No disponible"
              note="Stripe no ofrece depositos instantaneos en Mexico por el momento"
            />
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
              Informacion de tu ultimo deposito
            </p>
            <p>
              En tu pagina de Pagos veras el estado de tu ultimo deposito: <strong>Depositado</strong>,{" "}
              <strong>En camino</strong>, <strong>Pendiente</strong>, o <strong>Fallido</strong>.
            </p>
          </div>

          <WarningBox>
            Si un deposito falla (por ejemplo, CLABE incorrecta o cuenta cerrada),
            Stripe deshabilitara tu cuenta bancaria y el dinero quedara en tu saldo de Stripe.
            Recibiras una notificacion por Telegram.{" "}
            <strong>
              Para solucionarlo, entra a tu panel de Stripe (&ldquo;Mi Stripe&rdquo;)
              y actualiza tus datos bancarios.
            </strong>{" "}
            No necesitas contactar a tusalud.pro.
          </WarningBox>
        </div>
      </SectionAccordion>

      {/* 8. Problemas con tu cuenta */}
      <SectionAccordion
        title="Problemas con tu cuenta de Stripe"
        subtitle="Que hacer si tu cuenta esta restringida, deshabilitada o rechazada"
        icon={AlertTriangle}
        accentColor="amber"
      >
        <div className="space-y-3 text-sm text-gray-600 leading-relaxed">
          <p>
            Stripe puede restringir o deshabilitar tu cuenta si necesita informacion
            adicional o si detecta algun problema. Tu pagina de Pagos te mostrara
            una alerta con la razon y lo que necesitas hacer.
          </p>

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
              Posibles estados de tu cuenta
            </p>

            <div className="space-y-2">
              <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                <p className="text-sm font-semibold text-yellow-700">Verificacion en proceso</p>
                <p className="text-xs text-yellow-600 mt-0.5">
                  Stripe esta revisando tu documentacion. No necesitas hacer nada. Suele resolverse en 1-2 dias habiles.
                </p>
              </div>

              <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                <p className="text-sm font-semibold text-amber-700">Informacion requerida</p>
                <p className="text-xs text-amber-600 mt-0.5">
                  Stripe necesita datos adicionales (puede ser un documento vencido, datos faltantes, etc.).
                  Haz clic en <strong>&ldquo;Actualizar datos en Stripe&rdquo;</strong> para completar lo que falta.
                  Hay una fecha limite — si no la cumples, tu cuenta se deshabilitara.
                </p>
              </div>

              <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                <p className="text-sm font-semibold text-red-700">Cuenta deshabilitada</p>
                <p className="text-xs text-red-600 mt-0.5">
                  No proporcionaste la informacion requerida antes de la fecha limite.
                  Haz clic en <strong>&ldquo;Actualizar datos en Stripe&rdquo;</strong> para reactivar tu cuenta.
                </p>
              </div>

              <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                <p className="text-sm font-semibold text-red-700">Cuenta rechazada</p>
                <p className="text-xs text-red-600 mt-0.5">
                  Stripe rechazo tu cuenta permanentemente (por ejemplo, por documentacion invalida o
                  incompatibilidad con sus politicas). Esta decision es de Stripe, no de tusalud.pro.
                  Puedes intentar crear una nueva cuenta, pero deberas resolver el motivo del rechazo primero.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
              Motivos comunes de problemas
            </p>
            <ul className="list-disc list-inside text-xs text-gray-500 space-y-0.5 ml-1">
              <li>Identificacion oficial (INE/pasaporte) vencida</li>
              <li>El nombre en la cuenta no coincide con la identificacion</li>
              <li>Foto del documento borrosa, incompleta o en blanco y negro</li>
              <li>Comprobante de domicilio con mas de 6 meses de antiguedad</li>
              <li>CLABE bancaria incorrecta o cuenta cerrada</li>
            </ul>
          </div>

          <InfoBox>
            Si tu cuenta tiene problemas, recibiras una notificacion por Telegram.
            Tambien veras una alerta en tu pagina de Pagos con instrucciones especificas.
            En la mayoria de los casos, puedes resolver el problema tu mismo desde Stripe
            sin contactar a tusalud.pro.
          </InfoBox>
        </div>
      </SectionAccordion>

      {/* ═══════════ MERCADO PAGO ═══════════ */}
      <div className="pt-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-sky-500 mb-3 px-1">Mercado Pago</p>
      </div>

      {/* MP-1. Que es y como funciona */}
      <SectionAccordion
        title="Que es Mercado Pago y como funciona"
        subtitle="Cobrar con la plataforma de pagos mas popular de Mexico"
        icon={Wallet}
        accentColor="blue"
      >
        <div className="space-y-3 text-sm text-gray-600 leading-relaxed">
          <p>
            Mercado Pago es la plataforma de pagos de Mercado Libre, la mas utilizada en
            Mexico y Latinoamerica. Al conectar tu cuenta, podras generar links de pago
            que aceptan <strong>tarjetas, transferencias bancarias, OXXO, SPEI y Mercado Credito</strong>.
          </p>
          <InfoBox>
            <strong>tusalud.pro no interviene en tus cobros.</strong> No
            retenemos dinero, no cobramos comision, y no aparecemos en los
            cobros. Tu eres el titular de la cuenta de Mercado Pago y
            recibes el dinero directamente.
          </InfoBox>
          <p>El flujo funciona asi:</p>
          <ol className="list-decimal list-inside space-y-1 text-sm text-gray-600 ml-1">
            <li>
              Tu creas un <strong>link de pago</strong> con el monto y descripcion.
            </li>
            <li>
              Compartes el link con tu paciente por WhatsApp, mensaje o como prefieras.
            </li>
            <li>
              El paciente abre el link y elige como pagar: tarjeta, transferencia, OXXO, SPEI
              o Mercado Credito (meses sin intereses).
            </li>
            <li>
              El link solo puede usarse una vez. Una vez pagado, ya no acepta otro pago.
            </li>
            <li>
              Mercado Pago deposita el dinero en tu cuenta. Puedes retirarlo a tu banco
              desde la app de Mercado Pago.
            </li>
          </ol>
        </div>
      </SectionAccordion>

      {/* MP-2. Metodos de pago */}
      <SectionAccordion
        title="Metodos de pago en Mercado Pago"
        subtitle="Que opciones tiene tu paciente al abrir un link"
        icon={Smartphone}
        accentColor="blue"
      >
        <div className="space-y-3 text-sm text-gray-600 leading-relaxed">
          <p>
            Mercado Pago ofrece mas metodos de pago que Stripe en Mexico, incluyendo
            transferencia bancaria (SPEI) y Mercado Credito.
          </p>

          <div className="space-y-2">
            <PaymentMethodCard
              icon={CreditCard}
              title="Tarjeta de credito o debito"
              description="Visa, Mastercard, American Express. Incluye opcion de meses sin intereses con Mercado Credito."
              speed="Inmediato"
              limit="Segun limite de la tarjeta"
            />
            <PaymentMethodCard
              icon={Banknote}
              title="Transferencia bancaria (SPEI)"
              description="El paciente paga por transferencia desde su banca en linea. Disponible en todos los bancos de Mexico."
              speed="Minutos a horas"
              limit="Sin limite practico"
            />
            <PaymentMethodCard
              icon={Store}
              title="OXXO (efectivo)"
              description="El paciente recibe un codigo de barras y paga en cualquier OXXO. Ideal para pacientes sin tarjeta."
              speed="1-2 dias habiles"
              limit="Maximo $10,000 MXN"
            />
            <PaymentMethodCard
              icon={Wallet}
              title="Mercado Credito"
              description="Meses sin intereses financiado por Mercado Libre. El paciente paga en cuotas, tu recibes el monto completo."
              speed="Inmediato"
              limit="Segun linea de credito del paciente"
            />
          </div>

          <InfoBox>
            <strong>Ventaja clave sobre Stripe:</strong> Mercado Pago acepta transferencias
            bancarias (SPEI) y Mercado Credito (meses sin intereses). Stripe no ofrece
            estas opciones en Mexico.
          </InfoBox>
        </div>
      </SectionAccordion>

      {/* MP-3. Conectar cuenta */}
      <SectionAccordion
        title="Conectar Mercado Pago: paso a paso"
        subtitle="Como vincular tu cuenta por primera vez"
        icon={Shield}
        accentColor="green"
      >
        <div className="space-y-1">
          <WorkflowStep number={1} title="Ir a Pagos" icon={CreditCard}>
            En el menu lateral, haz clic en <strong>Pagos</strong>. Selecciona
            <strong> Mercado Pago</strong> para expandir sus opciones.
          </WorkflowStep>

          <WorkflowStep number={2} title="Conectar con Mercado Pago" icon={ExternalLink}>
            Haz clic en &ldquo;Conectar con Mercado Pago&rdquo;. Seras redirigido al sitio
            de Mercado Pago para autorizar la conexion. Si ya tienes cuenta de Mercado Pago,
            solo necesitas iniciar sesion y autorizar.
          </WorkflowStep>

          <WorkflowStep number={3} title="Autorizar acceso" icon={Shield}>
            Mercado Pago te pedira que autorices a tusalud.pro para crear links de pago
            a tu nombre. Haz clic en <strong>&ldquo;Autorizar&rdquo;</strong>.
            <ul className="list-disc list-inside mt-1 space-y-0.5 text-xs text-gray-500">
              <li>No compartimos tus datos bancarios ni tu saldo</li>
              <li>Solo creamos links de pago cuando tu lo solicitas</li>
              <li>Puedes revocar el acceso en cualquier momento</li>
            </ul>
          </WorkflowStep>

          <WorkflowStep number={4} title="Listo para cobrar" icon={LinkIcon}>
            Al regresar a tusalud.pro, veras que Mercado Pago esta conectado.
            Ya puedes crear links de pago inmediatamente.
          </WorkflowStep>
        </div>

        <InfoBox>
          Si no tienes cuenta de Mercado Pago, puedes crear una gratis en{" "}
          <strong>mercadopago.com.mx</strong>. Necesitaras tu RFC y una cuenta bancaria
          para recibir retiros.
        </InfoBox>
      </SectionAccordion>

      {/* MP-4. Comisiones */}
      <SectionAccordion
        title="Comisiones de Mercado Pago"
        subtitle="Cuanto cobra Mercado Pago por cada pago"
        icon={DollarSign}
        accentColor="amber"
      >
        <div className="space-y-3">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
              Comision de Mercado Pago (se descuenta del monto cobrado)
            </p>
            <FeeRow
              label="Tarjeta de credito"
              value="3.49% + IVA"
              note="Visa, Mastercard, Amex"
            />
            <FeeRow
              label="Tarjeta de debito"
              value="2.69% + IVA"
              note="Generalmente menor que credito"
            />
            <FeeRow
              label="Transferencia / SPEI"
              value="3.49% + IVA"
              note="Aunque la transferencia es gratis para el paciente, MP cobra comision"
            />
            <FeeRow
              label="OXXO"
              value="3.49% + IVA"
              note="Porcentaje sobre el monto"
            />
            <FeeRow
              label="Mercado Credito (MSI)"
              value="Variable"
              note="Depende del plazo. El paciente paga en cuotas, tu recibes el monto completo"
            />
          </div>

          <WarningBox>
            Las tarifas pueden variar segun tu tipo de cuenta y volumen. Consulta{" "}
            <strong>mercadopago.com.mx/costs</strong> para tarifas actualizadas.
            Las comisiones incluyen IVA.
          </WarningBox>

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
              Comision de tusalud.pro
            </p>
            <div className="p-3 bg-green-50 rounded-lg border border-green-200">
              <p className="text-sm font-semibold text-green-700">
                $0 — Sin comision
              </p>
              <p className="text-xs text-green-600 mt-0.5">
                tusalud.pro no cobra ninguna comision por los pagos que recibas.
                El unico costo es la comision de Mercado Pago.
              </p>
            </div>
          </div>
        </div>
      </SectionAccordion>

      {/* MP-5. Desconectar y seguridad */}
      <SectionAccordion
        title="Desconectar Mercado Pago"
        subtitle="Como revocar acceso y que pasa con tus links"
        icon={Unlink}
        accentColor="amber"
      >
        <div className="space-y-3 text-sm text-gray-600 leading-relaxed">
          <p>
            Puedes desconectar tu cuenta de Mercado Pago en cualquier momento desde
            la seccion de Pagos. Al desconectar:
          </p>
          <ul className="list-disc list-inside text-xs text-gray-500 space-y-0.5 ml-1">
            <li>Los links de pago pendientes <strong>dejaran de funcionar</strong></li>
            <li>Los pagos ya completados no se ven afectados</li>
            <li>Tu cuenta de Mercado Pago sigue existiendo (no se elimina)</li>
            <li>Puedes reconectar en cualquier momento</li>
          </ul>

          <InfoBox>
            Tambien puedes revocar el acceso directamente desde tu cuenta de Mercado Pago,
            en la seccion de &ldquo;Aplicaciones autorizadas&rdquo;. El efecto es el mismo.
          </InfoBox>

          <WarningBox>
            La conexion con Mercado Pago se renueva automaticamente cada 6 meses.
            Si por alguna razon la renovacion falla, recibiras una notificacion por
            Telegram para que reconectes tu cuenta manualmente.
          </WarningBox>
        </div>
      </SectionAccordion>

      {/* ═══════════ GENERAL ═══════════ */}
      <div className="pt-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3 px-1">General</p>
      </div>

      {/* 9. Notificaciones por Telegram */}
      <SectionAccordion
        title="Notificaciones por Telegram"
        subtitle="Que alertas recibiras sobre tus pagos"
        icon={Bell}
        accentColor="blue"
      >
        <div className="space-y-3 text-sm text-gray-600 leading-relaxed">
          <p>
            Si tienes Telegram conectado, recibiras notificaciones automaticas
            sobre eventos importantes de tus pagos (tanto de Stripe como de Mercado Pago):
          </p>

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
              Stripe y Mercado Pago
            </p>
            <NotificationRow
              emoji="💰"
              title="Pago recibido"
              description="Cuando un paciente paga un link de pago. Incluye monto, metodo de pago y concepto."
            />
            <NotificationRow
              emoji="⚠️"
              title="Contracargo"
              description="Si un paciente reclama un cargo con su banco. Incluye monto y detalles."
            />
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
              Solo Stripe
            </p>
            <NotificationRow
              emoji="🚨"
              title="Disputa de pago"
              description="Si un paciente reclama un cargo. Debes responder desde tu panel de Stripe con evidencia."
            />
            <NotificationRow
              emoji="✅"
              title="Disputa resuelta"
              description="Cuando una disputa se resuelve (a tu favor o en contra). Incluye el resultado."
            />
            <NotificationRow
              emoji="🏦"
              title="Deposito bancario fallido"
              description="Si Stripe no puede depositar en tu cuenta. Debes actualizar tus datos bancarios."
            />
            <NotificationRow
              emoji="⚠️"
              title="Alerta de cuenta"
              description="Si tu cuenta de Stripe es restringida, deshabilitada o necesita informacion adicional."
            />
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
              Solo Mercado Pago
            </p>
            <NotificationRow
              emoji="🔄"
              title="Conexion renovada"
              description="Tu token de acceso fue renovado automaticamente. No necesitas hacer nada."
            />
            <NotificationRow
              emoji="⚠️"
              title="Cuenta desconectada"
              description="Si la renovacion automatica falla o revocas acceso desde MP. Debes reconectar desde Pagos."
            />
            <NotificationRow
              emoji="🚨"
              title="Alerta de fraude"
              description="Si Mercado Pago detecta una operacion sospechosa. Revisa tu cuenta de MP."
            />
          </div>

          <InfoBox>
            Para recibir estas notificaciones necesitas tener Telegram conectado.
            Si no lo tienes, las alertas solo apareceran en tu pagina de Pagos cuando la visites.
          </InfoBox>
        </div>
      </SectionAccordion>

      {/* 10. Comisiones y costos */}
      <SectionAccordion
        title="Comisiones y costos"
        subtitle="Cuanto cobra Stripe por cada pago y que cobra tusalud.pro"
        icon={DollarSign}
        accentColor="amber"
      >
        <div className="space-y-3">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
              Comision de Stripe (se descuenta del monto cobrado)
            </p>
            <FeeRow
              label="Tarjeta nacional"
              value="3.6% + $3.00 MXN"
              note="Tarjetas emitidas en Mexico"
            />
            <FeeRow
              label="Tarjeta internacional"
              value="4.5% + $3.00 MXN"
              note="Tarjetas emitidas fuera de Mexico"
            />
            <FeeRow
              label="Apple Pay / Google Pay"
              value="3.6% + $3.00 MXN"
              note="Misma tarifa que tarjeta nacional (se cobra a la tarjeta vinculada)"
            />
            <FeeRow
              label="OXXO"
              value="$10.00 MXN"
              note="Tarifa fija por transaccion"
            />
            <FeeRow
              label="Contracargo (si pierdes la disputa)"
              value="$150.00 MXN"
              note="Tarifa de Stripe por disputa perdida, adicional al monto devuelto"
            />
          </div>

          <WarningBox>
            Estas tarifas son las publicadas por Stripe para Mexico al momento de
            esta guia. Pueden cambiar. Consulta siempre{" "}
            <strong>stripe.com/mx/pricing</strong> para la informacion mas
            actualizada.
          </WarningBox>

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
              Comision de tusalud.pro
            </p>
            <div className="p-3 bg-green-50 rounded-lg border border-green-200">
              <p className="text-sm font-semibold text-green-700">
                $0 — Sin comision
              </p>
              <p className="text-xs text-green-600 mt-0.5">
                tusalud.pro no cobra ninguna comision por los pagos que recibas.
                El unico costo es la comision de Stripe.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
              Ejemplo practico
            </p>
            <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 text-sm text-gray-700 space-y-1">
              <p>
                Cobras una consulta de <strong>$1,000 MXN</strong> con tarjeta
                nacional:
              </p>
              <ul className="list-disc list-inside text-xs text-gray-600 space-y-0.5 ml-1">
                <li>Comision de Stripe: $1,000 x 3.6% + $3 = $39.00 MXN</li>
                <li>
                  <strong>Tu recibes: $961.00 MXN</strong>
                </li>
              </ul>
              <p className="text-xs text-gray-500 mt-1">
                Si el pago es por OXXO ($1,000 MXN), Stripe cobra $10 fijos.
                Recibes $990.00 MXN.
              </p>
            </div>
          </div>

          <InfoBox>
            Al emitir un reembolso, Stripe <strong>no te devuelve la comision</strong> del pago
            original. Por ejemplo, si cobras $1,000 y luego reembolsas, pierdes los $39 de comision.
          </InfoBox>
        </div>
      </SectionAccordion>

      {/* 11. Reembolsos y disputas */}
      <SectionAccordion
        title="Reembolsos y disputas"
        subtitle="Que pasa si un paciente pide devolucion o reclama un cargo"
        icon={AlertTriangle}
        accentColor="amber"
      >
        <div className="space-y-3 text-sm text-gray-600 leading-relaxed">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
              Reembolsos
            </p>
            <p>
              Si necesitas devolver el dinero a un paciente, puedes hacerlo desde
              tu panel de Stripe (&ldquo;Mi Stripe&rdquo;). El reembolso se procesa a la misma
              tarjeta o metodo de pago que uso el paciente.
            </p>
            <ul className="list-disc list-inside text-xs text-gray-500 space-y-0.5 ml-1">
              <li>Los reembolsos con tarjeta tardan 5-10 dias habiles en aparecer en el estado de cuenta del paciente</li>
              <li>Puedes hacer reembolsos parciales (devolver solo una parte del monto)</li>
              <li>
                Los pagos por OXXO <strong>no se pueden reembolsar</strong>{" "}
                por Stripe — tendrias que devolver el dinero por otro medio
                (transferencia bancaria, efectivo)
              </li>
              <li>
                Stripe no te devuelve la comision original al hacer un reembolso
              </li>
              <li>
                El reembolso sale de tu saldo de Stripe. Si ya se deposito en tu banco, Stripe
                puede debitar el monto de tu cuenta bancaria
              </li>
            </ul>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
              Disputas (contracargos)
            </p>
            <p>
              Un contracargo ocurre cuando el paciente reclama el cobro
              directamente con su banco. Esto puede pasar si:
            </p>
            <ul className="list-disc list-inside text-xs text-gray-500 space-y-0.5 ml-1">
              <li>El paciente no reconoce el cargo en su estado de cuenta</li>
              <li>Alega que no recibio el servicio</li>
              <li>
                Fue un uso no autorizado de la tarjeta
              </li>
            </ul>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
              Que pasa cuando hay una disputa
            </p>
            <div className="space-y-1">
              <WorkflowStep number={1} title="Recibes notificacion" icon={Bell}>
                Te llega una alerta por Telegram con el monto y razon de la disputa.
                Stripe congela el monto disputado.
              </WorkflowStep>
              <WorkflowStep number={2} title="Presentas evidencia" icon={FileText}>
                Entra a tu panel de Stripe y sube evidencia: recibos, notas de consulta,
                comunicaciones con el paciente, comprobante de que el servicio fue prestado.
                Tienes entre 7 y 21 dias segun la red de la tarjeta.
              </WorkflowStep>
              <WorkflowStep number={3} title="Resolucion" icon={Shield}>
                El banco del paciente decide. Si <strong>ganas</strong>, el dinero regresa a tu cuenta.
                Si <strong>pierdes</strong>, el dinero se devuelve al paciente y Stripe cobra una tarifa
                de $150 MXN.
              </WorkflowStep>
            </div>
          </div>

          <WarningBox>
            Los contracargos son tu responsabilidad como titular de la cuenta de Stripe,
            no de tusalud.pro. La mejor prevencion es mantener buena comunicacion con
            tus pacientes y documentar las consultas realizadas.
            Los pagos por OXXO no pueden tener contracargos (son pagos en efectivo).
          </WarningBox>
        </div>
      </SectionAccordion>

      {/* 12. Pagos con OXXO */}
      <SectionAccordion
        title="Pagos con OXXO"
        subtitle="Como funcionan, tiempos y limitaciones"
        icon={Store}
        accentColor="green"
      >
        <div className="space-y-3 text-sm text-gray-600 leading-relaxed">
          <p>
            OXXO permite a tus pacientes pagar en efectivo en cualquier tienda
            OXXO de Mexico. Es ideal para pacientes que no tienen tarjeta o
            prefieren pagar en efectivo.
          </p>

          <div className="space-y-1">
            <WorkflowStep number={1} title="Paciente elige OXXO" icon={Store}>
              Al abrir el link de pago, el paciente selecciona OXXO como metodo
              de pago.
            </WorkflowStep>
            <WorkflowStep
              number={2}
              title="Se genera un voucher"
              icon={FileText}
            >
              Stripe genera un voucher con un codigo de barras y un numero de
              referencia. El paciente puede imprimirlo o mostrarlo desde su
              celular.
            </WorkflowStep>
            <WorkflowStep number={3} title="Pago en tienda" icon={Banknote}>
              El paciente va a cualquier OXXO y paga mostrando el voucher. Tiene{" "}
              <strong>72 horas</strong> para hacerlo. El monto debe ser exacto (OXXO
              no acepta pagos parciales).
            </WorkflowStep>
            <WorkflowStep
              number={4}
              title="Confirmacion"
              icon={Clock}
              tip="La confirmacion de OXXO llega al siguiente dia habil (lunes a viernes, excluyendo dias festivos). Si el paciente paga un viernes, la confirmacion puede llegar hasta el lunes."
            >
              Una vez que el paciente paga, Stripe confirma el pago y el status
              del link cambia a &ldquo;Pagado&rdquo;. Si no paga en 72 horas, el
              link cambia a &ldquo;Expirado&rdquo;.
            </WorkflowStep>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
              Limitaciones de OXXO
            </p>
            <ul className="list-disc list-inside text-xs text-gray-500 space-y-0.5 ml-1">
              <li>Monto maximo por pago: <strong>$10,000 MXN</strong></li>
              <li>No se pueden hacer reembolsos automaticos (tendrias que devolver por transferencia o efectivo)</li>
              <li>No hay contracargos (es pago en efectivo, ventaja para ti)</li>
              <li>El paciente debe pagar el monto exacto</li>
              <li>La confirmacion no es inmediata (siguiente dia habil)</li>
            </ul>
          </div>

          <WarningBox>
            Si tienes una cita programada para el dia siguiente, considera pedirle al paciente
            que pague con tarjeta, ya que la confirmacion de OXXO puede no llegar a tiempo.
          </WarningBox>
        </div>
      </SectionAccordion>

      {/* 13. Facturas (CFDI) */}
      <SectionAccordion
        title="Facturas (CFDI) y obligaciones fiscales"
        subtitle="Quien emite factura, que es responsabilidad de Stripe, y que es tuya"
        icon={Receipt}
        accentColor="amber"
      >
        <div className="space-y-3 text-sm text-gray-600 leading-relaxed">
          <WarningBox>
            Stripe <strong>no emite facturas fiscales (CFDI)</strong> a tus
            pacientes. Los recibos que Stripe genera son comprobantes de pago,
            pero <strong>no son CFDI validos ante el SAT</strong>.
          </WarningBox>

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
              Responsabilidades claras
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-xs border border-gray-200 rounded-lg overflow-hidden">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-left px-3 py-2 font-semibold text-gray-700">
                      Concepto
                    </th>
                    <th className="text-left px-3 py-2 font-semibold text-gray-700">
                      Responsable
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  <tr>
                    <td className="px-3 py-2 text-gray-600">
                      Emitir CFDI al paciente por la consulta
                    </td>
                    <td className="px-3 py-2 font-medium text-gray-900">
                      Tu (el doctor)
                    </td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 text-gray-600">
                      Declarar los ingresos ante el SAT
                    </td>
                    <td className="px-3 py-2 font-medium text-gray-900">
                      Tu (el doctor)
                    </td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 text-gray-600">
                      Factura por comisiones cobradas
                    </td>
                    <td className="px-3 py-2 font-medium text-gray-900">
                      Stripe te factura a ti
                    </td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 text-gray-600">
                      Recibo de pago al paciente
                    </td>
                    <td className="px-3 py-2 font-medium text-gray-900">
                      Stripe (automatico, no es CFDI)
                    </td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 text-gray-600">
                      Retencion de impuestos
                    </td>
                    <td className="px-3 py-2 font-medium text-gray-900">
                      Tu contador
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
              Que hace tusalud.pro
            </p>
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-xs text-blue-800">
                <strong>tusalud.pro no es parte de la relacion fiscal.</strong>{" "}
                No emitimos facturas por tus consultas, no retenemos impuestos, y
                no reportamos tus ingresos al SAT. La relacion de cobro es
                directa entre tu y tu paciente a traves de Stripe.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
              Recomendaciones
            </p>
            <ul className="list-disc list-inside space-y-1 text-xs text-gray-500 ml-1">
              <li>
                Emite tu CFDI por separado usando tu sistema de facturacion
                habitual (tu PAC). El monto del CFDI debe ser el total cobrado
                al paciente, no lo que tu recibes despues de comisiones.
              </li>
              <li>
                Si el paciente necesita deducir la consulta como gasto medico,
                necesitara tu CFDI, no el recibo de Stripe.
              </li>
              <li>
                Stripe te emitira factura por las comisiones que te cobra.
                Puedes descargarla desde tu panel de Stripe Express. Esta
                comision es deducible.
              </li>
              <li>
                Consulta con tu contador sobre el regimen fiscal adecuado y las
                obligaciones de IVA aplicables a servicios medicos.
              </li>
            </ul>
          </div>
        </div>
      </SectionAccordion>

      {/* Stripe vs MP comparison */}
      <SectionAccordion
        title="Stripe vs Mercado Pago: cual elegir?"
        subtitle="Comparacion rapida para ayudarte a decidir"
        icon={CreditCard}
        accentColor="indigo"
      >
        <div className="space-y-3 text-sm text-gray-600 leading-relaxed">
          <div className="overflow-x-auto">
            <table className="w-full text-xs border border-gray-200 rounded-lg overflow-hidden">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left px-3 py-2 font-semibold text-gray-700">Caracteristica</th>
                  <th className="text-left px-3 py-2 font-semibold text-purple-700">Stripe</th>
                  <th className="text-left px-3 py-2 font-semibold text-sky-700">Mercado Pago</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                <tr>
                  <td className="px-3 py-2 text-gray-600">Tarjetas</td>
                  <td className="px-3 py-2 text-gray-900">Si</td>
                  <td className="px-3 py-2 text-gray-900">Si</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 text-gray-600">OXXO</td>
                  <td className="px-3 py-2 text-gray-900">Si</td>
                  <td className="px-3 py-2 text-gray-900">Si</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 text-gray-600">Transferencia (SPEI)</td>
                  <td className="px-3 py-2 text-red-600">No</td>
                  <td className="px-3 py-2 text-green-600 font-medium">Si</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 text-gray-600">Meses sin intereses</td>
                  <td className="px-3 py-2 text-red-600">No</td>
                  <td className="px-3 py-2 text-green-600 font-medium">Si (Mercado Credito)</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 text-gray-600">Apple Pay / Google Pay</td>
                  <td className="px-3 py-2 text-green-600 font-medium">Si</td>
                  <td className="px-3 py-2 text-red-600">No</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 text-gray-600">Panel de administracion</td>
                  <td className="px-3 py-2 text-green-600 font-medium">Completo (Express)</td>
                  <td className="px-3 py-2 text-gray-900">App de MP</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 text-gray-600">Depositos automaticos</td>
                  <td className="px-3 py-2 text-green-600 font-medium">Si (2 dias habiles)</td>
                  <td className="px-3 py-2 text-gray-900">Retiro manual desde app</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 text-gray-600">Comision tarjeta nacional</td>
                  <td className="px-3 py-2 text-gray-900">3.6% + $3</td>
                  <td className="px-3 py-2 text-gray-900">~3.49% + IVA</td>
                </tr>
              </tbody>
            </table>
          </div>

          <InfoBox>
            <strong>Puedes conectar ambos proveedores al mismo tiempo.</strong>{" "}
            Usa Stripe para pacientes que prefieren Apple Pay o depositos automaticos,
            y Mercado Pago para pacientes que prefieren SPEI o meses sin intereses.
          </InfoBox>
        </div>
      </SectionAccordion>

      {/* 14. Preguntas frecuentes */}
      <SectionAccordion
        title="Preguntas frecuentes"
        subtitle="Dudas comunes sobre el sistema de pagos"
        icon={HelpCircle}
        accentColor="gray"
      >
        <div className="space-y-4">
          <FAQ
            q="Puedo cobrar en dolares o en otra moneda?"
            a="No. Los links de pago se generan en pesos mexicanos (MXN). Si tu paciente paga con tarjeta internacional, su banco hara la conversion automaticamente."
          />
          <FAQ
            q="Hay un monto minimo o maximo?"
            a="El monto minimo es $10 MXN (requerido por Stripe Mexico) y el maximo es $100,000 MXN por link de pago. Para pagos por OXXO, el maximo es $10,000 MXN."
          />
          <FAQ
            q="Puedo crear varios links para el mismo paciente?"
            a="Si. Cada link es independiente. Puedes crear uno por consulta, por tratamiento, o como prefieras. No hay limite de links."
          />
          <FAQ
            q="Que pasa si mi paciente paga dos veces el mismo link?"
            a="No es posible. Cada link de pago solo acepta un pago. Una vez completado, el link se desactiva automaticamente."
          />
          <FAQ
            q="Puedo desactivar un link despues de enviarlo?"
            a="Si. Haz clic en el icono de cancelar (X) junto al link. El paciente vera un mensaje de que el link ya no es valido."
          />
          <FAQ
            q="Que pasa si cierro mi cuenta de Stripe?"
            a="Puedes cerrar tu cuenta desde tu panel de Stripe Express. Los pagos pendientes se depositaran antes del cierre. Los links de pago activos dejaran de funcionar. Si quieres volver a cobrar, tendras que crear una nueva cuenta."
          />
          <FAQ
            q="tusalud.pro puede ver mis datos bancarios o mis pagos?"
            a="No. tusalud.pro solo sabe si tu cuenta de Stripe esta activa y el estado de los links de pago (pendiente/pagado). No tenemos acceso a tu cuenta bancaria, tu saldo, tus depositos, ni tus datos fiscales."
          />
          <FAQ
            q="Necesito hacer algo para los impuestos?"
            a="Si. Los ingresos por pagos con Stripe son ingresos como cualquier otro. Debes declararlos ante el SAT y emitir CFDI a tus pacientes si te lo solicitan. Consulta con tu contador."
          />
          <FAQ
            q="Stripe me cobra por tener la cuenta abierta?"
            a="No. No hay costos mensuales ni de apertura. Solo pagas comision cuando recibes un pago."
          />
          <FAQ
            q="Que pasa si la tarjeta de mi paciente es rechazada?"
            a="El paciente vera un mensaje indicando que su tarjeta fue rechazada. Las razones mas comunes son: fondos insuficientes, tarjeta vencida, CVV incorrecto, o el banco rechazo la transaccion. El paciente puede intentar con otra tarjeta, usar Apple/Google Pay, o pagar en OXXO. El link sigue activo."
          />
          <FAQ
            q="Que pasa si mi paciente necesita autenticacion 3D Secure?"
            a="Algunos bancos requieren una verificacion adicional (3D Secure) por seguridad. Stripe maneja esto automaticamente: el paciente vera una pantalla de su banco para confirmar el pago con un codigo SMS o su app bancaria. No necesitas hacer nada."
          />
          <FAQ
            q="Mis pacientes pueden pagar con Apple Pay o Google Pay?"
            a="Si. Apple Pay aparece automaticamente en dispositivos Apple (iPhone, iPad, Mac) y Google Pay en dispositivos Android. El paciente paga con Face ID, Touch ID o huella digital. La comision es la misma que con tarjeta."
          />
          <FAQ
            q="Mis pacientes pueden pagar con transferencia bancaria (SPEI)?"
            a="Con Stripe no. Pero si conectas Mercado Pago, tus pacientes si pueden pagar por transferencia bancaria (SPEI). Es una de las ventajas principales de Mercado Pago."
          />
          <FAQ
            q="Mis pacientes pueden pagar con meses sin intereses?"
            a="Actualmente no. Esta funcionalidad podria estar disponible en el futuro."
          />
          <FAQ
            q="Que hago si mi cuenta de Stripe se deshabilita?"
            a="En tu pagina de Pagos veras una alerta con el motivo. Generalmente debes actualizar algun documento o dato. Haz clic en 'Actualizar datos en Stripe' para resolverlo. Si es un rechazo permanente, puedes intentar crear una nueva cuenta."
          />
          <FAQ
            q="Como cambio mi cuenta bancaria?"
            a="Entra a tu panel de Stripe haciendo clic en 'Mi Stripe' en la pagina de Pagos. Desde ahi puedes actualizar tu CLABE bancaria en cualquier momento."
          />
          <FAQ
            q="Que pasa si un deposito a mi banco falla?"
            a="Recibiras una notificacion por Telegram. El dinero queda en tu saldo de Stripe. Entra a tu panel de Stripe, actualiza tu cuenta bancaria, y Stripe reintentara el deposito."
          />
          <FAQ
            q="Cuanto tarda en llegar el dinero a mi banco?"
            a="Con Stripe: el primer deposito puede tardar ~7 dias, despues son automaticos cada 2 dias habiles. Con Mercado Pago: el dinero llega a tu cuenta de MP inmediatamente y puedes retirarlo a tu banco desde la app (tarda 1-2 dias habiles)."
          />

          {/* MP-specific FAQs */}
          <div className="border-t border-gray-200 pt-3 mt-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-sky-500 mb-3">Mercado Pago</p>
          </div>
          <FAQ
            q="Necesito una cuenta de Mercado Pago para conectar?"
            a="Si. Necesitas una cuenta de Mercado Pago verificada (con RFC y cuenta bancaria). Si no tienes una, puedes crearla gratis en mercadopago.com.mx."
          />
          <FAQ
            q="Puedo tener Stripe y Mercado Pago conectados al mismo tiempo?"
            a="Si. Puedes tener ambos proveedores activos y usar el que prefieras para cada paciente. En la seccion de Pagos puedes expandir cualquiera de los dos."
          />
          <FAQ
            q="Que pasa si mi conexion de Mercado Pago expira?"
            a="La conexion se renueva automaticamente cada 6 meses. Si la renovacion falla, recibiras una notificacion por Telegram y deberas reconectar desde la seccion de Pagos. Tus links pendientes dejaran de funcionar hasta que reconectes."
          />
          <FAQ
            q="Puedo desconectar Mercado Pago sin afectar Stripe?"
            a="Si. Cada proveedor es independiente. Desconectar uno no afecta al otro."
          />
          <FAQ
            q="Mis pacientes pueden pagar con meses sin intereses en Mercado Pago?"
            a="Si, a traves de Mercado Credito. Mercado Pago ofrece financiamiento al paciente. Tu recibes el monto completo de inmediato, y el paciente le paga a Mercado Pago en cuotas."
          />
          <FAQ
            q="Donde veo mis pagos de Mercado Pago?"
            a="En la seccion de Pagos de tusalud.pro veras tus links de pago y su estado. Para ver tu saldo, retiros y detalles de comisiones, usa la app de Mercado Pago directamente."
          />
        </div>
      </SectionAccordion>
    </div>
  );
}

function PanelFeature({ icon: Icon, label, description }: { icon: LucideIcon; label: string; description: string }) {
  return (
    <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
      <div className="flex items-center gap-2 mb-0.5">
        <Icon className="w-3.5 h-3.5 text-gray-500" />
        <p className="text-xs font-semibold text-gray-700">{label}</p>
      </div>
      <p className="text-xs text-gray-500">{description}</p>
    </div>
  );
}

function NotificationRow({ emoji, title, description }: { emoji: string; title: string; description: string }) {
  return (
    <div className="flex items-start gap-3 py-2 px-3 bg-gray-50 rounded-lg">
      <span className="text-base mt-0.5">{emoji}</span>
      <div>
        <p className="text-sm font-medium text-gray-900">{title}</p>
        <p className="text-xs text-gray-500 mt-0.5">{description}</p>
      </div>
    </div>
  );
}

function PaymentMethodCard({
  icon: Icon,
  title,
  description,
  speed,
  limit,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  speed: string;
  limit: string;
}) {
  return (
    <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
      <div className="flex items-center gap-2 mb-1">
        <Icon className="w-4 h-4 text-indigo-500" />
        <p className="text-sm font-semibold text-gray-700">{title}</p>
      </div>
      <p className="text-xs text-gray-500 mb-2">{description}</p>
      <div className="flex gap-4">
        <span className="text-xs text-gray-400">
          Velocidad: <span className="text-gray-600 font-medium">{speed}</span>
        </span>
        <span className="text-xs text-gray-400">
          Limite: <span className="text-gray-600 font-medium">{limit}</span>
        </span>
      </div>
    </div>
  );
}

function FAQ({ q, a }: { q: string; a: string }) {
  return (
    <div className="border-b border-gray-100 pb-3 last:border-0 last:pb-0">
      <p className="text-sm font-medium text-gray-900">{q}</p>
      <p className="text-xs text-gray-600 mt-1 leading-relaxed">{a}</p>
    </div>
  );
}
