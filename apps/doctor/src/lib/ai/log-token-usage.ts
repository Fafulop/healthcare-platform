/**
 * Non-blocking utility to persist LLM token usage per doctor.
 * Call without await so it never blocks the request path.
 */

import { prisma } from '@healthcare/database';
import { fireAndForget } from './fire-and-forget';
import type { TokenUsage } from './types';

interface LogTokenUsageParams {
  doctorId: string;
  endpoint: string;       // e.g. "encounter-chat", "voice-chat"
  model: string;          // e.g. "gpt-4o", "whisper-1"
  provider: string;       // e.g. "openai", "anthropic"
  usage: TokenUsage;
  /** Cost-weighted tokens (cache-aware endpoints only — feeds the daily cap). */
  budgetTokens?: number;
  durationSeconds?: number; // for Whisper calls (no token data)
}

export function logTokenUsage(params: LogTokenUsageParams): void {
  // fireAndForget, no `.create().catch()`: un `prisma.llmTokenUsage` undefined
  // tronaría SÍNCRONO y el .catch no lo vería — ver fire-and-forget.ts.
  fireAndForget('logTokenUsage', () =>
    prisma.llmTokenUsage.create({
      data: {
        doctorId: params.doctorId,
        endpoint: params.endpoint,
        model: params.model,
        provider: params.provider,
        promptTokens: params.usage.promptTokens,
        completionTokens: params.usage.completionTokens,
        totalTokens: params.usage.totalTokens,
        budgetTokens: params.budgetTokens ?? null,
        durationSeconds: params.durationSeconds ?? null,
      },
    })
  );
}
