import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { requireDoctorAuth, logAudit } from '@/lib/medical-auth';
import {
  handleApiError,
  validateRequired,
  validateDateOfBirth,
  validateEmail,
  validateEnum
} from '@/lib/api-error-handler';

// GET /api/medical-records/patients
export async function GET(request: NextRequest) {
  try {
    const { doctorId, userId, role } = await requireDoctorAuth(request);

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'active';
    const search = searchParams.get('search') || '';

    const patients = await prisma.patient.findMany({
      where: {
        doctorId,
        status,
        ...(search ? {
          OR: [
            { firstName: { contains: search, mode: 'insensitive' } },
            { lastName: { contains: search, mode: 'insensitive' } },
            { internalId: { contains: search, mode: 'insensitive' } },
          ]
        } : {})
      },
      orderBy: { lastVisitDate: 'desc' },
      select: {
        id: true,
        internalId: true,
        firstName: true,
        lastName: true,
        dateOfBirth: true,
        sex: true,
        phone: true,
        email: true,
        firstVisitDate: true,
        lastVisitDate: true,
        status: true,
        tags: true,
        photoUrl: true,
        createdAt: true,
        updatedAt: true,
      }
    });

    return NextResponse.json({ data: patients });
  } catch (error) {
    return handleApiError(error, 'GET /api/medical-records/patients');
  }
}

// POST /api/medical-records/patients
export async function POST(request: NextRequest) {
  try {
    const { doctorId, userId, role } = await requireDoctorAuth(request);
    const body = await request.json();

    // Validate required fields
    validateRequired(body, ['firstName', 'lastName', 'dateOfBirth', 'sex']);

    // Validate date of birth
    const dateOfBirth = validateDateOfBirth(body.dateOfBirth);

    // Validate sex enum
    validateEnum(body.sex, ['male', 'female', 'other'] as const, 'sex');

    // Validate email if provided
    if (body.email) {
      validateEmail(body.email);
    }

    // Validate tags is array if provided
    if (body.tags && !Array.isArray(body.tags)) {
      throw new Error('Tags must be an array');
    }

    // Generate internal ID if not provided
    const internalId = body.internalId || `P${Date.now()}`;

    const patient = await prisma.patient.create({
      data: {
        doctorId,
        internalId,
        firstName: body.firstName,
        lastName: body.lastName,
        dateOfBirth,
        sex: body.sex,
        email: body.email,
        phone: body.phone,
        address: body.address,
        city: body.city,
        state: body.state,
        postalCode: body.postalCode,
        emergencyContactName: body.emergencyContactName,
        emergencyContactPhone: body.emergencyContactPhone,
        emergencyContactRelation: body.emergencyContactRelation,
        firstVisitDate: new Date(),
        status: 'active',
        tags: body.tags || [],
        currentAllergies: body.currentAllergies,
        currentChronicConditions: body.currentChronicConditions,
        currentMedications: body.currentMedications,
        bloodType: body.bloodType,
        generalNotes: body.generalNotes,
        photoUrl: body.photoUrl,
      }
    });

    // Log audit
    await logAudit({
      patientId: patient.id,
      doctorId,
      userId,
      userRole: role,
      action: 'create_patient',
      resourceType: 'patient',
      resourceId: patient.id,
      request
    });

    return NextResponse.json({ data: patient }, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'POST /api/medical-records/patients');
  }
}
