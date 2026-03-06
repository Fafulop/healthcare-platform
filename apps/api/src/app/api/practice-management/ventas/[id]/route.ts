import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { getAuthenticatedDoctor } from '@/lib/auth';
import { calculatePaymentStatus, computeItemTotals } from '@/lib/practice-utils';

// PATCH /api/practice-management/ventas/:id
// Lightweight partial update: { status } or { amountPaid }
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { doctor } = await getAuthenticatedDoctor(request);
    const { id } = await params;
    const saleId = parseInt(id);

    if (isNaN(saleId)) {
      return NextResponse.json({ error: 'ID de venta inválido' }, { status: 400 });
    }

    const existingSale = await prisma.sale.findFirst({
      where: { id: saleId, doctorId: doctor.id },
    });
    if (!existingSale) {
      return NextResponse.json({ error: 'Venta no encontrada' }, { status: 404 });
    }

    const body = await request.json();
    const { status, amountPaid } = body;

    if (status !== undefined && !VALID_STATUSES.includes(status)) {
      return NextResponse.json(
        { error: `Estado inválido. Valores permitidos: ${VALID_STATUSES.join(', ')}` },
        { status: 400 }
      );
    }

    const saleUpdate: any = {};
    if (status !== undefined) saleUpdate.status = status;
    if (amountPaid !== undefined) {
      const paid = parseFloat(amountPaid);
      const total = parseFloat(existingSale.total.toString());
      saleUpdate.amountPaid = paid;
      saleUpdate.paymentStatus = calculatePaymentStatus(paid, total);
    }

    if (Object.keys(saleUpdate).length === 0) {
      return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 });
    }

    const sale = await prisma.$transaction(async (tx) => {
      const updated = await tx.sale.update({ where: { id: saleId }, data: saleUpdate });

      const linkedLedger = await tx.ledgerEntry.findFirst({
        where: { saleId, doctorId: doctor.id },
      });

      if (linkedLedger) {
        if (saleUpdate.status === 'CANCELLED') {
          await tx.ledgerEntry.delete({ where: { id: linkedLedger.id } });
        } else {
          const ledgerUpdate: any = {};
          if (saleUpdate.paymentStatus !== undefined) ledgerUpdate.paymentStatus = saleUpdate.paymentStatus;
          if (saleUpdate.amountPaid !== undefined) ledgerUpdate.amountPaid = saleUpdate.amountPaid;
          if (Object.keys(ledgerUpdate).length > 0) {
            await tx.ledgerEntry.update({ where: { id: linkedLedger.id }, data: ledgerUpdate });
          }
        }
      }

      return updated;
    });

    return NextResponse.json({ data: sale });
  } catch (error: any) {
    console.error('Error al actualizar venta (patch):', error);
    if (error.message?.includes('Doctor') || error.message?.includes('access required')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

const VALID_STATUSES = ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'] as const;

// GET /api/practice-management/ventas/:id
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { doctor } = await getAuthenticatedDoctor(request);
    const { id } = await params;
    const saleId = parseInt(id);

    if (isNaN(saleId)) {
      return NextResponse.json({ error: 'ID de venta inválido' }, { status: 400 });
    }

    const sale = await prisma.sale.findFirst({
      where: { id: saleId, doctorId: doctor.id },
      include: {
        client: true,
        quotation: { select: { id: true, quotationNumber: true, issueDate: true } },
        items: { include: { product: true }, orderBy: { order: 'asc' } },
      },
    });

    if (!sale) {
      return NextResponse.json({ error: 'Venta no encontrada' }, { status: 404 });
    }

    return NextResponse.json({ data: sale });
  } catch (error: any) {
    console.error('Error al obtener venta:', error);
    if (error.message?.includes('Doctor') || error.message?.includes('access required')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// PUT /api/practice-management/ventas/:id
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { doctor } = await getAuthenticatedDoctor(request);
    const { id } = await params;
    const saleId = parseInt(id);

    if (isNaN(saleId)) {
      return NextResponse.json({ error: 'ID de venta inválido' }, { status: 400 });
    }

    const existingSale = await prisma.sale.findFirst({
      where: { id: saleId, doctorId: doctor.id },
    });
    if (!existingSale) {
      return NextResponse.json({ error: 'Venta no encontrada' }, { status: 404 });
    }

    const {
      clientId,
      saleDate,
      deliveryDate,
      items,
      notes,
      termsAndConditions,
      taxRate,
      status,
      amountPaid,
    } = await request.json();

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

    const { subtotal, totalTax, total, items: saleItems } = computeItemTotals(items);
    const taxRateValue = taxRate !== undefined ? parseFloat(taxRate) : 0.16;
    const finalAmountPaid =
      amountPaid !== undefined
        ? parseFloat(amountPaid)
        : parseFloat(existingSale.amountPaid?.toString() || '0');
    const finalStatus = status || existingSale.status;

    const sale = await prisma.$transaction(async (tx) => {
      // Replace items atomically
      await tx.saleItem.deleteMany({ where: { saleId } });

      const updatedSale = await tx.sale.update({
        where: { id: saleId },
        data: {
          clientId: clientId ? parseInt(clientId) : existingSale.clientId,
          saleDate: saleDate ? new Date(saleDate) : existingSale.saleDate,
          deliveryDate: deliveryDate !== undefined ? (deliveryDate ? new Date(deliveryDate) : null) : existingSale.deliveryDate,
          status: finalStatus,
          paymentStatus: calculatePaymentStatus(finalAmountPaid, total),
          amountPaid: finalAmountPaid,
          subtotal,
          taxRate: taxRateValue,
          tax: totalTax,
          total,
          notes: notes?.trim() || null,
          termsAndConditions: termsAndConditions?.trim() || null,
          items: { create: saleItems },
        },
        include: {
          client: true,
          quotation: true,
          items: { include: { product: true }, orderBy: { order: 'asc' } },
        },
      });

      // Sync linked ledger entry
      const linkedLedger = await tx.ledgerEntry.findFirst({
        where: { saleId, doctorId: doctor.id },
      });

      if (linkedLedger) {
        if (finalStatus === 'CANCELLED') {
          await tx.ledgerEntry.delete({ where: { id: linkedLedger.id } });
        } else {
          await tx.ledgerEntry.update({
            where: { id: linkedLedger.id },
            data: {
              amount: total,
              paymentStatus: calculatePaymentStatus(finalAmountPaid, total),
              amountPaid: finalAmountPaid,
            },
          });
        }
      }

      return updatedSale;
    });

    return NextResponse.json({ data: sale });
  } catch (error: any) {
    console.error('Error al actualizar venta:', error);
    if (error.message?.includes('Doctor') || error.message?.includes('access required')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// DELETE /api/practice-management/ventas/:id
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { doctor } = await getAuthenticatedDoctor(request);
    const { id } = await params;
    const saleId = parseInt(id);

    if (isNaN(saleId)) {
      return NextResponse.json({ error: 'ID de venta inválido' }, { status: 400 });
    }

    const existingSale = await prisma.sale.findFirst({
      where: { id: saleId, doctorId: doctor.id },
    });
    if (!existingSale) {
      return NextResponse.json({ error: 'Venta no encontrada' }, { status: 404 });
    }

    await prisma.$transaction([
      prisma.ledgerEntry.deleteMany({ where: { saleId, doctorId: doctor.id } }),
      prisma.sale.delete({ where: { id: saleId } }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error al eliminar venta:', error);
    if (error.message?.includes('Doctor') || error.message?.includes('access required')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
