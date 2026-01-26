/**
 * POST /api/llm-assistant/chat
 *
 * Chat endpoint for the LLM help assistant.
 * Accepts a question and session ID, returns a grounded answer with sources.
 *
 * Request: { question: string, sessionId: string }
 * Response: { success: true, data: { answer, sources, confidence, cached, modulesUsed } }
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireDoctorAuth } from '@/lib/medical-auth';
import { processQuery } from '@/lib/llm-assistant/query/pipeline';
import { isLLMAssistantError, toErrorResponse } from '@/lib/llm-assistant/errors';

export async function POST(request: NextRequest) {
  try {
    // 1. Authentication check
    const { userId } = await requireDoctorAuth(request);

    // 2. Parse request body
    const body = await request.json();
    const { question, sessionId } = body;

    if (!question || typeof question !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Se requiere una pregunta.' },
        { status: 400 }
      );
    }

    if (!sessionId || typeof sessionId !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Se requiere un sessionId.' },
        { status: 400 }
      );
    }

    // 3. Process query through RAG pipeline
    const result = await processQuery({
      question,
      sessionId,
      userId,
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    // Handle LLM Assistant specific errors
    if (isLLMAssistantError(error)) {
      const errResponse = toErrorResponse(error);
      return NextResponse.json(
        { success: false, error: errResponse.error, code: errResponse.code },
        { status: errResponse.statusCode }
      );
    }

    // Handle auth errors
    if (error instanceof Error) {
      if (error.message.includes('Authentication required')) {
        return NextResponse.json(
          { success: false, error: 'No autorizado' },
          { status: 401 }
        );
      }
      if (error.message.includes('Doctor role required') || error.message.includes('No doctor profile')) {
        return NextResponse.json(
          { success: false, error: 'Se requiere acceso de doctor' },
          { status: 403 }
        );
      }
    }

    console.error('LLM Assistant chat error:', error);
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
