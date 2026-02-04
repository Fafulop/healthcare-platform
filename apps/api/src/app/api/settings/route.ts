// GET /api/settings - Get all system settings
// PATCH /api/settings - Update a system setting (admin only)

import { NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { requireAdminAuth } from '@/lib/auth';

// GET - Get all system settings (public, no auth needed for SMS check)
export async function GET() {
  try {
    const settings = await prisma.systemSetting.findMany();

    const settingsMap: Record<string, string> = {};
    for (const s of settings) {
      settingsMap[s.key] = s.value;
    }

    return NextResponse.json({ success: true, data: settingsMap });
  } catch (error) {
    console.error('Error fetching settings:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch settings' },
      { status: 500 }
    );
  }
}

// PATCH - Update a setting (admin only)
export async function PATCH(request: Request) {
  try {
    await requireAdminAuth(request);

    const body = await request.json();
    const { key, value } = body;

    if (!key || value === undefined) {
      return NextResponse.json(
        { success: false, error: 'key and value are required' },
        { status: 400 }
      );
    }

    const setting = await prisma.systemSetting.upsert({
      where: { key },
      update: { value: String(value) },
      create: { key, value: String(value) },
    });

    console.log(`⚙️ Setting updated: ${key} = ${value}`);

    return NextResponse.json({ success: true, data: setting });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';

    if (message.includes('Admin access required') || message.includes('authorization')) {
      return NextResponse.json(
        { success: false, error: message },
        { status: 401 }
      );
    }

    console.error('Error updating setting:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update setting' },
      { status: 500 }
    );
  }
}
