/**
 * Qué campos de una cita puede ver quien mira el expediente (GET …/patients/[id]/bookings).
 *
 * La ruta cuelga de `medical-records` y sólo exige `expedientes`, pero sirve datos de CUATRO
 * áreas. Hasta 2026-09-25 un member con sólo `expedientes` veía precios, cobros, links de pago y
 * la factura (RFC, total) — hallado en el review de VISITAS D2. Cada bloque viaja sólo con SU
 * permiso; sin él, la llave NO viaja (no va vacía).
 */
import type { MedicalAuthContext } from '@/lib/medical-auth';
import { puedeVer } from '@/lib/visitas';

export interface BookingPermisos {
  /** Día, hora, servicio, estado, notas. Sin él la lista entera va vacía. */
  citas: boolean;
  /** Precio, monto, estado y método de cobro. */
  flujo: boolean;
  /** Links de Stripe / Mercado Pago. */
  pagos: boolean;
  /** Factura: CFDI, veredicto, "necesita factura". */
  facturacion: boolean;
}

export function bookingPermisos(ctx: MedicalAuthContext): BookingPermisos {
  return {
    citas: puedeVer(ctx, 'citas'),
    flujo: puedeVer(ctx, 'flujo'),
    pagos: puedeVer(ctx, 'pagos'),
    facturacion: puedeVer(ctx, 'facturacion'),
  };
}

const CAMPOS_FLUJO = ['finalPrice', 'amount', 'formaDePago', 'paymentStatus', 'amountPaid', 'estadoPago', 'metodoPago'] as const;
const CAMPOS_PAGOS = ['stripeLink', 'mpLink'] as const;
const CAMPOS_FACTURA = ['facturaSolicitada', 'facturada', 'facturadaVia', 'cfdi'] as const;

/**
 * Quita de UNA cita ya armada lo que `permisos` no deja ver. `ledgerEntryId` ancla el cobro Y la
 * factura, así que viaja con cualquiera de los dos. (Sin `citas` no se llama: la ruta ni lista.)
 */
export function recortarCitaPorPermiso<T extends Record<string, unknown>>(cita: T, permisos: BookingPermisos): Partial<T> {
  const out: Record<string, unknown> = { ...cita };
  if (!permisos.flujo) for (const k of CAMPOS_FLUJO) delete out[k];
  if (!permisos.pagos) for (const k of CAMPOS_PAGOS) delete out[k];
  if (!permisos.facturacion) for (const k of CAMPOS_FACTURA) delete out[k];
  if (!permisos.flujo && !permisos.facturacion) delete out.ledgerEntryId;
  return out as Partial<T>;
}
