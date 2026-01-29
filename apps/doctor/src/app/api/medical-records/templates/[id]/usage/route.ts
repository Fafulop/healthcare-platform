import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { requireDoctorAuth } from '@/lib/medical-auth';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/medical-records/templates/[id]/usage
 * Track template usage when creating an encounter
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const authContext = await requireDoctorAuth(request);
    const { id } = await params;

    // Check template exists and belongs to doctor
    const existing = await prisma.encounterTemplate.findFirst({
      where: {
        id,
        doctorId: authContext.doctorId,
        isActive: true,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Plantilla no encontrada' },
        { status: 404 }
      );
    }

    // Increment usage count and update last used timestamp
    const template = await prisma.encounterTemplate.update({
      where: { id },
      data: {
        usageCount: { increment: 1 },
        lastUsedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        usageCount: template.usageCount,
        lastUsedAt: template.lastUsedAt,
      },
    });
  } catch (error: any) {
    console.error('Error tracking template usage:', error);

    if (error.message === 'Authentication required' ||
        error.message === 'Doctor or Admin role required' ||
        error.message === 'No doctor profile linked to user') {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    return NextResponse.json(
      { error: 'Error al registrar uso de plantilla' },
      { status: 500 }
    );
  }
}
