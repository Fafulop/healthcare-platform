// GET /api/medical-records/patients/[id]/bookings
// Returns all bookings linked to a patient, ordered by appointment date descending.
// Scoped to the authenticated doctor — only returns bookings where booking.doctorId === doctor.

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { requireDoctorAuth } from '@/lib/medical-auth';
import { handleApiError } from '@/lib/api-error-handler';

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
            amount: true,
            formaDePago: true,
            cfdisEmitted: {
              where: { status: 'active' },
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
              take: 1,
              orderBy: { issuedAt: 'desc' },
            },
          },
        },
      },
      orderBy: [
        { slot: { date: 'desc' } },
        { date: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    const data = bookings.map((b) => {
      const le = b.ledgerEntry;
      const cfdi = le?.cfdisEmitted?.[0] ?? null;
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
        // Financial
        ledgerEntryId: le?.id ?? null,
        amount: le ? Number(le.amount) : null,
        formaDePago: le?.formaDePago ?? null,
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
