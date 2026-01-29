import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { requireDoctorAuth } from '@/lib/medical-auth';
import {
  DEFAULT_FIELD_VISIBILITY,
  validateTemplateName,
  validateFieldVisibility,
} from '@/constants/encounter-fields';
import type { FieldVisibility } from '@/types/encounter-template';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/medical-records/templates/[id]
 * Get a specific template by ID
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const authContext = await requireDoctorAuth(request);
    const { id } = await params;

    const template = await prisma.encounterTemplate.findFirst({
      where: {
        id,
        doctorId: authContext.doctorId,
      },
    });

    if (!template) {
      return NextResponse.json(
        { error: 'Plantilla no encontrada' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: template,
    });
  } catch (error: any) {
    console.error('Error fetching template:', error);

    if (error.message === 'Authentication required' ||
        error.message === 'Doctor or Admin role required' ||
        error.message === 'No doctor profile linked to user') {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    return NextResponse.json(
      { error: 'Error al obtener plantilla' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/medical-records/templates/[id]
 * Update a template
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const authContext = await requireDoctorAuth(request);
    const { id } = await params;
    const body = await request.json();

    // Check template exists and belongs to doctor
    const existing = await prisma.encounterTemplate.findFirst({
      where: {
        id,
        doctorId: authContext.doctorId,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Plantilla no encontrada' },
        { status: 404 }
      );
    }

    // Validate name if provided
    if (body.name !== undefined) {
      const nameError = validateTemplateName(body.name);
      if (nameError) {
        return NextResponse.json({ error: nameError }, { status: 400 });
      }

      // Check for duplicate name (excluding current template)
      const duplicate = await prisma.encounterTemplate.findFirst({
        where: {
          doctorId: authContext.doctorId,
          name: body.name.trim(),
          id: { not: id },
        },
      });

      if (duplicate) {
        return NextResponse.json(
          { error: 'Ya existe una plantilla con este nombre' },
          { status: 400 }
        );
      }
    }

    // Validate field visibility if provided
    if (body.fieldVisibility !== undefined) {
      const fieldVisibility: FieldVisibility = {
        ...DEFAULT_FIELD_VISIBILITY,
        ...body.fieldVisibility,
      };
      const visibilityError = validateFieldVisibility(fieldVisibility);
      if (visibilityError) {
        return NextResponse.json({ error: visibilityError }, { status: 400 });
      }
    }

    // If setting as default, unset any existing default
    if (body.isDefault === true && !existing.isDefault) {
      await prisma.encounterTemplate.updateMany({
        where: {
          doctorId: authContext.doctorId,
          isDefault: true,
          id: { not: id },
        },
        data: {
          isDefault: false,
        },
      });
    }

    // Prevent unsetting default if it's the only template
    if (body.isDefault === false && existing.isDefault) {
      const otherTemplates = await prisma.encounterTemplate.count({
        where: {
          doctorId: authContext.doctorId,
          isActive: true,
          id: { not: id },
        },
      });

      if (otherTemplates === 0) {
        return NextResponse.json(
          { error: 'Debe haber al menos una plantilla predeterminada' },
          { status: 400 }
        );
      }
    }

    // Build update data
    const updateData: any = {};
    if (body.name !== undefined) updateData.name = body.name.trim();
    if (body.description !== undefined) updateData.description = body.description?.trim() || null;
    if (body.icon !== undefined) updateData.icon = body.icon;
    if (body.color !== undefined) updateData.color = body.color;
    if (body.fieldVisibility !== undefined) {
      updateData.fieldVisibility = {
        ...DEFAULT_FIELD_VISIBILITY,
        ...body.fieldVisibility,
      };
    }
    if (body.defaultValues !== undefined) updateData.defaultValues = body.defaultValues;
    if (body.useSOAPMode !== undefined) updateData.useSOAPMode = body.useSOAPMode;
    if (body.isDefault !== undefined) updateData.isDefault = body.isDefault;
    if (body.isActive !== undefined) updateData.isActive = body.isActive;
    if (body.displayOrder !== undefined) updateData.displayOrder = body.displayOrder;

    const template = await prisma.encounterTemplate.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      data: template,
    });
  } catch (error: any) {
    console.error('Error updating template:', error);

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
      { error: 'Error al actualizar plantilla' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/medical-records/templates/[id]
 * Delete a template (soft delete by setting isActive=false)
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const authContext = await requireDoctorAuth(request);
    const { id } = await params;

    // Check template exists and belongs to doctor
    const existing = await prisma.encounterTemplate.findFirst({
      where: {
        id,
        doctorId: authContext.doctorId,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Plantilla no encontrada' },
        { status: 404 }
      );
    }

    // Prevent deleting the default template
    if (existing.isDefault) {
      return NextResponse.json(
        { error: 'No se puede eliminar la plantilla predeterminada. Establezca otra plantilla como predeterminada primero.' },
        { status: 400 }
      );
    }

    // Soft delete - set isActive to false
    await prisma.encounterTemplate.update({
      where: { id },
      data: { isActive: false },
    });

    return NextResponse.json({
      success: true,
      message: 'Plantilla eliminada correctamente',
    });
  } catch (error: any) {
    console.error('Error deleting template:', error);

    if (error.message === 'Authentication required' ||
        error.message === 'Doctor or Admin role required' ||
        error.message === 'No doctor profile linked to user') {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    return NextResponse.json(
      { error: 'Error al eliminar plantilla' },
      { status: 500 }
    );
  }
}
