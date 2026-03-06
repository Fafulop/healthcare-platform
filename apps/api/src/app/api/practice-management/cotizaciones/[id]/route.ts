import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { getAuthenticatedDoctor } from '@/lib/auth';
import { computeItemTotals } from '@/lib/practice-utils';

// PATCH /api/practice-management/cotizaciones/:id
// Lightweight partial update: { status }
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { doctor } = await getAuthenticatedDoctor(request);
    const { id } = await params;
    const quotationId = parseInt(id);

    if (isNaN(quotationId)) {
      return NextResponse.json({ error: 'ID de cotización inválido' }, { status: 400 });
    }

    const existingQuotation = await prisma.quotation.findFirst({
      where: { id: quotationId, doctorId: doctor.id },
    });
    if (!existingQuotation) {
      return NextResponse.json({ error: 'Cotización no encontrada' }, { status: 404 });
    }

    const { status } = await request.json();

    if (!status) {
      return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 });
    }

    if (!VALID_STATUSES.includes(status)) {
      return NextResponse.json(
        { error: `Estado inválido. Valores permitidos: ${VALID_STATUSES.join(', ')}` },
        { status: 400 }
      );
    }

    const quotation = await prisma.quotation.update({
      where: { id: quotationId },
      data: { status },
    });

    return NextResponse.json({ data: quotation });
  } catch (error: any) {
    console.error('Error al actualizar cotización (patch):', error);
    if (error.message?.includes('Doctor') || error.message?.includes('access required')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

const VALID_STATUSES = ['DRAFT', 'SENT', 'APPROVED', 'REJECTED', 'EXPIRED', 'CANCELLED'] as const;

// GET /api/practice-management/cotizaciones/:id
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { doctor } = await getAuthenticatedDoctor(request);
    const { id } = await params;
    const quotationId = parseInt(id);

    if (isNaN(quotationId)) {
      return NextResponse.json({ error: 'ID de cotización inválido' }, { status: 400 });
    }

    const quotation = await prisma.quotation.findFirst({
      where: { id: quotationId, doctorId: doctor.id },
      include: {
        client: true,
        items: { include: { product: true }, orderBy: { order: 'asc' } },
      },
    });

    if (!quotation) {
      return NextResponse.json({ error: 'Cotización no encontrada' }, { status: 404 });
    }

    return NextResponse.json({ data: quotation });
  } catch (error: any) {
    console.error('Error al obtener cotización:', error);
    if (error.message?.includes('Doctor') || error.message?.includes('access required')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// PUT /api/practice-management/cotizaciones/:id
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { doctor } = await getAuthenticatedDoctor(request);
    const { id } = await params;
    const quotationId = parseInt(id);

    if (isNaN(quotationId)) {
      return NextResponse.json({ error: 'ID de cotización inválido' }, { status: 400 });
    }

    const existingQuotation = await prisma.quotation.findFirst({
      where: { id: quotationId, doctorId: doctor.id },
    });
    if (!existingQuotation) {
      return NextResponse.json({ error: 'Cotización no encontrada' }, { status: 404 });
    }

    const { clientId, issueDate, validUntil, items, notes, termsAndConditions, taxRate, status } =
      await request.json();

    if (!items || items.length === 0) {
      return NextResponse.json(
        { error: 'Debe agregar al menos un producto o servicio' },
        { status: 400 }
      );
    }

    if (status && !VALID_STATUSES.includes(status)) {
      return NextResponse.json(
        { error: `Estado inválido. Valores permitidos: ${VALID_STATUSES.join(', ')}` },
        { status: 400 }
      );
    }

    const { subtotal, totalTax, total, items: quotationItems } = computeItemTotals(items);
    const taxRateValue = taxRate !== undefined ? parseFloat(taxRate) : 0.16;

    const quotation = await prisma.$transaction(async (tx) => {
      await tx.quotationItem.deleteMany({ where: { quotationId } });

      return tx.quotation.update({
        where: { id: quotationId },
        data: {
          clientId: clientId ? parseInt(clientId) : existingQuotation.clientId,
          issueDate: issueDate ? new Date(issueDate) : existingQuotation.issueDate,
          validUntil: validUntil ? new Date(validUntil) : existingQuotation.validUntil,
          status: status || existingQuotation.status,
          subtotal,
          taxRate: taxRateValue,
          tax: totalTax,
          total,
          notes: notes?.trim() || null,
          termsAndConditions: termsAndConditions?.trim() || null,
          items: { create: quotationItems },
        },
        include: {
          client: true,
          items: { include: { product: true }, orderBy: { order: 'asc' } },
        },
      });
    });

    return NextResponse.json({ data: quotation });
  } catch (error: any) {
    console.error('Error al actualizar cotización:', error);
    if (error.message?.includes('Doctor') || error.message?.includes('access required')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// DELETE /api/practice-management/cotizaciones/:id
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { doctor } = await getAuthenticatedDoctor(request);
    const { id } = await params;
    const quotationId = parseInt(id);

    if (isNaN(quotationId)) {
      return NextResponse.json({ error: 'ID de cotización inválido' }, { status: 400 });
    }

    const existingQuotation = await prisma.quotation.findFirst({
      where: { id: quotationId, doctorId: doctor.id },
    });
    if (!existingQuotation) {
      return NextResponse.json({ error: 'Cotización no encontrada' }, { status: 404 });
    }

    await prisma.quotation.delete({ where: { id: quotationId } });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error al eliminar cotización:', error);
    if (error.message?.includes('Doctor') || error.message?.includes('access required')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
