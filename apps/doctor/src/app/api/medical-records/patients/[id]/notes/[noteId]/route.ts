import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { requireDoctorAuth } from '@/lib/medical-auth';
import { handleApiError } from '@/lib/api-error-handler';

// PUT /api/medical-records/patients/:id/notes/:noteId
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; noteId: string }> }
) {
  try {
    const { doctorId } = await requireDoctorAuth(request);
    const { id: patientId, noteId } = await params;
    const body = await request.json();
    const { content } = body;

    if (!content || typeof content !== 'string' || content.trim() === '') {
      return NextResponse.json({ error: 'content is required' }, { status: 400 });
    }

    const existing = await prisma.patientNote.findFirst({
      where: { id: noteId, patientId, doctorId },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    }

    const note = await prisma.patientNote.update({
      where: { id: noteId },
      data: { content: content.trim() },
      select: { id: true, content: true, createdAt: true, updatedAt: true },
    });

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
