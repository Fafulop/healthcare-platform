// GET /api/users - List all users (admin only)

import { NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { requireAdmin } from '@healthcare/auth';

export async function GET(request: Request) {
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
            message: 'Admin access required to view users',
          },
          { status: 401 }
        );
      }
    }

    // Fetch all users with their linked doctor info
    const users = await prisma.user.findMany({
      include: {
        doctor: {
          select: {
            id: true,
            slug: true,
            doctorFullName: true,
            primarySpecialty: true,
            heroImage: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({
      success: true,
      count: users.length,
      data: users,
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch users',
      },
      { status: 500 }
    );
  }
}
