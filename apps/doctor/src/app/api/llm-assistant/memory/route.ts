/**
 * DELETE /api/llm-assistant/memory
 *
 * Clears conversation memory for a given session.
 *
 * Request: { sessionId: string }
 * Response: { success: true }
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireDoctorAuth } from '@/lib/medical-auth';
import { clearMemory } from '@/lib/llm-assistant/query/memory';

export async function DELETE(request: NextRequest) {
  try {
    await requireDoctorAuth(request);

    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: 'Se requiere un sessionId.' },
        { status: 400 }
      );
    }

    await clearMemory(sessionId);

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message.includes('Authentication required')) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      );
    }

    console.error('LLM Assistant memory clear error:', error);
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
