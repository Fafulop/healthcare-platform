"use client";

/**
 * AgentContext — app-shell-level state for the assistant copilot panel.
 *
 * Lifted from the old useAgendaAgent hook (which lived per-page in the
 * appointments page) so the conversation SURVIVES navigation. Mounted in
 * the ROOT layout, which also wraps /login and /consent, so the provider is
 * INERT on mount: zero fetches until the doctor opens the panel or sends a
 * message (G1 of the copilot-panel plan).
 *
 * Sends messages to /api/agenda-agent (server runs the tool loop) and keeps
 * client-side conversation history for the session (gap G10: no persistence
 * yet). Assistant messages can carry ordered proposals; executeProposals runs
 * them STRICTLY SEQUENTIALLY against the real endpoints (same calls the UI
 * makes, doctor's own auth token); on failure the chain STOPS and remaining
 * steps are marked skipped (02-DISENO §3.1). Results are fed back into the
 * conversation so the agent can verify/replan next turn (§3.2).
 *
 * Pages that render agenda data subscribe via subscribeAgendaChanged to
 * refresh their views after the executor mutates data; pages without a
 * subscription simply don't auto-refresh (same as today from any other page).
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';
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
  | 'no_show'
  | 'create_cfdi'
  | 'prepare_factura_borrador';
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
  /** F2c: follow-up action after a successful execution (e.g. "Abrir
   * borrador" → the Nueva Factura form) — the panel renders it as a button
   * because the chat renderer does NOT linkify prose (09-DISENO §7.1). */
  accion?: { label: string; href: string };
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

/** Execute ONE proposal against the real endpoint. Returns a human summary
 * (and optionally a follow-up accion for the card — F2c). */
async function executeOne(p: AgendaProposal): Promise<{ ok: boolean; resumen: string; accion?: { label: string; href: string } }> {
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
      // ONE call: the PATCH marks the cita COMPLETED and the API creates the income
      // LedgerEntry as an internal effect of that (citas-permitted) completion — NOT a
      // separate flujo-gated POST, so it also works for a secondary user without `flujo`
      // (00-REQUISITOS §3.6). The server rebuilds concept/area/patient identity from the
      // booking; we only forward the amount + forma de pago the proposal captured.
      // `params.ledger` is null when the income already exists (H2, e.g. paid payment link).
      const ledger = p.params.ledger as { amount?: number; formaDePago?: string } | null;
      const body: { status: string; income?: { price: number; formaDePago?: string } } = { status: 'COMPLETED' };
      if (ledger && typeof ledger.amount === 'number') {
        body.income = { price: ledger.amount, formaDePago: ledger.formaDePago };
      }
      const patchRes = await authFetch(`${API_URL}/api/appointments/bookings/${p.params.bookingId}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      const patchData = await patchRes.json().catch(() => ({ success: false, error: `respuesta inválida del servidor (HTTP ${patchRes.status}) — verifica el estado de la cita` }));
      if (!patchData.success) {
        return { ok: false, resumen: patchData.error || 'Error al completar la cita' };
      }
      if (patchData.ledgerWarning) {
        return {
          ok: true,
          resumen:
            '⚠️ Cita COMPLETADA, pero el ingreso NO se registró en Flujo de Dinero — regístralo manualmente',
        };
      }
      // H2 (no income to create) or the entry already existed (race with a payment webhook).
      if (!ledger || patchData.ledgerAlreadyExisted) {
        return { ok: true, resumen: 'Cita COMPLETADA · el ingreso ya estaba registrado en Flujo de Dinero (no se duplicó)' };
      }
      const monto = ledger.amount;
      return { ok: true, resumen: `Cita COMPLETADA · ingreso registrado en Flujo de Dinero${monto ? ` ($${monto})` : ''}` };
    }

    // --- PR F2c: preparar borrador de factura (tier bajo — reversible) ---

    if (p.type === 'prepare_factura_borrador') {
      const res = await authFetch(`${API_URL}/api/facturacion/drafts`, {
        method: 'POST',
        body: JSON.stringify(p.params),
      });
      const data = await res.json().catch(() => ({ error: `respuesta inválida del servidor (HTTP ${res.status})` }));
      if (!res.ok || !data.data) {
        return { ok: false, resumen: data.error || `Error al crear el borrador (HTTP ${res.status})` };
      }
      const draftId = data.data.id as number;
      return {
        ok: true,
        resumen: `Borrador #${draftId} creado — nada se timbró; revísalo y emítelo en Facturación`,
        accion: { label: 'Abrir borrador →', href: `/dashboard/facturacion?draft=${draftId}` },
      };
    }

    // --- PR F2b: emisión de CFDI (tier máximo — timbra ante el SAT) ---

    if (p.type === 'create_cfdi') {
      const res = await authFetch(`${API_URL}/api/facturacion/cfdi`, {
        method: 'POST',
        body: JSON.stringify(p.params),
      });
      const data = await res.json().catch(() => ({ error: `respuesta inválida del servidor (HTTP ${res.status}) — verifica en Facturación si la factura se emitió antes de reintentar` }));
      if (!res.ok || data.error) {
        return { ok: false, resumen: data.error || `Error al emitir la factura (HTTP ${res.status})` };
      }
      const folio = data.data?.folio ? ` · folio ${data.data.folio}` : '';
      const uuid = data.facturama?.uuid ? ` · UUID ${data.facturama.uuid}` : '';
      return {
        ok: true,
        resumen: `CFDI TIMBRADO ante el SAT${folio}${uuid} — el ingreso quedó marcado como facturado; PDF/XML en Facturación`,
      };
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

/**
 * Split contexts (review finding): the layouts and pages only need the
 * rarely-changing open state + stable actions, while messages/loading churn
 * on every turn. One merged context made every chat message re-render the
 * whole appointments page and shell chrome; with the split, chat activity
 * re-renders ONLY the panel.
 */
interface AgentActionsValue {
  /** Panel visibility — persisted in localStorage, survives reloads. */
  isOpen: boolean;
  open: () => void;
  close: () => void;
  /**
   * Register a callback to run after the executor changed agenda data.
   * Returns the unsubscribe function (call it on unmount).
   */
  subscribeAgendaChanged: (cb: () => void) => () => void;
}

interface AgentChatValue {
  messages: AgentMessage[];
  loading: boolean;
  executing: boolean;
  budget: AgentBudget | null;
  refreshBudget: () => Promise<void>;
  sendMessage: (text: string) => Promise<void>;
  clearChat: () => void;
  executeProposals: (messageIndex: number) => Promise<void>;
  rejectProposal: (messageIndex: number, proposalId: string) => void;
}

const AgentActionsContext = createContext<AgentActionsValue | null>(null);
const AgentChatContext = createContext<AgentChatValue | null>(null);

const OPEN_STORAGE_KEY = 'agentPanelOpen';

export function AgentProvider({ children }: { children: ReactNode }) {
  // Starts false and reads localStorage in an effect (not in the initializer)
  // to avoid an SSR hydration mismatch on first paint.
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [budget, setBudget] = useState<AgentBudget | null>(null);
  const executingRef = useRef(false);
  const agendaChangedSubscribers = useRef<Set<() => void>>(new Set());

  useEffect(() => {
    if (localStorage.getItem(OPEN_STORAGE_KEY) === 'true') setIsOpen(true);
  }, []);

  const open = useCallback(() => {
    setIsOpen(true);
    localStorage.setItem(OPEN_STORAGE_KEY, 'true');
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    localStorage.setItem(OPEN_STORAGE_KEY, 'false');
  }, []);

  const subscribeAgendaChanged = useCallback((cb: () => void) => {
    agendaChangedSubscribers.current.add(cb);
    return () => {
      agendaChangedSubscribers.current.delete(cb);
    };
  }, []);

  /** Fetch today's budget (panel calls this when it opens — never on mount). */
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
        updateProposal(messageIndex, p.id, {
          status: r.ok ? 'exito' : 'error',
          resultado: r.resumen,
          ...(r.accion ? { accion: r.accion } : {}),
        });
        resultados.push(`Paso ${p.orden} (${p.titulo}): ${r.ok ? 'ÉXITO' : 'FALLÓ'} — ${r.resumen}`);
        if (!r.ok) failed = true;
      }

      executingRef.current = false;
      setExecuting(false);
      // Notify CURRENT subscribers (e.g. /appointments refreshes its views);
      // pages without a subscription just don't auto-refresh.
      agendaChangedSubscribers.current.forEach((cb) => cb());

      // Feed results back so the agent verifies and re-plans if needed (§3.2)
      await sendMessage(`[Resultado de la ejecución del plan]\n${resultados.join('\n')}`);
    },
    [messages, updateProposal, sendMessage]
  );

  const clearChat = useCallback(() => setMessages([]), []);

  // Memoized so layout/page consumers only re-render on open/close, never on
  // chat churn (open/close/subscribeAgendaChanged are stable callbacks).
  const actionsValue = useMemo(
    () => ({ isOpen, open, close, subscribeAgendaChanged }),
    [isOpen, open, close, subscribeAgendaChanged]
  );

  const chatValue = useMemo(
    () => ({
      messages,
      loading,
      executing,
      budget,
      refreshBudget,
      sendMessage,
      clearChat,
      executeProposals,
      rejectProposal,
    }),
    [messages, loading, executing, budget, refreshBudget, sendMessage, clearChat, executeProposals, rejectProposal]
  );

  return (
    <AgentActionsContext.Provider value={actionsValue}>
      <AgentChatContext.Provider value={chatValue}>{children}</AgentChatContext.Provider>
    </AgentActionsContext.Provider>
  );
}

/** Open state + stable actions — safe for layouts/pages (no chat-churn re-renders). */
export function useAgentActions(): AgentActionsValue {
  const ctx = useContext(AgentActionsContext);
  if (!ctx) throw new Error('useAgentActions must be used within AgentProvider (root layout)');
  return ctx;
}

/** Full chat state — re-renders on every turn; only the panel should consume this. */
export function useAgentChat(): AgentChatValue {
  const ctx = useContext(AgentChatContext);
  if (!ctx) throw new Error('useAgentChat must be used within AgentProvider (root layout)');
  return ctx;
}
