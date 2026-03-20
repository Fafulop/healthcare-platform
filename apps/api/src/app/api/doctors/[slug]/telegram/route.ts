// GET  /api/doctors/[slug]/telegram — get current telegramChatId
// PUT  /api/doctors/[slug]/telegram — save telegramChatId
// DELETE /api/doctors/[slug]/telegram — remove telegramChatId

import { NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { requireDoctorAuth } from '@/lib/auth';

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
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = message.includes('access required') ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
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
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = message.includes('access required') ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
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
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = message.includes('access required') ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
