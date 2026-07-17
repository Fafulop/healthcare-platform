/**
 * F2c — CFDI draft item validation, shared by the drafts routes.
 * Items store BUSINESS FLAGS only (withIva/withIsrRetention); taxes are
 * recomputed by the Nueva Factura form on hydrate (regla E7).
 */

export interface DraftItemInput {
  description: string;
  productCode: string;
  unitCode: string;
  quantity: number;
  unitPrice: number;
  withIva: boolean;
  withIsrRetention: boolean;
}

export const MAX_DRAFT_ITEMS = 10;

export function validateDraftItems(raw: unknown): { items: DraftItemInput[] } | { error: string } {
  if (!Array.isArray(raw) || raw.length === 0) return { error: 'Se requiere al menos un concepto (items).' };
  if (raw.length > MAX_DRAFT_ITEMS) return { error: `Máximo ${MAX_DRAFT_ITEMS} conceptos por borrador.` };
  const items: DraftItemInput[] = [];
  for (const [i, r] of raw.entries()) {
    const it = (r ?? {}) as Record<string, unknown>;
    const description = typeof it.description === 'string' ? it.description.trim() : '';
    const unitPrice = typeof it.unitPrice === 'number' && Number.isFinite(it.unitPrice) && it.unitPrice > 0 ? it.unitPrice : null;
    const quantity = it.quantity === undefined ? 1
      : typeof it.quantity === 'number' && Number.isFinite(it.quantity) && it.quantity > 0 ? it.quantity : null;
    if (!description) return { error: `Concepto ${i + 1}: falta la descripción.` };
    if (unitPrice === null) return { error: `Concepto ${i + 1}: unitPrice debe ser un número > 0.` };
    if (quantity === null) return { error: `Concepto ${i + 1}: quantity debe ser un número > 0.` };
    if (typeof it.withIva !== 'boolean' || typeof it.withIsrRetention !== 'boolean') {
      return { error: `Concepto ${i + 1}: withIva y withIsrRetention son obligatorios y booleanos.` };
    }
    items.push({
      description,
      productCode: typeof it.productCode === 'string' && it.productCode.trim() ? it.productCode.trim() : '85121800',
      unitCode: typeof it.unitCode === 'string' && it.unitCode.trim() ? it.unitCode.trim() : 'E48',
      quantity,
      unitPrice,
      withIva: it.withIva,
      withIsrRetention: it.withIsrRetention,
    });
  }
  return { items };
}

/** Receiver derived FRESH from the patient at hydrate time (09-DISENO §7.4):
 * PG normalization mirrors the UI recipe (facturacion/page.tsx:1471) and the
 * agent's proposal path — one semantics for all three. */
export function deriveReceiverFromPatient(p: {
  rfc: string | null;
  razonSocial: string | null;
  regimenFiscal: string | null;
  usoCfdi: string | null;
  codigoPostalFiscal: string | null;
}, emitterZipCode: string): {
  receiver: { rfc: string; name: string; cfdiUse: string; fiscalRegime: string; taxZipCode: string } | null;
  esPublicoGeneral: boolean;
  camposFaltantes: string[];
} {
  const esPublicoGeneral = !!p.rfc && p.rfc.trim().toUpperCase() === 'XAXX010101000';
  if (esPublicoGeneral) {
    return {
      receiver: { rfc: 'XAXX010101000', name: 'PUBLICO EN GENERAL', cfdiUse: 'S01', fiscalRegime: '616', taxZipCode: emitterZipCode },
      esPublicoGeneral: true,
      camposFaltantes: [],
    };
  }
  const fields: [string, string | null][] = [
    ['rfc', p.rfc], ['razonSocial', p.razonSocial], ['regimenFiscal', p.regimenFiscal],
    ['usoCfdi', p.usoCfdi], ['codigoPostalFiscal', p.codigoPostalFiscal],
  ];
  const camposFaltantes = fields.filter(([, v]) => !v || !String(v).trim()).map(([k]) => k);
  if (camposFaltantes.length > 0) return { receiver: null, esPublicoGeneral: false, camposFaltantes };
  return {
    receiver: {
      rfc: p.rfc!.trim().toUpperCase(),
      name: p.razonSocial!.trim(),
      cfdiUse: p.usoCfdi!,
      fiscalRegime: p.regimenFiscal!,
      taxZipCode: p.codigoPostalFiscal!,
    },
    esPublicoGeneral: false,
    camposFaltantes: [],
  };
}
