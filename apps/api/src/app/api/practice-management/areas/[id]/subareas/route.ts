import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { getAuthenticatedDoctor } from '@/lib/auth';

// POST /api/practice-management/areas/:id/subareas
// Create a new subarea under an area
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { doctor } = await getAuthenticatedDoctor(request);
    const resolvedParams = await params;
    const areaId = parseInt(resolvedParams.id);
    const body = await request.json();

    if (isNaN(areaId)) {
      return NextResponse.json(
        { error: 'Invalid area ID' },
        { status: 400 }
      );
    }

    const { name, description } = body;

    // Validation
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Subarea name is required' },
        { status: 400 }
      );
    }

    // Verify area exists and belongs to doctor
    const area = await prisma.area.findFirst({
      where: {
        id: areaId,
        doctorId: doctor.id
      }
    });

    if (!area) {
      return NextResponse.json(
        { error: 'Area not found' },
        { status: 404 }
      );
    }

    // Create subarea
    const subarea = await prisma.subarea.create({
      data: {
        areaId,
        name: name.trim(),
        description: description?.trim() || null
      }
    });

    return NextResponse.json({ data: subarea }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating subarea:', error);

    // Handle unique constraint violation (duplicate name within area)
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'A subarea with this name already exists in this area' },
        { status: 409 }
      );
    }

    if (error.message.includes('Doctor') || error.message.includes('access required')) {
      return NextResponse.json(
        { error: error.message },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
