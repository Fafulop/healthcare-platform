import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { requireDoctorAuth } from '@/lib/medical-auth';
import { handleApiError } from '@/lib/api-error-handler';

// GET /api/notes/temas
// Returns all temas with their subtemas and note counts — used by sidebar + comboboxes
export async function GET(request: NextRequest) {
  try {
    const { doctorId } = await requireDoctorAuth(request);

    const temas = await prisma.noteTema.findMany({
      where: { doctorId },
      include: {
        subtemas: {
          orderBy: { name: 'asc' },
          select: { id: true, name: true },
        },
        _count: { select: { notes: true } },
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ success: true, data: temas });
  } catch (error) {
    return handleApiError(error, 'GET /api/notes/temas');
  }
}
