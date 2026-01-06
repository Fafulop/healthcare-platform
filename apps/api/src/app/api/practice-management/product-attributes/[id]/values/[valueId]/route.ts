import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { getAuthenticatedDoctor } from '@/lib/auth';

// PUT /api/practice-management/product-attributes/:id/values/:valueId
// Update a product attribute value
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; valueId: string }> }
) {
  try {
    const { doctor } = await getAuthenticatedDoctor(request);
    const resolvedParams = await params;
    const attributeId = parseInt(resolvedParams.id);
    const valueId = parseInt(resolvedParams.valueId);
    const body = await request.json();

    if (isNaN(attributeId) || isNaN(valueId)) {
      return NextResponse.json(
        { error: 'Invalid ID' },
        { status: 400 }
      );
    }

    const { value, description, cost, unit, order, isActive } = body;

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

    // Verify value exists and belongs to this attribute
    const existingValue = await prisma.productAttributeValue.findFirst({
      where: {
        id: valueId,
        attributeId
      }
    });

    if (!existingValue) {
      return NextResponse.json(
        { error: 'Product attribute value not found' },
        { status: 404 }
      );
    }

    // Update value
    const attributeValue = await prisma.productAttributeValue.update({
      where: { id: valueId },
      data: {
        value: value.trim(),
        description: description?.trim() || null,
        cost: cost?.toString() || null,
        unit: unit?.trim() || null,
        order: order !== undefined ? order : existingValue.order,
        isActive: isActive !== undefined ? isActive : existingValue.isActive
      }
    });

    return NextResponse.json({ data: attributeValue });
  } catch (error: any) {
    console.error('Error updating product attribute value:', error);

    // Handle unique constraint violation
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

// DELETE /api/practice-management/product-attributes/:id/values/:valueId
// Delete a product attribute value
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; valueId: string }> }
) {
  try {
    const { doctor } = await getAuthenticatedDoctor(request);
    const resolvedParams = await params;
    const attributeId = parseInt(resolvedParams.id);
    const valueId = parseInt(resolvedParams.valueId);

    if (isNaN(attributeId) || isNaN(valueId)) {
      return NextResponse.json(
        { error: 'Invalid ID' },
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

    // Verify value exists and belongs to this attribute
    const existingValue = await prisma.productAttributeValue.findFirst({
      where: {
        id: valueId,
        attributeId
      }
    });

    if (!existingValue) {
      return NextResponse.json(
        { error: 'Product attribute value not found' },
        { status: 404 }
      );
    }

    // Delete value
    await prisma.productAttributeValue.delete({
      where: { id: valueId }
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    console.error('Error deleting product attribute value:', error);

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
