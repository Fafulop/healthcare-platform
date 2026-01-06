import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { getAuthenticatedDoctor } from '@/lib/auth';
import { Decimal } from '@prisma/client/runtime/library';

// GET /api/practice-management/products/:id/components
// Get all components for a product
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

    const components = await prisma.productComponent.findMany({
      where: { productId },
      include: {
        attributeValue: {
          include: {
            attribute: true
          }
        }
      },
      orderBy: { order: 'asc' }
    });

    return NextResponse.json({ data: components });
  } catch (error: any) {
    console.error('Error fetching product components:', error);

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

// POST /api/practice-management/products/:id/components
// Add a component to a product (with automatic cost calculation)
export async function POST(
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

    const { attributeValueId, quantity, order } = body;

    // Validation
    if (!attributeValueId || !quantity) {
      return NextResponse.json(
        { error: 'Attribute value ID and quantity are required' },
        { status: 400 }
      );
    }

    if (quantity <= 0) {
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

    // Get attribute value to calculate cost
    const attributeValue = await prisma.productAttributeValue.findUnique({
      where: { id: attributeValueId },
      include: {
        attribute: {
          select: {
            doctorId: true
          }
        }
      }
    });

    if (!attributeValue) {
      return NextResponse.json(
        { error: 'Attribute value not found' },
        { status: 404 }
      );
    }

    // Verify the attribute value belongs to the same doctor
    if (attributeValue.attribute.doctorId !== doctor.id) {
      return NextResponse.json(
        { error: 'Attribute value does not belong to you' },
        { status: 403 }
      );
    }

    // Calculate cost
    const unitCost = parseFloat(attributeValue.cost || '0');
    const calculatedCost = unitCost * parseFloat(quantity.toString());

    // Create component
    const component = await prisma.productComponent.create({
      data: {
        productId,
        attributeValueId,
        quantity: new Decimal(quantity),
        calculatedCost: new Decimal(calculatedCost),
        order: order || 0
      },
      include: {
        attributeValue: {
          include: {
            attribute: true
          }
        }
      }
    });

    return NextResponse.json({ data: component }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating product component:', error);

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
