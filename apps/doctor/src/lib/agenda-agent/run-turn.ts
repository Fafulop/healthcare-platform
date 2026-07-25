/**
 * Agenda agent — one conversational turn (the tool-calling loop).
 *
 * Extracted from the route so the SAME code path serves production requests
 * (route.ts adds auth, daily budget, and token logging) and the G11 eval
 * runner (scripts/agenda-agent-evals.ts runs it directly against prod data
 * read-only — evals must exercise the working-tree prompt/tools BEFORE deploy,
 * not the already-deployed endpoint).
 *
 * Security invariants (see docs/DESDE JUNIO/AGENTES/AGENTE AGENDA/02-DISENO):
 * - doctorId comes from the caller (session in prod) and is injected into
 *   every tool — never from model output.
 * - Tools are an allowlist. This loop never mutates agenda data (proposals
 *   are plain JSON; execution happens client-side behind the doctor's
 *   confirmation with their own auth token).
 */

import {
  callClaude,
  type AgentToolParam,
  type AnthropicMessage,
  type AnthropicTool,
  type CacheControl,
  type SystemBlock,
  type ToolUseBlock,
} from './anthropic';
import type { ToolContext } from './tools';
import { ProposalCollector, type AgendaProposal } from './proposals';
// Tools + prompt come from the MODULE REGISTRY (modules/registry.ts): each
// domain (agenda today; facturas/pagos later) contributes tools, executors and
// prompt sections there — this loop never changes when a module is added.
// ALL_TOOLS is one definition for BOTH callsites (loop + synthesis): a
// divergent toolset would go unnoticed and also split the tools-prefix cache.
import {
  ALL_TOOLS,
  FULL_SCOPE,
  isProposalToolName,
  dispatchReadTool,
  dispatchProposalTool,
  type AgentScope,
} from './modules/registry';
import { STABLE_SYSTEM_PROMPT, buildSystemPrompt } from './prompt';
import { mxNowString, mxTodayKey, mxUpcomingDays } from './dates';

/** Default model. Haiku 4.5 since 2026-07-23: measured BETTER than Sonnet 5 on the
 * 65-eval suite (band 63–64/65, 0 hard FAIL) at ~half the cost — see
 * `docs/DESDE JUNIO/AGENTES/OPTIMIZACION COSTOS/`. Changing the default here rather
 * than setting AGENDA_AGENT_MODEL in Railway is deliberate: it ships the model in the
 * SAME commit as the thinking branch and the resolved-date block it depends on (a
 * Railway var could otherwise land first and run Haiku WITHOUT them — the 59/65
 * config), and it leaves `form-builder-chat` on its own Sonnet default instead of
 * dragging it along. The env var still overrides for an instant rollback. */
export const MODEL = process.env.AGENDA_AGENT_MODEL || 'claude-haiku-4-5';
const MAX_ITERATIONS = 8;
const MAX_TOKENS_PER_CALL = 4096;

/** Lever 2d — deferred tool loading via server-side tool search.
 *
 * The 39 tool schemas are 55% of the 27k-token prefix and a real turn uses
 * 0–3 of them; Anthropic also documents that tool-SELECTION accuracy degrades
 * past 30–50 tools. So: the hot agenda reads stay loaded, everything else is
 * `defer_loading: true` behind `tool_search_tool_regex` — the full definitions
 * still travel in the request, but deferred schemas enter the context only
 * when the model discovers them, APPENDED without invalidating the cached
 * prefix. GA on Haiku 4.5 + Sonnet 5 (verified 2026-07-24), no beta header.
 *
 * Rollback: AGENDA_AGENT_TOOL_SEARCH=0 restores the full-toolset request. */
const TOOL_SEARCH_ENABLED = process.env.AGENDA_AGENT_TOOL_SEARCH !== '0';

/** Non-deferred tools — the docs' "3–5 most frequently used". These are the
 * top read tools across the eval suite and cover the first hop of most
 * turns; everything else (incl. all propose_*) is one search away. */
const HOT_TOOL_NAMES = new Set(['get_day_schedule', 'get_bookings', 'get_availability', 'find_patient']);

const TOOL_SEARCH_TOOL = {
  type: 'tool_search_tool_regex_20251119',
  name: 'tool_search_tool_regex',
} as const;

function withDeferredLoading(tools: AnthropicTool[]): AgentToolParam[] {
  return [
    TOOL_SEARCH_TOOL,
    ...tools.map((t) => (HOT_TOOL_NAMES.has(t.name) ? t : { ...t, defer_loading: true })),
  ];
}

/** Owner toolset with deferral applied — computed ONCE so every request sends
 * byte-identical JSON (object identity isn't what caching keys on, but a
 * stable array avoids rebuilding 39 defs per turn). */
const ALL_TOOLS_DEFERRED: AgentToolParam[] = withDeferredLoading(ALL_TOOLS);
// Tool results are re-sent as input tokens on EVERY subsequent iteration — cap
// each serialized payload so one busy day doesn't grow the loop cost superlinearly.
const MAX_TOOL_RESULT_CHARS = 8_000;

function serializeToolResult(result: unknown): string {
  const json = JSON.stringify(result);
  if (json.length <= MAX_TOOL_RESULT_CHARS) return json;
  return JSON.stringify({
    truncado: true,
    aviso: 'Resultado truncado por tamaño — pide un filtro más específico (fecha o paciente).',
    parcial: json.slice(0, MAX_TOOL_RESULT_CHARS),
  });
}

function extractText(content: { type: string }[]): string {
  return content
    .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim();
}

/** PROMPT CACHING (05 §8): stable (cached) prefix + volatile temporal block.
 * The system prompt + tools are ~10k stable tokens re-sent on EVERY iteration
 * of EVERY turn. STABLE_SYSTEM_PROMPT (./prompt.ts, composed once at module
 * load from shared + per-module sections) is byte-identical across turns and
 * carries the cache breakpoint; the breakpoint also covers `tools`, which
 * render before system. Anything interpolated per-turn (date, time, weekday)
 * must live in the volatile block — never in the stable prompt. */
function buildSystem(scope: AgentScope): SystemBlock[] {
  const promptText = scope.isFull ? STABLE_SYSTEM_PROMPT : buildSystemPrompt(scope);
  // ONE anchor for the header AND the table: each mx* helper calls new Date()
  // on its own, so building them independently could straddle midnight MX and
  // print "Hoy es jueves 23" above a table whose "(hoy)" row says the 24th.
  // The weekday is read off row 0 rather than from mxTodayWeekday() for the same
  // reason — that helper would be a third independent clock read.
  const todayKey = mxTodayKey();
  const upcoming = mxUpcomingDays(14, todayKey);
  return [
    { type: 'text', text: promptText, cache_control: { type: 'ephemeral' } },
    {
      type: 'text',
      text: `## Contexto temporal
Ahora mismo es ${mxNowString()} (America/Mexico_City). Hoy es ${upcoming[0].weekday} ${todayKey}.

### Calendario ya resuelto (próximos 14 días)
El servidor ya calculó qué fecha le toca a cada día. Cuando el doctor diga "el martes",
"mañana", "el próximo viernes" o similar, TOMA la fecha de esta tabla — no la calcules tú:
${upcoming
  .map(({ key, weekday }, i) => `• ${weekday} ${key}${i === 0 ? ' (hoy)' : i === 1 ? ' (mañana)' : ''}`)
  .join('\n')}
Esta tabla solo va hacia ADELANTE y 14 días. Para cualquier fecha fuera de ella —**incluidas las
PASADAS** ("el martes pasado", "el mes pasado", "octubre")— calcula a partir de **Hoy** y di la
fecha completa al mencionarla.`,
    },
  ];
}

/** Move the message-side cache breakpoints to the tail of the conversation:
 * each loop iteration then reads the previous iteration's prefix (history +
 * earlier tool results) from cache instead of re-paying it at full input price.
 * TWO markers (last block of the last TWO messages) so the gap between
 * consecutive cache entries is bounded by ONE message's blocks — a busy
 * iteration (10 tool_use + 10 tool_result blocks) would otherwise exceed the
 * API's 20-block cache lookback and silently miss (review finding 2026-07-07).
 * Old markers are stripped first (max 4 breakpoints/request; we use ≤3: stable
 * system + these two). String contents become a text block to carry the marker. */
function setMessageCacheBreakpoints(messages: AnthropicMessage[]): void {
  for (const m of messages) {
    if (Array.isArray(m.content)) {
      for (const b of m.content) delete (b as { cache_control?: unknown }).cache_control;
    }
  }
  for (const m of messages.slice(-2)) {
    if (typeof m.content === 'string') {
      m.content = [{ type: 'text', text: m.content, cache_control: { type: 'ephemeral' } }];
    } else if (m.content.length > 0) {
      // Walk back to the last block that ACCEPTS cache_control — the docs list
      // text/tool_use/tool_result (and image/document); the tool-search blocks
      // (server_tool_use / tool_search_tool_result) are not in that list, and
      // an assistant turn resumed after pause_turn can END in one of them.
      for (let i = m.content.length - 1; i >= 0; i--) {
        const b = m.content[i];
        if (b.type === 'text' || b.type === 'tool_use' || b.type === 'tool_result') {
          (b as { cache_control?: CacheControl }).cache_control = { type: 'ephemeral' };
          break;
        }
      }
    }
  }
}

export interface AgendaTurnInput {
  doctorId: string;
  doctorSlug: string;
  message: string;
  conversationHistory?: { role: 'user' | 'assistant'; content: string }[];
  /** Bearer for apps/api authenticated endpoints — see ToolContext.apiToken. */
  apiToken?: string | null;
  /** What this caller's account and user may use — modules AND tools
   * (NUEVOS USUARIOS PR C, narrowed further by TIERS T3). Defaults to
   * FULL_SCOPE (owner on a tier that excludes nothing: byte-identical
   * prompt+tools) so any caller that doesn't pass it keeps testing owner
   * behavior unchanged. Callers build it with resolveAgentScope(access). */
  scope?: AgentScope;
}

/** A tool that threw during the turn (audit A2). The model only sees a generic
 * `{error}` and recovers gracefully, so without surfacing these the failure is
 * invisible server-side. Error IDENTITY only — never tool inputs or results.
 * run-turn stays DB-write-free (the eval runner shares it): the route persists
 * these; evals print them. */
export interface ToolErrorRecord {
  tool: string;
  errorName: string | null;
  errorCode: string | null;
  /** Truncated to 500 chars. */
  message: string | null;
}

export interface AgendaTurnResult {
  reply: string;
  toolsUsed: string[];
  /** Every tool invocation with its input, in call order (eval assertions). */
  toolCalls: { name: string; input: Record<string, unknown> }[];
  toolErrors: ToolErrorRecord[];
  proposals: AgendaProposal[];
  /** inputTokens = FULL context volume (uncached + cache writes + cache reads);
   * the cache fields expose how much of it was billed at ~0.1× (reads) /
   * ~1.25× (writes).
   *
   * budgetTokens = COST-WEIGHTED tokens (base-input-token equivalents) — what
   * the daily cap counts since 2026-07-08. History: the cap originally counted
   * raw volume, which equaled cost until prompt caching (2026-07-07) made a
   * cached token ~10× cheaper than an uncached one; a 3-turn session then
   * showed 16% of the cap while costing ~5% in dollars (the bar over-reported
   * spend 3–7×). Weights = price ratio to base input ($3/M): uncached ×1,
   * cache reads ×0.1, cache writes ×1.25, output ×5 ($15/M). This keeps the
   * 500k cap's original meaning (~$1.50/day worst case) exact. */
  usage: {
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheWriteTokens: number;
    budgetTokens: number;
  };
}

export async function runAgendaAgentTurn({
  doctorId,
  doctorSlug,
  message,
  conversationHistory = [],
  apiToken = null,
  scope = FULL_SCOPE,
}: AgendaTurnInput): Promise<AgendaTurnResult> {
  // tier reaches the tools so a KEPT tool can omit fields belonging to a
  // feature the plan excludes (TIERS T3 — see flujo.ts evidenceScope).
  const ctx: ToolContext = { doctorId, doctorSlug, apiToken, tier: scope.tier };
  const collector = new ProposalCollector();
  const proposalCtx = { doctorId, doctorSlug, collector, tier: scope.tier };
  // Defense in depth (01-DISENO §7.1): a blocked module's tools don't exist
  // for dispatch, not just hidden from the prompt/tools list — even though
  // the model can only ever REQUEST tools present in `tools` below, so this
  // is belt-and-suspenders against a future bug that desyncs the two. TIERS
  // T3 widened this from module- to TOOL-level: a tier can remove one tool
  // from a module the account otherwise keeps.
  const allowedToolNames = scope.isFull ? null : new Set(scope.tools.map((t) => t.name));

  const messages: AnthropicMessage[] = [
    ...conversationHistory
      .filter((m) => m.content != null && m.content !== '')
      .slice(-12)
      .map((m) => ({ role: m.role, content: m.content })),
    { role: 'user' as const, content: message },
  ];

  const system: SystemBlock[] = buildSystem(scope);
  const baseTools = scope.isFull ? ALL_TOOLS : scope.tools;
  // Narrowed sets get the same deferral per-request; if a caller lacks the hot
  // agenda tools entirely, the search tool itself satisfies the API's
  // "≥1 non-deferred tool" rule.
  const tools: AgentToolParam[] =
    !TOOL_SEARCH_ENABLED ? baseTools
    : scope.isFull ? ALL_TOOLS_DEFERRED
    : withDeferredLoading(baseTools);
  const toolsUsed: string[] = [];
  const toolCalls: { name: string; input: Record<string, unknown> }[] = [];
  const toolErrors: ToolErrorRecord[] = [];
  let totalInput = 0;
  let totalOutput = 0;
  let cacheRead = 0;
  let cacheWrite = 0;
  let reply = '';

  const addUsage = (u: {
    input_tokens: number;
    output_tokens: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
  }) => {
    // input_tokens is only the UNCACHED remainder — total context is the sum.
    totalInput += u.input_tokens + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0);
    totalOutput += u.output_tokens;
    cacheRead += u.cache_read_input_tokens ?? 0;
    cacheWrite += u.cache_creation_input_tokens ?? 0;
  };

  // Single choke point for model calls: the cache breakpoints are applied HERE
  // so no future callsite can forget them (review finding 2026-07-07).
  const callModel = async (toolChoice?: 'auto' | 'none') => {
    setMessageCacheBreakpoints(messages);
    const response = await callClaude({
      model: MODEL,
      system,
      messages,
      tools,
      maxTokens: MAX_TOKENS_PER_CALL,
      ...(toolChoice ? { toolChoice } : {}),
    });
    addUsage(response.usage);
    return response;
  };

  let exhausted = true;

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const response = await callModel();

    // Server-side tool loop (tool search) paused mid-work: append the partial
    // assistant turn as-is and call again — the API resumes where it left off.
    // No user message goes in between; the trailing server_tool_use tells the
    // API to continue. Counts against MAX_ITERATIONS so it can't spin forever.
    if (response.stop_reason === 'pause_turn') {
      messages.push({ role: 'assistant', content: response.content });
      continue;
    }

    const toolUses = response.content.filter((b): b is ToolUseBlock => b.type === 'tool_use');

    if (response.stop_reason !== 'tool_use' || toolUses.length === 0) {
      reply = extractText(response.content);
      // Truncated mid-answer at the token cap: say so instead of returning
      // an empty "Sin respuesta".
      if (response.stop_reason === 'max_tokens') {
        reply = reply
          ? reply + '\n\n_(Respuesta truncada — pregunta algo más específico para el detalle completo.)_'
          : 'La respuesta fue demasiado larga. Intenta una pregunta más específica (por ejemplo, un día o paciente concreto).';
      }
      exhausted = false;
      break;
    }

    // Execute requested tools server-side (doctorId injected via ctx).
    // SEQUENTIAL on purpose: proposal registration order = the model's call
    // order = execution order of the plan. Promise.all raced the collector
    // (whichever query finished first got orden 1) and shuffled the cards.
    // NOTE: pushes the WHOLE content array verbatim. On models with extended
    // thinking on (anthropic.ts thinkingFor), that array also carries thinking
    // blocks, which the API requires echoed back UNCHANGED alongside the
    // tool_use they preceded. Don't filter this to tool_use/text.
    messages.push({ role: 'assistant', content: response.content });

    const results = [];
    for (const tu of toolUses) {
      toolsUsed.push(tu.name);
      toolCalls.push({ name: tu.name, input: (tu.input ?? {}) as Record<string, unknown> });
      try {
        // allowedToolNames is null for the full/owner set (no check needed —
        // ALL_TOOLS already covers every tool). For a filtered set, the model
        // literally cannot have requested a name outside `tools` above; this
        // only fires if something ever desyncs, and degrades exactly like an
        // unknown tool name (never leaks "blocked" vs "doesn't exist").
        const result =
          allowedToolNames && !allowedToolNames.has(tu.name)
            ? { error: `Tool desconocida: ${tu.name}` }
            : isProposalToolName(tu.name)
              ? await dispatchProposalTool(proposalCtx, tu.name, tu.input)
              : await dispatchReadTool(ctx, tu.name, tu.input);
        results.push({ type: 'tool_result' as const, tool_use_id: tu.id, content: serializeToolResult(result) });
      } catch (err: any) {
        console.error(`[agenda-agent] tool ${tu.name} failed:`, err);
        // For $queryRaw failures Prisma reports code='P2010' with the driver
        // SQLSTATE in meta.code — keep BOTH ("P2010/42883"): P2010 alone
        // collapses every raw-query error into one undiagnosable bucket.
        const prismaCode = typeof err?.code === 'string' ? err.code : null;
        const driverCode = typeof err?.meta?.code === 'string' ? err.meta.code : null;
        toolErrors.push({
          tool: tu.name,
          errorName: typeof err?.name === 'string' ? err.name.slice(0, 100) : null,
          errorCode:
            (prismaCode === 'P2010' && driverCode
              ? `${prismaCode}/${driverCode}`
              : (prismaCode ?? driverCode)
            )?.slice(0, 40) ?? null,
          message: typeof err?.message === 'string' ? err.message.slice(0, 500) : null,
        });
        results.push({
          type: 'tool_result' as const,
          tool_use_id: tu.id,
          content: JSON.stringify({ error: 'La consulta falló, intenta reformular.' }),
          is_error: true,
        });
      }
    }

    messages.push({ role: 'user', content: results });
  }

  // Loop exhausted while the model still wanted tools: the last round of tool
  // results is already in `messages` — one final text-only call synthesizes an
  // answer from what was gathered instead of discarding it.
  if (exhausted) {
    // Known cache cost (accepted): switching tool_choice ('auto'→'none')
    // invalidates the MESSAGES cache tier, so this call — which fires when the
    // history is largest — re-bills it at full price. Inherent to forcing a
    // text-only synthesis; rare path (loop exhaustion only). Tools+system
    // cache still hits (review finding 2026-07-07).
    const final = await callModel('none');
    reply =
      extractText(final.content) ||
      'Necesité demasiados pasos para responder. Intenta una pregunta más específica.';
  }

  // Cost weights relative to base input price — see the budgetTokens doc above.
  const uncachedInput = totalInput - cacheRead - cacheWrite;
  const budgetTokens = Math.round(
    uncachedInput + cacheRead * 0.1 + cacheWrite * 1.25 + totalOutput * 5
  );

  return {
    reply: reply || 'Sin respuesta',
    toolsUsed,
    toolCalls,
    toolErrors,
    proposals: collector.proposals,
    usage: {
      inputTokens: totalInput,
      outputTokens: totalOutput,
      cacheReadTokens: cacheRead,
      cacheWriteTokens: cacheWrite,
      budgetTokens,
    },
  };
}
