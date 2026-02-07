/**
 * GET /api/custom-templates/[id] - Get single template
 * PUT /api/custom-templates/[id] - Update template
 * DELETE /api/custom-templates/[id] - Delete template
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { requireDoctorAuth } from '@/lib/medical-auth';
import { handleApiError } from '@/lib/api-error-handler';

// GET - Get single template
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { doctorId } = await requireDoctorAuth(request);
    const { id } = await params;

    const template = await prisma.encounterTemplate.findFirst({
      where: {
        id,
        doctorId,
        isCustom: true,
      },
    });

    if (!template) {
      return NextResponse.json(
        {
          success: false,
          error: 'Template not found',
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: template,
    });
  } catch (error) {
    return handleApiError(error, 'GET /api/custom-templates/[id]');
  }
}

// PUT - Update template
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { doctorId } = await requireDoctorAuth(request);
    const { id } = await params;
    const body = await request.json();

    // Verify template exists and belongs to doctor
    const existing = await prisma.encounterTemplate.findFirst({
      where: {
        id,
        doctorId,
        isCustom: true,
      },
    });

    if (!existing) {
      return NextResponse.json(
        {
          success: false,
          error: 'Template not found',
        },
        { status: 404 }
      );
    }

    // Check for name conflicts if changing name
    if (body.name && body.name !== existing.name) {
      const nameConflict = await prisma.encounterTemplate.findFirst({
        where: {
          doctorId,
          name: body.name,
          id: { not: id },
        },
      });

      if (nameConflict) {
        return NextResponse.json(
          {
            success: false,
            error: 'A template with this name already exists',
          },
          { status: 409 }
        );
      }
    }

    // If setting as default, unset other defaults
    if (body.isDefault && !existing.isDefault) {
      await prisma.encounterTemplate.updateMany({
        where: {
          doctorId,
          isCustom: true,
          isDefault: true,
          id: { not: id },
        },
        data: {
          isDefault: false,
        },
      });
    }

    // Build update data (only include provided fields)
    const updateData: any = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.icon !== undefined) updateData.icon = body.icon;
    if (body.color !== undefined) updateData.color = body.color;
    if (body.customFields !== undefined) updateData.customFields = body.customFields;
    if (body.isDefault !== undefined) updateData.isDefault = body.isDefault;
    if (body.isActive !== undefined) updateData.isActive = body.isActive;
    if (body.displayOrder !== undefined) updateData.displayOrder = body.displayOrder;

    // Update template
    const template = await prisma.encounterTemplate.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      data: template,
    });
  } catch (error) {
    return handleApiError(error, 'PUT /api/custom-templates/[id]');
  }
}

// DELETE - Delete template
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { doctorId } = await requireDoctorAuth(request);
    const { id } = await params;

    // Verify template exists and belongs to doctor
    const existing = await prisma.encounterTemplate.findFirst({
      where: {
        id,
        doctorId,
        isCustom: true,
      },
      include: {
        _count: {
          select: {
            encounters: true,
          },
        },
      },
    });

    if (!existing) {
      return NextResponse.json(
        {
          success: false,
          error: 'Template not found',
        },
        { status: 404 }
      );
    }

    // Check if template has been used
    if (existing._count.encounters > 0) {
      // Don't delete, just deactivate
      await prisma.encounterTemplate.update({
        where: { id },
        data: {
          isActive: false,
          isDefault: false,
        },
      });

      return NextResponse.json({
        success: true,
        message: `Template deactivated (was used in ${existing._count.encounters} encounters)`,
      });
    } else {
      // Safe to delete - no encounters use it
      await prisma.encounterTemplate.delete({
        where: { id },
      });

      return NextResponse.json({
        success: true,
        message: 'Template deleted',
      });
    }
  } catch (error) {
    return handleApiError(error, 'DELETE /api/custom-templates/[id]');
  }
}
