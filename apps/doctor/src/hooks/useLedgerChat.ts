import { useCallback } from 'react';
import { useBasePracticeChat, ConversationMessage } from './useBasePracticeChat';

// ─── Types ───────────────────────────────────────────────────────────────────

export type { PracticeChatMessage as LedgerChatMessage } from './useBasePracticeChat';

export interface LedgerEntryData {
  entryType: string | null;
  amount: number | null;
  concept: string | null;
  transactionDate: string | null;
  area: string | null;
  subarea: string | null;
  bankAccount: string | null;
  formaDePago: string | null;
  bankMovementId: string | null;
  paymentOption: string | null;
}

interface EntryAction {
  type: 'add' | 'update' | 'remove' | 'replace_all';
  index?: number;
  entry?: Partial<LedgerEntryData>;
  updates?: Partial<LedgerEntryData>;
  entries?: Partial<LedgerEntryData>[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function normalizeEntry(partial: Partial<LedgerEntryData>): LedgerEntryData {
  return {
    entryType: partial.entryType || null,
    amount: partial.amount ?? null,
    concept: partial.concept || null,
    transactionDate: partial.transactionDate || null,
    area: partial.area || null,
    subarea: partial.subarea || null,
    bankAccount: partial.bankAccount || null,
    formaDePago: partial.formaDePago || null,
    bankMovementId: partial.bankMovementId || null,
    paymentOption: partial.paymentOption || null,
  };
}

function applyEntryActions(
  currentEntries: LedgerEntryData[],
  actions: EntryAction[]
): LedgerEntryData[] {
  let result = [...currentEntries];

  for (const action of actions) {
    switch (action.type) {
      case 'add':
        if (action.entry) result.push(normalizeEntry(action.entry));
        break;
      case 'update': {
        const idx = action.index ?? -1;
        if (idx >= 0 && idx < result.length && action.updates) {
          result[idx] = { ...result[idx], ...action.updates };
        }
        break;
      }
      case 'remove': {
        const idx = action.index ?? -1;
        if (idx >= 0 && idx < result.length) result = result.filter((_, i) => i !== idx);
        break;
      }
      case 'replace_all':
        if (action.entries) result = action.entries.map(normalizeEntry);
        break;
    }
  }

  return result;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

interface UseLedgerChatOptions {
  accumulatedEntries: LedgerEntryData[];
  onUpdateEntries: (entries: LedgerEntryData[]) => void;
}

export function useLedgerChat({ accumulatedEntries, onUpdateEntries }: UseLedgerChatOptions) {
  const makeApiCall = useCallback(
    async (conversation: ConversationMessage[]) => {
      const res = await fetch('/api/ledger-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: conversation, accumulatedEntries }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message || 'Error desconocido');

      const { message = '', entryActions } = json.data;
      const hasActions = entryActions && entryActions.length > 0;

      if (hasActions) {
        onUpdateEntries(applyEntryActions(accumulatedEntries, entryActions));
      }

      const actionSummary = hasActions
        ? `Se actualizaron ${entryActions.length} movimiento${entryActions.length !== 1 ? 's' : ''}`
        : undefined;

      return { message, actionSummary };
    },
    [accumulatedEntries, onUpdateEntries]
  );

  return useBasePracticeChat({ idPrefix: 'ledger_chat', makeApiCall });
}
