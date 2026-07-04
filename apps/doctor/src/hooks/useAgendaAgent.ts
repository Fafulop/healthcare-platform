/**
 * useAgendaAgent — hook for the agenda agent panel (PR 1 reads + PR 2 proposals).
 *
 * Sends messages to /api/agenda-agent (server runs the tool loop) and keeps
 * client-side conversation history for the session (gap G10: no persistence yet).
 *
 * PR 2: assistant messages can carry ordered proposals. executeProposals runs
 * them STRICTLY SEQUENTIALLY against the real endpoints (same calls the UI
 * makes, doctor's own auth token); on failure the chain STOPS and remaining
 * steps are marked skipped (02-DISENO §3.1). Results are fed back into the
 * conversation so the agent can verify/replan next turn (§3.2).
 */

import { useState, useCallback, useRef } from 'react';
import { authFetch } from '@/lib/auth-fetch';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

export type ProposalType = 'create_range' | 'block_time' | 'unblock_time' | 'delete_range';
export type ProposalStatus = 'pendiente' | 'ejecutando' | 'exito' | 'error' | 'rechazada' | 'omitida';

export interface AgendaProposal {
  id: string;
  orden: number;
  type: ProposalType;
  titulo: string;
  detalle: string[];
  advertencias: string[];
  params: Record<string, unknown>;
  /** Client-side execution state. */
  status?: ProposalStatus;
  /** Result/error message after execution. */
  resultado?: string;
}

export interface AgentMessage {
  role: 'user' | 'assistant';
  content: string;
  toolsUsed?: string[];
  proposals?: AgendaProposal[];
}

interface AgentResponse {
  success: boolean;
  data?: { reply: string; toolsUsed: string[]; proposals?: AgendaProposal[] };
  error?: { code: string; message: string };
}

/** Execute ONE proposal against the real endpoint. Returns a human summary. */
async function executeOne(p: AgendaProposal): Promise<{ ok: boolean; resumen: string }> {
  try {
    if (p.type === 'create_range') {
      const res = await authFetch(`${API_URL}/api/appointments/ranges`, {
        method: 'POST',
        body: JSON.stringify(p.params),
      });
      const data = await res.json();
      if (res.status === 409) {
        return { ok: false, resumen: `Conflicto: ${data.error || 'traslapa con rangos existentes'}` };
      }
      if (!data.success) return { ok: false, resumen: data.error || 'Error al crear el rango' };
      return { ok: true, resumen: `${data.count ?? 1} rango(s) creados` };
    }

    if (p.type === 'block_time') {
      const res = await authFetch(`${API_URL}/api/appointments/ranges/block`, {
        method: 'POST',
        body: JSON.stringify(p.params),
      });
      const data = await res.json();
      if (!data.success) return { ok: false, resumen: data.error || 'Error al bloquear' };
      const extras: string[] = [];
      if (data.conflicts > 0) extras.push(`${data.conflicts} cita(s) siguen vivas dentro`);
      if (data.skippedDuplicates > 0) extras.push(`${data.skippedDuplicates} duplicado(s) saltados`);
      if (data.skippedNoRanges > 0) extras.push(`${data.skippedNoRanges} día(s) sin rangos saltados`);
      return {
        ok: true,
        resumen: `${data.datesBlocked ?? 0} día(s) bloqueados${extras.length ? ` (${extras.join(', ')})` : ''}`,
      };
    }

    if (p.type === 'unblock_time') {
      const res = await authFetch(`${API_URL}/api/appointments/ranges/block`, {
        method: 'DELETE',
        body: JSON.stringify(p.params),
      });
      const data = await res.json();
      if (!data.success) return { ok: false, resumen: data.error || 'Error al desbloquear' };
      return { ok: true, resumen: `${data.unblocked ?? '?'} bloqueo(s) eliminados` };
    }

    if (p.type === 'delete_range') {
      // Individual deletes (protected path: the endpoint refuses ranges with
      // active citas). Partial success is reported per range.
      const ids = (p.params.rangeIds as string[]) ?? [];
      const deleted: string[] = [];
      const failed: string[] = [];
      for (const id of ids) {
        const res = await authFetch(`${API_URL}/api/appointments/ranges/${id}`, { method: 'DELETE' });
        const data = await res.json().catch(() => ({ success: false }));
        if (data.success) deleted.push(id);
        else failed.push(data.error || `rango ${id.slice(-6)} rechazado`);
      }
      if (deleted.length === 0) {
        return { ok: false, resumen: `Ningún rango eliminado: ${failed.slice(0, 2).join(' · ')}` };
      }
      return {
        ok: true,
        resumen: `${deleted.length} rango(s) eliminados${failed.length ? ` — ${failed.length} rechazado(s): ${failed.slice(0, 2).join(' · ')}` : ''}`,
      };
    }

    return { ok: false, resumen: `Tipo de propuesta desconocido: ${p.type}` };
  } catch {
    return { ok: false, resumen: 'Error de conexión al ejecutar' };
  }
}

export function useAgendaAgent(onAgendaChanged?: () => void) {
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState(false);
  const executingRef = useRef(false);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || loading) return;

      const history = messages.map((m) => ({ role: m.role, content: m.content }));
      setMessages((prev) => [...prev, { role: 'user', content: trimmed }]);
      setLoading(true);

      try {
        const res = await fetch('/api/agenda-agent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: trimmed, conversationHistory: history }),
        });
        const data: AgentResponse = await res.json();

        if (data.success && data.data) {
          setMessages((prev) => [
            ...prev,
            {
              role: 'assistant',
              content: data.data!.reply,
              toolsUsed: data.data!.toolsUsed,
              proposals: (data.data!.proposals ?? []).map((p) => ({ ...p, status: 'pendiente' as const })),
            },
          ]);
        } else {
          setMessages((prev) => [
            ...prev,
            {
              role: 'assistant',
              content: data.error?.message || 'Ocurrió un error. Intenta de nuevo.',
            },
          ]);
        }
      } catch {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: 'Error de conexión. Verifica tu internet e intenta de nuevo.' },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [messages, loading]
  );

  const updateProposal = useCallback(
    (messageIndex: number, proposalId: string, patch: Partial<AgendaProposal>) => {
      setMessages((prev) =>
        prev.map((m, i) =>
          i === messageIndex && m.proposals
            ? { ...m, proposals: m.proposals.map((p) => (p.id === proposalId ? { ...p, ...patch } : p)) }
            : m
        )
      );
    },
    []
  );

  const rejectProposal = useCallback(
    (messageIndex: number, proposalId: string) => {
      updateProposal(messageIndex, proposalId, { status: 'rechazada' });
    },
    [updateProposal]
  );

  /**
   * Execute the message's non-rejected proposals STRICTLY IN ORDER. Stops the
   * chain on the first failure; remaining steps are marked "omitida". Feeds the
   * results back to the agent as a message so it can verify/replan.
   */
  const executeProposals = useCallback(
    async (messageIndex: number) => {
      if (executingRef.current) return;
      const msg = messages[messageIndex];
      const toRun = (msg?.proposals ?? [])
        .filter((p) => p.status === 'pendiente')
        .sort((a, b) => a.orden - b.orden);
      if (toRun.length === 0) return;

      executingRef.current = true;
      setExecuting(true);
      const resultados: string[] = [];
      let failed = false;

      for (const p of toRun) {
        if (failed) {
          updateProposal(messageIndex, p.id, {
            status: 'omitida',
            resultado: 'No ejecutada: falló un paso anterior',
          });
          resultados.push(`Paso ${p.orden} (${p.titulo}): OMITIDO por fallo anterior`);
          continue;
        }
        updateProposal(messageIndex, p.id, { status: 'ejecutando' });
        const r = await executeOne(p);
        updateProposal(messageIndex, p.id, { status: r.ok ? 'exito' : 'error', resultado: r.resumen });
        resultados.push(`Paso ${p.orden} (${p.titulo}): ${r.ok ? 'ÉXITO' : 'FALLÓ'} — ${r.resumen}`);
        if (!r.ok) failed = true;
      }

      executingRef.current = false;
      setExecuting(false);
      onAgendaChanged?.();

      // Feed results back so the agent verifies and re-plans if needed (§3.2)
      await sendMessage(`[Resultado de la ejecución del plan]\n${resultados.join('\n')}`);
    },
    [messages, updateProposal, sendMessage, onAgendaChanged]
  );

  const clearChat = useCallback(() => setMessages([]), []);

  return { messages, loading, executing, sendMessage, clearChat, executeProposals, rejectProposal };
}
