/**
 * Minimal Anthropic Messages API client (raw fetch — no SDK dependency, matching
 * how the rest of apps/doctor talks to LLM providers).
 *
 * Supports tool use: the agent loop sends tools + accumulated messages and gets
 * back content blocks (text and/or tool_use) plus usage.
 */

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';

/** Prompt-cache breakpoint marker (prefix caching, 5-min TTL). */
export interface CacheControl {
  type: 'ephemeral';
}

export interface AnthropicTool {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
  /** Tool search (lever 2d): the full definition still travels in `tools` on
   * every request, but a deferred tool is EXCLUDED from the context prefix
   * until the model discovers it via the search tool — the API appends the
   * schema without invalidating the cached prefix. Hard rules (docs): the
   * search tool itself never carries this; ≥1 tool must stay non-deferred; a
   * deferred tool cannot carry cache_control. */
  defer_loading?: boolean;
}

/** Anthropic's server-side tool search (regex variant, GA — verified available
 * on Haiku 4.5 and Sonnet 5, 2026-07-24). The search runs on Anthropic's
 * servers inside the same request; the client never executes it. */
export interface ToolSearchToolDef {
  type: 'tool_search_tool_regex_20251119';
  name: 'tool_search_tool_regex';
}

export type AgentToolParam = AnthropicTool | ToolSearchToolDef;

export interface TextBlock {
  type: 'text';
  text: string;
  cache_control?: CacheControl;
}

export interface ToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
  cache_control?: CacheControl;
}

/** The model's call to a SERVER-side tool (tool search). Executed by the API
 * within the same request — never dispatch it client-side and never send a
 * tool_result for its `srvtoolu_...` id (the API rejects that). */
export interface ServerToolUseBlock {
  type: 'server_tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

/** Result of a server-side tool search — pass it back verbatim in history so
 * the API can keep expanding the discovered tool references. */
export interface ToolSearchToolResultBlock {
  type: 'tool_search_tool_result';
  tool_use_id: string;
  content: unknown;
}

export type ContentBlock = TextBlock | ToolUseBlock | ServerToolUseBlock | ToolSearchToolResultBlock;

export interface ToolResultBlock {
  type: 'tool_result';
  tool_use_id: string;
  content: string;
  is_error?: boolean;
  cache_control?: CacheControl;
}

export interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string | (ContentBlock | ToolResultBlock)[];
}

/** System prompt as blocks so a cache breakpoint can sit after the STABLE part
 * (the volatile temporal block goes after it — see run-turn buildSystem).
 * Same shape as TextBlock — aliased so the two can never drift. */
export type SystemBlock = TextBlock;

export interface AnthropicResponse {
  content: ContentBlock[];
  /** `pause_turn`: the server-side tool loop paused (tool search runs in a
   * server loop) — re-send history as-is and call again to resume. */
  stop_reason: 'end_turn' | 'tool_use' | 'max_tokens' | 'stop_sequence' | 'pause_turn';
  usage: {
    input_tokens: number;
    output_tokens: number;
    /** Tokens written to cache this call (~1.25× input price). */
    cache_creation_input_tokens?: number;
    /** Tokens served from cache (~0.1× input price). */
    cache_read_input_tokens?: number;
  };
}

export interface CallClaudeParams {
  model: string;
  system: string | SystemBlock[];
  messages: AnthropicMessage[];
  tools: AgentToolParam[];
  maxTokens?: number;
  /** 'none' forces a text answer (used for the final synthesis call). */
  toolChoice?: 'auto' | 'none';
  /** Per-call timeout in ms (default 60s) — a hung upstream must not pin the request. */
  timeoutMs?: number;
}

export function isAnthropicConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/** Extended-thinking budget for models that need it declared explicitly.
 * 4096 since 2026-07-24: the failure shape of the noisy 58/65 Haiku run was
 * "asks instead of acting" on multi-step plans, and thinking is where a small
 * model plans them; output+thinking is only ~19% of turn cost, so headroom
 * here is cheap. The model uses what it needs — the budget is a ceiling, not
 * a target. */
const THINKING_BUDGET_TOKENS = 4096;
/** Per-call ceiling. Reasoning happens BEFORE the first output token, so a
 * thinking call needs more headroom than the 60s that was sized for
 * non-thinking calls — and blowing it surfaces to the doctor as an error, not a
 * slow answer. Measured 2026-07-23: with thinking on, cases that took ~4s ran
 * 20–33s and one call blew past 60s (`f2a-desempate-triple`). */
const DEFAULT_TIMEOUT_MS = 60_000;
const THINKING_TIMEOUT_MS = 90_000;
/** Room left for the actual answer on top of the thinking budget (output p50 is
 * ~515 tok, so this is generous). `budget_tokens` MUST be < `max_tokens`. */
const MIN_ANSWER_TOKENS = 2048;

/**
 * Thinking is NOT one parameter across models — the two shapes are mutually
 * exclusive and sending the wrong one is a 400 (verified against /v1/models
 * 2026-07-23):
 *
 *   - Sonnet 5      → `adaptive` ✅, `enabled` ❌, effort ✅
 *   - Haiku 4.5     → `enabled` (budget_tokens) ✅, `adaptive` ❌, effort ❌
 *
 * Sonnet 5 already runs adaptive thinking when `thinking` is omitted, so this
 * returns null for it: the Sonnet request stays byte-identical to the one that
 * produced the validated 63/65 baseline, and `form-builder-chat` (which shares
 * this client) is untouched. Only models that would otherwise run with NO
 * reasoning at all get a thinking block.
 */
/** Models that reason when `thinking` is OMITTED — nothing to send.
 * ⚠️ Deliberately narrow. "Supports adaptive" and "reasons when you omit the
 * param" are DIFFERENT properties: Opus 4.6/4.7/4.8 and Sonnet 4.6 support
 * adaptive but run WITHOUT thinking unless you pass it explicitly, and Opus 4.5
 * and older take the `enabled`+`budget_tokens` shape instead. Listing those here
 * would silence the warning below for exactly the models that would silently
 * under-reason — the failure this guardrail exists to prevent. If one of them
 * ever runs the agent, add it to the right branch rather than widening this. */
const ADAPTIVE_BY_DEFAULT = /^claude-(sonnet-5|fable-5|mythos-5)/;
/** Models that reason ONLY if `thinking: {type:'enabled', budget_tokens}` is sent. */
const NEEDS_EXPLICIT_THINKING = /^claude-haiku-4-5/;

const warnedModels = new Set<string>();

function thinkingFor(model: string): { budget_tokens: number } | null {
  if (NEEDS_EXPLICIT_THINKING.test(model)) return { budget_tokens: THINKING_BUDGET_TOKENS };
  if (ADAPTIVE_BY_DEFAULT.test(model)) return null;
  // Unknown model: we don't know which shape it takes, so we send none — which
  // may mean it runs with ZERO reasoning. That failure is SILENT and expensive
  // (it cost a full eval run on 2026-07-23: Haiku scored 59/65 · 1 FAIL with no
  // reasoning vs 64/65 · 0 FAIL with it). Say so loudly instead of guessing;
  // check /v1/models capabilities and add the model to a list above.
  if (!warnedModels.has(model)) {
    warnedModels.add(model);
    console.warn(
      `[agenda-agent] Modelo "${model}" no está clasificado para thinking. Va SIN razonamiento ` +
        `explícito, lo que puede degradar la calidad en silencio. Verifica /v1/models y clasifícalo ` +
        `en anthropic.ts (ADAPTIVE_BY_DEFAULT o NEEDS_EXPLICIT_THINKING).`
    );
  }
  return null;
}

export async function callClaude(params: CallClaudeParams): Promise<AnthropicResponse> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not configured');
  }

  // `tool_choice: none` is the text-only synthesis call (loop exhaustion). Extended
  // thinking constrains tool_choice, so skip it there: that path just re-words tool
  // results it already has, and this removes a 400 risk for zero behavioral loss.
  const thinking = params.toolChoice === 'none' ? null : thinkingFor(params.model);
  // `budget_tokens` must be strictly less than `max_tokens`, so raise the ceiling
  // when thinking is on — never lower an explicit caller value.
  const maxTokens = Math.max(
    params.maxTokens ?? 2048,
    thinking ? thinking.budget_tokens + MIN_ANSWER_TOKENS : 0
  );

  const res = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': ANTHROPIC_VERSION,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: params.model,
      max_tokens: maxTokens,
      system: params.system,
      messages: params.messages,
      tools: params.tools,
      ...(thinking ? { thinking: { type: 'enabled', ...thinking } } : {}),
      ...(params.toolChoice ? { tool_choice: { type: params.toolChoice } } : {}),
    }),
    signal: AbortSignal.timeout(
      params.timeoutMs ?? (thinking ? THINKING_TIMEOUT_MS : DEFAULT_TIMEOUT_MS)
    ),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    const err = new Error(`Anthropic API error ${res.status}: ${body.slice(0, 300)}`);
    (err as any).status = res.status;
    throw err;
  }

  return (await res.json()) as AnthropicResponse;
}
