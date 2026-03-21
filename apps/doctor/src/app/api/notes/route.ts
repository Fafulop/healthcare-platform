import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { requireDoctorAuth } from '@/lib/medical-auth';
import { handleApiError } from '@/lib/api-error-handler';

// GET /api/notes?q=
export async function GET(request: NextRequest) {
  try {
    const { doctorId } = await requireDoctorAuth(request);
    const q = new URL(request.url).searchParams.get('q')?.trim() ?? '';

    const notes = await prisma.doctorNote.findMany({
      where: {
        doctorId,
        ...(q && {
          OR: [
            { content: { contains: q, mode: 'insensitive' } },
            { tema: { name: { contains: q, mode: 'insensitive' } } },
            { subtema: { name: { contains: q, mode: 'insensitive' } } },
          ],
        }),
      },
      include: {
        tema: { select: { id: true, name: true } },
        subtema: { select: { id: true, name: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return NextResponse.json({ success: true, data: notes });
  } catch (error) {
    return handleApiError(error, 'GET /api/notes');
  }
}

// POST /api/notes
// Body: { content, temaName?, subtemaName? }
export async function POST(request: NextRequest) {
  try {
    const { doctorId } = await requireDoctorAuth(request);
    const body = await request.json();

    const content: string = body.content ?? '';
    const temaName: string | undefined = body.temaName?.trim() || undefined;
    const subtemaName: string | undefined = body.subtemaName?.trim() || undefined;

    // Upsert tema if provided
    let temaId: string | undefined;
    if (temaName) {
      const tema = await prisma.noteTema.upsert({
        where: { doctorId_name: { doctorId, name: temaName } },
        update: {},
        create: { doctorId, name: temaName },
      });
      temaId = tema.id;
    }

    // Upsert subtema if provided (requires tema)
    let subtemaId: string | undefined;
    if (subtemaName && temaId) {
      const subtema = await prisma.noteSubtema.upsert({
        where: { temaId_name: { temaId, name: subtemaName } },
        update: {},
        create: { temaId, doctorId, name: subtemaName },
      });
      subtemaId = subtema.id;
    }

    const note = await prisma.doctorNote.create({
      data: {
        doctorId,
        content,
        temaId: temaId ?? null,
        subtemaId: subtemaId ?? null,
      },
      include: {
        tema: { select: { id: true, name: true } },
        subtema: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({ success: true, data: note }, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'POST /api/notes');
  }
}
