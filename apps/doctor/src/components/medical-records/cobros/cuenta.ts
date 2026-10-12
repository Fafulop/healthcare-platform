import type { PatientBooking } from '@/components/medical-records/CitaBadges';
import { citaYaPaso } from '@/lib/citas/vencida';

/** Lo que «Cobros» necesita de una venta para sumarla. */
export interface VentaParaCuenta { total: string | number; amountPaid: string | number | null; status: string; paymentStatus: string }

export interface Cuenta {
  /** Lo que YA se pagó: al completar la cita (lo registra pagado), por link, un anticipo, y lo pagado de sus
   *  ventas. Sin importar la fecha. */
  cobrado: number;
  /** De sus citas agendadas cuya hora todavía no pasa: su precio menos lo ya pagado (anticipos). */
  porCobrarProximas: number;
  /** Lo mismo, de las que ya pasaron y nadie completó (las «Vencidas» de la agenda): recuerdan completar,
   *  marcar «No asistió» o cancelar. */
  porCobrarPasadas: number;
  /** Raro: un cobro registrado de una cita ya concluida (completada / no asistió) o de una venta que no está
   *  pagado completo — p. ej. un ingreso marcado «pendiente» a mano en Flujo de Dinero, o una venta con pago
   *  parcial. (Completar desde la app lo registra PAGADO: ahí no cae nada.) */
  otrosPendientes: number;
  /** Completadas sin cobro registrado (cortesía o sin registrar): no suman, se cuentan. */
  completadasSinCobro: number;
  /** Citas que YA se pueden facturar (tienen ingreso, «¿Necesita factura?» marcada, sin factura, no $0). */
  porFacturar: number;
}

/**
 * La cuenta del paciente — UNA sola regla para la página «Cobros» y el resumen del perfil (si no, uno decía
 * una cosa y el otro otra). 2026-10-12 (decisión del usuario, «mantenerlo simple»): tres números —
 * Cobrado · Por cobrar (próximas) · Por cobrar (pasadas sin completar). «Completar» desde la app registra
 * lo cobrado como PAGADO (y el link pagado también), así que una cita completada así YA es «cobrado», sea
 * de la fecha que sea. (Pendiente conocido, de antes: un ingreso PARCIAL + un link pagado cuenta sólo el
 * parcial.) Regla 0: si está pagada lo decide el SERVIDOR (`estadoPago`, el veredicto del chip de cada cita —
 * ingreso + links juntos), no los campos sueltos. «Pasada» = la regla «Vencida» de la agenda
 * (`citaYaPaso`: sin hora de fin, por el día). `ventas` null = no se cargaron (el perfil no las pide): no suman.
 */
export function calcularCuenta(bookings: PatientBooking[], ventas: VentaParaCuenta[] | null): Cuenta {
  let cobrado = 0, porCobrarProximas = 0, porCobrarPasadas = 0, otrosPendientes = 0, completadasSinCobro = 0, porFacturar = 0;
  for (const b of bookings) {
    if (b.status === 'CANCELLED' || b.estadoPago === 'CUBIERTA') continue;
    if (b.ledgerEntryId != null && b.facturaSolicitada === true && b.facturada !== true && (b.amount == null || Number(b.amount) > 0)) {
      porFacturar += 1;
    }
    const conIngreso = b.ledgerEntryId != null && b.amount != null;
    const montoLink = Number(b.stripeLink?.status === 'PAID' ? b.stripeLink.amount : b.mpLink?.status === 'PAID' ? b.mpLink.amount : 0);
    // Lo YA pagado de esta cita (veredicto del servidor): su ingreso (completo o parcial), o el link pagado
    // sin ingreso escrito.
    const pagado = conIngreso
      ? (b.estadoPago === 'PAGADO' ? Number(b.amount) : b.estadoPago === 'PARCIAL' ? Number(b.amountPaid ?? 0) : 0)
      : b.estadoPago === 'PAGADO' ? (montoLink || Number(b.finalPrice ?? 0)) : 0;
    cobrado += pagado;
    if (b.status === 'PENDING' || b.status === 'CONFIRMED') {
      // Agendada: falta su PRECIO menos lo pagado (un anticipo por link o en Flujo no se come el resto —
      // code review: con el monto del ingreso como base, un link de $300 de una cita de $1,000 dejaba $0).
      const falta = Math.max(0, Number(b.finalPrice ?? 0) - pagado);
      if (citaYaPaso(b.status, b.date, b.endTime)) porCobrarPasadas += falta; else porCobrarProximas += falta;
    } else if (conIngreso) {
      // Concluida (completada / no asistió) con un cobro registrado que no está pagado completo.
      otrosPendientes += Math.max(0, Number(b.amount) - pagado);
    } else if (b.status === 'COMPLETED' && pagado === 0) {
      completadasSinCobro += 1;
    }
  }
  for (const v of ventas ?? []) {
    if (v.status === 'CANCELLED') continue;
    const monto = Number(v.total);
    const pagadoV = v.paymentStatus === 'PAID' ? monto : v.paymentStatus === 'PARTIAL' ? Number(v.amountPaid ?? 0) : 0;
    cobrado += pagadoV;
    otrosPendientes += Math.max(0, monto - pagadoV);
  }
  return { cobrado, porCobrarProximas, porCobrarPasadas, otrosPendientes, completadasSinCobro, porFacturar };
}
