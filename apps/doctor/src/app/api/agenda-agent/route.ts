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
import { logToolErrors } from '@/lib/ai/log-tool-errors';
import { prisma } from '@healthcare/database';
import { isAnthropicConfigured } from '@/lib/agenda-agent/anthropic';
import { runAgendaAgentTurn, MODEL } from '@/lib/agenda-agent/run-turn';
import { enabledModules } from '@/lib/agenda-agent/modules/registry';
import { mintApiToken } from '@/lib/agenda-agent/api-token';
import { mxWeekStartKey } from '@/lib/agenda-agent/dates';

// The assistant's usage cap is WEEKLY (moved from daily 2026-07-23, cost review
// in docs/DESDE JUNIO/AGENTES/OPTIMIZACION COSTOS): a real doctor has zero-use
// days, so a 7-day window averages them out instead of a per-day ceiling that a
// single busy day blows. 2,000k budget/week ≈ $6/week ≈ $26/mo worst case at
// $3/M input — a fraction of the $37–50 subscription. Tune via env; the old
// AGENDA_AGENT_DAILY_TOKEN_CAP is no longer read (a stale value would misapply).
const WEEKLY_TOKEN_CAP = Number(process.env.AGENDA_AGENT_WEEKLY_TOKEN_CAP || 2_000_000);

async function getTokensUsedThisWeek(doctorId: string): Promise<number> {
  // The cap counts COST-WEIGHTED tokens (budget_tokens, since 2026-07-08) —
  // caching broke the volume≈cost equivalence the cap was sized with. Rows
  // without the column (pre-change) don't count; irrelevant now (weeks-old).
  // Week = Monday 00:00 Mexico City (UTC-6 year-round since 2022) through the
  // aggregate window's open end — same MX boundary the daily cap used, just a
  // 7-day span. Not UTC midnight (~18:00 local).
  const startOfWeek = new Date(mxWeekStartKey() + 'T00:00:00-06:00');
  const agg = await prisma.llmTokenUsage.aggregate({
    where: { doctorId, endpoint: 'agenda-agent', createdAt: { gte: startOfWeek } },
    _sum: { budgetTokens: true },
  });
  return agg._sum.budgetTokens ?? 0;
}

/** GET — this week's assistant budget for the session doctor (panel widget). */
export async function GET(request: NextRequest) {
  try {
    const { doctorId } = await requireDoctorAuth(request);
    const usedThisWeek = await getTokensUsedThisWeek(doctorId);
    return NextResponse.json({
      success: true,
      data: { used: usedThisWeek, cap: WEEKLY_TOKEN_CAP },
    });
  } catch (error) {
    return handleApiError(error, 'GET /api/agenda-agent');
  }
}

export async function POST(request: NextRequest) {
  try {
    const authCtx = await requireDoctorAuth(request);
    const { doctorId } = authCtx;

    // NUEVOS USUARIOS PR C: module set for THIS caller. Owners get every
    // module (byte-identical prompt/tools to before this feature existed).
    const modules = enabledModules({ isOwner: authCtx.isOwner, permissions: authCtx.permissions });
    if (modules.length === 0) {
      // Reachable only if an owner grants asistente_ia without any domain
      // toggle — the panel is supposed to hide itself in that case (client),
      // this is the server-side fail-safe. No model call, no tokens spent.
      return NextResponse.json({
        success: true,
        data: {
          reply: 'No tienes ningún módulo del asistente habilitado en esta cuenta. Pídele al dueño del consultorio que active al menos uno.',
          toolsUsed: [],
          proposals: [],
          budget: { used: await getTokensUsedThisWeek(doctorId), cap: WEEKLY_TOKEN_CAP },
        },
      });
    }

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

    // Weekly budget (gap G6) + doctor slug — independent queries, run in parallel
    const [usedThisWeek, doctor] = await Promise.all([
      getTokensUsedThisWeek(doctorId),
      prisma.doctor.findUnique({
        where: { id: doctorId },
        select: { slug: true },
      }),
    ]);

    if (usedThisWeek >= WEEKLY_TOKEN_CAP) {
      return NextResponse.json(
        { success: false, error: { code: 'BUDGET_EXCEEDED', message: 'Se alcanzó el límite semanal del asistente. Se reinicia el lunes.' } },
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
      modules,
      // Bearer for tools that call apps/api authenticated endpoints (catálogos
      // SAT) — minted from THIS doctor's session, same trust boundary as the
      // client's authFetch. Null if the secret is missing; the tool degrades.
      apiToken: mintApiToken({
        email: authCtx.email,
        userId: authCtx.userId,
        sessionVersion: authCtx.sessionVersion,
      }),
    });

    // totalTokens stays RAW volume (three analytics endpoints aggregate it
    // across all endpoints and need uniform units); the daily cap reads the
    // dedicated cost-weighted budgetTokens column instead. See the
    // budgetTokens doc in run-turn.ts.
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
      budgetTokens: turn.usage.budgetTokens,
    });

    // Audit A2: persist tool failures (the model handles them gracefully, so
    // they're invisible without this). Fire-and-forget — never blocks or
    // fails the reply. Error identity only, no data payloads.
    logToolErrors({ doctorId, endpoint: 'agenda-agent', errors: turn.toolErrors });

    console.log(
      `[agenda-agent] doctor=${doctorId} tools=[${turn.toolsUsed.join(',')}] tokens=${turn.usage.inputTokens + turn.usage.outputTokens} budget=${turn.usage.budgetTokens} cacheRead=${turn.usage.cacheReadTokens} cacheWrite=${turn.usage.cacheWriteTokens}`
    );

    return NextResponse.json({
      success: true,
      data: {
        reply: turn.reply,
        toolsUsed: turn.toolsUsed,
        proposals: turn.proposals,
        // usedThisWeek was read BEFORE the turn — add this turn's cost-weighted
        // spend so the widget updates without an extra query.
        budget: {
          used: usedThisWeek + turn.usage.budgetTokens,
          cap: WEEKLY_TOKEN_CAP,
        },
      },
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
