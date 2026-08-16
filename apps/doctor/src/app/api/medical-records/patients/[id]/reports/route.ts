import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { requireDoctorAuth, logAudit } from '@/lib/medical-auth';
import { handleApiError } from '@/lib/api-error-handler';
import { cargarPrefill, DatosDelInformeNoEncontrados } from '@/lib/informe-medico/cargar-prefill';
import { avisosDelFormato } from '@/lib/informe-medico/prefill';
import { dictParaRender, formatoDe } from '@/lib/informe-medico/formatos';
import { leerFuentesPedidas, resolverFuentesElegidas } from '@/lib/informe-medico/contexto-clinico';

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
    const formato = formatoDe(form);
    if (!formato) {
      return NextResponse.json(
        { error: `Este build no sabe generar "${form.insurer} — ${form.name}" versión ${form.version}` },
        { status: 409 }
      );
    }

    // Las FUENTES son opcionales (07-PLAN §10 #1: el selector arranca VACÍO —
    // nada se adjunta solo, y el doctor elige a propósito). Si vienen, el
    // veredicto de qué es una fuente válida y de si cabe lo da el servidor.
    let sources: unknown[] = [];
    let fuentesDescartadas: unknown[] = [];
    if (body?.sources !== undefined) {
      const pedidas = leerFuentesPedidas(body.sources);
      if ('error' in pedidas) return NextResponse.json({ error: pedidas.error }, { status: 400 });
      const resuelto = await resolverFuentesElegidas(pedidas, patientId, doctorId, encounterId);
      if (!resuelto.ok) return NextResponse.json({ error: resuelto.error }, { status: 409 });
      sources = resuelto.fuentes;
      fuentesDescartadas = resuelto.descartadas;
    }

    const { answers, avisos: todos } = await cargarPrefill({ doctorId, patientId, encounterId });
    // Sólo los avisos que ESTA hoja puede atender — ver `avisosDelFormato`.
    const avisos = avisosDelFormato(todos, dictParaRender(formato, form.fieldDict));

    const report = await prisma.medicalReport.create({
      data: {
        doctorId, patientId, encounterId, formId,
        answers: answers as object,
        sources: sources as object,
        status: 'draft',
        createdBy: userId,
      },
      select: { id: true, status: true, createdAt: true },
    });

    await logAudit({
      patientId, doctorId, userId, userRole: role,
      // Qué se eligió como fuente queda EN EL LOG: es la mitad de la respuesta a
      // "por qué este documento dice lo que dice" (01-FUENTES §6).
      action: 'CREATE', resourceType: 'MedicalReport', resourceId: report.id,
      changes: { formId, encounterId, sources }, request,
    });

    // Los avisos van con la respuesta, no al log: son para el doctor (un
    // apellido partido a ojo, más de 10 medicamentos recetados). Guardarlos sólo
    // en el servidor deja al doctor firmando algo que nadie le advirtió.
    // `fuentesDescartadas`: lo que el doctor marcó y el servidor no pudo leer.
    // Va con la respuesta por lo mismo que los avisos — callarlo lo deja creyendo
    // que el asistente va a leer algo que no le llega.
    return NextResponse.json({ report, avisos, fuentesDescartadas }, { status: 201 });
  } catch (error) {
    if (error instanceof DatosDelInformeNoEncontrados) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    return handleApiError(error, 'POST /api/medical-records/patients/:id/reports');
  }
}
