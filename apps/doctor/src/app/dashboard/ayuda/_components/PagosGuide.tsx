"use client";

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
} from "lucide-react";
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
      {/* 1. Que es y como funciona */}
      <SectionAccordion
        title="Que es Stripe y como funciona en tu cuenta"
        subtitle="Resumen general del sistema de pagos"
        icon={CreditCard}
        accentColor="blue"
        defaultOpen
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
            sobre eventos importantes de tus pagos:
          </p>

          <div className="space-y-2">
            <NotificationRow
              emoji="💰"
              title="Pago recibido"
              description="Cuando un paciente paga un link de pago (tarjeta o OXXO). Incluye monto y concepto."
            />
            <NotificationRow
              emoji="🚨"
              title="Disputa de pago"
              description="Si un paciente reclama un cargo con su banco. Incluye monto y razon. Debes responder desde tu panel de Stripe."
            />
            <NotificationRow
              emoji="✅"
              title="Disputa resuelta"
              description="Cuando una disputa se resuelve (a tu favor o en contra). Incluye el resultado."
            />
            <NotificationRow
              emoji="🏦"
              title="Deposito bancario fallido"
              description="Si Stripe no puede depositar en tu cuenta. Debes actualizar tus datos bancarios desde tu panel de Stripe."
            />
            <NotificationRow
              emoji="⚠️"
              title="Alerta de cuenta"
              description="Si tu cuenta de Stripe es restringida, deshabilitada o necesita informacion adicional."
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
            a="No. Stripe no permite transferencias bancarias (SPEI) en links de pago. Tus pacientes pueden pagar con tarjeta de credito/debito, Apple Pay, Google Pay, o en efectivo en OXXO. Si un paciente necesita pagar por transferencia, tendrias que darle tus datos bancarios directamente fuera de la plataforma."
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
            a="El primer deposito puede tardar ~7 dias. Despues, los depositos son automaticos cada 2 dias habiles. Puedes cambiar la frecuencia desde tu panel de Stripe (diario, semanal o mensual)."
          />
        </div>
      </SectionAccordion>
    </div>
  );
}

function PanelFeature({ icon: Icon, label, description }: { icon: typeof Banknote; label: string; description: string }) {
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
  icon: typeof CreditCard;
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
