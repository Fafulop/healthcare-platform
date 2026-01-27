/**
 * POST /api/llm-assistant/ingest
 *
 * Triggers the documentation ingestion pipeline.
 * Admin-only endpoint.
 *
 * Request: { force?: boolean, module?: string }
 * Response: { success: true, data: { results } }
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@healthcare/auth';
import { runIngestionPipeline } from '@/lib/llm-assistant/ingestion/pipeline';

export async function POST(request: NextRequest) {
  try {
    // Admin-only authentication
    const session = await auth();

    if (!session || !session.user) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      );
    }

    if ((session.user as any).role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: 'Se requieren permisos de administrador' },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { force = false, module: moduleFilter } = body;

    const results = await runIngestionPipeline({
      force,
      moduleFilter,
    });

    return NextResponse.json({
      success: true,
      data: {
        filesProcessed: results.length,
        totalChunks: results.reduce((s, r) => s + r.chunksCreated, 0),
        totalTokens: results.reduce((s, r) => s + r.totalTokens, 0),
        results,
      },
    });
  } catch (error) {
    console.error('LLM Assistant ingestion error:', error);
    return NextResponse.json(
      { success: false, error: 'Error al procesar la documentación' },
      { status: 500 }
    );
  }
}
