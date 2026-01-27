/**
 * Status transition validation for quotations and sales
 */

export type QuotationStatus = 'DRAFT' | 'SENT' | 'APPROVED' | 'REJECTED' | 'EXPIRED' | 'CANCELLED';
export type SaleStatus = 'PENDING' | 'CONFIRMED' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';
export type PurchaseStatus = 'PENDING' | 'CONFIRMED' | 'PROCESSING' | 'SHIPPED' | 'RECEIVED' | 'CANCELLED';

interface TransitionResult {
  allowed: boolean;
  requiresConfirmation: boolean;
  errorMessage?: string;
  confirmationMessage?: string;
}

/**
 * Quotation status transitions
 */
const quotationTransitions: Record<QuotationStatus, QuotationStatus[]> = {
  DRAFT: ['SENT', 'CANCELLED'],
  SENT: ['APPROVED', 'REJECTED', 'EXPIRED', 'CANCELLED'],
  APPROVED: ['CANCELLED'], // Can only cancel approved quotations
  REJECTED: ['CANCELLED'], // Can cancel rejected ones
  EXPIRED: ['DRAFT', 'SENT', 'APPROVED', 'REJECTED', 'CANCELLED'], // Allow reverting expired status
  CANCELLED: ['DRAFT', 'SENT', 'APPROVED', 'REJECTED', 'EXPIRED'], // Allow reverting cancelled status
};

/**
 * Sales status transitions
 */
const salesTransitions: Record<SaleStatus, SaleStatus[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED', 'CANCELLED'],
  DELIVERED: ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'CANCELLED'], // Allow reverting delivered status
  CANCELLED: ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED'], // Allow reverting cancelled status
};

/**
 * Validate quotation status transition
 */
export function validateQuotationTransition(
  currentStatus: QuotationStatus,
  newStatus: QuotationStatus
): TransitionResult {
  // Same status - no change
  if (currentStatus === newStatus) {
    return {
      allowed: false,
      requiresConfirmation: false,
      errorMessage: 'El estado es el mismo',
    };
  }

  const allowedTransitions = quotationTransitions[currentStatus] || [];
  const allowed = allowedTransitions.includes(newStatus);

  if (!allowed) {
    return {
      allowed: false,
      requiresConfirmation: false,
      errorMessage: `No se puede cambiar de ${currentStatus} a ${newStatus}`,
    };
  }

  // Determine if confirmation is required
  const requiresConfirmation =
    newStatus === 'CANCELLED' ||
    currentStatus === 'APPROVED';

  let confirmationMessage: string | undefined;
  if (requiresConfirmation) {
    if (newStatus === 'CANCELLED') {
      confirmationMessage = '¿Estás seguro de que quieres cancelar esta cotización?';
    } else if (currentStatus === 'APPROVED') {
      confirmationMessage = `¿Estás seguro de que quieres cambiar el estado de APROBADA a ${newStatus}?`;
    }
  }

  return {
    allowed: true,
    requiresConfirmation,
    confirmationMessage,
  };
}

/**
 * Validate sale status transition
 */
export function validateSaleTransition(
  currentStatus: SaleStatus,
  newStatus: SaleStatus
): TransitionResult {
  // Same status - no change
  if (currentStatus === newStatus) {
    return {
      allowed: false,
      requiresConfirmation: false,
      errorMessage: 'El estado es el mismo',
    };
  }

  const allowedTransitions = salesTransitions[currentStatus] || [];
  const allowed = allowedTransitions.includes(newStatus);

  if (!allowed) {
    return {
      allowed: false,
      requiresConfirmation: false,
      errorMessage: `No se puede cambiar de ${currentStatus} a ${newStatus}`,
    };
  }

  // Determine if confirmation is required for critical transitions
  const requiresConfirmation = newStatus === 'CANCELLED';

  let confirmationMessage: string | undefined;
  if (requiresConfirmation) {
    confirmationMessage = '¿Estás seguro de que quieres cancelar esta venta?';
  }

  return {
    allowed: true,
    requiresConfirmation,
    confirmationMessage,
  };
}

/**
 * Get allowed status transitions for quotations
 */
export function getAllowedQuotationStatuses(currentStatus: QuotationStatus): QuotationStatus[] {
  return quotationTransitions[currentStatus] || [];
}

/**
 * Get allowed status transitions for sales
 */
export function getAllowedSaleStatuses(currentStatus: SaleStatus): SaleStatus[] {
  return salesTransitions[currentStatus] || [];
}

/**
 * Purchase status transitions
 */
const purchaseTransitions: Record<PurchaseStatus, PurchaseStatus[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['RECEIVED', 'CANCELLED'],
  RECEIVED: ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'CANCELLED'], // Allow reverting received status
  CANCELLED: ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'RECEIVED'], // Allow reverting cancelled status
};

/**
 * Validate purchase status transition
 */
export function validatePurchaseTransition(
  currentStatus: PurchaseStatus,
  newStatus: PurchaseStatus
): TransitionResult {
  // Same status - no change
  if (currentStatus === newStatus) {
    return {
      allowed: false,
      requiresConfirmation: false,
      errorMessage: 'El estado es el mismo',
    };
  }

  const allowedTransitions = purchaseTransitions[currentStatus] || [];
  const allowed = allowedTransitions.includes(newStatus);

  if (!allowed) {
    return {
      allowed: false,
      requiresConfirmation: false,
      errorMessage: `No se puede cambiar de ${currentStatus} a ${newStatus}`,
    };
  }

  // Determine if confirmation is required for critical transitions
  const requiresConfirmation = newStatus === 'CANCELLED';

  let confirmationMessage: string | undefined;
  if (requiresConfirmation) {
    confirmationMessage = '¿Estás seguro de que quieres cancelar esta compra?';
  }

  return {
    allowed: true,
    requiresConfirmation,
    confirmationMessage,
  };
}

/**
 * Get allowed status transitions for purchases
 */
export function getAllowedPurchaseStatuses(currentStatus: PurchaseStatus): PurchaseStatus[] {
  return purchaseTransitions[currentStatus] || [];
}
