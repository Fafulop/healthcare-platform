import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { requireDoctorAuth } from '@/lib/medical-auth';
import { handleApiError, validateRequired } from '@/lib/api-error-handler';
import { normalizeDate } from '@/lib/conflict-checker';

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

    // Server-side conflict recheck: ONLY check task-task conflicts
    // (Simplified approach: tasks can coexist with appointment slots)
    let bookedAppointmentWarning = null;

    if (body.dueDate && body.startTime && body.endTime && !body.skipConflictCheck) {
      // 1. Check for task-task conflicts (BLOCKING)
      const taskConflicts = await prisma.task.findMany({
        where: {
          doctorId,
          dueDate: normalizeDate(body.dueDate),
          startTime: { not: null },
          endTime: { not: null },
          status: { in: ['PENDIENTE', 'EN_PROGRESO'] },
          AND: [
            { startTime: { lt: body.endTime } },
            { endTime: { gt: body.startTime } },
          ],
        },
        select: {
          id: true,
          title: true,
          dueDate: true,
          startTime: true,
          endTime: true,
          status: true,
          priority: true,
        },
      });

      if (taskConflicts.length > 0) {
        return NextResponse.json(
          {
            error: 'Ya tienes un pendiente a esta hora',
            taskConflicts,
          },
          { status: 409 }
        );
      }

      // 2. Check for booked appointments (INFORMATIONAL WARNING ONLY, not blocking)
      // Store warning to include in response AFTER creating the task
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3003';
        const slotsUrl = `${apiUrl}/api/appointments/slots?doctorId=${doctorId}&startDate=${body.dueDate}&endDate=${body.dueDate}`;

        const slotsResponse = await fetch(slotsUrl);
        if (slotsResponse.ok) {
          const slotsData = await slotsResponse.json();
          const slots = slotsData.data || [];

          // Find slots with active bookings that overlap with the task
          const bookedSlotsOverlapping = slots.filter((slot: any) => {
            const hasBookings =
              slot.currentBookings > 0 &&
              slot.bookings?.some(
                (b: any) => !['CANCELLED', 'COMPLETED', 'NO_SHOW'].includes(b.status)
              );
            const overlaps = slot.startTime < body.endTime && slot.endTime > body.startTime;
            return hasBookings && overlaps;
          });

          if (bookedSlotsOverlapping.length > 0) {
            // Store warning info to include in response after task creation
            bookedAppointmentWarning = {
              warning: `Tienes ${bookedSlotsOverlapping.length} cita(s) con pacientes a esta hora`,
              bookedAppointments: bookedSlotsOverlapping.map((slot: any) => ({
                startTime: slot.startTime,
                endTime: slot.endTime,
                bookings: slot.bookings
                  ?.filter((b: any) => !['CANCELLED', 'COMPLETED', 'NO_SHOW'].includes(b.status))
                  .map((b: any) => ({
                    patientName: b.patientName,
                    status: b.status,
                  })),
              })),
            };
          }
        }
      } catch (error) {
        // If appointment check fails, just log and continue (don't block task creation)
        console.error('Error checking booked appointments (non-blocking):', error);
      }
    }

    // Create the task (always, even if there are booked appointment warnings)
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

    // Return task with optional warning about booked appointments
    const response: any = { data: task };
    if (bookedAppointmentWarning) {
      response.warning = bookedAppointmentWarning.warning;
      response.bookedAppointments = bookedAppointmentWarning.bookedAppointments;
    }

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'POST /api/medical-records/tasks');
  }
}
