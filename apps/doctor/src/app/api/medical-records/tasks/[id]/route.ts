import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { requireDoctorAuth } from '@/lib/medical-auth';
import { handleApiError } from '@/lib/api-error-handler';
import { normalizeDate } from '@/lib/conflict-checker';

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

    return NextResponse.json({ data: task });
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

    // Verify ownership
    const existing = await prisma.task.findFirst({
      where: { id, doctorId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    await prisma.task.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, 'DELETE /api/medical-records/tasks/[id]');
  }
}
