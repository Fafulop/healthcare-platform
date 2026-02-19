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
import { CHAT_RATE_LIMIT_REQUESTS, CHAT_RATE_LIMIT_WINDOW_MS } from '@/lib/llm-assistant/constants';

// In-memory rate limiter (per userId, resets on server restart)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + CHAT_RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (entry.count >= CHAT_RATE_LIMIT_REQUESTS) {
    return false;
  }

  entry.count++;
  return true;
}

export async function POST(request: NextRequest) {
  try {
    // 1. Authentication check
    const { userId } = await requireDoctorAuth(request);

    // 2. Rate limit check
    if (!checkRateLimit(userId)) {
      return NextResponse.json(
        { success: false, error: 'Demasiadas solicitudes. Por favor espera un momento.', code: 'RATE_LIMITED' },
        { status: 429 }
      );
    }

    // 3. Parse request body
    const body = await request.json();
    const { question, sessionId, uiContext } = body;

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

    // 4. Process query through RAG + capability map pipeline
    const result = await processQuery({
      question,
      sessionId,
      userId,
      uiContext: uiContext && typeof uiContext.currentPath === 'string'
        ? { currentPath: uiContext.currentPath }
        : undefined,
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
