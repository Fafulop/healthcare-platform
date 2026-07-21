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
  type AnthropicMessage,
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
  AGENT_MODULES,
  ALL_TOOLS,
  buildTools,
  isProposalToolName,
  dispatchReadTool,
  dispatchProposalTool,
} from './modules/registry';
import type { AgentModule } from './modules/types';
import { STABLE_SYSTEM_PROMPT, buildSystemPrompt } from './prompt';
import { mxNowString, mxTodayKey, mxTodayWeekday } from './dates';

export const MODEL = process.env.AGENDA_AGENT_MODEL || 'claude-sonnet-5';
const MAX_ITERATIONS = 8;
const MAX_TOKENS_PER_CALL = 4096;
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
function buildSystem(modules: AgentModule[]): SystemBlock[] {
  const promptText = modules === AGENT_MODULES ? STABLE_SYSTEM_PROMPT : buildSystemPrompt(modules);
  return [
    { type: 'text', text: promptText, cache_control: { type: 'ephemeral' } },
    {
      type: 'text',
      text: `## Contexto temporal
Ahora mismo es ${mxNowString()} (America/Mexico_City). Hoy es ${mxTodayWeekday()} ${mxTodayKey()} —
calcula los demás días de la semana a partir de este dato, no lo deduzcas tú.`,
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
      m.content[m.content.length - 1].cache_control = { type: 'ephemeral' };
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
  /** Module set for THIS caller (NUEVOS USUARIOS PR C). Defaults to
   * AGENT_MODULES (full/owner set, byte-identical prompt+tools) so the eval
   * runner and any caller that doesn't pass this keep testing owner behavior
   * unchanged. Secondary users: apps/doctor's route computes this via
   * modules/registry.ts enabledModules(access) before calling in. */
  modules?: AgentModule[];
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
  modules = AGENT_MODULES,
}: AgendaTurnInput): Promise<AgendaTurnResult> {
  const ctx: ToolContext = { doctorId, doctorSlug, apiToken };
  const collector = new ProposalCollector();
  const proposalCtx = { doctorId, doctorSlug, collector };
  // Defense in depth (01-DISENO §7.1): a blocked module's tools don't exist
  // for dispatch, not just hidden from the prompt/tools list — even though
  // the model can only ever REQUEST tools present in `tools` below, so this
  // is belt-and-suspenders against a future bug that desyncs the two.
  const allowedToolNames = modules === AGENT_MODULES ? null : new Set(buildTools(modules).map((t) => t.name));

  const messages: AnthropicMessage[] = [
    ...conversationHistory
      .filter((m) => m.content != null && m.content !== '')
      .slice(-12)
      .map((m) => ({ role: m.role, content: m.content })),
    { role: 'user' as const, content: message },
  ];

  const system: SystemBlock[] = buildSystem(modules);
  const tools = modules === AGENT_MODULES ? ALL_TOOLS : buildTools(modules);
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
