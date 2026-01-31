import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { requireDoctorAuth } from '@/lib/medical-auth';
import { handleApiError, validateRequired } from '@/lib/api-error-handler';
import { checkConflictsForEntry, normalizeDate } from '@/lib/conflict-checker';

// GET /api/medical-records/tasks
export async function GET(request: NextRequest) {
  try {
    const { doctorId } = await requireDoctorAuth(request);

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const priority = searchParams.get('priority');
    const category = searchParams.get('category');
    const patientId = searchParams.get('patientId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const where: Record<string, unknown> = { doctorId };

    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (category) where.category = category;
    if (patientId) where.patientId = patientId;

    if (startDate || endDate) {
      where.dueDate = {};
      if (startDate) (where.dueDate as Record<string, unknown>).gte = normalizeDate(startDate);
      if (endDate) (where.dueDate as Record<string, unknown>).lte = normalizeDate(endDate);
    }

    const tasks = await prisma.task.findMany({
      where,
      orderBy: [
        { dueDate: 'asc' },
        { priority: 'asc' },
        { createdAt: 'desc' },
      ],
      include: {
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return NextResponse.json({ data: tasks });
  } catch (error) {
    return handleApiError(error, 'GET /api/medical-records/tasks');
  }
}

// POST /api/medical-records/tasks
export async function POST(request: NextRequest) {
  try {
    const { doctorId } = await requireDoctorAuth(request);
    const body = await request.json();

    validateRequired(body, ['title']);

    // Validate 30-minute increments
    const validTime = (t: string) => {
      const [, m] = t.split(':').map(Number);
      return m === 0 || m === 30;
    };
    if (body.startTime && !validTime(body.startTime)) {
      return NextResponse.json(
        { error: 'La hora de inicio debe ser en punto o a la media hora' },
        { status: 400 }
      );
    }
    if (body.endTime && !validTime(body.endTime)) {
      return NextResponse.json(
        { error: 'La hora de fin debe ser en punto o a la media hora' },
        { status: 400 }
      );
    }

    // startTime and endTime must both be provided or both absent
    if (body.startTime && !body.endTime) {
      return NextResponse.json(
        { error: 'Si se proporciona hora de inicio, la hora de fin es obligatoria' },
        { status: 400 }
      );
    }
    if (body.endTime && !body.startTime) {
      return NextResponse.json(
        { error: 'Si se proporciona hora de fin, la hora de inicio es obligatoria' },
        { status: 400 }
      );
    }

    // Server-side conflict recheck (prevents race conditions)
    if (body.dueDate && body.startTime && body.endTime && !body.skipConflictCheck) {
      const conflicts = await checkConflictsForEntry(doctorId, {
        date: body.dueDate,
        startTime: body.startTime,
        endTime: body.endTime,
      });

      const hasConflicts =
        conflicts.appointmentConflicts.length > 0 ||
        conflicts.taskConflicts.length > 0;

      if (hasConflicts) {
        return NextResponse.json(
          {
            error: 'Se detectaron conflictos de horario. Verifica e intenta de nuevo.',
            conflicts,
          },
          { status: 409 }
        );
      }
    }

    const task = await prisma.task.create({
      data: {
        doctorId,
        title: body.title,
        description: body.description || null,
        dueDate: body.dueDate ? normalizeDate(body.dueDate) : null,
        startTime: body.startTime || null,
        endTime: body.endTime || null,
        priority: body.priority || 'MEDIA',
        status: 'PENDIENTE',
        category: body.category || 'OTRO',
        patientId: body.patientId || null,
      },
      include: {
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return NextResponse.json({ data: task }, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'POST /api/medical-records/tasks');
  }
}
