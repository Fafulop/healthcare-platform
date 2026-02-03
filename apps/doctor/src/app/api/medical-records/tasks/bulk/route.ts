import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { requireDoctorAuth } from '@/lib/medical-auth';
import { handleApiError } from '@/lib/api-error-handler';
import { logTaskBulkDeleted } from '@/lib/activity-logger';

// DELETE /api/medical-records/tasks/bulk
export async function DELETE(request: NextRequest) {
  try {
    const { doctorId } = await requireDoctorAuth(request);
    const body = await request.json();

    if (!body.taskIds || !Array.isArray(body.taskIds) || body.taskIds.length === 0) {
      return NextResponse.json(
        { error: 'taskIds array is required and must not be empty' },
        { status: 400 }
      );
    }

    // Verify all tasks belong to this doctor
    const tasks = await prisma.task.findMany({
      where: {
        id: { in: body.taskIds },
        doctorId,
      },
      select: { id: true },
    });

    if (tasks.length !== body.taskIds.length) {
      return NextResponse.json(
        { error: 'Some tasks not found or do not belong to you' },
        { status: 403 }
      );
    }

    // Delete all tasks
    await prisma.task.deleteMany({
      where: {
        id: { in: body.taskIds },
        doctorId,
      },
    });

    // Log bulk delete activity
    await logTaskBulkDeleted({
      doctorId,
      count: body.taskIds.length,
    });

    return NextResponse.json({
      success: true,
      deletedCount: body.taskIds.length,
    });
  } catch (error) {
    return handleApiError(error, 'DELETE /api/medical-records/tasks/bulk');
  }
}
