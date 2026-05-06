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
            a tus pacientes con tarjeta de credito, tarjeta de debito y pagos en
            OXXO. Al activar Stripe, se crea una{" "}
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
              tarjeta o genera un voucher de OXXO.
            </li>
            <li>
              Stripe deposita el dinero en tu cuenta bancaria segun el calendario
              de pagos.
            </li>
          </ol>
        </div>
      </SectionAccordion>

      {/* 2. Activar cobros — paso a paso */}
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
                Los datos de la cuenta bancaria donde quieres recibir depositos
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

      {/* 3. Crear y compartir links de pago */}
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
            Llena el monto en pesos mexicanos (MXN) y opcionalmente una
            descripcion (ej: &ldquo;Consulta dermatologica&rdquo;,
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
                <strong>OXXO:</strong> se genera un voucher con codigo de
                barras. El paciente tiene 72 horas para pagar en cualquier OXXO.
                El link se actualiza automaticamente cuando Stripe confirma el
                pago.
              </li>
            </ul>
          </WorkflowStep>
        </div>

        <InfoBox>
          Cada link de pago es de un solo uso. Si un paciente necesita pagar otra
          vez, crea un link nuevo. Puedes crear los links que necesites sin
          limite.
        </InfoBox>
      </SectionAccordion>

      {/* 4. Estados de un link de pago */}
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
                El link fue creado pero el paciente aun no ha pagado.
              </p>
            </div>
            <div className="p-3 bg-green-50 rounded-lg border border-green-200">
              <p className="text-sm font-semibold text-green-700">Pagado</p>
              <p className="text-xs text-green-600 mt-0.5">
                El paciente pago exitosamente con tarjeta o en OXXO.
              </p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-sm font-semibold text-gray-600">Expirado</p>
              <p className="text-xs text-gray-500 mt-0.5">
                El paciente genero un voucher OXXO pero no pago en 72 horas.
              </p>
            </div>
            <div className="p-3 bg-red-50 rounded-lg border border-red-200">
              <p className="text-sm font-semibold text-red-600">Cancelado</p>
              <p className="text-xs text-red-500 mt-0.5">
                Tu desactivaste el link manualmente.
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

      {/* 5. Comisiones de Stripe */}
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
              label="OXXO"
              value="$10.00 MXN"
              note="Tarifa fija por transaccion"
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
        </div>
      </SectionAccordion>

      {/* 6. Depositos y cuenta bancaria */}
      <SectionAccordion
        title="Depositos y cuenta bancaria"
        subtitle="Cuando llega el dinero y como administrar tu cuenta"
        icon={Banknote}
        accentColor="green"
      >
        <div className="space-y-3 text-sm text-gray-600 leading-relaxed">
          <p>
            Stripe deposita el dinero automaticamente en la cuenta bancaria que
            registraste durante el onboarding. Los depositos siguen un calendario
            automatico.
          </p>

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
              Tiempos de deposito
            </p>
            <FeeRow
              label="Primer deposito"
              value="7 dias"
              note="Stripe retiene los fondos los primeros dias mientras verifica tu cuenta"
            />
            <FeeRow
              label="Depositos siguientes"
              value="2 dias habiles"
              note="Despues del periodo inicial, los depositos son automaticos"
            />
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
              Tu panel de Stripe Express
            </p>
            <p>
              Ademas de ver tus links de pago aqui en tusalud.pro, puedes
              acceder a tu <strong>Dashboard de Stripe Express</strong> para:
            </p>
            <ul className="list-disc list-inside space-y-0.5 text-xs text-gray-500 ml-1">
              <li>Ver tu saldo disponible y historial de depositos</li>
              <li>Cambiar tu cuenta bancaria</li>
              <li>Configurar la frecuencia de depositos (diario, semanal, mensual)</li>
              <li>Ver detalle de cada pago recibido</li>
              <li>Gestionar reembolsos y disputas</li>
            </ul>
            <InfoBox>
              Para acceder, entra a{" "}
              <strong>connect.stripe.com/express_login</strong> con el correo
              que usaste al crear tu cuenta. Stripe te enviara un codigo de
              verificacion por SMS o correo.
            </InfoBox>
          </div>
        </div>
      </SectionAccordion>

      {/* 7. Facturas (CFDI) */}
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
                Puedes descargarla desde tu Dashboard de Stripe Express. Esta
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

      {/* 8. Reembolsos y disputas */}
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
              tu Dashboard de Stripe Express. El reembolso se procesa a la misma
              tarjeta o metodo de pago que uso el paciente.
            </p>
            <ul className="list-disc list-inside text-xs text-gray-500 space-y-0.5 ml-1">
              <li>Los reembolsos con tarjeta tardan 5-10 dias habiles</li>
              <li>
                Los pagos por OXXO <strong>no se pueden reembolsar</strong>{" "}
                automaticamente — tendrias que devolver el dinero por otro medio
                (transferencia, efectivo)
              </li>
              <li>
                Stripe no te devuelve la comision original al hacer un reembolso
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
              <li>El paciente no reconoce el cargo</li>
              <li>Alega que no recibio el servicio</li>
              <li>
                Fue un uso no autorizado de la tarjeta
              </li>
            </ul>
            <WarningBox>
              En caso de contracargo, Stripe congela el monto disputado y tu
              tienes la oportunidad de presentar evidencia (recibos, notas de
              consulta, comunicaciones). Si pierdes la disputa, el dinero se
              devuelve al paciente mas una tarifa de $150 MXN que cobra Stripe.
              Como tu eres el titular de la cuenta, los contracargos son tu
              responsabilidad, no de tusalud.pro.
            </WarningBox>
          </div>
        </div>
      </SectionAccordion>

      {/* 9. Pagos con OXXO */}
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
              <strong>72 horas</strong> para hacerlo.
            </WorkflowStep>
            <WorkflowStep
              number={4}
              title="Confirmacion"
              icon={Clock}
              tip="La confirmacion de OXXO puede tardar varias horas despues de que el paciente paga en tienda. Es normal."
            >
              Una vez que el paciente paga, Stripe confirma el pago y el status
              del link cambia a &ldquo;Pagado&rdquo;. Si no paga en 72 horas, el
              link cambia a &ldquo;Expirado&rdquo;.
            </WorkflowStep>
          </div>

          <WarningBox>
            Los pagos por OXXO no se pueden reembolsar automaticamente por
            Stripe. Si necesitas devolver dinero de un pago OXXO, tendras que
            hacer una transferencia bancaria o devolver el efectivo directamente.
          </WarningBox>
        </div>
      </SectionAccordion>

      {/* 10. Preguntas frecuentes */}
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
            a="El monto minimo es $1 MXN y el maximo es $100,000 MXN por link de pago."
          />
          <FAQ
            q="Puedo crear varios links para el mismo paciente?"
            a="Si. Cada link es independiente. Puedes crear uno por consulta, por tratamiento, o como prefieras."
          />
          <FAQ
            q="Que pasa si mi paciente paga dos veces el mismo link?"
            a="Los links de pago de Stripe son de un solo uso. Una vez pagado, el link ya no acepta otro pago."
          />
          <FAQ
            q="Puedo desactivar un link despues de enviarlo?"
            a="Si. Haz clic en el icono de cancelar (X) junto al link. El paciente vera un mensaje de que el link ya no es valido."
          />
          <FAQ
            q="Que pasa si cierro mi cuenta de Stripe?"
            a="Puedes cerrar tu cuenta desde tu Dashboard de Stripe Express. Los pagos pendientes se depositaran antes del cierre. Los links de pago activos dejaran de funcionar."
          />
          <FAQ
            q="tusalud.pro puede ver mis datos bancarios o mis pagos?"
            a="No. tusalud.pro solo sabe si tu cuenta de Stripe esta activa y el estado de los links de pago (pendiente/pagado). No tenemos acceso a tu cuenta bancaria, tu saldo, ni tus datos fiscales."
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
            q="Mis pacientes pueden pagar con meses sin intereses?"
            a="Actualmente no. Esta funcionalidad podria estar disponible en el futuro."
          />
        </div>
      </SectionAccordion>
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
