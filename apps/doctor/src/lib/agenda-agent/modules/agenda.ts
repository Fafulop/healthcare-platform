/**
 * AGENDA module — the original agent (PR 1–3) packaged as a domain module.
 *
 * Tools and executors live unchanged in ../tools (reads) and ../proposals
 * (propose_*); this file only wires them into the module contract and OWNS the
 * agenda-specific prompt sections (moved verbatim from run-turn.ts in the
 * module refactor — byte-identical, verified by hash against the pre-refactor
 * prompt).
 */

import { AGENT_TOOLS, executeTool } from '../tools';
import { PROPOSAL_TOOLS, executeProposalTool } from '../proposals';
import type { AgentModule } from './types';

const AGENDA_DOMAIN_MODEL = `## Cómo funciona la agenda (invariantes — razona SIEMPRE con este modelo)
- Las citas son registros **independientes**: eliminar rangos o crear bloqueos NUNCA las afecta —
  siguen agendadas tal cual. Rangos y bloqueos solo controlan qué horarios se **ofrecen** para
  citas nuevas. (Como protección, el SERVIDOR rechaza AL EJECUTAR el borrado de un rango con
  citas activas dentro — no porque las afecte, sino para que el doctor lo revise. Ese veredicto
  no es tuyo: tú propones igual, transmites la advertencia y el doctor decide en la tarjeta.)
- Los bloqueos son una capa encima del horario: bloquear no cancela ni mueve nada; desbloquear
  restaura todo. Es la única acción de agenda 100% reversible.
- Estados de cita: PENDIENTE → CONFIRMADA → (COMPLETADA | NO ASISTIÓ | CANCELADA). Los tres
  últimos son **finales** — no hay vuelta atrás, el camino es siempre una cita nueva. PENDIENTE
  no puede completarse directo: primero se confirma.
- Todo lo que toca a un paciente (crear/confirmar/cancelar cita, re-enviar confirmación)
  **notifica** por SMS/email/Google Calendar y eso no se puede des-enviar. Crear/borrar rangos y
  bloqueos no notifica a nadie.
- Una cita puede ocupar más tiempo del que dice (bloque extendido, buffer del doctor) — ver
  regla 2 sobre disponibilidad.
- Google Calendar solo sincroniza CITAS (crear/confirmar/cancelar una cita crea/actualiza/borra
  su evento). Los rangos y bloqueos NO se reflejan en Google Calendar.`;

/**
 * ⚠️ La regla de COMPLETAR describe la frontera de la facturación SIN nombrar el
 * EXPEDIENTE a propósito (plan 07, punto A). El CFDI también se emite desde ahí,
 * pero `expediente: ['expedientes']` y `facturas: ['facturacion','sat']` son keys
 * INDEPENDIENTES: un member puede tener facturación y NO el expediente, y esta
 * prosa la reciben los dos (agenda solo depende de `facturacion`). Nombrarlo
 * mandaba a 12 de los 66 scopes alcanzables a una sección que no tienen —
 * familia de las bitácoras #26/#27. `prosaDependsOn` + una sola variante no puede
 * expresar las dos condiciones, así que la prosa se queda en la frontera y el
 * destino no se menciona. `gate:prosa` ya reconoce "expediente" como sección: si
 * alguien lo vuelve a nombrar aquí, truena en vez de pasar en silencio.
 */
const AGENDA_CITAS_RULES = `## Citas — reglas especiales (notifican al paciente)
- **Solo a petición explícita del doctor EN ESTE hilo.** "Límpiame el martes" o "libera esa hora"
  NO autoriza cancelar citas — clarifica primero qué quiere hacer con cada cita afectada. Una
  cancelación confirmada por error ya notificó al paciente y no se deshace.
- **El horario de una cita nueva sale de get_availability de ESTE turno** — nunca de memoria ni
  de turnos anteriores. Si el horario pedido no está libre, el servidor te da los horarios libres
  del día: ofrécelos. **EXCEPCIÓN (reagendar):** si el hueco destino solo lo ocupa la MISMA cita
  que vas a mover (o una que un paso anterior de este plan cancela), propón directo
  propose_reschedule_booking — el servidor descuenta esa cita al validar. No descartes un horario
  solo porque get_availability no lo muestre sin revisar QUÉ lo ocupa.
- **PENDIENTE no se completa ni se marca no-asistió directo**: propone confirmar y luego
  completar/no-asistió como DOS pasos del mismo plan (en ese orden) y avisa que confirmar notifica.
- **Reagendar es UNA acción** (propose_reschedule_booking — el sistema cancela y crea por ti).
  Nunca propongas cancelar y crear como pasos sueltos para mover una cita, salvo que el doctor lo
  pida así explícitamente.
- **Paciente conocido**: find_patient PRIMERO (te da patientId y contacto — la cita queda
  vinculada al expediente). **Walk-in**: pide al doctor los datos de contacto requeridos — NUNCA
  inventes email/teléfono.
- **Citas vencidas**: los cierres honestos son COMPLETADA (la consulta ocurrió — registra el
  ingreso) o NO ASISTIÓ. Cancelar una vencida manda al paciente un email de cancelación de una
  cita YA pasada — adviértelo SIEMPRE antes. Una PENDIENTE vencida no tiene salida sin notificar
  (no puede ir a no-asistió; confirmarla primero también notifica): explica las opciones y que el
  doctor decida informado.
- **Completar**: necesitas la forma de pago (efectivo/transferencia/tarjeta/cheque/depósito) —
  SALVO que el ingreso ya exista (p. ej. cita pagada con link de pago): el tool lo detecta solo,
  así que si no sabes la forma de pago llama al tool primero con solo el bookingId y pregunta
  únicamente si el tool te lo pide. El precio default es el de la cita. El ingreso se registra
  en Flujo de Dinero automáticamente (sin duplicarlo si ya existía); la factura (CFDI) NO se
  emite aquí: al completar la cita desde la tabla el doctor puede emitirla en el mismo paso, pero
  solo si el paciente ya tiene datos fiscales COMPLETOS. Si la cita ya estaba completada, ese paso
  ya pasó y desde la tabla no se puede. Sin datos fiscales completos no se emite por ningún
  camino: lo primero es el formulario fiscal. Dilo si el doctor la menciona.
- **Lotes grandes**: máximo 10 propuestas por turno. Si el trabajo excede el cap, propone las
  primeras 10 y DI explícitamente cuántas quedan para el siguiente turno — nunca omitas en
  silencio.`;

/**
 * TIERS T3 — same rules, minus the invoicing boundary. The full text above tells
 * the model the doctor CAN emit the CFDI when completing a cita AND to volunteer
 * it ("dilo si el doctor la menciona"); on a plan without Facturación that both
 * names a feature the account lacks and directly contradicts the plan-scope note
 * in prompt.ts. No tier trims agenda's TOOLS, so this variant is reachable only
 * through `prosaDependsOn` (types.ts).
 */
const AGENDA_CITAS_RULES_SIN_FACTURACION = AGENDA_CITAS_RULES.replace(
  'El ingreso se registra\n  en Flujo de Dinero automáticamente (sin duplicarlo si ya existía); la factura (CFDI) NO se\n  emite aquí: al completar la cita desde la tabla el doctor puede emitirla en el mismo paso, pero\n  solo si el paciente ya tiene datos fiscales COMPLETOS. Si la cita ya estaba completada, ese paso\n  ya pasó y desde la tabla no se puede. Sin datos fiscales completos no se emite por ningún\n  camino: lo primero es el formulario fiscal. Dilo si el doctor la menciona.',
  'El ingreso se registra\n  en Flujo de Dinero automáticamente (sin duplicarlo si ya existía). En esta cuenta NO tienes\n  facturación disponible: no ofrezcas emitir la factura ni mandes al doctor a otra sección a\n  hacerlo; si la menciona, dilo directo.'
);

export const agendaModule: AgentModule = {
  name: 'agenda',
  readTools: AGENT_TOOLS,
  proposalTools: PROPOSAL_TOOLS,
  executeRead: executeTool,
  executeProposal: executeProposalTool,
  prompt: {
    domainModel: AGENDA_DOMAIN_MODEL,
    domainRules: AGENDA_CITAS_RULES,
    prosaDependsOn: ['facturacion'],
    partial: {
      // domainModel is reused by REFERENCE (it says nothing about invoicing) —
      // copying it would be a drift source for zero benefit.
      domainModel: AGENDA_DOMAIN_MODEL,
      domainRules: AGENDA_CITAS_RULES_SIN_FACTURACION,
    },
  },
};
