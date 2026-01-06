import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { getAuthenticatedDoctor } from '@/lib/auth';

// GET /api/practice-management/clients
// Get all clients for authenticated doctor with optional filtering
export async function GET(request: NextRequest) {
  try {
    const { doctor } = await getAuthenticatedDoctor(request);
    const { searchParams } = new URL(request.url);

    const status = searchParams.get('status');
    const search = searchParams.get('search');

    const where: any = { doctorId: doctor.id };

    // Filter by status
    if (status) {
      where.status = status;
    }

    // Search across multiple fields
    if (search) {
      where.OR = [
        { businessName: { contains: search, mode: 'insensitive' } },
        { contactName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } }
      ];
    }

    const clients = await prisma.client.findMany({
      where,
      orderBy: { businessName: 'asc' }
    });

    return NextResponse.json({ data: clients });
  } catch (error: any) {
    console.error('Error fetching clients:', error);

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

// POST /api/practice-management/clients
// Create a new client for authenticated doctor
export async function POST(request: NextRequest) {
  try {
    const { doctor } = await getAuthenticatedDoctor(request);
    const body = await request.json();

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

    // Create client
    const client = await prisma.client.create({
      data: {
        doctorId: doctor.id,
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
        status: status || 'active'
      }
    });

    return NextResponse.json({ data: client }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating client:', error);

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

// Helper function for email validation
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
