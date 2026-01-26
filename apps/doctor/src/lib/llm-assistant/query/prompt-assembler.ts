/**
 * Prompt Assembler
 * Builds the message array for the LLM call
 */

import { MODULE_DEFINITIONS } from '../modules';
import { truncateToTokens } from '../tokenizer';
import {
  TOKEN_BUDGET_MEMORY,
  TOKEN_BUDGET_DOCS,
  TOKEN_BUDGET_QUESTION,
} from '../constants';
import type { PromptMessage, RetrievedChunk, ConversationMemory, SourceReference } from '../types';
import { formatMemoryForPrompt } from './memory';

/**
 * Build the system prompt with role definition and rules.
 */
export function buildSystemPrompt(): string {
  return `Eres un asistente de ayuda integrado en el Portal Médico. Tu propósito es guiar a los usuarios sobre cómo usar la aplicación.

REGLAS:
1. SOLO responde con información de la documentación proporcionada. Si no tienes información, di "No tengo información sobre eso en este momento."
2. Responde SIEMPRE en español (México).
3. Sé conciso y directo. Usa listas cuando sea apropiado.
4. Si el usuario pregunta sobre una funcionalidad específica, incluye la ruta de navegación (ej: "Ve a Menú > Expedientes Médicos > Pacientes").
5. NO inventes funcionalidades que no estén en la documentación.
6. NO ejecutes acciones en la aplicación. Solo guías al usuario.
7. Si la pregunta es ambigua, pide clarificación.
8. Menciona el módulo o sección relevante para que el usuario sepa dónde encontrar la información.`;
}

/**
 * Build static context about the application.
 */
export function buildStaticContext(): string {
  const moduleList = MODULE_DEFINITIONS
    .map(m => `- ${m.name}: ${m.description}`)
    .join('\n');

  return `INFORMACIÓN DE LA APLICACIÓN:
El Portal Médico es una plataforma web para médicos con los siguientes módulos:
${moduleList}

La aplicación está en español (México) y es responsive (escritorio, tablet, móvil).`;
}

/**
 * Format retrieved documentation chunks for the prompt.
 */
export function formatRetrievedDocs(chunks: RetrievedChunk[]): string {
  if (chunks.length === 0) {
    return 'DOCUMENTACIÓN: No se encontraron documentos relevantes.';
  }

  const sections = chunks.map((chunk, i) => {
    const header = [
      `[Doc ${i + 1}]`,
      chunk.module && `Módulo: ${chunk.module}`,
      chunk.submodule && `Sub: ${chunk.submodule}`,
      chunk.heading && `Sección: ${chunk.heading}`,
    ]
      .filter(Boolean)
      .join(' | ');

    return `${header}\n${chunk.content}`;
  });

  return `DOCUMENTACIÓN RELEVANTE:\n\n${sections.join('\n\n---\n\n')}`;
}

/**
 * Extract source references from retrieved chunks.
 */
export function extractSources(chunks: RetrievedChunk[]): SourceReference[] {
  const seen = new Set<string>();
  const sources: SourceReference[] = [];

  for (const chunk of chunks) {
    const key = `${chunk.module}:${chunk.filePath}`;
    if (seen.has(key)) continue;
    seen.add(key);

    sources.push({
      module: chunk.module,
      submodule: chunk.submodule,
      heading: chunk.heading,
      filePath: chunk.filePath,
    });
  }

  return sources;
}

/**
 * Assemble the complete prompt message array for the LLM.
 */
export function assemblePrompt(params: {
  question: string;
  chunks: RetrievedChunk[];
  memory: ConversationMemory | null;
}): PromptMessage[] {
  const { question, chunks, memory } = params;

  const messages: PromptMessage[] = [];

  // 1. System prompt
  const systemParts = [buildSystemPrompt(), buildStaticContext()];

  // 2. Memory context (if available)
  const memoryText = formatMemoryForPrompt(memory);
  if (memoryText) {
    systemParts.push(truncateToTokens(memoryText, TOKEN_BUDGET_MEMORY));
  }

  messages.push({
    role: 'system',
    content: systemParts.join('\n\n'),
  });

  // 3. Documentation context + user question
  const docsText = truncateToTokens(
    formatRetrievedDocs(chunks),
    TOKEN_BUDGET_DOCS
  );

  const userContent = `${docsText}\n\nPREGUNTA DEL USUARIO:\n${truncateToTokens(question, TOKEN_BUDGET_QUESTION)}`;

  messages.push({
    role: 'user',
    content: userContent,
  });

  return messages;
}
