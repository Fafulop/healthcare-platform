/**
 * Non-blocking utility to persist the assistant's tool trace.
 *
 * Existe porque el 2026-07-31 el agente ofreció tres horarios que no existían y
 * NO hubo forma de reconstruir qué le devolvieron las tools: `toolCalls` se
 * calculaba y la ruta lo tiraba, y el resultado no se capturaba en ningún lado.
 * Diagnosticarlo costó una sesión entera de arqueología contra la BD — y aun
 * así el estado de prod ya había cambiado (el doctor creó el rango faltante
 * DESPUÉS del turno), lo que llevó a dos conclusiones equivocadas.
 *
 * Mismo contrato que `logTokenUsage`/`logToolErrors`: se llama SIN await, nunca
 * bloquea ni tumba la respuesta.
 *
 * ⚠️ Recibe `turn.toolTrace` (redactado en run-turn), **nunca** `turn.toolCalls`
 * (crudo, para evals). La invariante de "ningún dato de paciente en tablas de
 * depuración" se aplica en `agenda-agent/tool-digest.ts`, no aquí.
 */

import { prisma } from '@healthcare/database';
import type { ToolTraceRecord } from '@/lib/agenda-agent/run-turn';

interface LogToolCallsParams {
  doctorId: string;
  endpoint: string; // "agenda-agent"
  /** Agrupa las llamadas de UN turno — sin esto las filas de turnos concurrentes
   * del mismo doctor se entremezclan y la secuencia deja de ser reconstruible. */
  turnId: string;
  trace: ToolTraceRecord[];
}

export function logToolCalls(params: LogToolCallsParams): void {
  if (params.trace.length === 0) return;
  prisma.agentToolCall
    .createMany({
      data: params.trace.map((t) => ({
        doctorId: params.doctorId,
        endpoint: params.endpoint,
        turnId: params.turnId,
        tool: t.tool,
        seq: t.seq,
        iteration: t.iteration,
        ok: t.ok,
        durationMs: t.durationMs,
        input: t.input as object,
        digest: t.digest as object,
      })),
    })
    .catch((err) => {
      console.error('[logToolCalls] Failed to log tool calls:', err);
    });
}
