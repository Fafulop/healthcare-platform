/**
 * POST /api/custom-templates - Create custom encounter template
 * GET /api/custom-templates - List doctor's custom templates
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { requireDoctorAuth } from '@/lib/medical-auth';
import { handleApiError } from '@/lib/api-error-handler';
import { validateCustomFields } from '@/lib/custom-template-validation';

// GET - List custom templates for authenticated doctor
export async function GET(request: NextRequest) {
  try {
    const { doctorId } = await requireDoctorAuth(request);
    const { searchParams } = new URL(request.url);
    const isPreAppointmentFilter = searchParams.get('isPreAppointment');
    const isRecetaFilter = searchParams.get('isReceta');

    const where: any = { doctorId, isCustom: true, isActive: true };
    if (isPreAppointmentFilter === 'true') where.isPreAppointment = true;
    if (isRecetaFilter === 'true') where.isReceta = true;

    const templates = await prisma.encounterTemplate.findMany({
      where,
      orderBy: [
        { displayOrder: 'asc' },
        { createdAt: 'desc' },
      ],
    });

    return NextResponse.json({
      success: true,
      data: templates,
    });
  } catch (error) {
    return handleApiError(error, 'GET /api/custom-templates');
  }
}

// POST - Create new custom template
export async function POST(request: NextRequest) {
  try {
    const { doctorId } = await requireDoctorAuth(request);
    const body = await request.json();

    // Validate required fields
    if (!body.name || typeof body.name !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: 'Template name is required',
        },
        { status: 400 }
      );
    }

    if (!body.customFields || !Array.isArray(body.customFields)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Custom fields array is required',
        },
        { status: 400 }
      );
    }

    // Validate custom fields structure
    const validationError = validateCustomFields(body.customFields);
    if (validationError) {
      return NextResponse.json(
        {
          success: false,
          error: validationError,
        },
        { status: 400 }
      );
    }

    // Check for duplicate name
    const existing = await prisma.encounterTemplate.findUnique({
      where: {
        doctorId_name: {
          doctorId,
          name: body.name,
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        {
          success: false,
          error: 'A template with this name already exists',
        },
        { status: 409 }
      );
    }

    // If setting as default, unset other defaults
    if (body.isDefault) {
      await prisma.encounterTemplate.updateMany({
        where: {
          doctorId,
          isCustom: true,
          isDefault: true,
        },
        data: {
          isDefault: false,
        },
      });
    }

    // Create template
    const template = await prisma.encounterTemplate.create({
      data: {
        doctorId,
        name: body.name,
        description: body.description || null,
        icon: body.icon || null,
        color: body.color || null,
        isCustom: true,
        customFields: body.customFields,
        // Empty for custom templates
        fieldVisibility: {},
        defaultValues: {},
        useSOAPMode: false,
        isDefault: body.isDefault || false,
        isPreAppointment: body.isPreAppointment ?? false,
        isReceta: body.isReceta ?? false,
        isActive: true,
        displayOrder: body.displayOrder || 0,
      },
    });

    return NextResponse.json(
      {
        success: true,
        data: template,
      },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error, 'POST /api/custom-templates');
  }
}

