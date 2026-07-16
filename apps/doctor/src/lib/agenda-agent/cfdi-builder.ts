/**
 * CFDI tax builder — PR F2b (regla clase-E7: el modelo NUNCA arma impuestos).
 *
 * EXACT replica of the Nueva Factura form's math (facturacion/page.tsx
 * handleSubmit, 1383-1421): per-item business flags (withIva/withIsrRetention)
 * become the taxes array server-side at PROPOSAL time. Rounding mirrors the
 * form precisely — tax Total rounded per tax, item total rounded ONCE at the
 * end, Base/subtotal left unrounded — so an agent-emitted CFDI and a
 * form-emitted CFDI produce identical numbers for identical inputs.
 *
 * v1 has NO rate overrides (the UI allows them for edge cases; the agent does
 * not — 08-PLAN §3): IVA is always 0.16 when withIva, ISR retention rate comes
 * from the EMITTER's régimen (626 → 0.0125, otherwise 0.10; cfdi/route.ts:128
 * warns on anything else).
 */

export const DEFAULT_IVA_RATE = 0.16;

export function isrRateFor(regimenFiscalEmisor: string | null | undefined): number {
  return regimenFiscalEmisor === '626' ? 0.0125 : 0.10;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export interface ConceptInput {
  description: string;
  unitPrice: number;
  quantity: number;
  productCode: string;
  unitCode: string;
  withIva: boolean;
  withIsrRetention: boolean;
}

export interface CfdiTax {
  Total: number;
  Name: 'IVA' | 'ISR';
  Base: number;
  Rate: number;
  IsRetention: boolean;
}

/** The exact item shape POST /api/facturacion/cfdi expects. */
export interface CfdiItem {
  productCode: string;
  description: string;
  quantity: number;
  unitCode: string;
  unitPrice: number;
  subtotal: number;
  taxes: CfdiTax[];
  total: number;
}

export interface CfdiTotals {
  subtotal: number;
  iva: number;
  retencionIsr: number;
  total: number;
}

export function buildCfdiItems(
  concepts: ConceptInput[],
  regimenFiscalEmisor: string | null | undefined
): { items: CfdiItem[]; totals: CfdiTotals } {
  const isrRate = isrRateFor(regimenFiscalEmisor);
  let subtotal = 0;
  let iva = 0;
  let retencionIsr = 0;

  const items = concepts.map((c) => {
    const itemSubtotal = c.quantity * c.unitPrice;
    const taxes: CfdiTax[] = [];
    if (c.withIva) {
      taxes.push({
        Total: round2(itemSubtotal * DEFAULT_IVA_RATE),
        Name: 'IVA',
        Base: itemSubtotal,
        Rate: DEFAULT_IVA_RATE,
        IsRetention: false,
      });
    }
    if (c.withIsrRetention) {
      taxes.push({
        Total: round2(itemSubtotal * isrRate),
        Name: 'ISR',
        Base: itemSubtotal,
        Rate: isrRate,
        IsRetention: true,
      });
    }
    const total =
      itemSubtotal +
      (c.withIva ? itemSubtotal * DEFAULT_IVA_RATE : 0) -
      (c.withIsrRetention ? itemSubtotal * isrRate : 0);

    subtotal += itemSubtotal;
    if (c.withIva) iva += itemSubtotal * DEFAULT_IVA_RATE;
    if (c.withIsrRetention) retencionIsr += itemSubtotal * isrRate;

    return {
      productCode: c.productCode,
      description: c.description,
      quantity: c.quantity,
      unitCode: c.unitCode,
      unitPrice: c.unitPrice,
      subtotal: itemSubtotal,
      taxes,
      total: round2(total),
    };
  });

  return {
    items,
    totals: {
      subtotal: round2(subtotal),
      iva: round2(iva),
      retencionIsr: round2(retencionIsr),
      total: round2(subtotal + iva - retencionIsr),
    },
  };
}

/**
 * Ledger formaDePago → SAT forma de pago. Only the UNAMBIGUOUS values map;
 * 'tarjeta' (crédito 04 vs débito 28) and 'deposito' (no clean SAT concept)
 * return null so the tool asks the doctor instead of guessing on a legal
 * document. Values verified against FORMAS_DE_PAGO (ledger-types.ts:126-132)
 * and the SAT codes the form offers (OFFLINE_FORMAS_PAGO, page.tsx:103-110).
 */
export const LEDGER_FORMA_TO_SAT: Record<string, string | null> = {
  efectivo: '01',
  transferencia: '03',
  cheque: '02',
  tarjeta: null,
  deposito: null,
};

// Labels for these codes: reuse SAT_FORMA_PAGO_LABELS (ledger-types.ts) —
// one definition, shared with the CFDI detail views.
export const SAT_PAYMENT_FORMS = ['01', '02', '03', '04', '28', '99'] as const;
