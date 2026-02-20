/**
 * LLM Client for LLM Assistant
 * Uses provider-agnostic abstraction layer
 */

import { getChatProvider } from '../ai';
import { LLM_MODEL, LLM_TEMPERATURE, LLM_MAX_TOKENS } from './constants';
import type { PromptMessage } from './types';
import type { ChatCompletionResult } from '../ai/types';

/**
 * Call the LLM with assembled prompt messages.
 * Returns content and token usage metadata.
 */
export async function callLLM(messages: PromptMessage[]): Promise<ChatCompletionResult> {
  return getChatProvider().chatCompletion(messages, {
    model: LLM_MODEL,
    temperature: LLM_TEMPERATURE,
    maxTokens: LLM_MAX_TOKENS,
  });
}
