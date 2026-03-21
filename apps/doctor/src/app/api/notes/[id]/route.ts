import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { requireDoctorAuth } from '@/lib/medical-auth';
import { handleApiError } from '@/lib/api-error-handler';

const noteInclude = {
  tema: { select: { id: true, name: true } },
  subtema: { select: { id: true, name: true } },
} as const;

// GET /api/notes/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { doctorId } = await requireDoctorAuth(request);
    const { id } = await params;

    const note = await prisma.doctorNote.findFirst({
      where: { id, doctorId },
      include: noteInclude,
    });

    if (!note) {
      return NextResponse.json({ success: false, error: 'Note not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: note });
  } catch (error) {
    return handleApiError(error, 'GET /api/notes/[id]');
  }
}

// PUT /api/notes/[id]
// Body: { content, temaName?, subtemaName? }
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { doctorId } = await requireDoctorAuth(request);
    const { id } = await params;
    const body = await request.json();

    // Verify ownership
    const existing = await prisma.doctorNote.findFirst({ where: { id, doctorId } });
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Note not found' }, { status: 404 });
    }

    const content: string = body.content ?? existing.content;
    const temaName: string | undefined = body.temaName?.trim() || undefined;
    const subtemaName: string | undefined = body.subtemaName?.trim() || undefined;

    // Upsert tema if provided, else clear it
    let temaId: string | null = null;
    if (temaName) {
      const tema = await prisma.noteTema.upsert({
        where: { doctorId_name: { doctorId, name: temaName } },
        update: {},
        create: { doctorId, name: temaName },
      });
      temaId = tema.id;
    }

    // Upsert subtema if provided (requires tema), else clear it
    let subtemaId: string | null = null;
    if (subtemaName && temaId) {
      const subtema = await prisma.noteSubtema.upsert({
        where: { temaId_name: { temaId, name: subtemaName } },
        update: {},
        create: { temaId, doctorId, name: subtemaName },
      });
      subtemaId = subtema.id;
    }

    const note = await prisma.doctorNote.update({
      where: { id },
      data: { content, temaId, subtemaId },
      include: noteInclude,
    });

    return NextResponse.json({ success: true, data: note });
  } catch (error) {
    return handleApiError(error, 'PUT /api/notes/[id]');
  }
}

// DELETE /api/notes/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { doctorId } = await requireDoctorAuth(request);
    const { id } = await params;

    const existing = await prisma.doctorNote.findFirst({ where: { id, doctorId } });
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Note not found' }, { status: 404 });
    }

    await prisma.doctorNote.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, 'DELETE /api/notes/[id]');
  }
}
