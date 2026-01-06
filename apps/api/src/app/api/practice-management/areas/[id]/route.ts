import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { getAuthenticatedDoctor } from '@/lib/auth';

// GET /api/practice-management/areas/:id
// Get a single area with subareas
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { doctor } = await getAuthenticatedDoctor(request);
    const resolvedParams = await params;
    const areaId = parseInt(resolvedParams.id);

    if (isNaN(areaId)) {
      return NextResponse.json(
        { error: 'Invalid area ID' },
        { status: 400 }
      );
    }

    const area = await prisma.area.findFirst({
      where: {
        id: areaId,
        doctorId: doctor.id
      },
      include: {
        subareas: {
          orderBy: { name: 'asc' }
        }
      }
    });

    if (!area) {
      return NextResponse.json(
        { error: 'Area not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: area });
  } catch (error: any) {
    console.error('Error fetching area:', error);

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

// PUT /api/practice-management/areas/:id
// Update an area
export async function PUT(
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
        { error: 'Area name is required' },
        { status: 400 }
      );
    }

    // Verify ownership
    const existingArea = await prisma.area.findFirst({
      where: {
        id: areaId,
        doctorId: doctor.id
      }
    });

    if (!existingArea) {
      return NextResponse.json(
        { error: 'Area not found' },
        { status: 404 }
      );
    }

    // Update area
    const area = await prisma.area.update({
      where: { id: areaId },
      data: {
        name: name.trim(),
        description: description?.trim() || null
      },
      include: { subareas: true }
    });

    return NextResponse.json({ data: area });
  } catch (error: any) {
    console.error('Error updating area:', error);

    // Handle unique constraint violation (duplicate name)
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'An area with this name already exists' },
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

// DELETE /api/practice-management/areas/:id
// Delete an area (cascades to subareas)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { doctor } = await getAuthenticatedDoctor(request);
    const resolvedParams = await params;
    const areaId = parseInt(resolvedParams.id);

    if (isNaN(areaId)) {
      return NextResponse.json(
        { error: 'Invalid area ID' },
        { status: 400 }
      );
    }

    // Verify ownership
    const existingArea = await prisma.area.findFirst({
      where: {
        id: areaId,
        doctorId: doctor.id
      }
    });

    if (!existingArea) {
      return NextResponse.json(
        { error: 'Area not found' },
        { status: 404 }
      );
    }

    // Delete area (cascades to subareas automatically)
    await prisma.area.delete({
      where: { id: areaId }
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    console.error('Error deleting area:', error);

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
