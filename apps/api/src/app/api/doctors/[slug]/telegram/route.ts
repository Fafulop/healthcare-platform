// GET  /api/doctors/[slug]/telegram — get current telegramChatId
// PUT  /api/doctors/[slug]/telegram — save telegramChatId
// DELETE /api/doctors/[slug]/telegram — remove telegramChatId

import { NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { requireDoctorAuth, AuthError } from '@/lib/auth';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    await requireDoctorAuth(request);

    const doctor = await prisma.doctor.findUnique({
      where: { slug },
      select: { telegramChatId: true },
    });

    if (!doctor) {
      return NextResponse.json({ error: 'Doctor not found' }, { status: 404 });
    }

    return NextResponse.json({ chatId: doctor.telegramChatId ?? null });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    await requireDoctorAuth(request);

    const { chatId } = await request.json();
    if (!chatId || typeof chatId !== 'string' || chatId.trim() === '') {
      return NextResponse.json({ error: 'chatId is required' }, { status: 400 });
    }

    const doctor = await prisma.doctor.update({
      where: { slug },
      data: { telegramChatId: chatId.trim() },
      select: { telegramChatId: true },
    });

    return NextResponse.json({ chatId: doctor.telegramChatId });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    await requireDoctorAuth(request);

    await prisma.doctor.update({
      where: { slug },
      data: { telegramChatId: null },
    });

    return NextResponse.json({ chatId: null });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
