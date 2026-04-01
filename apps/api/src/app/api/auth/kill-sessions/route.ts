import { prisma } from '@healthcare/database';
import { NextResponse } from 'next/server';
import { validateAuthToken } from '@/lib/auth';

export async function PATCH(request: Request) {
  let authUser: Awaited<ReturnType<typeof validateAuthToken>>;

  try {
    authUser = await validateAuthToken(request);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    await prisma.user.update({
      where: { id: authUser.userId },
      data: { sessionVersion: { increment: 1 } },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to invalidate sessions' },
      { status: 500 }
    );
  }
}
