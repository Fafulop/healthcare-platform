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
import { handleApiError } from '@/lib/api-error-handler';
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
    // El techo del PLAN y los toggles de member se delegan al handler
    // compartido, para que el cuerpo sea idéntico al del resto de las rutas
    // (403 + `featureKey`). Antes caían al 500 genérico de abajo: el cliente
    // recibía un crash en vez de la pantalla de plan — y con PERMISSION_BLOCKED
    // eso ya pasaba desde antes de TIERS. Hallazgo del review de Q2a.
    if (
      error instanceof Error &&
      (error.message === 'TIER_EXCLUDED' || error.message === 'PERMISSION_BLOCKED')
    ) {
      return handleApiError(error);
    }

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
