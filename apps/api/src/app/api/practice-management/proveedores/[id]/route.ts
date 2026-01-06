import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { getAuthenticatedDoctor } from '@/lib/auth';

// GET /api/practice-management/proveedores/:id
// Get a single supplier by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { doctor } = await getAuthenticatedDoctor(request);
    const resolvedParams = await params;
    const proveedorId = parseInt(resolvedParams.id);

    if (isNaN(proveedorId)) {
      return NextResponse.json(
        { error: 'Invalid supplier ID' },
        { status: 400 }
      );
    }

    const proveedor = await prisma.proveedor.findFirst({
      where: {
        id: proveedorId,
        doctorId: doctor.id
      }
    });

    if (!proveedor) {
      return NextResponse.json(
        { error: 'Supplier not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: proveedor });
  } catch (error: any) {
    console.error('Error fetching supplier:', error);

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

// PUT /api/practice-management/proveedores/:id
// Update a supplier
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { doctor } = await getAuthenticatedDoctor(request);
    const resolvedParams = await params;
    const proveedorId = parseInt(resolvedParams.id);
    const body = await request.json();

    if (isNaN(proveedorId)) {
      return NextResponse.json(
        { error: 'Invalid supplier ID' },
        { status: 400 }
      );
    }

    const {
      businessName,
      contactName,
      rfc,
      email,
      phone,
      street,
      city,
      state,
      postalCode,
      country,
      industry,
      notes,
      status
    } = body;

    // Validation
    if (!businessName || typeof businessName !== 'string' || businessName.trim().length === 0) {
      return NextResponse.json(
        { error: 'Business name is required' },
        { status: 400 }
      );
    }

    // Email validation
    if (email && !isValidEmail(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Status validation
    if (status && !['active', 'inactive'].includes(status)) {
      return NextResponse.json(
        { error: 'Status must be active or inactive' },
        { status: 400 }
      );
    }

    // Verify ownership
    const existingProveedor = await prisma.proveedor.findFirst({
      where: {
        id: proveedorId,
        doctorId: doctor.id
      }
    });

    if (!existingProveedor) {
      return NextResponse.json(
        { error: 'Supplier not found' },
        { status: 404 }
      );
    }

    // Update supplier
    const proveedor = await prisma.proveedor.update({
      where: { id: proveedorId },
      data: {
        businessName: businessName.trim(),
        contactName: contactName?.trim() || null,
        rfc: rfc?.trim() || null,
        email: email?.trim() || null,
        phone: phone?.trim() || null,
        street: street?.trim() || null,
        city: city?.trim() || null,
        state: state?.trim() || null,
        postalCode: postalCode?.trim() || null,
        country: country?.trim() || 'México',
        industry: industry?.trim() || null,
        notes: notes?.trim() || null,
        status: status || existingProveedor.status
      }
    });

    return NextResponse.json({ data: proveedor });
  } catch (error: any) {
    console.error('Error updating supplier:', error);

    // Handle unique constraint violation (duplicate business name)
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'A supplier with this business name already exists' },
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

// DELETE /api/practice-management/proveedores/:id
// Delete a supplier
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { doctor } = await getAuthenticatedDoctor(request);
    const resolvedParams = await params;
    const proveedorId = parseInt(resolvedParams.id);

    if (isNaN(proveedorId)) {
      return NextResponse.json(
        { error: 'Invalid supplier ID' },
        { status: 400 }
      );
    }

    // Verify ownership
    const existingProveedor = await prisma.proveedor.findFirst({
      where: {
        id: proveedorId,
        doctorId: doctor.id
      }
    });

    if (!existingProveedor) {
      return NextResponse.json(
        { error: 'Supplier not found' },
        { status: 404 }
      );
    }

    // Delete supplier
    await prisma.proveedor.delete({
      where: { id: proveedorId }
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    console.error('Error deleting supplier:', error);

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

// Helper function for email validation
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
