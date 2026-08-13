// GET /api/medical-records/patients/[id]/bookings
// Returns all bookings linked to a patient, ordered by appointment date descending.
// Scoped to the authenticated doctor — only returns bookings where booking.doctorId === doctor.

import { NextRequest, NextResponse } from 'next/server';
import { prisma, resolveFacturaVerdict, buildSatStatusMap, satUuidQueryVariants } from '@healthcare/database';
import { requireDoctorAuth } from '@/lib/medical-auth';
import { handleApiError } from '@/lib/api-error-handler';

/** Etiquetas de `LedgerEntry.formaDePago`. Viven aquí porque el método se manda ya
 *  resuelto (el cliente no vuelve a mapear). Mismos valores que FORMAS_DE_PAGO en
 *  ledger-types. */
const FORMA_PAGO_LABEL: Record<string, string> = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  tarjeta: 'Tarjeta',
  cheque: 'Cheque',
  deposito: 'Depósito',
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { doctorId } = await requireDoctorAuth(request);
    const { id: patientId } = await params;

    // Verify patient belongs to this doctor
    const patient = await prisma.patient.findFirst({
      where: { id: patientId, doctorId },
      select: { id: true },
    });
    if (!patient) {
      return NextResponse.json({ success: false, error: 'Patient not found' }, { status: 404 });
    }

    const bookings = await prisma.booking.findMany({
      where: { patientId, doctorId },
      select: {
        id: true,
        status: true,
        serviceName: true,
        appointmentMode: true,
        finalPrice: true,
        // La casilla "¿Necesita factura?" de la tabla de citas. Es una pregunta
        // por CITA y no se deduce de `patient.requiereFactura`, que contesta otra
        // ("¿tenemos su RFC?", ver bookings/route.ts en apps/api).
        facturaSolicitada: true,
        slot: {
          select: {
            date: true,
            startTime: true,
            endTime: true,
          },
        },
        // freeform booking time fields
        date: true,
        startTime: true,
        endTime: true,
        formLink: {
          select: { id: true, status: true },
        },
        paymentLink: {
          select: { stripePaymentLinkUrl: true, status: true, isActive: true, paidAt: true, amount: true },
        },
        mpPaymentPreference: {
          select: { mpInitPoint: true, status: true, isActive: true, paidAt: true, amount: true },
        },
        // Financial data via LedgerEntry → CfdiEmitted
        ledgerEntry: {
          select: {
            id: true,
            // Dueño del ingreso — la clave del lookup del SAT lo incluye (un uuid
            // tiene una fila por doctor y sus satStatus pueden discrepar).
            doctorId: true,
            amount: true,
            formaDePago: true,
            // ¿Ya se COBRÓ? El estado de pago vive en el ingreso, no en la cita:
            // un link de pago pagado crea el ingreso PAID aunque la cita siga
            // agendada, y completar una cita registra el ingreso aunque no haya
            // habido pago electrónico.
            paymentStatus: true,
            amountPaid: true,
            // Las tres señales del veredicto de facturación. `cfdisEmitted` va SIN
            // filtro de status a propósito: la regla de qué status cuenta vive en
            // resolveFacturaVerdict (packages/database), no en cada query.
            satCfdiUuid: true,
            cfdisEmitted: {
              select: {
                id: true,
                uuid: true,
                folio: true,
                status: true,
                total: true,
                rfcReceptor: true,
                nombreReceptor: true,
                usoCfdi: true,
                formaPago: true,
                issuedAt: true,
              },
              orderBy: { issuedAt: 'desc' },
            },
            facturas: { select: { id: true } },
            facturasXml: { select: { id: true } },
          },
        },
      },
      orderBy: [
        { slot: { date: 'desc' } },
        { date: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    // Una sola consulta para todas las citas: contrastar los uuids EXTERNOS contra
    // el último sync del SAT (Vigente vs Cancelado). Se consultan las DOS variantes
    // de case (satUuidQueryVariants): el `IN` de Postgres es case-sensitive y el
    // uuid no se escribe con el mismo case por todos los caminos — no encontrar la
    // fila se leería como "no está cancelada".
    const satUuids = bookings
      .map((b) => b.ledgerEntry?.satCfdiUuid)
      .filter((u): u is string => !!u);
    const satStatusByUuid = satUuids.length > 0
      ? buildSatStatusMap(
          await prisma.satCfdiMetadata.findMany({
            where: { doctorId, uuid: { in: satUuidQueryVariants(satUuids) } },
            select: { doctorId: true, uuid: true, satStatus: true },
          })
        )
      : undefined;

    const data = bookings.map((b) => {
      const le = b.ledgerEntry;
      // Display: la ACTIVA más reciente (la lista viene ordenada desc). El
      // veredicto es otra cosa y lo resuelve el helper compartido.
      const cfdi = le?.cfdisEmitted?.find((c) => c.status === 'active') ?? null;
      const veredicto = resolveFacturaVerdict(le, satStatusByUuid);

      // ¿YA SE COBRÓ? UN solo veredicto, resuelto aquí (regla 0), mirando las DOS
      // mitades: el ingreso y los links. Antes cada mitad la pintaba un componente
      // distinto en el cliente, y la misma tarjeta podía decir "Por cobrar" arriba
      // (mirando el ingreso) y "Pagado" abajo (mirando el link) al mismo tiempo.
      const linkStripePagado = b.paymentLink?.status === 'PAID';
      const linkMpPagado = b.mpPaymentPreference?.status === 'PAID';
      // TRES estados, no un booleano: un cobro a medias no es "pagado" ni es
      // "por cobrar" a secas, y aplastarlo contra cualquiera de los dos miente.
      // ⚠️ El PARCIAL del ingreso GANA sobre un link pagado: un anticipo por link
      // deja el link en PAID y el ingreso en PARTIAL, y decir "Pagado · Mercado
      // Pago" ahí afirma que un saldo vivo ya se saldó (además de contradecir el
      // "cobrado X de Y" de la misma tarjeta).
      const estadoPago: 'PAGADO' | 'PARCIAL' | 'PENDIENTE' =
        le?.paymentStatus === 'PARTIAL' ? 'PARCIAL'
        : (le?.paymentStatus === 'PAID' || linkStripePagado || linkMpPagado) ? 'PAGADO'
        : 'PENDIENTE';
      const pagado = estadoPago === 'PAGADO';
      // El MÉTODO se manda ya legible. El proveedor del link gana sobre la forma
      // de pago del ingreso: "Mercado Pago" dice de dónde salió el dinero, que es
      // justo lo que el doctor quiere ver; el webhook escribe además una forma
      // genérica ("tarjeta") que sola no distingue un cobro en ventanilla.
      const metodoPago = estadoPago === 'PENDIENTE'
        ? null
        : linkStripePagado ? 'Stripe'
        : linkMpPagado ? 'Mercado Pago'
        : le?.formaDePago
          ? (FORMA_PAGO_LABEL[le.formaDePago] ?? le.formaDePago)
          : null;
      return {
        id: b.id,
        date: (b.slot?.date ?? b.date)?.toISOString().split('T')[0] ?? null,
        startTime: b.slot?.startTime ?? b.startTime ?? null,
        endTime: b.slot?.endTime ?? b.endTime ?? null,
        serviceName: b.serviceName ?? null,
        status: b.status,
        appointmentMode: b.appointmentMode ?? null,
        finalPrice: b.finalPrice ? Number(b.finalPrice) : null,
        formLinkId: b.formLink?.status === 'SUBMITTED' ? (b.formLink.id ?? null) : null,
        facturaSolicitada: b.facturaSolicitada ?? null,
        // Financial
        ledgerEntryId: le?.id ?? null,
        amount: le ? Number(le.amount) : null,
        formaDePago: le?.formaDePago ?? null,
        paymentStatus: le?.paymentStatus ?? null,
        amountPaid: le ? Number(le.amountPaid) : null,
        // VEREDICTO de cobro + método ya legible (ver arriba).
        estadoPago,
        metodoPago,
        // VEREDICTO, no las señales sueltas: el cliente no re-deriva "qué cuenta
        // como facturada" (regla 0). `via` es solo para la copy de la tarjeta.
        facturada: veredicto.facturada,
        facturadaVia: veredicto.via,
        // Payment links (linked cobro)
        stripeLink: b.paymentLink ? {
          url: b.paymentLink.stripePaymentLinkUrl,
          status: b.paymentLink.status,
          isActive: b.paymentLink.isActive,
          paidAt: b.paymentLink.paidAt?.toISOString() ?? null,
          amount: Number(b.paymentLink.amount),
        } : null,
        mpLink: b.mpPaymentPreference ? {
          url: b.mpPaymentPreference.mpInitPoint,
          status: b.mpPaymentPreference.status,
          isActive: b.mpPaymentPreference.isActive,
          paidAt: b.mpPaymentPreference.paidAt?.toISOString() ?? null,
          amount: Number(b.mpPaymentPreference.amount),
        } : null,
        // CFDI
        cfdi: cfdi ? {
          id: cfdi.id,
          uuid: cfdi.uuid,
          folio: cfdi.folio,
          status: cfdi.status,
          total: Number(cfdi.total),
          rfcReceptor: cfdi.rfcReceptor,
          nombreReceptor: cfdi.nombreReceptor,
          usoCfdi: cfdi.usoCfdi,
          formaPago: cfdi.formaPago,
          issuedAt: cfdi.issuedAt.toISOString(),
        } : null,
      };
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return handleApiError(error, 'GET /api/medical-records/patients/[id]/bookings');
  }
}
