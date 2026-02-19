/**
 * LLM Client for LLM Assistant
 * Uses provider-agnostic abstraction layer
 */

import { getChatProvider } from '../ai';
import { LLM_MODEL, LLM_TEMPERATURE, LLM_MAX_TOKENS } from './constants';
import type { PromptMessage } from './types';

/**
 * Call the LLM with assembled prompt messages.
 * Returns the assistant's text response.
 */
export async function callLLM(messages: PromptMessage[]): Promise<string> {
  return getChatProvider().chatCompletion(messages, {
    model: LLM_MODEL,
    temperature: LLM_TEMPERATURE,
    maxTokens: LLM_MAX_TOKENS,
  });
}
