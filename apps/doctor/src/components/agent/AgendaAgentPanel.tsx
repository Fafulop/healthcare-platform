"use client";

/**
 * AgendaAgentPanel — chat panel for the assistant (PR 1 reads + PR 2
 * internal-action proposals). Mounted ONCE in DashboardLayout (never
 * per-page — two mounts would duplicate UI over the shared AgentContext
 * state): docked side panel on desktop (lg+, the layout shrinks to make
 * room), fixed overlay on small desktop, bottom sheet on mobile. State
 * lives in AgentContext (root layout) so the conversation and pending
 * cards survive navigation.
 *
 * Proposals arrive as ordered cards under the assistant message; the doctor
 * confirms ("Ejecutar plan") or rejects each card. Execution is strictly
 * sequential — a failed step stops the chain and later steps show "omitida".
 */

import { useState, useRef, useEffect, type KeyboardEvent } from 'react';
import {
  Bot, User, Send, X, Trash2, Loader2, Sparkles,
  CalendarPlus, Lock, Unlock, CalendarX, AlertTriangle,
  CheckCircle2, XCircle, CircleSlash, Play,
  CalendarCheck, CalendarClock, UserX, BadgeCheck,
} from 'lucide-react';
import { useAgentActions, useAgentChat, type AgentMessage, type AgendaProposal, type AgentBudget } from '@/contexts/AgentContext';

/** Daily-usage widget: slim bar + percentage. Green → amber (≥70%) → red (≥90%).
 * "Uso de hoy" because the cap resets at midnight (MX), not per conversation. */
function BudgetBar({ budget }: { budget: AgentBudget }) {
  if (!(budget.cap > 0)) return null; // misconfigured cap → no widget, not "NaN%"
  const pct = Math.min(100, Math.round((budget.used / budget.cap) * 100));
  const barColor = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-emerald-500';
  const textColor = pct >= 90 ? 'text-red-600' : pct >= 70 ? 'text-amber-600' : 'text-gray-400';
  return (
    <div
      className="px-4 py-1.5 border-b border-gray-100 flex items-center gap-2"
      title="El asistente tiene un límite diario de uso que se reinicia a medianoche."
    >
      <span className="text-[10px] text-gray-400 flex-shrink-0">Uso de hoy</span>
      <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
        <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-[10px] font-medium flex-shrink-0 ${textColor}`}>
        {pct >= 100 ? 'límite alcanzado' : `${pct}%`}
      </span>
    </div>
  );
}

function renderInline(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, j) =>
    part.startsWith('**') && part.endsWith('**') ? (
      <strong key={j}>{part.slice(2, -2)}</strong>
    ) : (
      <span key={j}>{part}</span>
    )
  );
}

function renderContent(content: string) {
  // Minimal markdown: **bold** + line breaks + "- "/"• " bullets as real bullets
  const lines = content.split('\n');
  return (
    <div className="space-y-1">
      {lines.map((line, i) => {
        const bullet = line.match(/^\s*[-•]\s+(.*)$/);
        if (bullet) {
          return (
            <div key={i} className="flex gap-1.5 pl-1">
              <span className="flex-shrink-0 text-gray-400">•</span>
              <span>{renderInline(bullet[1])}</span>
            </div>
          );
        }
        return <div key={i}>{renderInline(line)}</div>;
      })}
    </div>
  );
}

const PROPOSAL_ICONS = {
  create_range: CalendarPlus,
  block_time: Lock,
  unblock_time: Unlock,
  delete_range: CalendarX,
  create_booking: CalendarPlus,
  confirm_booking: BadgeCheck,
  cancel_booking: CalendarX,
  reschedule_booking: CalendarClock,
  complete_booking: CalendarCheck,
  no_show: UserX,
} as const;

function ProposalCard({
  proposal,
  onReject,
}: {
  proposal: AgendaProposal;
  onReject: () => void;
}) {
  const Icon = PROPOSAL_ICONS[proposal.type] ?? CalendarPlus;
  const status = proposal.status ?? 'pendiente';
  const border =
    status === 'exito' ? 'border-emerald-300 bg-emerald-50'
    : status === 'error' ? 'border-red-300 bg-red-50'
    : status === 'rechazada' || status === 'omitida' ? 'border-gray-200 bg-gray-50 opacity-70'
    : 'border-amber-300 bg-amber-50';

  return (
    <div className={`rounded-xl border px-3 py-2 text-xs space-y-1 ${border}`}>
      <div className="flex items-center gap-1.5 font-semibold text-gray-800">
        <span className="text-gray-400">#{proposal.orden}</span>
        <Icon className="w-3.5 h-3.5 flex-shrink-0" />
        <span className="flex-1">{proposal.titulo}</span>
        {status === 'ejecutando' && <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-600" />}
        {status === 'exito' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
        {status === 'error' && <XCircle className="w-3.5 h-3.5 text-red-600" />}
        {(status === 'rechazada' || status === 'omitida') && <CircleSlash className="w-3.5 h-3.5 text-gray-400" />}
        {status === 'pendiente' && (
          <button
            onClick={onReject}
            className="text-[10px] text-gray-400 hover:text-red-500 underline"
            title="Rechazar este paso"
          >
            rechazar
          </button>
        )}
      </div>
      {proposal.detalle.map((d, i) => (
        <div key={i} className="text-gray-600 pl-5">{d}</div>
      ))}
      {proposal.advertencias.map((a, i) => (
        // 📱 = notifies the patient (tier 🔴): irreversible once sent — stands
        // out in red so the doctor can't miss it before confirming.
        <div key={i} className={`flex gap-1 pl-5 ${a.startsWith('📱') ? 'text-red-700 font-medium' : 'text-amber-700'}`}>
          <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" />
          <span>{a}</span>
        </div>
      ))}
      {proposal.resultado && (
        <div className={`pl-5 font-medium ${status === 'exito' ? 'text-emerald-700' : status === 'error' ? 'text-red-700' : 'text-gray-500'}`}>
          {proposal.resultado}
        </div>
      )}
    </div>
  );
}

function ProposalPlan({
  proposals,
  executing,
  stale,
  onExecute,
  onReject,
}: {
  proposals: AgendaProposal[];
  executing: boolean;
  /** Not the latest message: the preview may no longer match reality. */
  stale: boolean;
  onExecute: () => void;
  onReject: (proposalId: string) => void;
}) {
  const pending = proposals.filter((p) => (p.status ?? 'pendiente') === 'pendiente');
  return (
    <div className="w-full space-y-1.5 mt-1.5">
      {proposals.map((p) => (
        <ProposalCard key={p.id} proposal={p} onReject={() => onReject(p.id)} />
      ))}
      {pending.length > 0 && !stale && (
        <button
          onClick={onExecute}
          disabled={executing}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50"
        >
          {executing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
          {executing ? 'Ejecutando…' : `Ejecutar ${pending.length > 1 ? `plan (${pending.length} pasos, en orden)` : 'este paso'}`}
        </button>
      )}
      {pending.length > 0 && stale && (
        <div className="text-[10px] text-gray-400 text-center px-2">
          Plan anterior — la agenda pudo cambiar; pídele al asistente que lo vuelva a proponer.
        </div>
      )}
    </div>
  );
}

function MessageBubble({ message }: { message: AgentMessage }) {
  const isUser = message.role === 'user';
  return (
    <div className={`flex gap-2 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      <div
        className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center mt-1 ${
          isUser ? 'bg-blue-600 text-white' : 'bg-emerald-600 text-white'
        }`}
      >
        {isUser ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
      </div>
      <div className={`max-w-[85%] flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
        <div
          className={`px-3 py-2 rounded-2xl text-sm leading-relaxed ${
            isUser
              ? 'bg-blue-600 text-white rounded-br-md'
              : 'bg-gray-100 text-gray-800 rounded-bl-md'
          }`}
        >
          {renderContent(message.content)}
        </div>
        {!isUser && message.toolsUsed && message.toolsUsed.length > 0 && (
          <div className="text-[10px] text-gray-400 mt-0.5 px-1">
            consultó: {[...new Set(message.toolsUsed)].join(', ')}
          </div>
        )}
      </div>
    </div>
  );
}

const SUGGESTIONS = [
  '¿Cómo está mi agenda hoy?',
  '¿Tengo citas vencidas?',
  '¿Cuánto ingresé este mes?',
  '¿Quién me debe facturas PPD?',
  'Bloquea mi horario del viernes por la tarde',
];

export function AgendaAgentPanel() {
  const { isOpen, close } = useAgentActions();
  const {
    messages, loading, executing, budget, refreshBudget,
    sendMessage, clearChat, executeProposals, rejectProposal,
  } = useAgentChat();
  // Block sending while a plan is executing too: a message sent mid-execution
  // races the executor's verification turn with a stale history (review finding).
  const busy = loading || executing;
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState('');

  // Budget is fetched when the panel opens (and updated by every turn's
  // response) — NEVER on provider mount: the provider lives in the root
  // layout and must stay inert on /login and /consent (G1).
  useEffect(() => {
    if (isOpen) refreshBudget();
  }, [isOpen, refreshBudget]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const handleSend = (value?: string) => {
    const trimmed = (value ?? text).trim();
    if (!trimmed || busy) return;
    sendMessage(trimmed);
    setText('');
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed z-[60] flex flex-col shadow-xl bg-white border-t sm:border-t-0 sm:border-l border-gray-200
        inset-x-0 bottom-0 h-[60vh] rounded-t-2xl
        sm:inset-x-auto sm:right-0 sm:top-0 sm:bottom-0 sm:h-auto sm:w-96 sm:rounded-none
        lg:static lg:shrink-0 lg:shadow-none"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-emerald-50">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-emerald-600" />
          <span className="text-sm font-semibold text-gray-800">Asistente</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">
            beta · propone, tú confirmas
          </span>
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <button
              onClick={clearChat}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
              title="Limpiar conversación"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={close}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
            title="Cerrar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {budget && <BudgetBar budget={budget} />}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && (
          <div className="text-center pt-8 space-y-4">
            <Bot className="w-10 h-10 text-emerald-200 mx-auto" />
            <p className="text-sm text-gray-500">
              Pregúntame sobre tu agenda (citas, disponibilidad, pacientes), tu facturación y
              cobros, o tus números fiscales del SAT.
            </p>
            <div className="flex flex-col items-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => handleSend(s)}
                  className="text-xs px-3 py-1.5 rounded-full border border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i}>
            <MessageBubble message={m} />
            {m.role === 'assistant' && (m.proposals?.length ?? 0) > 0 && (
              <div className="pl-8 pr-2">
                <ProposalPlan
                  proposals={m.proposals!}
                  executing={executing}
                  stale={i !== messages.length - 1}
                  onExecute={() => executeProposals(i)}
                  onReject={(pid) => rejectProposal(i, pid)}
                />
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="flex items-center gap-2 text-gray-400 text-sm px-8">
            <Loader2 className="w-4 h-4 animate-spin" />
            Consultando tu agenda…
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-gray-200 p-3">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escribe tu pregunta…"
            disabled={busy}
            className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-gray-50"
          />
          <button
            onClick={() => handleSend()}
            disabled={!text.trim() || busy}
            className="p-2 rounded-xl bg-emerald-600 text-white disabled:opacity-40 hover:bg-emerald-700"
            title="Enviar"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
