// POST /api/patient-import/validate — sube un archivo y devuelve la VISTA
// PREVIA. No escribe absolutamente nada.
//
// FASE 3 de `docs/DESDE JUNIO/PACIENTE MIGRATION/`.
//
// El paso de vista previa no es un lujo: una inserción a ciegas de 300
// pacientes que falla en el renglón 180 —habiendo escrito ya 179— es peor que
// no tener importación. Es además la misma forma que ya usa conciliación
// bancaria y la misma regla del agente: se propone, se confirma, y hasta
// entonces se ejecuta.

import { NextRequest, NextResponse } from 'next/server';
import { prisma, validateImport } from '@healthcare/database';
import { requireDoctorAuth, AuthError } from '@/lib/auth';
import { parseImportFile, describeSheets } from '@/lib/patient-import-parse';
import { resolveTargetDoctorId, loadExisting, MAX_FILE_BYTES } from '../_shared';

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
    const result = validateImport(sheets, existing);

    // El doctor al que se le va a escribir se devuelve POR NOMBRE. Un admin
    // importando al doctor equivocado es una fuga de datos entre doctores, no
    // un typo, y un id no se revisa: un nombre sí.
    const doctor = await prisma.doctor.findUnique({
      where: { id: doctorId },
      select: { id: true, doctorFullName: true, slug: true, city: true },
    });

    return NextResponse.json({
      data: {
        doctor,
        sourceFile: file.name,
        counts: result.counts,
        issues: result.issues,
        preview: {
          patients: result.patients.slice(0, 20).map((p) => ({
            row: p.row,
            internalId: p.internalId,
            nombre: `${p.data.firstName ?? ''} ${p.data.lastName ?? ''}`.trim(),
          })),
          encounters: result.encounters.slice(0, 20).map((e) => ({
            row: e.row,
            patientRef: e.patientRef,
            fecha: (e.data.encounterDate as Date)?.toISOString().slice(0, 10),
            motivo: e.data.chiefComplaint,
          })),
        },
      },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('POST /api/patient-import/validate', error);
    return NextResponse.json(
      { error: 'No se pudo leer el archivo. ¿Es la plantilla?' },
      { status: 500 },
    );
  }
}
