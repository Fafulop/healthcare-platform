/**
 * Prompt Assembler
 * Builds the message array for the LLM call.
 *
 * Structure:
 *   [system]  role + rules + app modules + capability map + memory + UI context
 *   [user]    retrieved docs + question
 */

import { MODULE_DEFINITIONS } from '../modules';
import { truncateToTokens } from '../tokenizer';
import {
  TOKEN_BUDGET_MEMORY,
  TOKEN_BUDGET_DOCS,
  TOKEN_BUDGET_QUESTION,
  TOKEN_BUDGET_CAPABILITIES,
} from '../constants';
import type {
  PromptMessage,
  RetrievedChunk,
  ConversationMemory,
  SourceReference,
  UIContext,
} from '../types';
import { formatMemoryForPrompt } from './memory';

/**
 * Build the system prompt with role definition and rules.
 */
export function buildSystemPrompt(): string {
  return `Eres un asistente experto integrado en el Portal Médico. Tu función es guiar a los usuarios con precisión sobre cómo usar la aplicación.

FUENTES DE INFORMACIÓN (en orden de prioridad):
1. REGLAS DE LA APLICACIÓN — Reglas deterministas inyectadas en este prompt. Son la fuente de verdad absoluta sobre qué está permitido o bloqueado. Responde directamente desde ellas aunque no haya documentación adicional.
2. DOCUMENTACIÓN DE REFERENCIA — Explicaciones de flujos y procedimientos. Complementa las reglas cuando están disponibles.

REGLAS DE COMPORTAMIENTO:
1. Si las REGLAS DE LA APLICACIÓN responden la pregunta → úsalas directamente. No necesitas documentación adicional para hacerlo.
2. Si solo hay DOCUMENTACIÓN DE REFERENCIA → úsala para explicar flujos y pasos.
3. Responde SIEMPRE en español (México).
4. Sé directo y concreto. Usa listas numeradas para pasos, viñetas para opciones.
5. Incluye la ruta de navegación exacta cuando sea relevante (ej: "Ve a Citas > Lista > selecciona el horario").
6. Si algo está bloqueado, explica POR QUÉ y cómo resolverlo paso a paso.
7. Di "No tengo información sobre eso en este momento" SOLO si ninguna de las dos fuentes contiene información sobre el tema — no lo uses cuando las REGLAS ya responden la pregunta.
8. NO inventes funcionalidades que no estén en las REGLAS ni en la DOCUMENTACIÓN.
9. NO ejecutes acciones en la aplicación. Solo guías al usuario.`;
}

/**
 * Build static context about the application modules.
 */
export function buildStaticContext(): string {
  const moduleList = MODULE_DEFINITIONS
    .map(m => `- ${m.name}: ${m.description}`)
    .join('\n');

  return `MÓDULOS DEL PORTAL MÉDICO:
${moduleList}

La aplicación está en español (México) y es responsive (escritorio, tablet, móvil).`;
}

/**
 * Format retrieved documentation chunks for the prompt.
 */
export function formatRetrievedDocs(chunks: RetrievedChunk[]): string {
  if (chunks.length === 0) {
    return 'DOCUMENTACIÓN ADICIONAL: No se encontraron documentos de referencia para esta pregunta. Si las REGLAS DE LA APLICACIÓN contienen la respuesta, úsalas directamente.';
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

  return `DOCUMENTACIÓN DE REFERENCIA:\n\n${sections.join('\n\n---\n\n')}`;
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
 * Format the UI context as a short prompt section.
 */
function buildUIContextSection(uiContext: UIContext): string {
  return `CONTEXTO ACTUAL DEL USUARIO:\nEl usuario está en la página: ${uiContext.currentPath}`;
}

/**
 * Assemble the complete prompt message array for the LLM.
 */
export function assemblePrompt(params: {
  question: string;
  chunks: RetrievedChunk[];
  memory: ConversationMemory | null;
  capabilityMapText?: string;
  uiContext?: UIContext;
}): PromptMessage[] {
  const { question, chunks, memory, capabilityMapText, uiContext } = params;

  const messages: PromptMessage[] = [];

  // 1. System prompt: role + rules
  const systemParts = [buildSystemPrompt(), buildStaticContext()];

  // 2. Capability map (injected before docs — highest priority)
  if (capabilityMapText) {
    systemParts.push(truncateToTokens(capabilityMapText, TOKEN_BUDGET_CAPABILITIES));
  }

  // 3. Conversation memory
  const memoryText = formatMemoryForPrompt(memory);
  if (memoryText) {
    systemParts.push(truncateToTokens(memoryText, TOKEN_BUDGET_MEMORY));
  }

  // 4. UI context (where the user is right now)
  if (uiContext) {
    systemParts.push(buildUIContextSection(uiContext));
  }

  messages.push({
    role: 'system',
    content: systemParts.join('\n\n'),
  });

  // 5. Documentation + user question (user turn)
  const docsText = truncateToTokens(
    formatRetrievedDocs(chunks),
    TOKEN_BUDGET_DOCS
  );

  const userContent = `${docsText}\n\nPREGUNTA:\n${truncateToTokens(question, TOKEN_BUDGET_QUESTION)}`;

  messages.push({
    role: 'user',
    content: userContent,
  });

  return messages;
}
