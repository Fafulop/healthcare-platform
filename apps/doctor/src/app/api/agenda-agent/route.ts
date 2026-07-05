/**
 * POST /api/agenda-agent
 *
 * Agenda agent (PR 1 reads + PR 2 internal-action proposals). The actual
 * tool-calling loop lives in @/lib/agenda-agent/run-turn (shared with the G11
 * eval runner); this route adds what only production needs: session auth,
 * request validation, the per-doctor daily token budget, and token logging.
 *
 * Security invariants (see docs/DESDE JUNIO/AGENTES/AGENTE AGENDA/02-DISENO):
 * - doctorId comes from the session and is injected into every tool — never from
 *   model output.
 * - Tools are an allowlist. This route never mutates agenda data (proposals are
 *   plain JSON; execution happens client-side behind the doctor's confirmation
 *   with their own auth token).
 * - Per-request iteration cap + per-doctor daily token cap (gap G6) + per-turn
 *   proposal cap.
 *
 * Request:  { message: string, conversationHistory: { role, content }[] }
 * Response: { success, data: { reply, toolsUsed, proposals: AgendaProposal[] } }
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireDoctorAuth } from '@/lib/medical-auth';
import { handleApiError } from '@/lib/api-error-handler';
import { logTokenUsage } from '@/lib/ai/log-token-usage';
import { prisma } from '@healthcare/database';
import { isAnthropicConfigured } from '@/lib/agenda-agent/anthropic';
import { runAgendaAgentTurn, MODEL } from '@/lib/agenda-agent/run-turn';
import { mxTodayKey } from '@/lib/agenda-agent/dates';

const DAILY_TOKEN_CAP = Number(process.env.AGENDA_AGENT_DAILY_TOKEN_CAP || 500_000);

async function getTokensUsedToday(doctorId: string): Promise<number> {
  // Day boundary in Mexico City (UTC-6 year-round since 2022), consistent with
  // the agent's notion of "today" — not UTC midnight (~18:00 local).
  const startOfDay = new Date(mxTodayKey() + 'T00:00:00-06:00');
  const agg = await prisma.llmTokenUsage.aggregate({
    where: { doctorId, endpoint: 'agenda-agent', createdAt: { gte: startOfDay } },
    _sum: { totalTokens: true },
  });
  return agg._sum.totalTokens ?? 0;
}

export async function POST(request: NextRequest) {
  try {
    const { doctorId } = await requireDoctorAuth(request);

    if (!isAnthropicConfigured()) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_CONFIGURED', message: 'El asistente no está configurado (falta ANTHROPIC_API_KEY).' } },
        { status: 503 }
      );
    }

    const body = await request.json();
    const { message, conversationHistory = [] } = body as {
      message: string;
      conversationHistory: { role: 'user' | 'assistant'; content: string }[];
    };

    if (!message || typeof message !== 'string' || message.trim() === '') {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_REQUEST', message: 'Se requiere un mensaje' } },
        { status: 400 }
      );
    }
    // Resilience against pasted walls of text / garbage: bound what enters the
    // loop (every char is re-sent as input tokens on each iteration).
    if (message.length > 4_000) {
      return NextResponse.json(
        { success: false, error: { code: 'MESSAGE_TOO_LONG', message: 'El mensaje es demasiado largo. Resume tu petición (máx ~4,000 caracteres).' } },
        { status: 400 }
      );
    }

    // Daily budget (gap G6) + doctor slug — independent queries, run in parallel
    const [usedToday, doctor] = await Promise.all([
      getTokensUsedToday(doctorId),
      prisma.doctor.findUnique({
        where: { id: doctorId },
        select: { slug: true },
      }),
    ]);

    if (usedToday >= DAILY_TOKEN_CAP) {
      return NextResponse.json(
        { success: false, error: { code: 'BUDGET_EXCEEDED', message: 'Se alcanzó el límite diario del asistente. Intenta mañana.' } },
        { status: 429 }
      );
    }
    if (!doctor) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Doctor no encontrado' } },
        { status: 404 }
      );
    }

    const turn = await runAgendaAgentTurn({
      doctorId,
      doctorSlug: doctor.slug,
      message,
      conversationHistory,
    });

    logTokenUsage({
      doctorId,
      endpoint: 'agenda-agent',
      model: MODEL,
      provider: 'anthropic',
      usage: {
        promptTokens: turn.usage.inputTokens,
        completionTokens: turn.usage.outputTokens,
        totalTokens: turn.usage.inputTokens + turn.usage.outputTokens,
      },
    });

    console.log(
      `[agenda-agent] doctor=${doctorId} tools=[${turn.toolsUsed.join(',')}] tokens=${turn.usage.inputTokens + turn.usage.outputTokens}`
    );

    return NextResponse.json({
      success: true,
      data: { reply: turn.reply, toolsUsed: turn.toolsUsed, proposals: turn.proposals },
    });
  } catch (error: any) {
    console.error('[agenda-agent] error:', error);
    if (error?.status === 429) {
      return NextResponse.json(
        { success: false, error: { code: 'RATE_LIMITED', message: 'Demasiadas solicitudes. Intenta en unos momentos.' } },
        { status: 429 }
      );
    }
    return handleApiError(error, 'POST /api/agenda-agent');
  }
}
