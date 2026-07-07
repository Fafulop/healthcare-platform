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

export type ProposalType =
  | 'create_range'
  | 'block_time'
  | 'unblock_time'
  | 'delete_range'
  | 'create_booking'
  | 'confirm_booking'
  | 'cancel_booking'
  | 'reschedule_booking'
  | 'complete_booking'
  | 'no_show';
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

/** Daily assistant budget (resets at midnight MX) — drives the panel widget. */
export interface AgentBudget {
  used: number;
  cap: number;
}

interface AgentResponse {
  success: boolean;
  data?: {
    reply: string;
    toolsUsed: string[];
    proposals?: AgendaProposal[];
    budget?: AgentBudget;
  };
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

    // --- PR 3: citas (todo lo que notifica al paciente llegó con card 🔴) ---

    if (p.type === 'create_booking') {
      const res = await authFetch(`${API_URL}/api/appointments/range-bookings`, {
        method: 'POST',
        body: JSON.stringify(p.params),
      });
      // .catch on every parse in the cita branches: a non-JSON body after a
      // SUCCESSFUL mutation must not throw to the outer catch — the generic
      // "Error de conexión" would mask what already happened (review finding).
      const data = await res.json().catch(() => ({ success: false, error: `respuesta inválida del servidor (HTTP ${res.status})` }));
      if (!data.success) return { ok: false, resumen: data.error || 'Error al crear la cita' };
      return { ok: true, resumen: 'Cita creada (CONFIRMADA) — notificaciones enviadas según los datos de contacto' };
    }

    if (p.type === 'confirm_booking' || p.type === 'cancel_booking' || p.type === 'no_show') {
      const res = await authFetch(`${API_URL}/api/appointments/bookings/${p.params.bookingId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: p.params.status }),
      });
      const data = await res.json().catch(() => ({ success: false, error: `respuesta inválida del servidor (HTTP ${res.status})` }));
      if (!data.success) return { ok: false, resumen: data.error || 'Error al actualizar la cita' };
      const labels: Record<string, string> = {
        confirm_booking: 'Cita CONFIRMADA — notificaciones enviadas según los datos de contacto',
        cancel_booking: 'Cita CANCELADA — aviso enviado si tenía email; evento de calendario eliminado',
        no_show: 'Cita marcada NO ASISTIÓ',
      };
      return { ok: true, resumen: labels[p.type] };
    }

    if (p.type === 'complete_booking') {
      // Two calls, mirroring useBookings.completeBooking (G1): the PATCH does
      // NOT create the LedgerEntry — the ledger POST (payload built server-side
      // at proposal time) is what registers the income in Flujo de Dinero.
      const patchRes = await authFetch(`${API_URL}/api/appointments/bookings/${p.params.bookingId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'COMPLETED' }),
      });
      const patchData = await patchRes.json().catch(() => ({ success: false, error: `respuesta inválida del servidor (HTTP ${patchRes.status}) — verifica el estado de la cita` }));
      if (!patchData.success) {
        return { ok: false, resumen: patchData.error || 'Error al completar la cita' };
      }
      try {
        const ledgerRes = await authFetch(`${API_URL}/api/practice-management/ledger`, {
          method: 'POST',
          body: JSON.stringify(p.params.ledger),
        });
        const ledgerData = await ledgerRes.json();
        if (!ledgerData.data) {
          return {
            ok: true,
            resumen:
              '⚠️ Cita COMPLETADA, pero el ingreso NO se registró en Flujo de Dinero — regístralo manualmente',
          };
        }
      } catch {
        return {
          ok: true,
          resumen:
            '⚠️ Cita COMPLETADA, pero el ingreso NO se registró en Flujo de Dinero — regístralo manualmente',
        };
      }
      const monto = (p.params.ledger as { amount?: number })?.amount;
      return { ok: true, resumen: `Cita COMPLETADA · ingreso registrado en Flujo de Dinero${monto ? ` ($${monto})` : ''}` };
    }

    if (p.type === 'reschedule_booking') {
      // Cancel-then-create (G4/RSC). If the create fails, the original is
      // already CANCELLED and the patient notified — say it EXPLICITLY (RSC-3)
      // so the verification turn re-plans immediately.
      const cancelRes = await authFetch(`${API_URL}/api/appointments/bookings/${p.params.bookingId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'CANCELLED' }),
      });
      const cancelData = await cancelRes.json().catch(() => ({ success: false, error: `respuesta inválida del servidor (HTTP ${cancelRes.status}) — verifica el estado de la cita` }));
      if (!cancelData.success) {
        return { ok: false, resumen: `No se pudo cancelar la cita original: ${cancelData.error || 'error'} (nada cambió)` };
      }
      const createRes = await authFetch(`${API_URL}/api/appointments/range-bookings`, {
        method: 'POST',
        body: JSON.stringify(p.params.create),
      });
      const createData = await createRes.json().catch(() => ({ success: false, error: `respuesta inválida del servidor (HTTP ${createRes.status})` }));
      if (!createData.success) {
        return {
          ok: false,
          resumen: `⚠️ La cita original quedó CANCELADA (paciente avisado) pero NO se pudo crear la nueva: ${createData.error || 'error'} — hay que reagendar al paciente YA`,
        };
      }
      // Restore a manually-adjusted price (the create endpoint recomputes it
      // from the service — review finding). Non-fatal: the reschedule stands.
      let priceNote = '';
      const restorePrice = p.params.restorePrice as number | undefined;
      const newBookingId = createData.data?.id as string | undefined;
      if (restorePrice && newBookingId) {
        const priceOk = await authFetch(`${API_URL}/api/appointments/bookings/${newBookingId}`, {
          method: 'PATCH',
          body: JSON.stringify({ finalPrice: restorePrice }),
        })
          .then((r) => r.json())
          .then((d) => Boolean(d.success))
          .catch(() => false);
        priceNote = priceOk
          ? ` · precio ajustado re-aplicado ($${restorePrice})`
          : ` · ⚠️ NO se pudo re-aplicar el precio ajustado ($${restorePrice}) — ajústalo manualmente`;
      }
      return { ok: true, resumen: `Cita reagendada — original cancelada, nueva CONFIRMADA (paciente notificado de ambas)${priceNote}` };
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
  const [budget, setBudget] = useState<AgentBudget | null>(null);
  const executingRef = useRef(false);

  /** Fetch today's budget (panel calls this when it opens). */
  const refreshBudget = useCallback(async () => {
    try {
      const res = await fetch('/api/agenda-agent');
      const data = await res.json().catch(() => null);
      if (data?.success && data.data) setBudget(data.data as AgentBudget);
    } catch {
      // Non-critical widget data — leave the previous value.
    }
  }, []);

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
          if (data.data.budget) setBudget(data.data.budget);
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

  return {
    messages,
    loading,
    executing,
    budget,
    refreshBudget,
    sendMessage,
    clearChat,
    executeProposals,
    rejectProposal,
  };
}
