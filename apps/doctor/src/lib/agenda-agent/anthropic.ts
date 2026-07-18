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
}

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

export type ContentBlock = TextBlock | ToolUseBlock;

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
  stop_reason: 'end_turn' | 'tool_use' | 'max_tokens' | 'stop_sequence';
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
  tools: AnthropicTool[];
  maxTokens?: number;
  /** Sampling temperature (omit for API default). */
  temperature?: number;
  /** 'none' forces a text answer (used for the final synthesis call). */
  toolChoice?: 'auto' | 'none';
  /** Per-call timeout in ms (default 60s) — a hung upstream must not pin the request. */
  timeoutMs?: number;
}

export function isAnthropicConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export async function callClaude(params: CallClaudeParams): Promise<AnthropicResponse> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not configured');
  }

  const res = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': ANTHROPIC_VERSION,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: params.model,
      max_tokens: params.maxTokens ?? 2048,
      system: params.system,
      messages: params.messages,
      tools: params.tools,
      ...(params.temperature !== undefined ? { temperature: params.temperature } : {}),
      ...(params.toolChoice ? { tool_choice: { type: params.toolChoice } } : {}),
    }),
    signal: AbortSignal.timeout(params.timeoutMs ?? 60_000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    const err = new Error(`Anthropic API error ${res.status}: ${body.slice(0, 300)}`);
    (err as any).status = res.status;
    throw err;
  }

  return (await res.json()) as AnthropicResponse;
}
