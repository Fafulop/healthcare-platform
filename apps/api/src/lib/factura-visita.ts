// VISITAS 11-PLAN (2026-10-12) — «Facturar» desde la visita: la cita + sus ventas en UNA factura.
// docs/DESDE JUNIO/VISITAS/11-PLAN-factura-de-la-visita.md
//
// Todo se decide AQUÍ, del lado del servidor (regla 0): qué ingresos entran, cuáles no y por qué, los
// conceptos, la forma y el método de pago. El formulario de Facturación sólo lo pinta (misma forma que un
// borrador del asistente) y el doctor lo revisa antes de timbrar.
//
// El modelo: una factura sigue teniendo UN ingreso principal (`cfdis_emitted.ledger_entry_id`: el de la
// cita, o el de la primera venta si la cita no entra) y la tabla `cfdi_ingresos` guarda TODOS los que cubre.

import type { Prisma } from '@healthcare/database';
import { prisma } from '@healthcare/database';
import { calculatePaymentStatus } from '@/lib/practice-utils';
import { deriveReceiverFromPatient, usoIncompatibleConRegimen } from '@/lib/cfdi-drafts';

/** Lo más que se liga a una factura (la cita + hasta 19 ventas). */
export const MAX_INGRESOS_POR_FACTURA = 20;

// Las claves de siempre del formulario (servicio médico). Un producto lleva «pieza» como unidad; su clave
// de producto el doctor la revisa en el formulario (se le avisa).
const CLAVE_SERVICIO = '85121800';
const UNIDAD_SERVICIO = 'E48';
const UNIDAD_PIEZA = 'H87';

/** La tasa de IVA que aplica el formulario de Facturación a un concepto «con IVA». */
const IVA = 0.16;

const FORMA_SAT: Record<string, string> = { efectivo: '01', cheque: '02', transferencia: '03', tarjeta: '04', deposito: '03' };

type Ingreso = {
  id: number; amount: Prisma.Decimal; amountPaid: Prisma.Decimal | null; paymentStatus: string | null;
  porRealizar: boolean; formaDePago: string | null; hasFactura: boolean; satCfdiUuid: string | null;
};
const SELECT_INGRESO = {
  id: true, amount: true, amountPaid: true, paymentStatus: true, porRealizar: true, formaDePago: true,
  hasFactura: true, satCfdiUuid: true,
} as const;

/** El MISMO veredicto que la nota de la cita: un «por realizar» no está pagado; sin estado, lo pagado decide. */
function estaPagado(e: Ingreso): boolean {
  if (e.porRealizar) return false;
  const estado = e.paymentStatus ?? calculatePaymentStatus(e.amountPaid != null ? Number(e.amountPaid) : 0, Number(e.amount));
  return estado === 'PAID';
}

/** ¿Ya tiene factura? Las señales que guardan un ingreso: la bandera, el uuid del SAT. */
function yaFacturado(e: Ingreso): boolean {
  return e.hasFactura || !!e.satCfdiUuid;
}

const pesos = (n: number) => `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export interface ConceptoFactura {
  description: string; productCode: string; unitCode: string;
  quantity: number; unitPrice: number; withIva: boolean; withIsrRetention: boolean;
}

/**
 * El prellenado de la factura de una visita. `null` = la visita no existe o no es de este doctor.
 * Con la MISMA forma que un borrador (`DraftPrefill` del formulario) + lo propio de la visita.
 */
export async function armarFacturaDeVisita(doctorId: string, visitaId: string) {
  const visita = await prisma.visita.findFirst({
    where: { id: visitaId, doctorId },
    select: { id: true, patientId: true, bookingId: true },
  });
  if (!visita) return null;

  const [profile, patient, cita, ventas] = await Promise.all([
    prisma.doctorFiscalProfile.findUnique({ where: { doctorId }, select: { codigoPostal: true } }),
    prisma.patient.findFirst({
      where: { id: visita.patientId, doctorId },
      select: { id: true, firstName: true, lastName: true, rfc: true, razonSocial: true, regimenFiscal: true, usoCfdi: true, codigoPostalFiscal: true },
    }),
    visita.bookingId
      ? prisma.booking.findFirst({
          where: { id: visita.bookingId, doctorId },
          select: { id: true, serviceName: true, status: true, ledgerEntry: { select: { ...SELECT_INGRESO, doctorId: true, tratamientoId: true } } },
        })
      : null,
    prisma.sale.findMany({
      where: { visitaId: visita.id, doctorId },
      orderBy: { id: 'asc' },
      select: {
        id: true, saleNumber: true, status: true, patientId: true, total: true,
        items: { orderBy: { order: 'asc' }, select: { description: true, itemType: true, quantity: true, unitPrice: true, discountRate: true, taxRate: true } },
        ledgerEntries: { select: SELECT_INGRESO },
      },
    }),
  ]);

  const incluidos: { que: string; monto: number; ingresoId: number; pagado: boolean; forma: string | null }[] = [];
  const excluidos: { que: string; motivo: string }[] = [];
  const avisos: string[] = [];
  const items: ConceptoFactura[] = [];

  // ── La cita ──
  if (cita) {
    const e = cita.ledgerEntry && cita.ledgerEntry.doctorId === doctorId ? cita.ledgerEntry : null;
    const que = `Cita${cita.serviceName ? ` · ${cita.serviceName}` : ''}`;
    if (!e) excluidos.push({ que, motivo: 'sin cobro registrado' });
    else if (Number(e.amount) <= 0) excluidos.push({ que, motivo: e.tratamientoId ? 'cubierta por el paquete ($0)' : 'cobro de $0' });
    else if (yaFacturado(e)) excluidos.push({ que, motivo: 'ya está facturada' });
    // Sin pagar completo NO entra (code review): una factura de algo no pagado es PPD con forma «99» y obliga a
    // complementos de pago que la plataforma no emite. La visita sólo factura lo PAGADO (PUE); lo demás, cuando
    // se pague.
    else if (!estaPagado(e)) excluidos.push({ que, motivo: 'sin pagar completo: factúrala cuando se pague' });
    else {
      const monto = Number(e.amount);
      incluidos.push({ que, monto, ingresoId: e.id, pagado: estaPagado(e), forma: e.formaDePago });
      // Igual que «Facturar» de Cobros: un concepto de servicio por lo cobrado, sin IVA.
      items.push({ description: cita.serviceName || 'Consulta médica', productCode: CLAVE_SERVICIO, unitCode: UNIDAD_SERVICIO, quantity: 1, unitPrice: monto, withIva: false, withIsrRetention: false });
    }
  }

  // ── Las ventas de la visita ──
  for (const v of ventas) {
    const que = `Venta ${v.saleNumber}`;
    if (v.status === 'CANCELLED') { excluidos.push({ que, motivo: 'cancelada' }); continue; }
    if (v.patientId !== visita.patientId) { excluidos.push({ que, motivo: 'es de otro paciente' }); continue; }
    // Cada venta tiene UN ingreso por su total (medido en prod); si no, no hay qué ligar.
    if (v.ledgerEntries.length !== 1) { excluidos.push({ que, motivo: v.ledgerEntries.length ? 'tiene varios ingresos: factúrala desde Facturación' : 'sin ingreso registrado' }); continue; }
    const e = v.ledgerEntries[0];
    if (Number(e.amount) <= 0) { excluidos.push({ que, motivo: 'cobro de $0' }); continue; }
    if (yaFacturado(e)) { excluidos.push({ que, motivo: 'ya está facturada' }); continue; }
    if (!estaPagado(e)) { excluidos.push({ que, motivo: 'sin pagar completo: factúrala cuando se pague' }); continue; }
    // El formulario aplica UNA tasa de IVA (16%) a todo concepto con IVA: una venta con otra tasa (8% frontera…)
    // saldría mal timbrada (code review) — se factura aparte, desde Facturación.
    if (v.items.some((it) => { const t = Number(it.taxRate ?? 0); return t > 0 && Math.abs(t - IVA) > 0.0001; })) {
      excluidos.push({ que, motivo: 'tiene IVA distinto de 16%: factúrala desde Facturación' }); continue;
    }
    if (incluidos.length >= MAX_INGRESOS_POR_FACTURA) { excluidos.push({ que, motivo: `una factura cubre a lo más ${MAX_INGRESOS_POR_FACTURA} cobros` }); continue; }

    // Sus artículos: precio con su descuento ya aplicado; IVA si su tasa lo lleva.
    let suma = 0;
    for (const it of v.items) {
      const cantidad = Number(it.quantity);
      // Con su descuento y SIN redondear a centavos (6 decimales, los que admite el SAT): redondear por unidad
      // se desviaba con la cantidad y la factura dejaba de cuadrar con su cobro (code review).
      const unitario = Math.round(Number(it.unitPrice) * (1 - Number(it.discountRate ?? 0)) * 1e6) / 1e6;
      const conIva = Number(it.taxRate ?? 0) > 0;
      // Con la tasa que SE VA a timbrar (16%), no la guardada: así el aviso de abajo dice la verdad.
      suma += cantidad * unitario * (conIva ? 1 + IVA : 1);
      items.push({
        description: it.description, productCode: CLAVE_SERVICIO,
        unitCode: it.itemType === 'product' ? UNIDAD_PIEZA : UNIDAD_SERVICIO,
        quantity: cantidad, unitPrice: unitario, withIva: conIva, withIsrRetention: false,
      });
    }
    const monto = Number(e.amount);
    if (Math.abs(suma - monto) > 0.01 * Math.max(1, v.items.length)) {
      avisos.push(`${que}: sus artículos suman ${pesos(suma)} y su cobro es ${pesos(monto)} — revisa los conceptos antes de timbrar.`);
    }
    if (v.items.some((it) => it.itemType === 'product')) {
      avisos.push(`${que} trae productos: revisa su clave SAT (viene la de servicio médico, ${CLAVE_SERVICIO}).`);
    }
    incluidos.push({ que, monto, ingresoId: e.id, pagado: estaPagado(e), forma: e.formaDePago });
  }

  // ── Forma y método de pago (una sola por factura). Sólo entra lo pagado ⇒ siempre PUE. ──
  const formas = [...new Set(incluidos.map((i) => i.forma ?? 'efectivo'))];
  const mayor = [...incluidos].sort((a, b) => b.monto - a.monto)[0];
  const forma = mayor ? FORMA_SAT[mayor.forma ?? 'efectivo'] ?? '03' : '03';
  if (formas.length > 1) avisos.push(`Los cobros tienen formas de pago distintas (${formas.join(', ')}): va la del monto mayor; revísala.`);

  const derivation = patient
    ? deriveReceiverFromPatient(patient, profile?.codigoPostal ?? '')
    : { receiver: null, esPublicoGeneral: false, camposFaltantes: ['expediente no vinculado'] };
  const principal = incluidos[0] ?? null;

  return {
    // La forma de un borrador (el formulario la conoce), sin borrador: id 0.
    id: 0,
    origen: 'visita' as const,
    visitaId: visita.id,
    ledgerEntryId: principal?.ingresoId ?? null,
    ledgerEntryIdsExtra: incluidos.slice(1).map((i) => i.ingresoId),
    items,
    paymentForm: forma,
    paymentMethod: 'PUE',
    observations: null,
    status: 'draft',
    receiver: derivation.receiver,
    esPublicoGeneral: derivation.esPublicoGeneral,
    camposFaltantes: derivation.camposFaltantes,
    usoIncompatible: !derivation.esPublicoGeneral && patient ? usoIncompatibleConRegimen(patient.usoCfdi, patient.regimenFiscal) : false,
    paciente: patient ? { id: patient.id, nombre: `${patient.firstName} ${patient.lastName}`.trim() } : null,
    ingreso: null,
    incluidos: incluidos.map(({ que, monto, pagado }) => ({ que, monto, pagado })),
    excluidos,
    avisos,
  };
}

/** El paciente de un ingreso: el de su cita o el de su venta (los ingresos no lo guardan siempre). */
async function pacienteDeIngreso(tx: Prisma.TransactionClient | typeof prisma, e: { bookingId: string | null; saleId: number | null }) {
  if (e.bookingId) return (await tx.booking.findUnique({ where: { id: e.bookingId }, select: { patientId: true } }))?.patientId ?? null;
  if (e.saleId) return (await tx.sale.findUnique({ where: { id: e.saleId }, select: { patientId: true } }))?.patientId ?? null;
  return null;
}

/**
 * Los ingresos ADICIONALES de una factura (la de una visita), revisados ANTES de timbrar con el mismo guardia
 * anti-doble-factura que el principal: de este doctor, con monto, sin factura, distintos, y del MISMO paciente
 * que el principal. Devuelve un error en palabras (409) o null.
 */
export async function validarIngresosExtra(doctorId: string, principalId: number, extras: unknown): Promise<{ ids: number[]; montoLigado: number } | { error: string; status: number }> {
  if (extras === undefined || extras === null) return { ids: [], montoLigado: 0 };
  if (!Array.isArray(extras) || extras.some((x) => !Number.isInteger(x) || (x as number) <= 0)) {
    return { error: 'ledgerEntryIdsExtra debe ser una lista de ids', status: 400 };
  }
  const ids = [...new Set(extras as number[])];
  if (ids.length === 0) return { ids: [], montoLigado: 0 };
  if (ids.includes(principalId)) return { error: 'Un ingreso adicional repite el principal', status: 400 };
  if (ids.length + 1 > MAX_INGRESOS_POR_FACTURA) return { error: `Una factura cubre a lo más ${MAX_INGRESOS_POR_FACTURA} cobros`, status: 400 };

  const [principal, entries] = await Promise.all([
    prisma.ledgerEntry.findFirst({ where: { id: principalId, doctorId }, select: { bookingId: true, saleId: true, amount: true } }),
    prisma.ledgerEntry.findMany({ where: { id: { in: ids }, doctorId }, select: { id: true, amount: true, hasFactura: true, satCfdiUuid: true, bookingId: true, saleId: true } }),
  ]);
  if (!principal) return { error: 'Entrada de ledger no encontrada', status: 404 };
  if (entries.length !== ids.length) return { error: 'Algún cobro adicional no se encontró', status: 404 };
  const paciente = await pacienteDeIngreso(prisma, principal);
  if (!paciente) return { error: 'El cobro principal no está ligado a un paciente', status: 409 };
  for (const e of entries) {
    if (Number(e.amount) <= 0) return { error: 'Un cobro adicional es de $0: no hay qué facturar', status: 409 };
    if (e.hasFactura || e.satCfdiUuid) {
      return { error: 'Un cobro de esta factura ya tiene factura — no se emite dos veces. Recarga la visita y vuelve a intentarlo.', status: 409 };
    }
    if ((await pacienteDeIngreso(prisma, e)) !== paciente) return { error: 'Los cobros de una factura deben ser del mismo paciente', status: 409 };
  }
  return { ids, montoLigado: Number(principal.amount) + entries.reduce((s, e) => s + Number(e.amount), 0) };
}

/**
 * Lo que la factura va a cobrar ANTES de impuestos retenidos: subtotal + IVA trasladado de cada concepto. Si el
 * doctor quitó conceptos en el formulario (una venta que no quiere facturar), ya no cuadra con los cobros que se
 * marcarían facturados — y esa venta quedaría «facturada» sin estar en ninguna factura (code review).
 */
export function totalAntesDeRetenciones(items: any[]): number {
  return items.reduce((s, it) => {
    const sub = Number(it.subtotal ?? (Number(it.unitPrice) * Number(it.quantity ?? 1))) || 0;
    const tras = Array.isArray(it.taxes) ? it.taxes.filter((t: any) => !t.IsRetention).reduce((a: number, t: any) => a + (Number(t.Total) || 0), 0) : 0;
    return s + sub + tras;
  }, 0);
}

/**
 * Después de timbrar: los enlaces (principal + extras), `has_factura` en los extras y los borradores vivos de
 * todos esos ingresos cerrados — en UNA transacción (si falla a medias, una venta quedaría facturable dos
 * veces). Lanza si falla: quien llama lo reporta (la factura YA salió).
 */
export async function ligarIngresosAFactura(cfdiId: number, principalId: number, extras: number[]) {
  const todos = [principalId, ...extras];
  await prisma.$transaction([
    prisma.cfdiIngreso.createMany({ data: todos.map((ledgerEntryId) => ({ cfdiEmittedId: cfdiId, ledgerEntryId })), skipDuplicates: true }),
    prisma.ledgerEntry.updateMany({ where: { id: { in: extras } }, data: { hasFactura: true } }),
    prisma.cfdiDraft.updateMany({ where: { ledgerEntryId: { in: todos }, status: 'draft' }, data: { status: 'emitted', emittedCfdiId: cfdiId } }),
  ]);
}
