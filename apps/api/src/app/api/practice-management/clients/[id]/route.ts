import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { getAuthenticatedDoctor } from '@/lib/auth';

// GET /api/practice-management/clients/:id
// Get a single client by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { doctor } = await getAuthenticatedDoctor(request);
    const resolvedParams = await params;
    const clientId = parseInt(resolvedParams.id);

    if (isNaN(clientId)) {
      return NextResponse.json(
        { error: 'Invalid client ID' },
        { status: 400 }
      );
    }

    const client = await prisma.client.findFirst({
      where: {
        id: clientId,
        doctorId: doctor.id
      }
    });

    if (!client) {
      return NextResponse.json(
        { error: 'Client not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: client });
  } catch (error: any) {
    console.error('Error fetching client:', error);

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

// PUT /api/practice-management/clients/:id
// Update a client
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { doctor } = await getAuthenticatedDoctor(request);
    const resolvedParams = await params;
    const clientId = parseInt(resolvedParams.id);
    const body = await request.json();

    if (isNaN(clientId)) {
      return NextResponse.json(
        { error: 'Invalid client ID' },
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
    const existingClient = await prisma.client.findFirst({
      where: {
        id: clientId,
        doctorId: doctor.id
      }
    });

    if (!existingClient) {
      return NextResponse.json(
        { error: 'Client not found' },
        { status: 404 }
      );
    }

    // Update client
    const client = await prisma.client.update({
      where: { id: clientId },
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
        status: status || existingClient.status
      }
    });

    return NextResponse.json({ data: client });
  } catch (error: any) {
    console.error('Error updating client:', error);

    // Handle unique constraint violation (duplicate business name)
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'A client with this business name already exists' },
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

// DELETE /api/practice-management/clients/:id
// Delete a client
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { doctor } = await getAuthenticatedDoctor(request);
    const resolvedParams = await params;
    const clientId = parseInt(resolvedParams.id);

    if (isNaN(clientId)) {
      return NextResponse.json(
        { error: 'Invalid client ID' },
        { status: 400 }
      );
    }

    // Verify ownership
    const existingClient = await prisma.client.findFirst({
      where: {
        id: clientId,
        doctorId: doctor.id
      }
    });

    if (!existingClient) {
      return NextResponse.json(
        { error: 'Client not found' },
        { status: 404 }
      );
    }

    // Delete client
    await prisma.client.delete({
      where: { id: clientId }
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    console.error('Error deleting client:', error);

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
