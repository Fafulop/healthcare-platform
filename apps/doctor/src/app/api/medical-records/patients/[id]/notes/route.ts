import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { requireDoctorAuth } from '@/lib/medical-auth';
import { handleApiError } from '@/lib/api-error-handler';
import { resolverVisitaDeHijo } from '@/lib/visitas';

// GET /api/medical-records/patients/:id/notes
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { doctorId } = await requireDoctorAuth(request);
    const { id: patientId } = await params;

    const patient = await prisma.patient.findFirst({
      where: { id: patientId, doctorId },
      select: { id: true },
    });
    if (!patient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 });
    }

    const notes = await prisma.patientNote.findMany({
      where: { patientId, doctorId },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, content: true, visitaId: true, createdAt: true, updatedAt: true },
    });

    return NextResponse.json({ success: true, data: notes });
  } catch (error) {
    return handleApiError(error, 'GET /api/medical-records/patients/[id]/notes');
  }
}

// POST /api/medical-records/patients/:id/notes
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { doctorId } = await requireDoctorAuth(request);
    const { id: patientId } = await params;
    const body = await request.json();
    const { content } = body;

    if (!content || typeof content !== 'string' || content.trim() === '') {
      return NextResponse.json({ error: 'content is required' }, { status: 400 });
    }

    const patient = await prisma.patient.findFirst({
      where: { id: patientId, doctorId },
      select: { id: true },
    });
    if (!patient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 });
    }

    // VISITAS D3: a note has no consultation, so its visit is the one sent (same patient).
    const visitaId = await resolverVisitaDeHijo(doctorId, patientId, {
      visitaId: body.visitaId, encounterId: null, encounterCambio: false,
    });

    const note = await prisma.patientNote.create({
      data: {
        patientId,
        doctorId,
        content: content.trim(),
        visitaId: visitaId ?? null,
      },
      select: { id: true, content: true, visitaId: true, createdAt: true, updatedAt: true },
    });

    return NextResponse.json({ success: true, data: note }, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'POST /api/medical-records/patients/[id]/notes');
  }
}
