import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { getAuthenticatedDoctor } from '@/lib/auth';

// Helper function to auto-calculate payment status based on amount paid
function calculatePaymentStatus(amountPaid: number, total: number): 'PENDING' | 'PARTIAL' | 'PAID' {
  if (amountPaid === 0) {
    return 'PENDING';
  } else if (amountPaid >= total) {
    return 'PAID';
  } else {
    return 'PARTIAL';
  }
}

// GET /api/practice-management/ledger/:id
// Get a single ledger entry by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { doctor } = await getAuthenticatedDoctor(request);
    const resolvedParams = await params;
    const entryId = parseInt(resolvedParams.id);

    if (isNaN(entryId)) {
      return NextResponse.json(
        { error: 'ID de entrada inválido' },
        { status: 400 }
      );
    }

    const entry = await prisma.ledgerEntry.findFirst({
      where: {
        id: entryId,
        doctorId: doctor.id
      },
      include: {
        attachments: true,
        facturas: true,
        facturasXml: true,
        client: {
          select: {
            id: true,
            businessName: true,
            contactName: true
          }
        },
        supplier: {
          select: {
            id: true,
            businessName: true,
            contactName: true
          }
        },
        sale: {
          select: {
            id: true,
            saleNumber: true,
            total: true
          }
        },
        purchase: {
          select: {
            id: true,
            purchaseNumber: true,
            total: true
          }
        }
      }
    });

    if (!entry) {
      return NextResponse.json(
        { error: 'Entrada no encontrada' },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: entry });
  } catch (error: any) {
    console.error('Error fetching ledger entry:', error);

    if (error.message.includes('Doctor') || error.message.includes('access required')) {
      return NextResponse.json(
        { error: error.message },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// PUT /api/practice-management/ledger/:id
// Update a ledger entry
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { doctor } = await getAuthenticatedDoctor(request);
    const resolvedParams = await params;
    const entryId = parseInt(resolvedParams.id);
    const body = await request.json();

    if (isNaN(entryId)) {
      return NextResponse.json(
        { error: 'ID de entrada inválido' },
        { status: 400 }
      );
    }

    const {
      amount,
      concept,
      bankAccount,
      formaDePago,
      internalId,
      bankMovementId,
      entryType,
      transactionDate,
      area,
      subarea,
      porRealizar,
      paymentStatus,
      amountPaid
    } = body;

    // Validation - required fields
    if (!amount || typeof amount !== 'number') {
      return NextResponse.json(
        { error: 'El monto es requerido y debe ser un número' },
        { status: 400 }
      );
    }

    if (amount <= 0) {
      return NextResponse.json(
        { error: 'El monto debe ser mayor a 0' },
        { status: 400 }
      );
    }

    if (!concept || typeof concept !== 'string' || concept.trim().length === 0) {
      return NextResponse.json(
        { error: 'El concepto es requerido' },
        { status: 400 }
      );
    }

    if (concept.length > 500) {
      return NextResponse.json(
        { error: 'El concepto no puede exceder 500 caracteres' },
        { status: 400 }
      );
    }

    if (!entryType || !['ingreso', 'egreso'].includes(entryType)) {
      return NextResponse.json(
        { error: 'El tipo debe ser ingreso o egreso' },
        { status: 400 }
      );
    }

    if (!transactionDate) {
      return NextResponse.json(
        { error: 'La fecha de transacción es requerida' },
        { status: 400 }
      );
    }

    if (!area || typeof area !== 'string' || area.trim().length === 0) {
      return NextResponse.json(
        { error: 'El área es requerida' },
        { status: 400 }
      );
    }

    if (!subarea || typeof subarea !== 'string' || subarea.trim().length === 0) {
      return NextResponse.json(
        { error: 'La subárea es requerida' },
        { status: 400 }
      );
    }

    // Validate formaDePago if provided
    if (formaDePago && !['efectivo', 'transferencia', 'tarjeta', 'cheque', 'deposito'].includes(formaDePago)) {
      return NextResponse.json(
        { error: 'Forma de pago inválida' },
        { status: 400 }
      );
    }

    // Verify ownership
    const existingEntry = await prisma.ledgerEntry.findFirst({
      where: {
        id: entryId,
        doctorId: doctor.id
      }
    });

    if (!existingEntry) {
      return NextResponse.json(
        { error: 'Entrada no encontrada' },
        { status: 404 }
      );
    }

    // Check if internal ID is being changed and if it's unique
    if (internalId && internalId !== existingEntry.internalId) {
      const duplicateId = await prisma.ledgerEntry.findFirst({
        where: {
          doctorId: doctor.id,
          internalId: internalId.trim(),
          id: { not: entryId }
        }
      });

      if (duplicateId) {
        return NextResponse.json(
          { error: 'El ID interno ya existe' },
          { status: 409 }
        );
      }
    }

    // Update ledger entry
    const entry = await prisma.ledgerEntry.update({
      where: { id: entryId },
      data: {
        amount: amount,
        concept: concept.trim(),
        bankAccount: bankAccount?.trim() || null,
        formaDePago: formaDePago || existingEntry.formaDePago,
        internalId: internalId?.trim() || existingEntry.internalId,
        bankMovementId: bankMovementId?.trim() || null,
        entryType: entryType,
        transactionDate: new Date(transactionDate + 'T12:00:00'),
        area: area.trim(),
        subarea: subarea.trim(),
        porRealizar: porRealizar !== undefined ? porRealizar : existingEntry.porRealizar,
        paymentStatus: calculatePaymentStatus(
          amountPaid !== undefined ? parseFloat(amountPaid) : parseFloat(existingEntry.amountPaid?.toString() || '0'),
          amount
        ),
        amountPaid: amountPaid !== undefined ? parseFloat(amountPaid) : existingEntry.amountPaid
      },
      include: {
        attachments: true,
        facturas: true,
        facturasXml: true
      }
    });

    // SYNC: Update linked sale if it exists
    if (existingEntry.saleId) {
      const finalAmountPaid = amountPaid !== undefined ? parseFloat(amountPaid) : parseFloat(existingEntry.amountPaid?.toString() || '0');
      await prisma.sale.update({
        where: { id: existingEntry.saleId },
        data: {
          total: amount,
          paymentStatus: calculatePaymentStatus(finalAmountPaid, amount),
          amountPaid: finalAmountPaid
        }
      });
    }

    // SYNC: Update linked purchase if it exists
    if (existingEntry.purchaseId) {
      const finalAmountPaid = amountPaid !== undefined ? parseFloat(amountPaid) : parseFloat(existingEntry.amountPaid?.toString() || '0');
      await prisma.purchase.update({
        where: { id: existingEntry.purchaseId },
        data: {
          total: amount,
          paymentStatus: calculatePaymentStatus(finalAmountPaid, amount),
          amountPaid: finalAmountPaid
        }
      });
    }

    return NextResponse.json({ data: entry });
  } catch (error: any) {
    console.error('Error updating ledger entry:', error);

    // Handle unique constraint violation
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'El ID interno ya existe' },
        { status: 409 }
      );
    }

    if (error.message.includes('Doctor') || error.message.includes('access required')) {
      return NextResponse.json(
        { error: error.message },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// PATCH /api/practice-management/ledger/:id
// Partial update for inline editing (area/subarea/formaDePago/amountPaid)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { doctor } = await getAuthenticatedDoctor(request);
    const resolvedParams = await params;
    const entryId = parseInt(resolvedParams.id);
    const body = await request.json();

    if (isNaN(entryId)) {
      return NextResponse.json(
        { error: 'ID de entrada inválido' },
        { status: 400 }
      );
    }

    const { area, subarea, formaDePago, amountPaid, paymentStatus } = body;

    // Validation
    if (area !== undefined && (!area || typeof area !== 'string' || area.trim().length === 0)) {
      return NextResponse.json(
        { error: 'El área es requerida' },
        { status: 400 }
      );
    }

    // Validate formaDePago if provided
    if (formaDePago !== undefined && formaDePago && !['efectivo', 'transferencia', 'tarjeta', 'cheque', 'deposito'].includes(formaDePago)) {
      return NextResponse.json(
        { error: 'Forma de pago inválida' },
        { status: 400 }
      );
    }

    // Verify ownership
    const existingEntry = await prisma.ledgerEntry.findFirst({
      where: {
        id: entryId,
        doctorId: doctor.id
      }
    });

    if (!existingEntry) {
      return NextResponse.json(
        { error: 'Entrada no encontrada' },
        { status: 404 }
      );
    }

    // Build update data object - only update provided fields
    const updateData: any = {};
    if (area !== undefined) updateData.area = area.trim();
    if (subarea !== undefined) updateData.subarea = subarea ? subarea.trim() : '';
    if (formaDePago !== undefined) updateData.formaDePago = formaDePago;

    // Handle amountPaid and auto-calculate paymentStatus
    if (amountPaid !== undefined) {
      const finalAmountPaid = parseFloat(amountPaid);
      const totalAmount = parseFloat(existingEntry.amount.toString());
      updateData.amountPaid = finalAmountPaid;
      updateData.paymentStatus = calculatePaymentStatus(finalAmountPaid, totalAmount);
    } else if (paymentStatus !== undefined) {
      updateData.paymentStatus = paymentStatus;
    }

    // Update only the specified fields
    const updatedEntry = await prisma.ledgerEntry.update({
      where: { id: entryId },
      data: updateData,
      include: {
        client: {
          select: {
            id: true,
            businessName: true,
            contactName: true
          }
        },
        supplier: {
          select: {
            id: true,
            businessName: true,
            contactName: true
          }
        }
      }
    });

    // SYNC: Update linked sale if amountPaid was changed
    if (amountPaid !== undefined && existingEntry.saleId) {
      const finalAmountPaid = parseFloat(amountPaid);
      const totalAmount = parseFloat(existingEntry.amount.toString());
      await prisma.sale.update({
        where: { id: existingEntry.saleId },
        data: {
          amountPaid: finalAmountPaid,
          paymentStatus: calculatePaymentStatus(finalAmountPaid, totalAmount)
        }
      });
    }

    // SYNC: Update linked purchase if amountPaid was changed
    if (amountPaid !== undefined && existingEntry.purchaseId) {
      const finalAmountPaid = parseFloat(amountPaid);
      const totalAmount = parseFloat(existingEntry.amount.toString());
      await prisma.purchase.update({
        where: { id: existingEntry.purchaseId },
        data: {
          amountPaid: finalAmountPaid,
          paymentStatus: calculatePaymentStatus(finalAmountPaid, totalAmount)
        }
      });
    }

    return NextResponse.json({ data: updatedEntry });
  } catch (error: any) {
    console.error('Error updating ledger entry:', error);

    if (error.message.includes('Doctor') || error.message.includes('access required')) {
      return NextResponse.json(
        { error: error.message },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: 'Error al actualizar entrada' },
      { status: 500 }
    );
  }
}

// DELETE /api/practice-management/ledger/:id
// Delete a ledger entry (cascades to attachments and invoices)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { doctor } = await getAuthenticatedDoctor(request);
    const resolvedParams = await params;
    const entryId = parseInt(resolvedParams.id);

    if (isNaN(entryId)) {
      return NextResponse.json(
        { error: 'ID de entrada inválido' },
        { status: 400 }
      );
    }

    // Verify ownership and get related data
    const existingEntry = await prisma.ledgerEntry.findFirst({
      where: {
        id: entryId,
        doctorId: doctor.id
      }
    });

    if (!existingEntry) {
      return NextResponse.json(
        { error: 'Entrada no encontrada' },
        { status: 404 }
      );
    }

    // Block deletion if linked to a sale
    if (existingEntry.saleId) {
      return NextResponse.json(
        { error: 'No se puede eliminar este movimiento porque está vinculado a una venta. Elimina o cancela la venta desde la página de Ventas.' },
        { status: 400 }
      );
    }

    // Block deletion if linked to a purchase
    if (existingEntry.purchaseId) {
      return NextResponse.json(
        { error: 'No se puede eliminar este movimiento porque está vinculado a una compra. Elimina o cancela la compra desde la página de Compras.' },
        { status: 400 }
      );
    }

    // Delete the ledger entry (only if not linked to sale/purchase)
    await prisma.ledgerEntry.delete({
      where: { id: entryId }
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    console.error('Error deleting ledger entry:', error);

    if (error.message.includes('Doctor') || error.message.includes('access required')) {
      return NextResponse.json(
        { error: error.message },
        { status: 403 }
      );
    }

    // Provide more specific error messages for common issues
    if (error.code === 'P2003') {
      return NextResponse.json(
        { error: 'No se puede eliminar porque tiene registros relacionados' },
        { status: 409 }
      );
    }

    if (error.code === 'P2025') {
      return NextResponse.json(
        { error: 'El registro ya fue eliminado' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
