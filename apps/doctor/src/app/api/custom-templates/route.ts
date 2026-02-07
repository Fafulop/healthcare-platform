/**
 * POST /api/custom-templates - Create custom encounter template
 * GET /api/custom-templates - List doctor's custom templates
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { requireDoctorAuth } from '@/lib/medical-auth';
import { handleApiError } from '@/lib/api-error-handler';
import type { FieldDefinition } from '@/types/custom-encounter';

// GET - List custom templates for authenticated doctor
export async function GET(request: NextRequest) {
  try {
    const { doctorId } = await requireDoctorAuth(request);

    const templates = await prisma.encounterTemplate.findMany({
      where: {
        doctorId,
        isCustom: true,
        isActive: true,
      },
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

/**
 * Validate custom fields array structure
 */
function validateCustomFields(fields: any[]): string | null {
  if (fields.length === 0) {
    return 'At least one field is required';
  }

  if (fields.length > 50) {
    return 'Maximum 50 fields allowed';
  }

  const fieldNames = new Set<string>();

  for (let i = 0; i < fields.length; i++) {
    const field = fields[i];

    // Check required properties
    if (!field.id || typeof field.id !== 'string') {
      return `Field at index ${i}: id is required`;
    }

    if (!field.name || typeof field.name !== 'string') {
      return `Field at index ${i}: name is required`;
    }

    // Check for duplicate names
    if (fieldNames.has(field.name)) {
      return `Duplicate field name: ${field.name}`;
    }
    fieldNames.add(field.name);

    // Validate field name format (camelCase)
    if (!/^[a-z][a-zA-Z0-9]*$/.test(field.name)) {
      return `Field "${field.name}": name must be camelCase (start with lowercase, no spaces)`;
    }

    if (!field.label || typeof field.label !== 'string') {
      return `Field "${field.name}": label is required`;
    }

    if (!field.type) {
      return `Field "${field.name}": type is required`;
    }

    const validTypes = ['text', 'textarea', 'number', 'date', 'time', 'dropdown', 'radio', 'checkbox', 'file'];
    if (!validTypes.includes(field.type)) {
      return `Field "${field.name}": invalid type "${field.type}"`;
    }

    if (typeof field.required !== 'boolean') {
      return `Field "${field.name}": required must be boolean`;
    }

    if (typeof field.order !== 'number') {
      return `Field "${field.name}": order must be number`;
    }

    // Validate type-specific requirements
    if ((field.type === 'dropdown' || field.type === 'radio') && !field.options) {
      return `Field "${field.name}": options array required for ${field.type}`;
    }

    if (field.options && !Array.isArray(field.options)) {
      return `Field "${field.name}": options must be an array`;
    }

    if (field.options && field.options.length === 0) {
      return `Field "${field.name}": options array cannot be empty`;
    }
  }

  return null;
}
