/**
 * Conversation Memory
 * Sliding window of recent turns for context continuity
 */

import { prisma } from '../db';
import { MEMORY_MAX_TURNS, MEMORY_TTL_HOURS } from '../constants';
import type { ConversationTurn, ConversationMemory } from '../types';

/**
 * Load conversation memory for a session.
 * Returns the last N turns.
 */
export async function loadMemory(sessionId: string): Promise<ConversationMemory | null> {
  const record = await prisma.llmConversationMemory.findUnique({
    where: { sessionId },
  });

  if (!record) return null;

  // Check expiry
  if (record.expiresAt < new Date()) {
    await prisma.llmConversationMemory.delete({ where: { sessionId } }).catch(() => {});
    return null;
  }

  const turns = (record.turns as unknown as ConversationTurn[]) || [];

  return {
    sessionId: record.sessionId,
    userId: record.userId,
    turns: turns.slice(-MEMORY_MAX_TURNS * 2), // Keep last N exchanges (user + assistant = 2 turns each)
    activeModule: record.activeModule ?? undefined,
  };
}

/**
 * Update conversation memory with new turns.
 * Uses upsert with sliding window.
 */
export async function updateMemory(
  sessionId: string,
  userId: string,
  userMessage: string,
  assistantMessage: string,
  activeModule?: string
): Promise<void> {
  const expiresAt = new Date(Date.now() + MEMORY_TTL_HOURS * 60 * 60 * 1000);

  const existing = await prisma.llmConversationMemory.findUnique({
    where: { sessionId },
  });

  const existingTurns = existing
    ? (existing.turns as unknown as ConversationTurn[]) || []
    : [];

  const newTurns: ConversationTurn[] = [
    ...existingTurns,
    { role: 'user', content: userMessage, timestamp: new Date().toISOString() },
    { role: 'assistant', content: assistantMessage, timestamp: new Date().toISOString() },
  ].slice(-(MEMORY_MAX_TURNS * 2));

  await prisma.llmConversationMemory.upsert({
    where: { sessionId },
    create: {
      sessionId,
      userId,
      turns: newTurns as any,
      activeModule: activeModule ?? null,
      expiresAt,
    },
    update: {
      turns: newTurns as any,
      activeModule: activeModule ?? null,
      expiresAt,
    },
  });
}

/**
 * Clear conversation memory for a session.
 */
export async function clearMemory(sessionId: string): Promise<void> {
  await prisma.llmConversationMemory.delete({
    where: { sessionId },
  }).catch(() => {});
}

/**
 * Format conversation memory as a prompt string.
 */
export function formatMemoryForPrompt(memory: ConversationMemory | null): string {
  if (!memory || memory.turns.length === 0) return '';

  const lines: string[] = ['Conversación reciente:'];

  for (const turn of memory.turns) {
    const prefix = turn.role === 'user' ? 'Usuario' : 'Asistente';
    lines.push(`${prefix}: ${turn.content}`);
  }

  return lines.join('\n');
}
