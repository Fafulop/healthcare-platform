import { useCallback } from 'react';
import { useBasePracticeChat, ConversationMessage } from './useBasePracticeChat';

// ─── Types ───────────────────────────────────────────────────────────────────

export type { PracticeChatMessage as SaleChatMessage } from './useBasePracticeChat';

export interface SaleFormData {
  clientName: string;
  saleDate: string;
  deliveryDate: string;
  paymentStatus: string;
  amountPaid: number;
  notes: string;
  termsAndConditions: string;
  itemCount: number;
  items: SaleChatItem[];
}

export interface SaleChatItem {
  description: string;
  itemType: 'product' | 'service';
  quantity: number;
  unit: string;
  unitPrice: number;
  discountRate: number;
  taxRate: number;
}

export interface ItemAction {
  type: 'add' | 'update' | 'remove' | 'replace_all';
  index?: number;
  item?: Partial<SaleChatItem>;
  updates?: Partial<SaleChatItem>;
  items?: Partial<SaleChatItem>[];
}

// ─── Hook ────────────────────────────────────────────────────────────────────

interface UseSaleChatOptions {
  currentFormData: SaleFormData;
  onUpdateFields: (updates: Record<string, any>) => void;
  onUpdateItems: (actions: ItemAction[]) => void;
}

export function useSaleChat({ currentFormData, onUpdateFields, onUpdateItems }: UseSaleChatOptions) {
  const makeApiCall = useCallback(
    async (conversation: ConversationMessage[]) => {
      const res = await fetch('/api/sale-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: conversation, currentFormData }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message || 'Error desconocido');

      const { message = '', fieldUpdates, itemActions } = json.data;
      let fieldCount = 0;
      let itemCount = 0;

      if (fieldUpdates && Object.keys(fieldUpdates).length > 0) {
        onUpdateFields(fieldUpdates);
        fieldCount = Object.keys(fieldUpdates).length;
      }
      if (itemActions?.length) {
        onUpdateItems(itemActions);
        itemCount = itemActions.length;
      }

      let actionSummary: string | undefined;
      if (fieldCount > 0 || itemCount > 0) {
        const parts: string[] = [];
        if (fieldCount > 0) parts.push(`${fieldCount} campo${fieldCount !== 1 ? 's' : ''}`);
        if (itemCount > 0) parts.push(`${itemCount} item${itemCount !== 1 ? 's' : ''}`);
        actionSummary = `Se actualizaron ${parts.join(' y ')}`;
      }

      return { message, actionSummary };
    },
    [currentFormData, onUpdateFields, onUpdateItems]
  );

  return useBasePracticeChat({ idPrefix: 'sale_chat', makeApiCall });
}
