import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { getAuthenticatedDoctor } from '@/lib/auth';
import { validateDraftItems } from '@/lib/cfdi-drafts';

/**
 * F2c — CFDI drafts: the agent (or future manual flows) PREPARES a factura;
 * the doctor reviews/edits/emits it in the Nueva Factura form.
 * Validation/derivation helpers live in @/lib/cfdi-drafts (route files may
 * only export HTTP methods).
 */

// GET /api/facturacion/drafts?patientId=&status= — list (expediente section)
export async function GET(request: NextRequest) {
  try {
    const { doctor } = await getAuthenticatedDoctor(request);
    const { searchParams } = new URL(request.url);
    const patientId = searchParams.get('patientId') || undefined;
    const status = searchParams.get('status') || undefined;

    const drafts = await prisma.cfdiDraft.findMany({
      where: {
        doctorId: doctor.id,
        ...(patientId ? { patientId } : {}),
        ...(status ? { status } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return NextResponse.json({ data: drafts });
  } catch (error: any) {
    if (error.name === 'AuthError') {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error listing CFDI drafts:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// POST /api/facturacion/drafts — create (agent executor / future manual flow)
export async function POST(request: NextRequest) {
  try {
    const { doctor } = await getAuthenticatedDoctor(request);
    const body = await request.json();
    const { ledgerEntryId, items, paymentForm, paymentMethod, observations, origin } = body;

    const parsed = validateDraftItems(items);
    if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

    // v1: a draft always hangs off an existing income (09-DISENO §7 —
    // ledgerEntryId REQUIRED; the two-turn rule applies upstream).
    const entryId = typeof ledgerEntryId === 'number' && Number.isInteger(ledgerEntryId) && ledgerEntryId > 0 ? ledgerEntryId : null;
    if (!entryId) return NextResponse.json({ error: 'ledgerEntryId es requerido (entero > 0).' }, { status: 400 });
    const entry = await prisma.ledgerEntry.findFirst({
      where: { id: entryId, doctorId: doctor.id },
      select: { id: true, entryType: true, origin: true, hasFactura: true, patientId: true },
    });
    if (!entry) return NextResponse.json({ error: 'Entrada de ledger no encontrada' }, { status: 404 });
    if (entry.entryType !== 'ingreso') return NextResponse.json({ error: 'Solo se preparan borradores de ingresos.' }, { status: 400 });
    if (entry.hasFactura) {
      return NextResponse.json({ error: 'Ese ingreso ya tiene una factura ligada — no se prepara un borrador.' }, { status: 409 });
    }
    // Anti-duplicate (09-DISENO §7.2): one live draft per income.
    const existing = await prisma.cfdiDraft.findFirst({
      where: { doctorId: doctor.id, ledgerEntryId: entryId, status: 'draft' },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json(
        { error: `Ya existe un borrador pendiente para ese ingreso (id ${existing.id}) — ábrelo o descártalo antes de crear otro.`, existingDraftId: existing.id },
        { status: 409 }
      );
    }

    const draft = await prisma.cfdiDraft.create({
      data: {
        doctorId: doctor.id,
        patientId: entry.patientId,
        ledgerEntryId: entryId,
        items: parsed.items as any,
        paymentForm: typeof paymentForm === 'string' && paymentForm ? paymentForm : '01',
        paymentMethod: paymentMethod === 'PPD' ? 'PPD' : 'PUE',
        ...(typeof observations === 'string' && observations.trim() ? { observations: observations.trim() } : {}),
        origin: origin === 'user' ? 'user' : 'agent',
      },
    });
    return NextResponse.json({ data: draft }, { status: 201 });
  } catch (error: any) {
    if (error.name === 'AuthError') {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error creating CFDI draft:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
