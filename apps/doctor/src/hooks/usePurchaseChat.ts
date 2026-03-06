import { useCallback } from 'react';
import { useBasePracticeChat, ConversationMessage } from './useBasePracticeChat';

// ─── Types ───────────────────────────────────────────────────────────────────

export type { PracticeChatMessage as PurchaseChatMessage } from './useBasePracticeChat';

export interface PurchaseFormData {
  supplierName: string;
  purchaseDate: string;
  deliveryDate: string;
  paymentStatus: string;
  amountPaid: number;
  notes: string;
  termsAndConditions: string;
  itemCount: number;
  items: PurchaseChatItem[];
}

export interface PurchaseChatItem {
  description: string;
  itemType: 'product' | 'service';
  quantity: number;
  unit: string;
  unitPrice: number;
  discountRate: number;
  taxRate: number;
}

export interface PurchaseItemAction {
  type: 'add' | 'update' | 'remove' | 'replace_all';
  index?: number;
  item?: Partial<PurchaseChatItem>;
  updates?: Partial<PurchaseChatItem>;
  items?: Partial<PurchaseChatItem>[];
}

// ─── Hook ────────────────────────────────────────────────────────────────────

interface UsePurchaseChatOptions {
  currentFormData: PurchaseFormData;
  onUpdateFields: (updates: Record<string, any>) => void;
  onUpdateItems: (actions: PurchaseItemAction[]) => void;
}

export function usePurchaseChat({
  currentFormData,
  onUpdateFields,
  onUpdateItems,
}: UsePurchaseChatOptions) {
  const makeApiCall = useCallback(
    async (conversation: ConversationMessage[]) => {
      const res = await fetch('/api/purchase-chat', {
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

  return useBasePracticeChat({ idPrefix: 'purch_chat', makeApiCall });
}
