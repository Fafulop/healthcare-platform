import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { requireDoctorAuth } from '@/lib/medical-auth';
import {
  DEFAULT_FIELD_VISIBILITY,
  DEFAULT_VALUES,
  DEFAULT_TEMPLATE,
  MAX_TEMPLATES_PER_DOCTOR,
  validateTemplateName,
  validateFieldVisibility,
} from '@/constants/encounter-fields';
import type { FieldVisibility, DefaultValues } from '@/types/encounter-template';

/**
 * GET /api/medical-records/templates
 * List all templates for the authenticated doctor
 */
export async function GET(request: NextRequest) {
  try {
    const authContext = await requireDoctorAuth(request);

    // Get all active templates for this doctor
    const templates = await prisma.encounterTemplate.findMany({
      where: {
        doctorId: authContext.doctorId,
        isActive: true,
      },
      orderBy: [
        { isDefault: 'desc' }, // Default template first
        { displayOrder: 'asc' },
        { name: 'asc' },
      ],
    });

    // If no templates exist, create the default one
    if (templates.length === 0) {
      const defaultTemplate = await prisma.encounterTemplate.create({
        data: {
          doctorId: authContext.doctorId,
          name: DEFAULT_TEMPLATE.name,
          description: DEFAULT_TEMPLATE.description,
          icon: DEFAULT_TEMPLATE.icon,
          color: DEFAULT_TEMPLATE.color,
          fieldVisibility: DEFAULT_TEMPLATE.fieldVisibility as object,
          defaultValues: DEFAULT_TEMPLATE.defaultValues as object,
          useSOAPMode: DEFAULT_TEMPLATE.useSOAPMode,
          isDefault: true,
          isActive: true,
          displayOrder: 0,
        },
      });

      return NextResponse.json({
        success: true,
        data: [defaultTemplate],
      });
    }

    return NextResponse.json({
      success: true,
      data: templates,
    });
  } catch (error: any) {
    console.error('Error fetching templates:', error);

    if (error.message === 'Authentication required' ||
        error.message === 'Doctor or Admin role required' ||
        error.message === 'No doctor profile linked to user') {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    return NextResponse.json(
      { error: 'Error al obtener plantillas' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/medical-records/templates
 * Create a new template for the authenticated doctor
 */
export async function POST(request: NextRequest) {
  try {
    const authContext = await requireDoctorAuth(request);
    const body = await request.json();

    // Validate required fields
    const nameError = validateTemplateName(body.name);
    if (nameError) {
      return NextResponse.json({ error: nameError }, { status: 400 });
    }

    // Validate field visibility
    const fieldVisibility: FieldVisibility = {
      ...DEFAULT_FIELD_VISIBILITY,
      ...body.fieldVisibility,
    };
    const visibilityError = validateFieldVisibility(fieldVisibility);
    if (visibilityError) {
      return NextResponse.json({ error: visibilityError }, { status: 400 });
    }

    // Check template limit
    const existingCount = await prisma.encounterTemplate.count({
      where: {
        doctorId: authContext.doctorId,
        isActive: true,
      },
    });

    if (existingCount >= MAX_TEMPLATES_PER_DOCTOR) {
      return NextResponse.json(
        {
          error: `Límite alcanzado: máximo ${MAX_TEMPLATES_PER_DOCTOR} plantillas permitidas`,
        },
        { status: 400 }
      );
    }

    // Check for duplicate name
    const existing = await prisma.encounterTemplate.findUnique({
      where: {
        doctorId_name: {
          doctorId: authContext.doctorId,
          name: body.name.trim(),
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Ya existe una plantilla con este nombre' },
        { status: 400 }
      );
    }

    // If setting as default, unset any existing default
    if (body.isDefault) {
      await prisma.encounterTemplate.updateMany({
        where: {
          doctorId: authContext.doctorId,
          isDefault: true,
        },
        data: {
          isDefault: false,
        },
      });
    }

    // Get the next display order
    const maxOrderResult = await prisma.encounterTemplate.aggregate({
      where: { doctorId: authContext.doctorId },
      _max: { displayOrder: true },
    });
    const nextOrder = (maxOrderResult._max.displayOrder ?? -1) + 1;

    // Create the template
    const template = await prisma.encounterTemplate.create({
      data: {
        doctorId: authContext.doctorId,
        name: body.name.trim(),
        description: body.description?.trim() || null,
        icon: body.icon || null,
        color: body.color || null,
        fieldVisibility: fieldVisibility as object,
        defaultValues: (body.defaultValues || DEFAULT_VALUES) as object,
        useSOAPMode: body.useSOAPMode ?? false,
        isDefault: body.isDefault ?? false,
        isActive: true,
        displayOrder: body.displayOrder ?? nextOrder,
      },
    });

    return NextResponse.json({
      success: true,
      data: template,
    }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating template:', error);

    if (error.message === 'Authentication required' ||
        error.message === 'Doctor or Admin role required' ||
        error.message === 'No doctor profile linked to user') {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    // Handle unique constraint violation
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'Ya existe una plantilla con este nombre' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Error al crear plantilla' },
      { status: 500 }
    );
  }
}
