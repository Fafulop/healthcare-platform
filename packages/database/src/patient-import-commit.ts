/**
 * Escritura de la importación de pacientes — FASE 3.
 *
 * Toma lo que el validador dejó listo y lo escribe DENTRO DE UNA TRANSACCIÓN.
 * O entra todo o no entra nada: una importación que falla a la mitad deja al
 * doctor con medio expediente y sin forma de saber por dónde iba.
 *
 * Se escribe en 3 operaciones masivas y no en N inserciones sueltas, porque
 * 2 000 idas y vueltas a la base no caben en el timeout de una transacción.
 *
 * ⚠️ La auditoría NO es opcional. Cada alta individual escribe hoy un
 * `PatientAuditLog`; si la importación no los escribe, el rastro miente sobre
 * cómo entraron los datos — y la home afirma en público que el expediente es
 * conforme a la NOM-004 y la NOM-024.
 *
 * Cuando importa un ADMIN, se registra al admin real. **Nunca** suplantando al
 * doctor: un rastro falso es peor que uno ausente porque no se detecta después.
 *
 * Diseño: `docs/DESDE JUNIO/PACIENTE MIGRATION/`.
 */

import type { Prisma } from '@prisma/client';
import { importedNotesHeader } from './patient-import';
import type { ValidationResult } from './patient-import-validate';

export interface ImportActor {
  /** El usuario que APRIETA el botón — doctor, apoyo o admin. */
  userId: string;
  /** `doctor` · `member` · `admin`. Va tal cual al audit log. */
  role: string;
}

export interface CommitInput {
  doctorId: string;
  actor: ImportActor;
  sourceFile: string;
  batchId: string;
  /** Folios que el doctor YA tiene, para no generar uno repetido. */
  existingInternalIds: Set<string>;
}

export interface CommitResult {
  batchId: string;
  patientsCreated: number;
  encountersCreated: number;
  auditRowsWritten: number;
}

/**
 * Genera folios para los pacientes que no traen.
 *
 * ⚠️ NO se reutiliza `` `P${Date.now()}` `` de `patients/route.ts`: sirve para
 * un alta a la vez, pero en un lote varios pacientes caen en el MISMO
 * milisegundo, producen el mismo folio y chocan contra
 * `@@unique([doctorId, internalId])`. La importación reventaría a media
 * escritura. Es el hueco #1 del plan.
 */
function makeInternalIdFactory(taken: Set<string>, batchId: string) {
  let n = 0;
  const stamp = batchId.slice(0, 8).toUpperCase();
  return (): string => {
    let candidate: string;
    do {
      n += 1;
      candidate = `MIG-${stamp}-${String(n).padStart(4, '0')}`;
    } while (taken.has(candidate));
    taken.add(candidate);
    return candidate;
  };
}

export async function commitPatientImport(
  tx: Prisma.TransactionClient,
  validated: ValidationResult,
  input: CommitInput,
): Promise<CommitResult> {
  const { doctorId, actor, sourceFile, batchId } = input;
  const importedAt = new Date();
  const nextInternalId = makeInternalIdFactory(
    new Set(input.existingInternalIds),
    batchId,
  );

  /* ── 1. Pacientes ──────────────────────────────────────────────────── */

  // El folio se resuelve ANTES de escribir, porque las consultas cuelgan de él.
  const withIds = validated.patients.map((p) => ({
    ...p,
    resolvedInternalId: p.internalId ?? nextInternalId(),
  }));

  // Las consultas se agrupan por folio para poder calcular primera/última
  // visita, que la plantilla promete rellenar solas.
  const byRef = new Map<string, Date[]>();
  for (const e of validated.encounters) {
    const d = e.data.encounterDate as Date;
    if (!d) continue;
    const list = byRef.get(e.patientRef);
    if (list) list.push(d);
    else byRef.set(e.patientRef, [d]);
  }

  await tx.patient.createMany({
    data: withIds.map((p) => {
      const dates = byRef.get(p.resolvedInternalId) ?? [];
      const sorted = dates.slice().sort((a, b) => a.getTime() - b.getTime());
      return {
        ...(p.data as object),
        doctorId,
        internalId: p.resolvedInternalId,
        status: (p.data.status as string) ?? 'active',
        // Si el archivo no las trae, salen de las consultas importadas.
        firstVisitDate: (p.data.firstVisitDate as Date) ?? sorted[0] ?? null,
        lastVisitDate:
          (p.data.lastVisitDate as Date) ?? sorted[sorted.length - 1] ?? null,
      } as Prisma.PatientCreateManyInput;
    }),
  });

  // Se leen de vuelta porque `createMany` no devuelve ids y las consultas y
  // los audit logs los necesitan.
  const created = await tx.patient.findMany({
    where: {
      doctorId,
      internalId: { in: withIds.map((p) => p.resolvedInternalId) },
    },
    select: { id: true, internalId: true },
  });
  const idByInternal = new Map(created.map((c) => [c.internalId, c.id]));

  /* ── 2. Consultas ──────────────────────────────────────────────────── */

  const header = importedNotesHeader(sourceFile, importedAt);

  const encounterRows = validated.encounters
    .map((e) => {
      const patientId = idByInternal.get(e.patientRef);
      if (!patientId) return null;

      const notes = e.data.clinicalNotes as string | undefined;

      return {
        ...(e.data as object),
        patientId,
        doctorId,
        // La procedencia va AQUÍ y no en `customData`: cualquier cosa en
        // `customData` hace que la tarjeta saque su título del primer valor
        // string de ese objeto y que se OCULTE el motivo de consulta.
        clinicalNotes: notes ? `${header}\n\n${notes}` : header,
        encounterType: (e.data.encounterType as string) ?? 'consultation',
        // `completed`, no `draft`: son visitas que ya ocurrieron. En draft
        // aparecerían como trabajo pendiente del doctor.
        status: 'completed',
        completedAt: importedAt,
        createdBy: actor.userId,
      } as Prisma.ClinicalEncounterCreateManyInput;
    })
    .filter((r): r is Prisma.ClinicalEncounterCreateManyInput => r !== null);

  if (encounterRows.length > 0) {
    await tx.clinicalEncounter.createMany({ data: encounterRows });
  }

  /* ── 3. Auditoría ──────────────────────────────────────────────────── */

  const auditRows: Prisma.PatientAuditLogCreateManyInput[] = [];

  for (const p of withIds) {
    const patientId = idByInternal.get(p.resolvedInternalId);
    if (!patientId) continue;
    auditRows.push({
      patientId,
      doctorId,
      action: 'create_patient',
      resourceType: 'patient',
      resourceId: patientId,
      userId: actor.userId,
      userRole: actor.role,
      // `changes` ya es Json?: carga el lote sin cambiar el esquema, lo que
      // importa porque aquí `prisma db push` revierte objetos de prod.
      changes: {
        via: 'import',
        batchId,
        sourceFile,
        sheetRow: p.row,
        generatedInternalId: p.internalId === null,
      },
      timestamp: importedAt,
    });
  }

  for (const e of validated.encounters) {
    const patientId = idByInternal.get(e.patientRef);
    if (!patientId) continue;
    auditRows.push({
      patientId,
      doctorId,
      action: 'create_encounter',
      resourceType: 'encounter',
      userId: actor.userId,
      userRole: actor.role,
      changes: { via: 'import', batchId, sourceFile, sheetRow: e.row },
      timestamp: importedAt,
    });
  }

  if (auditRows.length > 0) {
    await tx.patientAuditLog.createMany({ data: auditRows });
  }

  return {
    batchId,
    patientsCreated: withIds.length,
    encountersCreated: encounterRows.length,
    auditRowsWritten: auditRows.length,
  };
}
