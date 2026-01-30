import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { requireDoctorAuth } from '@/lib/medical-auth';
import { handleApiError, validateRequired } from '@/lib/api-error-handler';

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
      if (startDate) (where.dueDate as Record<string, unknown>).gte = new Date(startDate);
      if (endDate) (where.dueDate as Record<string, unknown>).lte = new Date(endDate);
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

    const task = await prisma.task.create({
      data: {
        doctorId,
        title: body.title,
        description: body.description || null,
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
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
