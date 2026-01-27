/**
 * OpenAI LLM Client for LLM Assistant
 * Uses gpt-4o-mini for answer generation
 */

import OpenAI from 'openai';
import { LLM_MODEL, LLM_TEMPERATURE, LLM_MAX_TOKENS } from './constants';
import type { PromptMessage } from './types';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

/**
 * Call the LLM with assembled prompt messages.
 * Returns the assistant's text response.
 */
export async function callLLM(messages: PromptMessage[]): Promise<string> {
  const response = await openai.chat.completions.create({
    model: LLM_MODEL,
    temperature: LLM_TEMPERATURE,
    max_tokens: LLM_MAX_TOKENS,
    messages: messages.map(m => ({
      role: m.role,
      content: m.content,
    })),
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('Empty response from LLM');
  }

  return content;
}
