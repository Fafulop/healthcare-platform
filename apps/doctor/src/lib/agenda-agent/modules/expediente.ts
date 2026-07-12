/**
 * EXPEDIENTE module — F1: READ-ONLY tools over medical-records METADATA
 * (/dashboard/medical-records). Último módulo de "F1 everywhere" (blueprint §4).
 *
 * PRIVACY TIER (decisión de AGENTE FACTURAS 00/02 §7, no re-litigar): el
 * asistente devuelve SOLO metadatos (conteos, fechas, tipos, estatus) y datos
 * administrativos/demográficos. El CONTENIDO clínico — SOAP, chiefComplaint,
 * clinicalNotes, diagnosis, vitales, cuerpos de notas, archivos de media —
 * NUNCA aparece en ningún select de este archivo, con UNA excepción auditada:
 * los 4 campos del baseline (alergias/padecimientos/medicamentos/tipo de
 * sangre) SÍ se seleccionan pero se reducen a booleanos de existencia ANTES
 * de salir — jamás esparcir (`...patient`) ese objeto en la respuesta.
 * DECISIÓN tags: los tags del expediente (p.ej. "epoc", "hipertenso") son
 * etiquetas administrativas del propio doctor, visibles abiertas en su lista
 * de pacientes — se devuelven a sabiendas de que pueden codificar condición
 * (mismo nivel que el nombre del servicio de una cita). Identidad/contacto/
 * fiscal ya viven en find_patient y get_patient_profile — no se duplican.
 */

import { prisma } from '@healthcare/database';
import type { AnthropicTool } from '../anthropic';
import type { ToolContext } from '../tools';
import { mxTodayKey } from '../dates';
import type { AgentModule } from './types';

const PACIENTES_LIST_CAP = 12;
const FOLLOWUPS_CAP = 3;

// -----------------------------------------------------------------------------
// Tool definitions
// -----------------------------------------------------------------------------

const EXPEDIENTE_TOOLS: AnthropicTool[] = [
  {
    name: 'get_expediente_resumen',
    description:
      'Resumen ADMINISTRATIVO de un expediente (SOLO metadatos, nunca contenido clínico): edad/sexo/estatus/tags, primera y última visita, contacto de emergencia, y conteos con fechas de consultas (incl. borradores sin cerrar y seguimientos pendientes), recetas por estatus, documentos/media, notas y formularios pre-consulta. Úsala para "¿cuántas consultas le he hecho a X?", "¿tiene borradores pendientes?", "¿tiene receta reciente?", "¿le toca seguimiento?". El patientId sale de find_patient de ESTE turno. Datos fiscales/contacto = get_patient_profile; dinero = get_billing_status.',
    input_schema: {
      type: 'object',
      properties: {
        patientId: { type: 'string', description: 'ID del expediente (de find_patient)' },
      },
      required: ['patientId'],
    },
  },
  {
    name: 'get_pacientes_overview',
    description:
      'Vista operativa de TODOS los expedientes: totales por estatus (activo/inactivo/archivado), pacientes nuevos, y lista filtrable (hasta 12) por estatus, tag, sin visita en N meses (reactivación) o nuevos en N meses. Úsala para "¿cuántos pacientes activos tengo?", "¿quién no ha vuelto en 6 meses?", "¿pacientes nuevos este mes?", "¿quiénes tienen tag diabético?".',
    input_schema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['active', 'inactive', 'archived'],
          description: 'Filtrar por estatus (opcional)',
        },
        tag: { type: 'string', description: 'Filtrar por tag exacto, p.ej. "diabetic" (opcional)' },
        sinVisitaMeses: {
          type: 'number',
          description: 'Solo pacientes sin CONSULTA registrada en el expediente en los últimos N meses — OJO: mide consultas clínicas, no citas de agenda (opcional)',
        },
        nuevosMeses: {
          type: 'number',
          description: 'Solo pacientes creados en los últimos N meses (opcional)',
        },
      },
    },
  },
];

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

const MX_TZ = 'America/Mexico_City';
const dayOf = (d: Date | null | undefined) =>
  d ? d.toLocaleDateString('en-CA', { timeZone: MX_TZ }) : null;

/** Age in full years from a @db.Date DOB, against MX today. */
function ageFrom(dob: Date): number {
  const today = mxTodayKey(); // YYYY-MM-DD
  const birth = dob.toISOString().slice(0, 10);
  let age = Number(today.slice(0, 4)) - Number(birth.slice(0, 4));
  if (today.slice(5) < birth.slice(5)) age -= 1;
  return age;
}

/** Bounded month count from model input (1..120) or undefined. */
function asMonths(v: unknown): number | undefined {
  const n = typeof v === 'number' ? Math.trunc(v) : NaN;
  return Number.isFinite(n) && n >= 1 && n <= 120 ? n : undefined;
}

/** N months back, day-of-month CLAMPED to the target month's length (a bare
 * setMonth on May 31 - 3 → Mar 2/3, shifting the cutoff — review finding). */
function monthsAgo(months: number): Date {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() - months;
  const lastDayOfTarget = new Date(y, m + 1, 0).getDate();
  return new Date(y, m, Math.min(now.getDate(), lastDayOfTarget));
}

// -----------------------------------------------------------------------------
// get_expediente_resumen — administrative card + clinical METADATA counts.
// Every select in this function is metadata-only by construction (see header).
// -----------------------------------------------------------------------------

async function getExpedienteResumen(ctx: ToolContext, input: { patientId?: string }) {
  const doctorId = ctx.doctorId;
  if (!input.patientId || typeof input.patientId !== 'string') {
    return { error: 'patientId requerido — sale de find_patient de ESTE turno.' };
  }

  const patient = await prisma.patient.findFirst({
    where: { id: input.patientId, doctorId },
    select: {
      id: true,
      internalId: true,
      firstName: true,
      lastName: true,
      dateOfBirth: true,
      sex: true,
      status: true,
      tags: true,
      lastVisitDate: true,
      emergencyContactName: true,
      emergencyContactPhone: true,
      emergencyContactRelation: true,
      // Baseline: EXISTENCE flags only — the texts are clinical content.
      currentAllergies: true,
      currentChronicConditions: true,
      currentMedications: true,
      bloodType: true,
      createdAt: true,
    },
  });
  if (!patient) {
    return { error: 'Expediente no encontrado — usa un patientId de find_patient de ESTE turno.' };
  }

  const pid = patient.id;
  const todayStart = new Date(mxTodayKey() + 'T00:00:00Z');

  const [
    encountersTotal,
    encountersDraft,
    lastEncounter,
    followUps,
    followUpsVencidos,
    recetasByStatus,
    lastReceta,
    mediaTotal,
    lastMedia,
    notasTotal,
    lastNota,
    formsByStatus,
  ] = await Promise.all([
    prisma.clinicalEncounter.count({ where: { patientId: pid, doctorId } }),
    prisma.clinicalEncounter.count({ where: { patientId: pid, doctorId, status: 'draft' } }),
    prisma.clinicalEncounter.findFirst({
      where: { patientId: pid, doctorId },
      select: { encounterDate: true, encounterType: true, status: true },
      orderBy: { encounterDate: 'desc' },
    }),
    prisma.clinicalEncounter.findMany({
      where: { patientId: pid, doctorId, followUpDate: { gte: todayStart } },
      select: { followUpDate: true, encounterDate: true },
      orderBy: { followUpDate: 'asc' },
      take: FOLLOWUPS_CAP,
    }),
    // Overdue follow-ups too — the rules tell the model to flag "seguimientos
    // vencidos"; without this query they'd be invisible (review finding).
    prisma.clinicalEncounter.findMany({
      where: { patientId: pid, doctorId, followUpDate: { lt: todayStart } },
      select: { followUpDate: true, encounterDate: true },
      orderBy: { followUpDate: 'desc' },
      take: FOLLOWUPS_CAP,
    }),
    prisma.prescription.groupBy({
      by: ['status'],
      where: { patientId: pid, doctorId },
      _count: { id: true },
    }),
    prisma.prescription.findFirst({
      where: { patientId: pid, doctorId },
      select: { prescriptionDate: true, status: true },
      orderBy: { prescriptionDate: 'desc' },
    }),
    prisma.patientMedia.count({ where: { patientId: pid, doctorId } }),
    prisma.patientMedia.findFirst({
      where: { patientId: pid, doctorId },
      select: { captureDate: true, mediaType: true },
      orderBy: { captureDate: 'desc' },
    }),
    prisma.patientNote.count({ where: { patientId: pid, doctorId } }),
    prisma.patientNote.findFirst({
      where: { patientId: pid, doctorId },
      select: { updatedAt: true },
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.appointmentFormLink.groupBy({
      by: ['status'],
      where: { patientId: pid, doctorId },
      _count: { id: true },
    }),
  ]);

  return {
    expediente: {
      id: patient.internalId,
      nombre: `${patient.firstName} ${patient.lastName}`.trim(),
      edad: ageFrom(patient.dateOfBirth),
      sexo: patient.sex,
      estatus: patient.status,
      tags: patient.tags,
      creado: dayOf(patient.createdAt),
      // lastVisitDate la estampa crear un encounter; firstVisitDate se estampa
      // al CREAR el expediente (no es la primera consulta — no se expone como tal).
      ultimaConsultaRegistrada: dayOf(patient.lastVisitDate),
      contactoEmergencia: patient.emergencyContactName
        ? `${patient.emergencyContactName}${patient.emergencyContactRelation ? ` (${patient.emergencyContactRelation})` : ''}${patient.emergencyContactPhone ? ` · ${patient.emergencyContactPhone}` : ''}`
        : null,
    },
    // Existence only — the content is clinical and fuera de tu alcance.
    baselineRegistrado: {
      alergias: patient.currentAllergies != null && patient.currentAllergies.trim() !== '',
      padecimientosCronicos:
        patient.currentChronicConditions != null && patient.currentChronicConditions.trim() !== '',
      medicamentosActuales:
        patient.currentMedications != null && patient.currentMedications.trim() !== '',
      tipoDeSangre: patient.bloodType != null && patient.bloodType.trim() !== '',
      nota: 'Solo indica si el dato ESTÁ registrado — el contenido se consulta en el expediente.',
    },
    consultas: {
      total: encountersTotal,
      borradoresSinCerrar: encountersDraft,
      ultima: lastEncounter
        ? { fecha: dayOf(lastEncounter.encounterDate), tipo: lastEncounter.encounterType, estatus: lastEncounter.status }
        : null,
      seguimientosProximos: followUps.map((f) => ({
        fecha: dayOf(f.followUpDate),
        deLaConsultaDel: dayOf(f.encounterDate),
      })),
      seguimientosVencidos: followUpsVencidos.map((f) => ({
        fecha: dayOf(f.followUpDate),
        deLaConsultaDel: dayOf(f.encounterDate),
      })),
    },
    recetas: {
      total: recetasByStatus.reduce((s, g) => s + g._count.id, 0),
      porEstatus: Object.fromEntries(recetasByStatus.map((g) => [g.status, g._count.id])),
      ultima: lastReceta
        ? { fecha: dayOf(lastReceta.prescriptionDate), estatus: lastReceta.status }
        : null,
    },
    documentosMedia: {
      total: mediaTotal,
      ultimo: lastMedia ? { fecha: dayOf(lastMedia.captureDate), tipo: lastMedia.mediaType } : null,
    },
    notas: {
      total: notasTotal,
      ultimaActualizacion: lastNota ? dayOf(lastNota.updatedAt) : null,
    },
    formulariosPreConsulta: Object.fromEntries(formsByStatus.map((g) => [g.status, g._count.id])),
    alcance:
      'Metadatos del expediente (conteos/fechas/estatus). El contenido clínico, los datos fiscales (get_patient_profile) y el dinero (get_billing_status) van por otros caminos.',
  };
}

// -----------------------------------------------------------------------------
// get_pacientes_overview — practice-level aggregates + filtered capped list.
// -----------------------------------------------------------------------------

interface OverviewInput {
  status?: string;
  tag?: string;
  sinVisitaMeses?: number;
  nuevosMeses?: number;
}

async function getPacientesOverview(ctx: ToolContext, input: OverviewInput) {
  const doctorId = ctx.doctorId;

  const where: Record<string, unknown> = { doctorId };
  const filtros: string[] = [];

  if (typeof input.status === 'string' && ['active', 'inactive', 'archived'].includes(input.status)) {
    where.status = input.status;
    filtros.push(`estatus=${input.status}`);
  }
  if (typeof input.tag === 'string' && input.tag.trim()) {
    where.tags = { has: input.tag.trim() };
    filtros.push(`tag=${input.tag.trim()}`);
  }
  // Silent filter drops mislead the model (review finding, same class as
  // flujo's periodo) — every discarded input gets echoed in filtrosAplicados.
  if (input.sinVisitaMeses != null && asMonths(input.sinVisitaMeses) === undefined) {
    filtros.push(`sinVisitaMeses=${String(input.sinVisitaMeses)} FUERA DE RANGO (1-120) — IGNORADO`);
  }
  if (input.nuevosMeses != null && asMonths(input.nuevosMeses) === undefined) {
    filtros.push(`nuevosMeses=${String(input.nuevosMeses)} FUERA DE RANGO (1-120) — IGNORADO`);
  }
  const sinVisita = asMonths(input.sinVisitaMeses);
  if (sinVisita) {
    // "No ha vuelto en N meses" = última visita anterior al corte O nunca ha
    // venido (lastVisitDate null). Los nunca-venidos se distinguen en la fila.
    where.OR = [
      { lastVisitDate: { lt: monthsAgo(sinVisita) } },
      { lastVisitDate: null },
    ];
    filtros.push(
      `sin CONSULTA registrada en ${sinVisita} meses (incluye expedientes sin ninguna consulta; mide consultas del expediente, no citas de agenda)`
    );
  }
  const nuevos = asMonths(input.nuevosMeses);
  if (nuevos) {
    where.createdAt = { gte: monthsAgo(nuevos) };
    filtros.push(`creados en los últimos ${nuevos} meses`);
  }

  const [total, byStatus, matching, pacientes] = await Promise.all([
    prisma.patient.count({ where: { doctorId } }),
    prisma.patient.groupBy({ by: ['status'], where: { doctorId }, _count: { id: true } }),
    prisma.patient.count({ where }),
    prisma.patient.findMany({
      where,
      select: {
        internalId: true,
        firstName: true,
        lastName: true,
        status: true,
        tags: true,
        lastVisitDate: true,
        createdAt: true,
      },
      // Reactivación: los más olvidados primero; en otros filtros el orden
      // sigue siendo informativo (visita más antigua primero, nulls al frente).
      orderBy: [{ lastVisitDate: { sort: 'asc', nulls: 'first' } }],
      take: PACIENTES_LIST_CAP,
    }),
  ]);

  return {
    totalExpedientes: total,
    porEstatus: Object.fromEntries(byStatus.map((g) => [g.status, g._count.id])),
    filtrosAplicados: filtros.length > 0 ? filtros : ['ninguno (todos los expedientes)'],
    totalEncontradas: matching,
    mostradas: Math.min(matching, PACIENTES_LIST_CAP),
    pacientes: pacientes.map((p) => ({
      id: p.internalId,
      nombre: `${p.firstName} ${p.lastName}`.trim(),
      estatus: p.status,
      ...(p.tags.length > 0 ? { tags: p.tags } : {}),
      ultimaConsulta: dayOf(p.lastVisitDate) ?? 'sin consulta registrada',
      creado: dayOf(p.createdAt),
    })),
    ...(matching > PACIENTES_LIST_CAP
      ? { nota: `Solo ${PACIENTES_LIST_CAP} de ${matching} (última visita más antigua primero) — usa "totalEncontradas" para contar.` }
      : {}),
  };
}

// -----------------------------------------------------------------------------
// Module
// -----------------------------------------------------------------------------

async function executeExpedienteTool(
  ctx: ToolContext,
  name: string,
  input: Record<string, unknown>
): Promise<unknown> {
  switch (name) {
    case 'get_expediente_resumen':
      return getExpedienteResumen(ctx, input as { patientId?: string });
    case 'get_pacientes_overview':
      return getPacientesOverview(ctx, input as OverviewInput);
    default:
      return { error: `Tool desconocida: ${name}` };
  }
}

const EXPEDIENTE_DOMAIN_MODEL = `## Cómo funciona el expediente para ti (invariantes)
- El expediente tiene DOS capas: METADATOS (conteos, fechas, tipos, estatus de consultas/
  recetas/documentos/notas) — tu alcance — y CONTENIDO clínico (notas SOAP, diagnósticos,
  recetas por dentro, vitales, alergias) — fuera de tu alcance, es otro nivel de privacidad.
  Del baseline solo sabes SI está registrado, nunca qué dice.
- Expediente ≠ cita: un paciente puede tener citas sin expediente (walk-in) y un expediente
  puede existir sin citas. **"Última visita/consulta" del expediente = última CONSULTA
  CLÍNICA registrada** (la estampa crear un encounter) — una cita de agenda NO la actualiza;
  para citas usa las tools de agenda. Un expediente "sin consulta registrada" puede tener
  citas perfectamente.
- Un borrador (draft) de consulta es trabajo sin cerrar del doctor; un seguimiento
  (followUpDate) sin cita agendada es un pendiente accionable — señálalos cuando aparezcan.`;

const EXPEDIENTE_RULES = `## Expedientes — reglas (SOLO METADATOS)
- **Contenido clínico: NUNCA.** Si piden qué dice una nota/receta/diagnóstico, declina y
  ofrece lo que SÍ tienes (cuántas, de cuándo, estatus) + dónde verlo (el expediente en
  Expedientes Médicos). Puedes decir "tiene alergias registradas", jamás cuáles.
- **Reparto con otros tools**: identidad/búsqueda = find_patient; datos FISCALES y contacto =
  get_patient_profile; dinero/facturas del paciente = get_billing_status; historial
  administrativo-clínico (conteos/fechas) = get_expediente_resumen; preguntas de cartera
  ("¿cuántos activos?", "¿quién no ha vuelto?") = get_pacientes_overview.
- Para contar usa "totalEncontradas"/"total" de los tools (las listas vienen capadas).
- Al reportar un expediente menciona pendientes accionables si existen (borradores sin
  cerrar, seguimientos vencidos o próximos sin cita, formularios PENDING).`;

export const expedienteModule: AgentModule = {
  name: 'expediente',
  readTools: EXPEDIENTE_TOOLS,
  proposalTools: [],
  executeRead: executeExpedienteTool,
  executeProposal: async () => null,
  prompt: {
    domainModel: EXPEDIENTE_DOMAIN_MODEL,
    domainRules: EXPEDIENTE_RULES,
  },
};
