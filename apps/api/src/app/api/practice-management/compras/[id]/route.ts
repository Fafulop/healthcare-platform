import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { getAuthenticatedDoctor } from '@/lib/auth';
import { calculatePaymentStatus, computeItemTotals } from '@/lib/practice-utils';

// PATCH /api/practice-management/compras/:id
// Lightweight partial update: { status } or { amountPaid }
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { doctor } = await getAuthenticatedDoctor(request);
    const { id } = await params;
    const purchaseId = parseInt(id);

    if (isNaN(purchaseId)) {
      return NextResponse.json({ error: 'ID de compra inválido' }, { status: 400 });
    }

    const existingPurchase = await prisma.purchase.findFirst({
      where: { id: purchaseId, doctorId: doctor.id },
    });
    if (!existingPurchase) {
      return NextResponse.json({ error: 'Compra no encontrada' }, { status: 404 });
    }

    const body = await request.json();
    const { status, amountPaid } = body;

    if (status !== undefined && !VALID_STATUSES.includes(status)) {
      return NextResponse.json(
        { error: `Estado inválido. Valores permitidos: ${VALID_STATUSES.join(', ')}` },
        { status: 400 }
      );
    }

    const purchaseUpdate: any = {};
    if (status !== undefined) purchaseUpdate.status = status;
    if (amountPaid !== undefined) {
      const paid = parseFloat(amountPaid);
      const total = parseFloat(existingPurchase.total.toString());
      purchaseUpdate.amountPaid = paid;
      purchaseUpdate.paymentStatus = calculatePaymentStatus(paid, total);
    }

    if (Object.keys(purchaseUpdate).length === 0) {
      return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 });
    }

    const purchase = await prisma.$transaction(async (tx) => {
      const updated = await tx.purchase.update({ where: { id: purchaseId }, data: purchaseUpdate });

      const linkedLedger = await tx.ledgerEntry.findFirst({
        where: { purchaseId, doctorId: doctor.id },
      });

      if (linkedLedger) {
        if (purchaseUpdate.status === 'CANCELLED') {
          await tx.ledgerEntry.delete({ where: { id: linkedLedger.id } });
        } else {
          const ledgerUpdate: any = {};
          if (purchaseUpdate.paymentStatus !== undefined) ledgerUpdate.paymentStatus = purchaseUpdate.paymentStatus;
          if (purchaseUpdate.amountPaid !== undefined) ledgerUpdate.amountPaid = purchaseUpdate.amountPaid;
          if (Object.keys(ledgerUpdate).length > 0) {
            await tx.ledgerEntry.update({ where: { id: linkedLedger.id }, data: ledgerUpdate });
          }
        }
      }

      return updated;
    });

    return NextResponse.json({ data: purchase });
  } catch (error: any) {
    console.error('Error al actualizar compra (patch):', error);
    if (error.message?.includes('Doctor') || error.message?.includes('access required')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

const VALID_STATUSES = ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'RECEIVED', 'CANCELLED'] as const;

// GET /api/practice-management/compras/:id
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { doctor } = await getAuthenticatedDoctor(request);
    const { id } = await params;
    const purchaseId = parseInt(id);

    if (isNaN(purchaseId)) {
      return NextResponse.json({ error: 'ID de compra inválido' }, { status: 400 });
    }

    const purchase = await prisma.purchase.findFirst({
      where: { id: purchaseId, doctorId: doctor.id },
      include: {
        supplier: true,
        quotation: { select: { id: true, quotationNumber: true, issueDate: true } },
        items: { include: { product: true }, orderBy: { order: 'asc' } },
      },
    });

    if (!purchase) {
      return NextResponse.json({ error: 'Compra no encontrada' }, { status: 404 });
    }

    return NextResponse.json({ data: purchase });
  } catch (error: any) {
    console.error('Error al obtener compra:', error);
    if (error.message?.includes('Doctor') || error.message?.includes('access required')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// PUT /api/practice-management/compras/:id
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { doctor } = await getAuthenticatedDoctor(request);
    const { id } = await params;
    const purchaseId = parseInt(id);

    if (isNaN(purchaseId)) {
      return NextResponse.json({ error: 'ID de compra inválido' }, { status: 400 });
    }

    const existingPurchase = await prisma.purchase.findFirst({
      where: { id: purchaseId, doctorId: doctor.id },
    });
    if (!existingPurchase) {
      return NextResponse.json({ error: 'Compra no encontrada' }, { status: 404 });
    }

    const {
      supplierId,
      purchaseDate,
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

    const { subtotal, totalTax, total, items: purchaseItems } = computeItemTotals(items);
    const taxRateValue = taxRate !== undefined ? parseFloat(taxRate) : 0.16;
    const finalAmountPaid =
      amountPaid !== undefined
        ? parseFloat(amountPaid)
        : parseFloat(existingPurchase.amountPaid?.toString() || '0');
    const finalStatus = status || existingPurchase.status;

    const purchase = await prisma.$transaction(async (tx) => {
      await tx.purchaseItem.deleteMany({ where: { purchaseId } });

      const updatedPurchase = await tx.purchase.update({
        where: { id: purchaseId },
        data: {
          supplierId: supplierId ? parseInt(supplierId) : existingPurchase.supplierId,
          purchaseDate: purchaseDate ? new Date(purchaseDate) : existingPurchase.purchaseDate,
          deliveryDate: deliveryDate !== undefined ? (deliveryDate ? new Date(deliveryDate) : null) : existingPurchase.deliveryDate,
          status: finalStatus,
          paymentStatus: calculatePaymentStatus(finalAmountPaid, total),
          amountPaid: finalAmountPaid,
          subtotal,
          taxRate: taxRateValue,
          tax: totalTax,
          total,
          notes: notes?.trim() || null,
          termsAndConditions: termsAndConditions?.trim() || null,
          items: { create: purchaseItems },
        },
        include: {
          supplier: true,
          quotation: true,
          items: { include: { product: true }, orderBy: { order: 'asc' } },
        },
      });

      // Sync linked ledger entry
      const linkedLedger = await tx.ledgerEntry.findFirst({
        where: { purchaseId, doctorId: doctor.id },
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

      return updatedPurchase;
    });

    return NextResponse.json({ data: purchase });
  } catch (error: any) {
    console.error('Error al actualizar compra:', error);
    if (error.message?.includes('Doctor') || error.message?.includes('access required')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// DELETE /api/practice-management/compras/:id
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { doctor } = await getAuthenticatedDoctor(request);
    const { id } = await params;
    const purchaseId = parseInt(id);

    if (isNaN(purchaseId)) {
      return NextResponse.json({ error: 'ID de compra inválido' }, { status: 400 });
    }

    const existingPurchase = await prisma.purchase.findFirst({
      where: { id: purchaseId, doctorId: doctor.id },
    });
    if (!existingPurchase) {
      return NextResponse.json({ error: 'Compra no encontrada' }, { status: 404 });
    }

    await prisma.$transaction([
      prisma.ledgerEntry.deleteMany({ where: { purchaseId, doctorId: doctor.id } }),
      prisma.purchase.delete({ where: { id: purchaseId } }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error al eliminar compra:', error);
    if (error.message?.includes('Doctor') || error.message?.includes('access required')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
