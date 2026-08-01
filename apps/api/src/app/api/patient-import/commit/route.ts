// POST /api/patient-import/commit — escribe la importación.
//
// FASE 3 de `docs/DESDE JUNIO/PACIENTE MIGRATION/`.
//
// ⚠️ VUELVE A PARSEAR Y A VALIDAR EL ARCHIVO. No acepta renglones ya
// procesados del cliente, y eso NO es desconfianza del navegador: si el commit
// aceptara filas armadas por quien llama, se podría escribir en el expediente
// saltándose entera la validación —fechas imposibles, sexo inventado, folios
// repetidos—. La vista previa es para el humano; la verdad se recalcula aquí.
//
// Efecto secundario bueno: el archivo no se guarda en ningún lado entre la
// vista previa y el commit. El navegador ya lo tiene y volverlo a mandar es
// gratis, así que no hace falta almacenamiento temporal ni limpiarlo después.

import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { prisma, validateImport, commitPatientImport } from '@healthcare/database';
import { requireDoctorAuth, AuthError } from '@/lib/auth';
import { parseImportFile, describeSheets } from '@/lib/patient-import-parse';
import {
  resolveTargetDoctorId,
  auditRoleFor,
  loadExisting,
  MAX_FILE_BYTES,
} from '../_shared';

/** La transacción escribe miles de renglones; el default de 5 s no alcanza. */
const TX_TIMEOUT_MS = 120_000;
const TX_MAX_WAIT_MS = 15_000;

export async function POST(request: NextRequest) {
  try {
    const user = await requireDoctorAuth(request);

    const form = await request.formData();
    const file = form.get('file');
    const requestedDoctorId = form.get('doctorId');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Falta el archivo.' }, { status: 400 });
    }
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        { error: `El archivo pesa más de ${MAX_FILE_BYTES / 1024 / 1024} MB.` },
        { status: 400 },
      );
    }

    const doctorId = await resolveTargetDoctorId(
      user,
      typeof requestedDoctorId === 'string' ? requestedDoctorId : null,
    );

    const sheets = await parseImportFile(await file.arrayBuffer(), file.name);
    const problem = describeSheets(sheets);
    if (problem) {
      return NextResponse.json({ error: problem }, { status: 400 });
    }

    const existing = await loadExisting(prisma, doctorId);
    const validated = validateImport(sheets, existing);

    if (validated.patients.length === 0) {
      return NextResponse.json(
        { error: 'No hay ni un renglón válido para importar.', counts: validated.counts },
        { status: 400 },
      );
    }

    const batchId = randomUUID();

    const result = await prisma.$transaction(
      (tx) =>
        commitPatientImport(tx, validated, {
          doctorId,
          actor: { userId: user.userId, role: auditRoleFor(user) },
          sourceFile: file.name,
          batchId,
          existingInternalIds: existing.internalIds ?? new Set(),
        }),
      { timeout: TX_TIMEOUT_MS, maxWait: TX_MAX_WAIT_MS },
    );

    return NextResponse.json({
      data: {
        ...result,
        // Se devuelven los problemas que quedaron: los renglones con error NO
        // se importaron y el que subió el archivo tiene que enterarse aquí,
        // no descubrirlo después contando pacientes.
        skipped: validated.counts.errors,
        warnings: validated.counts.warnings,
        issues: validated.issues,
      },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('POST /api/patient-import/commit', error);
    return NextResponse.json(
      { error: 'No se pudo completar la importación. No se escribió nada.' },
      { status: 500 },
    );
  }
}
