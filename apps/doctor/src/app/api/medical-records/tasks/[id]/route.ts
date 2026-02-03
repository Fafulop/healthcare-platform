import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { requireDoctorAuth } from '@/lib/medical-auth';
import { handleApiError } from '@/lib/api-error-handler';
import { normalizeDate } from '@/lib/conflict-checker';
import { logTaskUpdated, logTaskCompleted, logTaskStatusChanged, logTaskDeleted } from '@/lib/activity-logger';

// GET /api/medical-records/tasks/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { doctorId } = await requireDoctorAuth(request);
    const { id } = await params;

    const task = await prisma.task.findFirst({
      where: { id, doctorId },
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

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    return NextResponse.json({ data: task });
  } catch (error) {
    return handleApiError(error, 'GET /api/medical-records/tasks/[id]');
  }
}

// PUT /api/medical-records/tasks/[id]
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { doctorId } = await requireDoctorAuth(request);
    const { id } = await params;
    const body = await request.json();

    // Verify ownership
    const existing = await prisma.task.findFirst({
      where: { id, doctorId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    // Determine the final date/time values (use body if provided, else existing)
    const finalDueDate = body.dueDate !== undefined ? body.dueDate : existing.dueDate;
    const finalStartTime = body.startTime !== undefined ? body.startTime : existing.startTime;
    const finalEndTime = body.endTime !== undefined ? body.endTime : existing.endTime;

    // Helper to convert Date or string to normalized Date
    const toNormalizedDate = (date: Date | string): Date => {
      if (date instanceof Date) {
        return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
      }
      return normalizeDate(date);
    };

    // Check for task-task conflicts if time is being set/changed (exclude current task)
    let bookedAppointmentWarning = null;

    if (finalDueDate && finalStartTime && finalEndTime) {
      // 1. Check for task-task conflicts (BLOCKING) - exclude current task
      const taskConflicts = await prisma.task.findMany({
        where: {
          doctorId,
          id: { not: id }, // Exclude the task being edited
          dueDate: toNormalizedDate(finalDueDate),
          startTime: { not: null },
          endTime: { not: null },
          status: { in: ['PENDIENTE', 'EN_PROGRESO'] },
          AND: [
            { startTime: { lt: finalEndTime } },
            { endTime: { gt: finalStartTime } },
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

      // 2. Check for booked appointments (INFORMATIONAL WARNING ONLY)
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3003';
        const dueDateStr = typeof finalDueDate === 'string' ? finalDueDate.split('T')[0] : finalDueDate.toISOString().split('T')[0];
        const slotsUrl = `${apiUrl}/api/appointments/slots?doctorId=${doctorId}&startDate=${dueDateStr}&endDate=${dueDateStr}`;

        const slotsResponse = await fetch(slotsUrl);
        if (slotsResponse.ok) {
          const slotsData = await slotsResponse.json();
          const slots = slotsData.data || [];

          const bookedSlotsOverlapping = slots.filter((slot: any) => {
            const hasBookings =
              slot.currentBookings > 0 &&
              slot.bookings?.some(
                (b: any) => !['CANCELLED', 'COMPLETED', 'NO_SHOW'].includes(b.status)
              );
            const overlaps = slot.startTime < finalEndTime && slot.endTime > finalStartTime;
            return hasBookings && overlaps;
          });

          if (bookedSlotsOverlapping.length > 0) {
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
        console.error('Error checking booked appointments (non-blocking):', error);
      }
    }

    // Set completedAt when status changes to COMPLETADA
    const updateData: Record<string, unknown> = {};
    if (body.title !== undefined) updateData.title = body.title;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.dueDate !== undefined) updateData.dueDate = body.dueDate ? normalizeDate(body.dueDate) : null;
    if (body.startTime !== undefined) updateData.startTime = body.startTime;
    if (body.endTime !== undefined) updateData.endTime = body.endTime;
    if (body.priority !== undefined) updateData.priority = body.priority;
    if (body.category !== undefined) updateData.category = body.category;
    if (body.patientId !== undefined) updateData.patientId = body.patientId || null;

    if (body.status !== undefined) {
      updateData.status = body.status;
      if (body.status === 'COMPLETADA' && existing.status !== 'COMPLETADA') {
        updateData.completedAt = new Date();
      } else if (body.status !== 'COMPLETADA') {
        updateData.completedAt = null;
      }
    }

    const task = await prisma.task.update({
      where: { id },
      data: updateData,
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

    // Log activity based on what changed
    const changedFields = Object.keys(updateData).filter(key => key !== 'completedAt');
    const patientName = task.patient ? `${task.patient.firstName} ${task.patient.lastName}` : undefined;

    // Check if status changed to COMPLETADA
    if (body.status === 'COMPLETADA' && existing.status !== 'COMPLETADA') {
      await logTaskCompleted({
        doctorId,
        taskId: task.id,
        taskTitle: task.title,
        category: task.category,
        patientName,
      });
    }
    // Check if status changed (but not to COMPLETADA, already handled above)
    else if (body.status !== undefined && existing.status !== body.status) {
      await logTaskStatusChanged({
        doctorId,
        taskId: task.id,
        taskTitle: task.title,
        oldStatus: existing.status,
        newStatus: body.status,
      });
    }
    // General update (no status change or non-completion status change)
    else if (changedFields.length > 0) {
      await logTaskUpdated({
        doctorId,
        taskId: task.id,
        taskTitle: task.title,
        changedFields,
      });
    }

    // Return task with optional warning about booked appointments
    const response: Record<string, unknown> = { data: task };
    if (bookedAppointmentWarning) {
      response.warning = bookedAppointmentWarning.warning;
      response.bookedAppointments = bookedAppointmentWarning.bookedAppointments;
    }

    return NextResponse.json(response);
  } catch (error) {
    return handleApiError(error, 'PUT /api/medical-records/tasks/[id]');
  }
}

// DELETE /api/medical-records/tasks/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { doctorId } = await requireDoctorAuth(request);
    const { id } = await params;

    // Verify ownership and get task details for logging
    const existing = await prisma.task.findFirst({
      where: { id, doctorId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    await prisma.task.delete({ where: { id } });

    // Log activity
    await logTaskDeleted({
      doctorId,
      taskId: id,
      taskTitle: existing.title,
      priority: existing.priority,
      category: existing.category,
      dueDate: existing.dueDate || undefined,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, 'DELETE /api/medical-records/tasks/[id]');
  }
}
