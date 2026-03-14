// POST /api/reviews/generate-link - Generate a standalone one-time review link (doctor only)

import { NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { validateAuthToken } from '@/lib/auth';
import { randomBytes } from 'crypto';

export async function POST(request: Request) {
  try {
    const { role, doctorId } = await validateAuthToken(request);

    if (role !== 'DOCTOR' || !doctorId) {
      return NextResponse.json(
        { success: false, error: 'Only doctors can generate review links' },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const patientName: string | undefined = body.patientName?.trim() || undefined;

    const token = randomBytes(20).toString('hex'); // 40-char hex token

    await prisma.reviewLink.create({
      data: {
        token,
        doctorId,
        patientName: patientName || null,
      },
    });

    const publicUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://tusalud.pro';

    return NextResponse.json({
      success: true,
      data: {
        token,
        url: `${publicUrl}/review/${token}`,
      },
    });
  } catch (error) {
    if (error instanceof Error && (error.message.includes('token') || error.message.includes('Unauthorized'))) {
      return NextResponse.json({ success: false, error: error.message }, { status: 401 });
    }
    console.error('Error generating review link:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate review link' },
      { status: 500 }
    );
  }
}
