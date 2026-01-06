import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { getAuthenticatedDoctor } from '@/lib/auth';

// GET /api/practice-management/products/:id
// Get a single product by ID with components
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { doctor } = await getAuthenticatedDoctor(request);
    const resolvedParams = await params;
    const productId = parseInt(resolvedParams.id);

    if (isNaN(productId)) {
      return NextResponse.json(
        { error: 'Invalid product ID' },
        { status: 400 }
      );
    }

    const product = await prisma.product.findFirst({
      where: {
        id: productId,
        doctorId: doctor.id
      },
      include: {
        components: {
          include: {
            attributeValue: {
              include: {
                attribute: true
              }
            }
          },
          orderBy: { order: 'asc' }
        }
      }
    });

    if (!product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: product });
  } catch (error: any) {
    console.error('Error fetching product:', error);

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

// PUT /api/practice-management/products/:id
// Update a product
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { doctor } = await getAuthenticatedDoctor(request);
    const resolvedParams = await params;
    const productId = parseInt(resolvedParams.id);
    const body = await request.json();

    if (isNaN(productId)) {
      return NextResponse.json(
        { error: 'Invalid product ID' },
        { status: 400 }
      );
    }

    const {
      name,
      sku,
      category,
      description,
      price,
      cost,
      stockQuantity,
      unit,
      status
    } = body;

    // Validation
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Product name is required' },
        { status: 400 }
      );
    }

    // Verify ownership
    const existingProduct = await prisma.product.findFirst({
      where: {
        id: productId,
        doctorId: doctor.id
      }
    });

    if (!existingProduct) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }

    // Update product
    const product = await prisma.product.update({
      where: { id: productId },
      data: {
        name: name.trim(),
        sku: sku?.trim() || null,
        category: category?.trim() || null,
        description: description?.trim() || null,
        price: price ? parseFloat(price.toString()) : null,
        cost: cost ? parseFloat(cost.toString()) : null,
        stockQuantity: stockQuantity ? parseInt(stockQuantity.toString()) : null,
        unit: unit?.trim() || null,
        status: status || existingProduct.status
      },
      include: {
        components: {
          include: {
            attributeValue: {
              include: {
                attribute: true
              }
            }
          },
          orderBy: { order: 'asc' }
        }
      }
    });

    return NextResponse.json({ data: product });
  } catch (error: any) {
    console.error('Error updating product:', error);

    // Handle unique constraint violation
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'A product with this name already exists' },
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

// DELETE /api/practice-management/products/:id
// Delete a product (cascades to components)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { doctor } = await getAuthenticatedDoctor(request);
    const resolvedParams = await params;
    const productId = parseInt(resolvedParams.id);

    if (isNaN(productId)) {
      return NextResponse.json(
        { error: 'Invalid product ID' },
        { status: 400 }
      );
    }

    // Verify ownership
    const existingProduct = await prisma.product.findFirst({
      where: {
        id: productId,
        doctorId: doctor.id
      }
    });

    if (!existingProduct) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }

    // Delete product (cascades to components)
    await prisma.product.delete({
      where: { id: productId }
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    console.error('Error deleting product:', error);

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
