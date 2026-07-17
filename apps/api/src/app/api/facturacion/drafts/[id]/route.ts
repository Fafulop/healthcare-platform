import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { getAuthenticatedDoctor } from '@/lib/auth';
import { deriveReceiverFromPatient } from '@/lib/cfdi-drafts';

/**
 * F2c — single draft: GET hydrates the Nueva Factura form; PATCH discards.
 * GET derives the receiver FRESH from the patient (09-DISENO §7.4) and
 * reports the income's current state (§7.5) so the form warns BEFORE submit
 * (the 409 in POST /cfdi is the net, not the first line).
 */

async function findDraft(request: NextRequest, id: string) {
  const { doctor } = await getAuthenticatedDoctor(request);
  const draftId = parseInt(id, 10);
  if (!Number.isInteger(draftId) || draftId <= 0) return { doctor, draft: null };
  const draft = await prisma.cfdiDraft.findFirst({
    where: { id: draftId, doctorId: doctor.id },
  });
  return { doctor, draft };
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { doctor, draft } = await findDraft(request, id);
    if (!draft) return NextResponse.json({ error: 'Borrador no encontrado' }, { status: 404 });

    const [profile, entry, patient] = await Promise.all([
      prisma.doctorFiscalProfile.findUnique({
        where: { doctorId: doctor.id },
        select: { codigoPostal: true },
      }),
      draft.ledgerEntryId
        ? prisma.ledgerEntry.findFirst({
            where: { id: draft.ledgerEntryId, doctorId: doctor.id },
            select: { id: true, amount: true, concept: true, hasFactura: true, formaDePago: true },
          })
        : null,
      draft.patientId
        ? prisma.patient.findFirst({
            where: { id: draft.patientId, doctorId: doctor.id },
            select: {
              id: true, firstName: true, lastName: true, rfc: true, razonSocial: true,
              regimenFiscal: true, usoCfdi: true, codigoPostalFiscal: true,
            },
          })
        : null,
    ]);

    const derivation = patient
      ? deriveReceiverFromPatient(patient, profile?.codigoPostal ?? '')
      : { receiver: null, esPublicoGeneral: false, camposFaltantes: ['expediente no vinculado'] };

    return NextResponse.json({
      data: {
        ...draft,
        // Fresh, server-derived context for the form (never stored):
        receiver: derivation.receiver,
        esPublicoGeneral: derivation.esPublicoGeneral,
        camposFaltantes: derivation.camposFaltantes,
        paciente: patient ? { id: patient.id, nombre: `${patient.firstName} ${patient.lastName}`.trim() } : null,
        ingreso: entry
          ? { id: entry.id, amount: Number(entry.amount), concept: entry.concept, hasFactura: entry.hasFactura, formaDePago: entry.formaDePago }
          : null,
      },
    });
  } catch (error: any) {
    if (error.name === 'AuthError') {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error fetching CFDI draft:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// PATCH /api/facturacion/drafts/[id] — { action: 'discard' } (v1: only discard;
// 'emitted' is set by POST /facturacion/cfdi when it receives draftId).
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { draft } = await findDraft(request, id);
    if (!draft) return NextResponse.json({ error: 'Borrador no encontrado' }, { status: 404 });
    const body = await request.json().catch(() => ({}));
    if (body.action !== 'discard') {
      return NextResponse.json({ error: 'Acción inválida — solo "discard".' }, { status: 400 });
    }
    if (draft.status !== 'draft') {
      return NextResponse.json({ error: `El borrador ya está ${draft.status} — no se puede descartar.` }, { status: 409 });
    }
    const updated = await prisma.cfdiDraft.update({
      where: { id: draft.id },
      data: { status: 'discarded' },
    });
    return NextResponse.json({ data: updated });
  } catch (error: any) {
    if (error.name === 'AuthError') {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error updating CFDI draft:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
