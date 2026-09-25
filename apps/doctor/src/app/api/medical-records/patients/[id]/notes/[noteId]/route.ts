import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { requireDoctorAuth, logAudit } from '@/lib/medical-auth';
import { handleApiError } from '@/lib/api-error-handler';
import { resolverVisitaDeHijo } from '@/lib/visitas';

// PUT /api/medical-records/patients/:id/notes/:noteId
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; noteId: string }> }
) {
  try {
    const { doctorId, userId, role } = await requireDoctorAuth(request);
    const { id: patientId, noteId } = await params;
    const body = await request.json();
    const { content } = body;

    // VISITAS D3: a PUT may only move the note to another visit (no content) — the
    // «¿A qué visita pertenece?» control. Otherwise content stays required.
    const soloVisita = content === undefined && body.visitaId !== undefined;
    if (!soloVisita && (!content || typeof content !== 'string' || content.trim() === '')) {
      return NextResponse.json({ error: 'content is required' }, { status: 400 });
    }

    const existing = await prisma.patientNote.findFirst({
      where: { id: noteId, patientId, doctorId },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    }

    const visitaId = await resolverVisitaDeHijo(doctorId, patientId, {
      visitaId: body.visitaId, encounterId: null, encounterCambio: false,
    });
    const visitaMovida = visitaId !== undefined && visitaId !== existing.visitaId;

    const note = await prisma.patientNote.update({
      where: { id: noteId },
      data: {
        ...(soloVisita ? {} : { content: content.trim() }),
        ...(visitaMovida ? { visitaId } : {}),
        // Filing a note into a visit is not editing it: keep its date, or it jumps to the top of
        // the list (ordered by updatedAt) as if it had just been written.
        ...(soloVisita ? { updatedAt: existing.updatedAt } : {}),
      },
      select: { id: true, content: true, visitaId: true, createdAt: true, updatedAt: true },
    });

    // A visit move is audited from → to (NOM-024).
    if (visitaMovida) {
      await logAudit({
        patientId, doctorId, userId, userRole: role,
        action: 'move_note_visita', resourceType: 'note', resourceId: noteId,
        changes: { visitaId: { from: existing.visitaId, to: visitaId } },
        request,
      });
    }

    return NextResponse.json({ success: true, data: note });
  } catch (error) {
    return handleApiError(error, 'PUT /api/medical-records/patients/[id]/notes/[noteId]');
  }
}

// DELETE /api/medical-records/patients/:id/notes/:noteId
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; noteId: string }> }
) {
  try {
    const { doctorId } = await requireDoctorAuth(request);
    const { id: patientId, noteId } = await params;

    const existing = await prisma.patientNote.findFirst({
      where: { id: noteId, patientId, doctorId },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    }

    await prisma.patientNote.delete({ where: { id: noteId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, 'DELETE /api/medical-records/patients/[id]/notes/[noteId]');
  }
}
