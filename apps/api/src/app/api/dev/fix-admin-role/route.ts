// DEV ONLY - Fix admin role
// DELETE THIS FILE after use

import { NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';

export async function POST(request: Request) {
  // Only allow in development
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 });
  }

  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: 'Email required' }, { status: 400 });
    }

    console.log(`Updating role to ADMIN for: ${email}`);

    const user = await prisma.user.update({
      where: { email },
      data: { role: 'ADMIN' },
    });

    console.log('✅ Role updated:', user);

    return NextResponse.json({
      success: true,
      message: 'Role updated to ADMIN',
      user,
    });
  } catch (error) {
    console.error('Error updating role:', error);
    return NextResponse.json(
      { error: 'Failed to update role', details: error },
      { status: 500 }
    );
  }
}

// Also add a GET to check current role
export async function GET() {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 });
  }

  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        doctorId: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      success: true,
      users,
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
}
