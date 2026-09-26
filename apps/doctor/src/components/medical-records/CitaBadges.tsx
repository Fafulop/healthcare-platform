'use client';

// La cita de un paciente tal como la manda `GET /api/medical-records/patients/[id]/bookings`, y los
// chips que la pintan. Salieron de la página del paciente (VISITAS D4) para que la visita pinte el
// MISMO veredicto que «Citas e Ingresos» y no uno propio.

export interface BookingCfdi {
  id: number;
  uuid: string;
  folio: string | null;
  status: string;
  total: number;
  rfcReceptor: string;
  nombreReceptor: string;
  usoCfdi: string;
  formaPago: string;
  issuedAt: string;
}

export interface BookingPaymentLink {
  url: string;
  status: string;
  isActive: boolean;
  paidAt: string | null;
  amount: number;
}

export interface PatientBooking {
  id: string;
  date: string | null;
  startTime: string | null;
  endTime: string | null;
  serviceName: string | null;
  status: string;
  appointmentMode: string | null;
  // ⚠️ Los campos de cobro, links y factura sólo VIAJAN con su permiso (ver
  // BookingPermisos): ausentes = "no puedes verlo", no "no hay".
  finalPrice?: number | null;
  /** Notas escritas al AGENDAR la cita. Puede venir "" — tratar como vacío. */
  notes?: string | null;
  formLinkId?: string | null;
  /** Casilla "¿Necesita factura?" de la tabla de citas. Pregunta por CITA —
   *  distinta de `patient.requiereFactura`, que es del expediente. */
  facturaSolicitada?: boolean | null;
  // Financial
  ledgerEntryId?: number | null;
  amount?: number | null;
  formaDePago?: string | null;
  /** Del INGRESO: 'PENDING' | 'PARTIAL' | 'PAID'. null = no hay ingreso todavía. */
  paymentStatus?: string | null;
  amountPaid?: number | null;
  /** VEREDICTO de cobro del servidor (ingreso + links juntos) y su método ya legible. */
  estadoPago?: 'PAGADO' | 'PARCIAL' | 'PENDIENTE' | 'SIN_REGISTRO';
  metodoPago?: string | null;
  /** VEREDICTO del servidor (resolveFacturaVerdict) — no se re-deriva aquí. */
  facturada?: boolean;
  facturadaVia?: 'plataforma' | 'subida' | 'externa_sat' | null;
  cfdi?: BookingCfdi | null;
  // Payment links (linked cobro)
  stripeLink?: BookingPaymentLink | null;
  mpLink?: BookingPaymentLink | null;
}

export function BookingStatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    CONFIRMED:  'bg-blue-100 text-blue-700',
    PENDING:    'bg-yellow-100 text-yellow-700',
    COMPLETED:  'bg-green-100 text-green-700',
    CANCELLED:  'bg-red-100 text-red-700',
    NO_SHOW:    'bg-orange-100 text-orange-700',
  };
  const label: Record<string, string> = {
    CONFIRMED: 'Agendada',
    PENDING:   'Pendiente',
    COMPLETED: 'Completada',
    CANCELLED: 'Cancelada',
    NO_SHOW:   'No asistió',
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded ${map[status] ?? 'bg-gray-100 text-gray-600'}`}>
      {label[status] ?? status}
    </span>
  );
}

/** ¿Ya se cobró? El veredicto —y el método— los resuelve el SERVIDOR mirando el
 *  ingreso Y los links juntos (`estadoPago`/`metodoPago` en la ruta de bookings).
 *  Aquí solo se pinta: dos componentes leyendo mitades distintas es lo que hacía
 *  que una misma tarjeta dijera "Por cobrar" y "Pagado" a la vez.
 *
 *  Siempre pinta algo (los cuatro estados tienen chip), a diferencia de la
 *  versión anterior, que se callaba cuando no había ingreso. */
export function PagoBadge({
  estadoPago, metodoPago,
}: { estadoPago: 'PAGADO' | 'PARCIAL' | 'PENDIENTE' | 'SIN_REGISTRO'; metodoPago: string | null }) {
  // Gris y neutro: no afirma una deuda, dice que no hay registro. Es el estado de
  // las 49 citas anteriores a que completar creara el ingreso (may–jun 2026).
  if (estadoPago === 'SIN_REGISTRO') {
    return <span className="text-[11px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">Sin cobro registrado</span>;
  }
  if (estadoPago === 'PENDIENTE') {
    return <span className="text-[11px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">Por cobrar</span>;
  }
  if (estadoPago === 'PARCIAL') {
    return (
      <span className="text-[11px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
        Pago parcial{metodoPago ? ` · ${metodoPago}` : ''}
      </span>
    );
  }
  return (
    <span className="text-[11px] px-1.5 py-0.5 rounded bg-green-100 text-green-700">
      Pagado{metodoPago ? ` · ${metodoPago}` : ''}
    </span>
  );
}

/** Dos hechos INDEPENDIENTES en un solo chip, por orden de importancia: ya está
 *  facturada (veredicto del servidor) gana sobre la petición. Si la pidieron y no
 *  está, ese es el pendiente que hay que ver. */
export function FacturaBadge({ facturada, solicitada }: { facturada: boolean; solicitada: boolean }) {
  if (facturada) {
    return <span className="text-[11px] px-1.5 py-0.5 rounded bg-teal-100 text-teal-800">Facturado</span>;
  }
  if (solicitada) {
    return <span className="text-[11px] px-1.5 py-0.5 rounded bg-orange-100 text-orange-800">Necesita factura</span>;
  }
  return null;
}
