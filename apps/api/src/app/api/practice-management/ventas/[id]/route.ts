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

// GET /api/practice-management/ventas/:id
// Obtener venta específica
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { doctor } = await getAuthenticatedDoctor(request);
    const resolvedParams = await params;
    const saleId = parseInt(resolvedParams.id);

    if (isNaN(saleId)) {
      return NextResponse.json(
        { error: 'ID de venta inválido' },
        { status: 400 }
      );
    }

    const sale = await prisma.sale.findFirst({
      where: {
        id: saleId,
        doctorId: doctor.id
      },
      include: {
        client: true,
        quotation: {
          select: {
            id: true,
            quotationNumber: true,
            issueDate: true
          }
        },
        items: {
          include: {
            product: true
          },
          orderBy: { order: 'asc' }
        }
      }
    });

    if (!sale) {
      return NextResponse.json(
        { error: 'Venta no encontrada' },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: sale });
  } catch (error: any) {
    console.error('Error al obtener venta:', error);

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

// PUT /api/practice-management/ventas/:id
// Actualizar venta
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { doctor } = await getAuthenticatedDoctor(request);
    const resolvedParams = await params;
    const saleId = parseInt(resolvedParams.id);
    const body = await request.json();

    if (isNaN(saleId)) {
      return NextResponse.json(
        { error: 'ID de venta inválido' },
        { status: 400 }
      );
    }

    // Verificar propiedad
    const existingSale = await prisma.sale.findFirst({
      where: {
        id: saleId,
        doctorId: doctor.id
      }
    });

    if (!existingSale) {
      return NextResponse.json(
        { error: 'Venta no encontrada' },
        { status: 404 }
      );
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
      paymentStatus,
      amountPaid
    } = body;

    // Validar items
    if (!items || items.length === 0) {
      return NextResponse.json(
        { error: 'Debe agregar al menos un producto o servicio' },
        { status: 400 }
      );
    }

    // Calcular totales
    let subtotal = 0;
    let totalTax = 0;
    const saleItems = items.map((item: any, index: number) => {
      const baseAmount = parseFloat(item.quantity) * parseFloat(item.unitPrice);
      const discountRate = item.discountRate !== undefined ? parseFloat(item.discountRate) : 0;
      const discountAmount = baseAmount * discountRate;
      const itemSubtotal = baseAmount - discountAmount;
      const itemTaxRate = item.taxRate !== undefined ? parseFloat(item.taxRate) : 0.16;
      const itemTaxAmount = itemSubtotal * itemTaxRate;

      subtotal += itemSubtotal;
      totalTax += itemTaxAmount;

      return {
        productId: item.productId || null,
        itemType: item.itemType || 'product',
        description: item.description,
        sku: item.sku || null,
        quantity: parseFloat(item.quantity),
        unit: item.unit || null,
        unitPrice: parseFloat(item.unitPrice),
        discountRate: discountRate,
        taxRate: itemTaxRate,
        taxAmount: itemTaxAmount,
        subtotal: itemSubtotal,
        order: index
      };
    });

    const taxRateValue = taxRate !== undefined ? parseFloat(taxRate) : 0.16;
    const total = subtotal + totalTax;

    // Eliminar items existentes y crear nuevos
    await prisma.saleItem.deleteMany({
      where: { saleId }
    });

    // Actualizar venta
    const sale = await prisma.sale.update({
      where: { id: saleId },
      data: {
        clientId: clientId ? parseInt(clientId) : existingSale.clientId,
        saleDate: saleDate ? new Date(saleDate) : existingSale.saleDate,
        deliveryDate: deliveryDate ? new Date(deliveryDate) : existingSale.deliveryDate,
        status: status || existingSale.status,
        paymentStatus: calculatePaymentStatus(
          amountPaid !== undefined ? parseFloat(amountPaid) : parseFloat(existingSale.amountPaid?.toString() || '0'),
          total
        ),
        amountPaid: amountPaid !== undefined ? parseFloat(amountPaid) : existingSale.amountPaid,
        subtotal,
        taxRate: taxRateValue,
        tax: totalTax,
        total,
        notes: notes?.trim() || null,
        termsAndConditions: termsAndConditions?.trim() || null,
        items: {
          create: saleItems
        }
      },
      include: {
        client: true,
        quotation: true,
        items: {
          include: {
            product: true
          },
          orderBy: { order: 'asc' }
        }
      }
    });

    // SYNC: Update or delete linked ledger entry
    const linkedLedgerEntry = await prisma.ledgerEntry.findFirst({
      where: {
        saleId: saleId,
        doctorId: doctor.id
      }
    });

    if (linkedLedgerEntry) {
      const finalStatus = status || existingSale.status;

      // If cancelled, delete the ledger entry
      if (finalStatus === 'CANCELLED') {
        await prisma.ledgerEntry.delete({
          where: { id: linkedLedgerEntry.id }
        });
      } else {
        // Otherwise, sync the ledger entry
        const finalAmountPaid = amountPaid !== undefined ? parseFloat(amountPaid) : parseFloat(existingSale.amountPaid?.toString() || '0');
        await prisma.ledgerEntry.update({
          where: { id: linkedLedgerEntry.id },
          data: {
            amount: total,
            paymentStatus: calculatePaymentStatus(finalAmountPaid, total),
            amountPaid: finalAmountPaid
          }
        });
      }
    }

    return NextResponse.json({ data: sale });
  } catch (error: any) {
    console.error('Error al actualizar venta:', error);

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

// DELETE /api/practice-management/ventas/:id
// Eliminar venta
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { doctor } = await getAuthenticatedDoctor(request);
    const resolvedParams = await params;
    const saleId = parseInt(resolvedParams.id);

    if (isNaN(saleId)) {
      return NextResponse.json(
        { error: 'ID de venta inválido' },
        { status: 400 }
      );
    }

    // Verificar propiedad
    const existingSale = await prisma.sale.findFirst({
      where: {
        id: saleId,
        doctorId: doctor.id
      }
    });

    if (!existingSale) {
      return NextResponse.json(
        { error: 'Venta no encontrada' },
        { status: 404 }
      );
    }

    // Delete linked ledger entry first
    await prisma.ledgerEntry.deleteMany({
      where: {
        saleId: saleId,
        doctorId: doctor.id
      }
    });

    // Eliminar venta (cascada a items)
    await prisma.sale.delete({
      where: { id: saleId }
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    console.error('Error al eliminar venta:', error);

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
