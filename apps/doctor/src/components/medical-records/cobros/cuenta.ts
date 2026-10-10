import type { PatientBooking } from '@/components/medical-records/CitaBadges';

/** Lo que «Cobros» necesita de una venta para sumarla. */
export interface VentaParaCuenta { total: string | number; amountPaid: string | number | null; status: string; paymentStatus: string }

export interface Cuenta {
  /** Lo REGISTRADO: ingresos de sus citas (o lo pagado por link sin ingreso escrito) + sus ventas. */
  registrado: number;
  pagado: number;
  /** Lo registrado que falta pagar, sumado RENGLÓN por renglón (lo de más en uno no tapa lo de otro). */
  pendiente: number;
  /** El precio de sus citas agendadas que aún no tienen cobro. */
  porCobrar: number;
  /** Completadas sin cobro registrado (cortesía o sin registrar): no suman, se cuentan. */
  completadasSinCobro: number;
  /** Citas que YA se pueden facturar (tienen ingreso, «¿Necesita factura?» marcada, sin factura, no $0). */
  porFacturar: number;
}

/**
 * VISITAS 10-PLAN P2/P3 — la cuenta del paciente, UNA sola regla para la página «Cobros» y el resumen del
 * perfil (si no, el perfil decía «nada por pagar» y Cobros «$X por cobrar»). Regla 0: si está pagada lo
 * decide el SERVIDOR (`estadoPago`, el veredicto del chip de cada cita — ingreso + links juntos), no los
 * campos sueltos. `ventas` null = no se cargaron (el perfil no las pide): no suman.
 */
export function calcularCuenta(bookings: PatientBooking[], ventas: VentaParaCuenta[] | null): Cuenta {
  let registrado = 0, pagado = 0, pendiente = 0, porCobrar = 0, completadasSinCobro = 0, porFacturar = 0;
  const sumar = (monto: number, pagadoAqui: number) => {
    registrado += monto; pagado += pagadoAqui; pendiente += Math.max(0, monto - pagadoAqui);
  };
  for (const b of bookings) {
    if (b.status === 'CANCELLED' || b.estadoPago === 'CUBIERTA') continue;
    if (b.ledgerEntryId != null && b.facturaSolicitada === true && b.facturada !== true && (b.amount == null || Number(b.amount) > 0)) {
      porFacturar += 1;
    }
    const montoLink = Number(b.stripeLink?.status === 'PAID' ? b.stripeLink.amount : b.mpLink?.status === 'PAID' ? b.mpLink.amount : 0);
    if (b.ledgerEntryId != null && b.amount != null) {
      const monto = Number(b.amount);
      sumar(monto, b.estadoPago === 'PAGADO' ? monto : b.estadoPago === 'PARCIAL' ? Number(b.amountPaid ?? 0) : 0);
    } else if (b.estadoPago === 'PAGADO') {
      // Pagada por link SIN ingreso escrito: cuenta lo que se pagó.
      const monto = montoLink || Number(b.finalPrice ?? 0);
      sumar(monto, monto);
    } else if (b.status === 'PENDING' || b.status === 'CONFIRMED') {
      porCobrar += Number(b.finalPrice ?? 0);
    } else if (b.status === 'COMPLETED') {
      completadasSinCobro += 1;
    }
  }
  for (const v of ventas ?? []) {
    if (v.status === 'CANCELLED') continue;
    const monto = Number(v.total);
    sumar(monto, v.paymentStatus === 'PAID' ? monto : v.paymentStatus === 'PARTIAL' ? Number(v.amountPaid ?? 0) : 0);
  }
  return { registrado, pagado, pendiente, porCobrar, completadasSinCobro, porFacturar };
}
