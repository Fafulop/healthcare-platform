// PATCH /api/users/[id] - Update user's doctorId (link/unlink)
// GET /api/users/[id] - Get single user

import { NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { requireAdmin } from '@healthcare/auth';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        doctor: {
          select: {
            id: true,
            slug: true,
            doctorFullName: true,
            primarySpecialty: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: `User with id "${id}" not found`,
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch user',
      },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Check for admin access
    const origin = request.headers.get('origin');
    const isLocalDev = process.env.NODE_ENV === 'development';
    const isFromAdminApp = origin === 'http://localhost:3002';

    // Skip auth check for admin app in local development
    if (!isLocalDev || !isFromAdminApp) {
      try {
        await requireAdmin();
      } catch (error) {
        console.error('Authentication failed:', error);
        return NextResponse.json(
          {
            success: false,
            error: 'Unauthorized',
            message: 'Admin access required to update users',
          },
          { status: 401 }
        );
      }
    }

    const { id } = await params;
    const body = await request.json();

    console.log('Updating user:', {
      userId: id,
      doctorId: body.doctorId,
    });

    // Validate that the doctor exists if doctorId is provided
    if (body.doctorId) {
      const doctorExists = await prisma.doctor.findUnique({
        where: { id: body.doctorId },
      });

      if (!doctorExists) {
        return NextResponse.json(
          {
            success: false,
            error: 'Invalid doctorId',
            message: `Doctor with id "${body.doctorId}" not found`,
          },
          { status: 400 }
        );
      }
    }

    // Update the user
    const user = await prisma.user.update({
      where: { id },
      data: {
        doctorId: body.doctorId || null, // null to unlink
      },
      include: {
        doctor: {
          select: {
            id: true,
            slug: true,
            doctorFullName: true,
            primarySpecialty: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: user,
      message: body.doctorId
        ? `User linked to doctor profile successfully`
        : `User unlinked from doctor profile`,
    });
  } catch (error) {
    console.error('Error updating user:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update user',
        message: errorMessage,
      },
      { status: 500 }
    );
  }
}
