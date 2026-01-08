import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { getAuthenticatedDoctor } from '@/lib/auth';

// GET /api/practice-management/areas
// Get all areas with subareas for authenticated doctor
export async function GET(request: NextRequest) {
  try {
    const { doctor } = await getAuthenticatedDoctor(request);

    const areas = await prisma.area.findMany({
      where: { doctorId: doctor.id },
      include: {
        subareas: {
          orderBy: { name: 'asc' }
        }
      },
      orderBy: { name: 'asc' }
    });

    return NextResponse.json({ data: areas });
  } catch (error: any) {
    console.error('Error fetching areas:', error);

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

// POST /api/practice-management/areas
// Create a new area for authenticated doctor
export async function POST(request: NextRequest) {
  try {
    const { doctor } = await getAuthenticatedDoctor(request);
    const body = await request.json();

    const { name, description, type } = body;

    // Validation
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Area name is required' },
        { status: 400 }
      );
    }

    if (type && type !== 'INGRESO' && type !== 'EGRESO') {
      return NextResponse.json(
        { error: 'Type must be either INGRESO or EGRESO' },
        { status: 400 }
      );
    }

    // Create area
    const area = await prisma.area.create({
      data: {
        doctorId: doctor.id,
        name: name.trim(),
        description: description?.trim() || null,
        type: type || 'INGRESO'
      },
      include: { subareas: true }
    });

    return NextResponse.json({ data: area }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating area:', error);

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
