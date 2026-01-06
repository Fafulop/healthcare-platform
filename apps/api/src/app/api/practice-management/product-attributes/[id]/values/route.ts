import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { getAuthenticatedDoctor } from '@/lib/auth';

// POST /api/practice-management/product-attributes/:id/values
// Create a new value for a product attribute
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { doctor } = await getAuthenticatedDoctor(request);
    const resolvedParams = await params;
    const attributeId = parseInt(resolvedParams.id);
    const body = await request.json();

    if (isNaN(attributeId)) {
      return NextResponse.json(
        { error: 'Invalid attribute ID' },
        { status: 400 }
      );
    }

    const { value, description, cost, unit, order } = body;

    // Validation
    if (!value || typeof value !== 'string' || value.trim().length === 0) {
      return NextResponse.json(
        { error: 'Value name is required' },
        { status: 400 }
      );
    }

    // Verify attribute exists and belongs to doctor
    const attribute = await prisma.productAttribute.findFirst({
      where: {
        id: attributeId,
        doctorId: doctor.id
      }
    });

    if (!attribute) {
      return NextResponse.json(
        { error: 'Product attribute not found' },
        { status: 404 }
      );
    }

    // Create value
    const attributeValue = await prisma.productAttributeValue.create({
      data: {
        attributeId,
        value: value.trim(),
        description: description?.trim() || null,
        cost: cost?.toString() || null,
        unit: unit?.trim() || null,
        order: order || 0,
        isActive: true
      }
    });

    return NextResponse.json({ data: attributeValue }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating product attribute value:', error);

    // Handle unique constraint violation (duplicate value within attribute)
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'A value with this name already exists in this attribute' },
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
