import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { requireDoctorAuth, logAudit } from '@/lib/medical-auth';
import { handleApiError } from '@/lib/api-error-handler';
import { cargarPrefill, DatosDelInformeNoEncontrados } from '@/lib/informe-medico/cargar-prefill';
import { formatoDe } from '@/lib/informe-medico/formatos';

// GET /api/medical-records/patients/:id/reports?encounterId=...
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { doctorId } = await requireDoctorAuth(request);
    const { id: patientId } = await params;
    const encounterId = request.nextUrl.searchParams.get('encounterId');

    const reports = await prisma.medicalReport.findMany({
      where: { patientId, doctorId, ...(encounterId ? { encounterId } : {}) },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, status: true, consentGiven: true, issuedAt: true, createdAt: true,
        encounterId: true,
        form: { select: { id: true, insurer: true, name: true, version: true } },
      },
    });

    return NextResponse.json({ reports });
  } catch (error) {
    return handleApiError(error, 'GET /api/medical-records/patients/:id/reports');
  }
}

// POST /api/medical-records/patients/:id/reports
// Crea el informe YA PRE-LLENADO con lo determinista. El doctor corrige encima.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { doctorId, userId, role } = await requireDoctorAuth(request);
    const { id: patientId } = await params;
    const body = await request.json();
    const encounterId: string | undefined = body?.encounterId;
    const formId: string | undefined = body?.formId;

    if (!encounterId || !formId) {
      return NextResponse.json({ error: 'encounterId y formId son obligatorios' }, { status: 400 });
    }

    const form = await prisma.insuranceForm.findUnique({ where: { id: formId } });
    if (!form || !form.isActive) {
      return NextResponse.json({ error: 'Formato no encontrado o inactivo' }, { status: 404 });
    }
    // Sin diccionario en este build el informe saldría en blanco pareciendo bien.
    if (!formatoDe(form)) {
      return NextResponse.json(
        { error: `Este build no sabe generar "${form.insurer} — ${form.name}" versión ${form.version}` },
        { status: 409 }
      );
    }

    const { answers, avisos } = await cargarPrefill({ doctorId, patientId, encounterId });

    const report = await prisma.medicalReport.create({
      data: {
        doctorId, patientId, encounterId, formId,
        answers: answers as object,
        status: 'draft',
        createdBy: userId,
      },
      select: { id: true, status: true, createdAt: true },
    });

    await logAudit({
      patientId, doctorId, userId, userRole: role,
      action: 'CREATE', resourceType: 'MedicalReport', resourceId: report.id,
      changes: { formId, encounterId }, request,
    });

    // Los avisos van con la respuesta, no al log: son para el doctor (un
    // apellido partido a ojo, más de 10 medicamentos recetados). Guardarlos sólo
    // en el servidor deja al doctor firmando algo que nadie le advirtió.
    return NextResponse.json({ report, avisos }, { status: 201 });
  } catch (error) {
    if (error instanceof DatosDelInformeNoEncontrados) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    return handleApiError(error, 'POST /api/medical-records/patients/:id/reports');
  }
}
