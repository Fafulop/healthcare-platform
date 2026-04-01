import { prisma } from '@healthcare/database';
import { NextResponse } from 'next/server';
import { validateAuthToken, AuthError } from '@/lib/auth';

export async function PATCH(request: Request) {
  let authUser: Awaited<ReturnType<typeof validateAuthToken>>;

  try {
    // skipVersionCheck: kill-sessions must work even when the token's version
    // is stale — that's precisely the situation it needs to fix.
    authUser = await validateAuthToken(request, { skipVersionCheck: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
