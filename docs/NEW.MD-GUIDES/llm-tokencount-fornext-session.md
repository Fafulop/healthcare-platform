# LLM Token Usage Tracking Per Doctor

## Goal

Track input and output token consumption per doctor across all LLM providers (OpenAI, Anthropic, future providers). This enables usage monitoring, cost attribution, and billing per doctor.

---

## Current State

### What exists

- **Provider-agnostic LLM abstraction** at `apps/doctor/src/lib/ai/`
  - `types.ts` — `ChatProvider` and `EmbeddingProvider` interfaces
  - `index.ts` — Factory with lazy singleton pattern
  - `providers/openai.ts` — Fully implemented (gpt-4o, whisper-1, text-embedding-3-small)
  - `providers/anthropic.ts` — Stub, not yet functional

- **6 API routes that consume LLM tokens:**

  | Route | Purpose | Model | JSON Mode |
  |-------|---------|-------|-----------|
  | `POST /api/encounter-chat` | Fill encounter form fields via chat | gpt-4o | Yes |
  | `POST /api/form-builder-chat` | Create custom templates via chat | gpt-4o | Yes |
  | `POST /api/voice/chat` | Voice-assisted data entry conversation | gpt-4o | Yes |
  | `POST /api/voice/transcribe` | Audio to text (Whisper) | whisper-1 | No |
  | `POST /api/voice/structure` | Transcript to structured JSON | gpt-4o | Yes |
  | `POST /api/llm-assistant/chat` | RAG Q&A assistant | gpt-4o-mini | No |

- **Every route authenticates the doctor** via `requireDoctorAuth()`, so `doctorId` is always available.

### What's missing

- `ChatProvider.chatCompletion()` returns `Promise<string>` — token usage metadata is **discarded**.
- OpenAI responses include `response.usage.prompt_tokens` and `response.usage.completion_tokens` but these are never captured.
- No database table for token usage logs.
- No aggregation or reporting endpoints.

---

## Implementation Plan

### Step 1: Update the ChatProvider interface

**File:** `apps/doctor/src/lib/ai/types.ts`

Add a `ChatCompletionResult` type and change the return type of `chatCompletion`:

```typescript
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface ChatCompletionResult {
  content: string;
  usage: TokenUsage;
}

export interface ChatProvider {
  chatCompletion(
    messages: ChatMessage[],
    options?: ChatCompletionOptions
  ): Promise<ChatCompletionResult>;  // was Promise<string>
}
```

This is the key design decision: **usage tracking lives in the interface**, so every provider must return it.

### Step 2: Update OpenAI provider

**File:** `apps/doctor/src/lib/ai/providers/openai.ts`

The OpenAI SDK already returns usage data. Change `chatCompletion()` to capture it:

```typescript
async chatCompletion(messages, options): Promise<ChatCompletionResult> {
  const response = await this.client.chat.completions.create({
    model: options?.model || this.defaultModel,
    messages,
    temperature: options?.temperature ?? 0.7,
    max_tokens: options?.maxTokens,
    response_format: options?.jsonMode ? { type: 'json_object' } : undefined,
  });

  return {
    content: response.choices[0].message.content || '',
    usage: {
      promptTokens: response.usage?.prompt_tokens ?? 0,
      completionTokens: response.usage?.completion_tokens ?? 0,
      totalTokens: response.usage?.total_tokens ?? 0,
    },
  };
}
```

### Step 3: Update Anthropic provider (when implemented)

**File:** `apps/doctor/src/lib/ai/providers/anthropic.ts`

Anthropic uses different field names but same concept:

```typescript
async chatCompletion(messages, options): Promise<ChatCompletionResult> {
  const response = await this.client.messages.create({ ... });

  return {
    content: response.content[0].text,
    usage: {
      promptTokens: response.usage.input_tokens,
      completionTokens: response.usage.output_tokens,
      totalTokens: response.usage.input_tokens + response.usage.output_tokens,
    },
  };
}
```

The route handlers never know which provider is behind it — they always get `result.usage.promptTokens`.

### Step 4: Create database table

**File:** `packages/database/prisma/schema.prisma`

Add a new model for token usage logging:

```prisma
model LlmTokenUsage {
  id                String   @id @default(cuid())
  doctorId          String
  endpoint          String   // "encounter-chat", "form-builder-chat", "voice-chat", etc.
  model             String   // "gpt-4o", "gpt-4o-mini", "whisper-1", "claude-sonnet-4-5", etc.
  provider          String   // "openai", "anthropic"
  promptTokens      Int
  completionTokens  Int
  totalTokens       Int
  createdAt         DateTime @default(now())

  doctor Doctor @relation(fields: [doctorId], references: [id])

  @@index([doctorId])
  @@index([doctorId, createdAt])
  @@index([createdAt])
  @@schema("llm_assistant")
}
```

Run migration after adding the model:

```bash
npx prisma migrate dev --name add-llm-token-usage
```

### Step 5: Create a logging utility

**File:** `apps/doctor/src/lib/ai/log-token-usage.ts`

```typescript
import { prisma } from '@healthcare/database';

interface LogTokenUsageParams {
  doctorId: string;
  endpoint: string;
  model: string;
  provider: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export async function logTokenUsage(params: LogTokenUsageParams): Promise<void> {
  try {
    await prisma.llmTokenUsage.create({
      data: {
        doctorId: params.doctorId,
        endpoint: params.endpoint,
        model: params.model,
        provider: params.provider,
        promptTokens: params.usage.promptTokens,
        completionTokens: params.usage.completionTokens,
        totalTokens: params.usage.totalTokens,
      },
    });
  } catch (err) {
    // Log but don't fail the request — token tracking is non-critical
    console.error('[logTokenUsage] Failed to log:', err);
  }
}
```

### Step 6: Update all API routes

Every route that calls `chatCompletion()` needs two changes:

1. Destructure `{ content, usage }` instead of just getting a string.
2. Call `logTokenUsage()` after the LLM call (fire-and-forget, don't await).

**Example for encounter-chat route** (`apps/doctor/src/app/api/encounter-chat/route.ts`):

```typescript
// Before:
const responseText = await chatProvider.chatCompletion(messages, options);

// After:
const { content: responseText, usage } = await chatProvider.chatCompletion(messages, options);

// Log usage (non-blocking)
logTokenUsage({
  doctorId: authUser.doctorId,
  endpoint: 'encounter-chat',
  model: 'gpt-4o',
  provider: process.env.LLM_PROVIDER || 'openai',
  usage,
});
```

Apply the same pattern to all 6 routes:

| Route file | endpoint value |
|------------|---------------|
| `app/api/encounter-chat/route.ts` | `"encounter-chat"` |
| `app/api/form-builder-chat/route.ts` | `"form-builder-chat"` |
| `app/api/voice/chat/route.ts` | `"voice-chat"` |
| `app/api/voice/transcribe/route.ts` | `"voice-transcribe"` |
| `app/api/voice/structure/route.ts` | `"voice-structure"` |
| `app/api/llm-assistant/chat/route.ts` | `"llm-assistant"` |

**Note on Whisper (voice-transcribe):** Whisper doesn't return token counts. For this endpoint, estimate based on audio duration or log `0` for tokens and track `duration` separately. Consider adding a `durationSeconds` column to the table for whisper calls.

### Step 7: Update llm-assistant pipeline

**File:** `apps/doctor/src/lib/llm-assistant/llm-client.ts`

This file wraps `chatCompletion()` for the RAG pipeline. Update it to pass through usage data:

```typescript
// Before:
export async function callLLM(messages): Promise<string>

// After:
export async function callLLM(messages): Promise<ChatCompletionResult>
```

Then update `query/pipeline.ts` to destructure and log the usage.

---

## Step 8 (Optional): Aggregation API for admin dashboard

Create an endpoint to query usage per doctor:

**Route:** `GET /api/admin/llm-usage?doctorId=xxx&from=2025-01-01&to=2025-01-31`

```typescript
const usage = await prisma.llmTokenUsage.groupBy({
  by: ['doctorId', 'endpoint'],
  where: {
    doctorId: doctorId || undefined,
    createdAt: { gte: from, lte: to },
  },
  _sum: {
    promptTokens: true,
    completionTokens: true,
    totalTokens: true,
  },
  _count: true,
});
```

Response format:

```json
{
  "success": true,
  "data": [
    {
      "doctorId": "abc123",
      "endpoint": "encounter-chat",
      "totalCalls": 47,
      "promptTokens": 23500,
      "completionTokens": 12800,
      "totalTokens": 36300
    }
  ]
}
```

---

## Files to modify (summary)

| File | Change |
|------|--------|
| `apps/doctor/src/lib/ai/types.ts` | Add `TokenUsage`, `ChatCompletionResult`, update `ChatProvider` interface |
| `apps/doctor/src/lib/ai/providers/openai.ts` | Return `ChatCompletionResult` with usage data |
| `apps/doctor/src/lib/ai/providers/anthropic.ts` | Same (when implemented) |
| `packages/database/prisma/schema.prisma` | Add `LlmTokenUsage` model |
| `apps/doctor/src/lib/ai/log-token-usage.ts` | **New file** — logging utility |
| `apps/doctor/src/app/api/encounter-chat/route.ts` | Destructure usage, call logTokenUsage |
| `apps/doctor/src/app/api/form-builder-chat/route.ts` | Same |
| `apps/doctor/src/app/api/voice/chat/route.ts` | Same |
| `apps/doctor/src/app/api/voice/transcribe/route.ts` | Log duration (no token data from Whisper) |
| `apps/doctor/src/app/api/voice/structure/route.ts` | Destructure usage, call logTokenUsage |
| `apps/doctor/src/app/api/llm-assistant/chat/route.ts` | Same |
| `apps/doctor/src/lib/llm-assistant/llm-client.ts` | Pass through `ChatCompletionResult` |
| `apps/doctor/src/lib/llm-assistant/query/pipeline.ts` | Destructure usage, call logTokenUsage |

---

## Key design decisions

1. **Usage tracking is in the interface, not the provider** — Any future provider (Google Gemini, Mistral, local models) must return token counts. This is enforced at the type level.

2. **Logging is non-blocking** — `logTokenUsage()` should not be awaited in the request path. If it fails, the request still succeeds. Token tracking is non-critical.

3. **One table, all providers** — The `provider` column distinguishes OpenAI from Anthropic from others. No separate tables per provider.

4. **Whisper is a special case** — It doesn't return token counts. Track audio `durationSeconds` instead. Consider adding this as an optional column.

5. **Embeddings are not tracked initially** — Embedding calls (for RAG) are cheap and high-volume. Can be added later if needed with the same pattern on `EmbeddingProvider`.
