/**
 * Separate Prisma client for the LLM Assistant.
 *
 * Uses LLM_DATABASE_URL when available (e.g. a Railway pgvector instance),
 * falling back to the default DATABASE_URL.
 *
 * This allows local development to keep using a local PostgreSQL for
 * the main app while the LLM assistant connects to a remote pgvector DB.
 * In production both variables can point to the same database.
 */

import { PrismaClient } from '@healthcare/database';

const globalForLlmPrisma = globalThis as unknown as {
  llmPrisma: PrismaClient | undefined;
};

const datasourceUrl = process.env.LLM_DATABASE_URL || process.env.DATABASE_URL;

export const prisma =
  globalForLlmPrisma.llmPrisma ??
  new PrismaClient({
    datasourceUrl,
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForLlmPrisma.llmPrisma = prisma;
}
