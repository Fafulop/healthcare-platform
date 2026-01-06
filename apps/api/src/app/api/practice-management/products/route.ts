import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { getAuthenticatedDoctor } from '@/lib/auth';

// GET /api/practice-management/products
// Get all products for authenticated doctor with optional filtering
export async function GET(request: NextRequest) {
  try {
    const { doctor } = await getAuthenticatedDoctor(request);
    const { searchParams } = new URL(request.url);

    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const category = searchParams.get('category'); // rfc field

    const where: any = { doctorId: doctor.id };

    // Filter by status
    if (status) {
      where.status = status;
    }

    // Filter by category
    if (category) {
      where.category = category;
    }

    // Search across multiple fields
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } }, // Product name
        { sku: { contains: search, mode: 'insensitive' } }, // SKU
        { category: { contains: search, mode: 'insensitive' } } // Category
      ];
    }

    const products = await prisma.product.findMany({
      where,
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
      },
      orderBy: { name: 'asc' }
    });

    return NextResponse.json({ data: products });
  } catch (error: any) {
    console.error('Error fetching products:', error);

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

// POST /api/practice-management/products
// Create a new product
export async function POST(request: NextRequest) {
  try {
    const { doctor } = await getAuthenticatedDoctor(request);
    const body = await request.json();

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

    // Create product
    const product = await prisma.product.create({
      data: {
        doctorId: doctor.id,
        name: name.trim(),
        sku: sku?.trim() || null,
        category: category?.trim() || null,
        description: description?.trim() || null,
        price: price ? parseFloat(price.toString()) : null,
        cost: cost ? parseFloat(cost.toString()) : null,
        stockQuantity: stockQuantity ? parseInt(stockQuantity.toString()) : 0,
        unit: unit?.trim() || null,
        status: status || 'active'
      },
      include: {
        components: {
          include: {
            attributeValue: {
              include: {
                attribute: true
              }
            }
          }
        }
      }
    });

    return NextResponse.json({ data: product }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating product:', error);

    // Handle unique constraint violation (duplicate product name)
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
