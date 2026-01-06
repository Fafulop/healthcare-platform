import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { getAuthenticatedDoctor } from '@/lib/auth';

// GET /api/practice-management/product-attributes
// Get all product attributes with their values for authenticated doctor
export async function GET(request: NextRequest) {
  try {
    const { doctor } = await getAuthenticatedDoctor(request);

    const attributes = await prisma.productAttribute.findMany({
      where: {
        doctorId: doctor.id,
        isActive: true
      },
      include: {
        values: {
          where: { isActive: true },
          orderBy: { order: 'asc' }
        }
      },
      orderBy: { order: 'asc' }
    });

    return NextResponse.json({ data: attributes });
  } catch (error: any) {
    console.error('Error fetching product attributes:', error);

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

// POST /api/practice-management/product-attributes
// Create a new product attribute (category)
export async function POST(request: NextRequest) {
  try {
    const { doctor } = await getAuthenticatedDoctor(request);
    const body = await request.json();

    const { name, description, order } = body;

    // Validation
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Attribute name is required' },
        { status: 400 }
      );
    }

    // Create attribute
    const attribute = await prisma.productAttribute.create({
      data: {
        doctorId: doctor.id,
        name: name.trim(),
        description: description?.trim() || null,
        order: order || 0,
        isActive: true
      },
      include: {
        values: true
      }
    });

    return NextResponse.json({ data: attribute }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating product attribute:', error);

    // Handle unique constraint violation (duplicate name)
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'A product attribute with this name already exists' },
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
