import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { getAuthenticatedDoctor } from '@/lib/auth';

// PUT /api/practice-management/areas/:id/subareas/:subareaId
// Update a subarea
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; subareaId: string }> }
) {
  try {
    const { doctor } = await getAuthenticatedDoctor(request);
    const resolvedParams = await params;
    const areaId = parseInt(resolvedParams.id);
    const subareaId = parseInt(resolvedParams.subareaId);
    const body = await request.json();

    if (isNaN(areaId) || isNaN(subareaId)) {
      return NextResponse.json(
        { error: 'Invalid ID' },
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

    // Verify subarea exists and belongs to this area
    const existingSubarea = await prisma.subarea.findFirst({
      where: {
        id: subareaId,
        areaId
      }
    });

    if (!existingSubarea) {
      return NextResponse.json(
        { error: 'Subarea not found' },
        { status: 404 }
      );
    }

    // Update subarea
    const subarea = await prisma.subarea.update({
      where: { id: subareaId },
      data: {
        name: name.trim(),
        description: description?.trim() || null
      }
    });

    return NextResponse.json({ data: subarea });
  } catch (error: any) {
    console.error('Error updating subarea:', error);

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

// DELETE /api/practice-management/areas/:id/subareas/:subareaId
// Delete a subarea
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; subareaId: string }> }
) {
  try {
    const { doctor } = await getAuthenticatedDoctor(request);
    const resolvedParams = await params;
    const areaId = parseInt(resolvedParams.id);
    const subareaId = parseInt(resolvedParams.subareaId);

    if (isNaN(areaId) || isNaN(subareaId)) {
      return NextResponse.json(
        { error: 'Invalid ID' },
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

    // Verify subarea exists and belongs to this area
    const existingSubarea = await prisma.subarea.findFirst({
      where: {
        id: subareaId,
        areaId
      }
    });

    if (!existingSubarea) {
      return NextResponse.json(
        { error: 'Subarea not found' },
        { status: 404 }
      );
    }

    // Delete subarea
    await prisma.subarea.delete({
      where: { id: subareaId }
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    console.error('Error deleting subarea:', error);

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
