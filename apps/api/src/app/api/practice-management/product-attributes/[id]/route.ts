import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { getAuthenticatedDoctor } from '@/lib/auth';

// PUT /api/practice-management/product-attributes/:id
// Update a product attribute
export async function PUT(
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

    const { name, description, order, isActive } = body;

    // Validation
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Attribute name is required' },
        { status: 400 }
      );
    }

    // Verify ownership
    const existingAttribute = await prisma.productAttribute.findFirst({
      where: {
        id: attributeId,
        doctorId: doctor.id
      }
    });

    if (!existingAttribute) {
      return NextResponse.json(
        { error: 'Product attribute not found' },
        { status: 404 }
      );
    }

    // Update attribute
    const attribute = await prisma.productAttribute.update({
      where: { id: attributeId },
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        order: order !== undefined ? order : existingAttribute.order,
        isActive: isActive !== undefined ? isActive : existingAttribute.isActive
      },
      include: {
        values: {
          where: { isActive: true },
          orderBy: { order: 'asc' }
        }
      }
    });

    return NextResponse.json({ data: attribute });
  } catch (error: any) {
    console.error('Error updating product attribute:', error);

    // Handle unique constraint violation
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

// DELETE /api/practice-management/product-attributes/:id
// Delete a product attribute (cascades to values)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { doctor } = await getAuthenticatedDoctor(request);
    const resolvedParams = await params;
    const attributeId = parseInt(resolvedParams.id);

    if (isNaN(attributeId)) {
      return NextResponse.json(
        { error: 'Invalid attribute ID' },
        { status: 400 }
      );
    }

    // Verify ownership
    const existingAttribute = await prisma.productAttribute.findFirst({
      where: {
        id: attributeId,
        doctorId: doctor.id
      }
    });

    if (!existingAttribute) {
      return NextResponse.json(
        { error: 'Product attribute not found' },
        { status: 404 }
      );
    }

    // Delete attribute (cascades to values)
    await prisma.productAttribute.delete({
      where: { id: attributeId }
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    console.error('Error deleting product attribute:', error);

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
