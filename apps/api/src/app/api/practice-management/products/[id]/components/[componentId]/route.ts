import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { getAuthenticatedDoctor } from '@/lib/auth';

// PUT /api/practice-management/products/:id/components/:componentId
// Update a product component (recalculates cost)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; componentId: string }> }
) {
  try {
    const { doctor } = await getAuthenticatedDoctor(request);
    const resolvedParams = await params;
    const productId = parseInt(resolvedParams.id);
    const componentId = parseInt(resolvedParams.componentId);
    const body = await request.json();

    if (isNaN(productId) || isNaN(componentId)) {
      return NextResponse.json(
        { error: 'Invalid ID' },
        { status: 400 }
      );
    }

    const { quantity, order } = body;

    // Validation
    if (!quantity || quantity <= 0) {
      return NextResponse.json(
        { error: 'Quantity must be greater than 0' },
        { status: 400 }
      );
    }

    // Verify product ownership
    const product = await prisma.product.findFirst({
      where: {
        id: productId,
        doctorId: doctor.id
      }
    });

    if (!product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }

    // Verify component exists and belongs to this product
    const existingComponent = await prisma.productComponent.findFirst({
      where: {
        id: componentId,
        productId
      },
      include: {
        attributeValue: true
      }
    });

    if (!existingComponent) {
      return NextResponse.json(
        { error: 'Component not found' },
        { status: 404 }
      );
    }

    // Recalculate cost
    const unitCost = parseFloat(existingComponent.attributeValue.cost?.toString() || '0');
    const calculatedCost = unitCost * parseFloat(quantity.toString());

    // Update component
    const component = await prisma.productComponent.update({
      where: { id: componentId },
      data: {
        quantity,
        calculatedCost,
        order: order !== undefined ? order : existingComponent.order
      },
      include: {
        attributeValue: {
          include: {
            attribute: true
          }
        }
      }
    });

    return NextResponse.json({ data: component });
  } catch (error: any) {
    console.error('Error updating product component:', error);

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

// DELETE /api/practice-management/products/:id/components/:componentId
// Delete a product component
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; componentId: string }> }
) {
  try {
    const { doctor } = await getAuthenticatedDoctor(request);
    const resolvedParams = await params;
    const productId = parseInt(resolvedParams.id);
    const componentId = parseInt(resolvedParams.componentId);

    if (isNaN(productId) || isNaN(componentId)) {
      return NextResponse.json(
        { error: 'Invalid ID' },
        { status: 400 }
      );
    }

    // Verify product ownership
    const product = await prisma.product.findFirst({
      where: {
        id: productId,
        doctorId: doctor.id
      }
    });

    if (!product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }

    // Verify component exists and belongs to this product
    const existingComponent = await prisma.productComponent.findFirst({
      where: {
        id: componentId,
        productId
      }
    });

    if (!existingComponent) {
      return NextResponse.json(
        { error: 'Component not found' },
        { status: 404 }
      );
    }

    // Delete component
    await prisma.productComponent.delete({
      where: { id: componentId }
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    console.error('Error deleting product component:', error);

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
