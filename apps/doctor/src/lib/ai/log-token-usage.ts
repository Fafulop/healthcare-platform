/**
 * Non-blocking utility to persist LLM token usage per doctor.
 * Call without await so it never blocks the request path.
 */

import { prisma } from '@healthcare/database';
import type { TokenUsage } from './types';

interface LogTokenUsageParams {
  doctorId: string;
  endpoint: string;       // e.g. "encounter-chat", "voice-chat"
  model: string;          // e.g. "gpt-4o", "whisper-1"
  provider: string;       // e.g. "openai", "anthropic"
  usage: TokenUsage;
  durationSeconds?: number; // for Whisper calls (no token data)
}

export function logTokenUsage(params: LogTokenUsageParams): void {
  prisma.llmTokenUsage
    .create({
      data: {
        doctorId: params.doctorId,
        endpoint: params.endpoint,
        model: params.model,
        provider: params.provider,
        promptTokens: params.usage.promptTokens,
        completionTokens: params.usage.completionTokens,
        totalTokens: params.usage.totalTokens,
        durationSeconds: params.durationSeconds ?? null,
      },
    })
    .catch((err) => {
      console.error('[logTokenUsage] Failed to log token usage:', err);
    });
}
