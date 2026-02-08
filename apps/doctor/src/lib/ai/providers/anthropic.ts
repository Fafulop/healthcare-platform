/**
 * Anthropic stub implementation of ChatProvider and EmbeddingProvider
 *
 * Placeholder showing how to add a new provider.
 * Install the @anthropic-ai/sdk package and implement the methods below.
 */

import type {
  ChatProvider,
  EmbeddingProvider,
  ChatMessage,
  ChatCompletionOptions,
} from '../types';

export class AnthropicChatProvider implements ChatProvider {
  async chatCompletion(
    _messages: ChatMessage[],
    _options: ChatCompletionOptions = {}
  ): Promise<string> {
    // TODO: implement with @anthropic-ai/sdk
    // const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    // Separate system message from conversation messages, etc.
    throw new Error(
      'Anthropic chat provider is not yet implemented. Set LLM_PROVIDER=openai or implement this class.'
    );
  }
}

export class AnthropicEmbeddingProvider implements EmbeddingProvider {
  async generateEmbedding(_text: string): Promise<number[]> {
    throw new Error(
      'Anthropic embedding provider is not yet implemented. Set EMBEDDING_PROVIDER=openai or implement this class.'
    );
  }

  async generateEmbeddingsBatch(
    _texts: string[],
    _batchSize?: number
  ): Promise<number[][]> {
    throw new Error(
      'Anthropic embedding provider is not yet implemented. Set EMBEDDING_PROVIDER=openai or implement this class.'
    );
  }
}
