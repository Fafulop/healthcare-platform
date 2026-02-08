/**
 * Provider-agnostic AI factory
 *
 * Reads LLM_PROVIDER and EMBEDDING_PROVIDER env vars to select implementations.
 * Defaults to 'openai'.
 */

import type { ChatProvider, EmbeddingProvider } from './types';
import { OpenAIChatProvider, OpenAIEmbeddingProvider } from './providers/openai';
import { AnthropicChatProvider, AnthropicEmbeddingProvider } from './providers/anthropic';

export type { ChatMessage, ChatCompletionOptions, ChatProvider, EmbeddingProvider } from './types';

// Lazy singletons per provider
let _chatProvider: ChatProvider | null = null;
let _embeddingProvider: EmbeddingProvider | null = null;

function createChatProvider(provider: string): ChatProvider {
  switch (provider) {
    case 'openai':
      return new OpenAIChatProvider();
    case 'anthropic':
      return new AnthropicChatProvider();
    default:
      throw new Error(
        `Unknown LLM_PROVIDER: "${provider}". Supported values: openai, anthropic`
      );
  }
}

function createEmbeddingProvider(provider: string): EmbeddingProvider {
  switch (provider) {
    case 'openai':
      return new OpenAIEmbeddingProvider();
    case 'anthropic':
      return new AnthropicEmbeddingProvider();
    default:
      throw new Error(
        `Unknown EMBEDDING_PROVIDER: "${provider}". Supported values: openai, anthropic`
      );
  }
}

export function getChatProvider(): ChatProvider {
  if (!_chatProvider) {
    const provider = process.env.LLM_PROVIDER || 'openai';
    _chatProvider = createChatProvider(provider);
  }
  return _chatProvider;
}

export function getEmbeddingProvider(): EmbeddingProvider {
  if (!_embeddingProvider) {
    const provider = process.env.EMBEDDING_PROVIDER || 'openai';
    _embeddingProvider = createEmbeddingProvider(provider);
  }
  return _embeddingProvider;
}
