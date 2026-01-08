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

// GET /api/practice-management/compras/:id
// Obtener compra específica
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { doctor } = await getAuthenticatedDoctor(request);
    const resolvedParams = await params;
    const purchaseId = parseInt(resolvedParams.id);

    if (isNaN(purchaseId)) {
      return NextResponse.json(
        { error: 'ID de compra inválido' },
        { status: 400 }
      );
    }

    const purchase = await prisma.purchase.findFirst({
      where: {
        id: purchaseId,
        doctorId: doctor.id
      },
      include: {
        supplier: true,
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

    if (!purchase) {
      return NextResponse.json(
        { error: 'Compra no encontrada' },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: purchase });
  } catch (error: any) {
    console.error('Error al obtener compra:', error);

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

// PUT /api/practice-management/compras/:id
// Actualizar compra
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { doctor } = await getAuthenticatedDoctor(request);
    const resolvedParams = await params;
    const purchaseId = parseInt(resolvedParams.id);
    const body = await request.json();

    if (isNaN(purchaseId)) {
      return NextResponse.json(
        { error: 'ID de compra inválido' },
        { status: 400 }
      );
    }

    // Verificar propiedad
    const existingPurchase = await prisma.purchase.findFirst({
      where: {
        id: purchaseId,
        doctorId: doctor.id
      }
    });

    if (!existingPurchase) {
      return NextResponse.json(
        { error: 'Compra no encontrada' },
        { status: 404 }
      );
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
    const purchaseItems = items.map((item: any, index: number) => {
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
    await prisma.purchaseItem.deleteMany({
      where: { purchaseId }
    });

    // Actualizar compra
    const purchase = await prisma.purchase.update({
      where: { id: purchaseId },
      data: {
        supplierId: supplierId ? parseInt(supplierId) : existingPurchase.supplierId,
        purchaseDate: purchaseDate ? new Date(purchaseDate) : existingPurchase.purchaseDate,
        deliveryDate: deliveryDate ? new Date(deliveryDate) : existingPurchase.deliveryDate,
        status: status || existingPurchase.status,
        paymentStatus: calculatePaymentStatus(
          amountPaid !== undefined ? parseFloat(amountPaid) : parseFloat(existingPurchase.amountPaid?.toString() || '0'),
          total
        ),
        amountPaid: amountPaid !== undefined ? parseFloat(amountPaid) : existingPurchase.amountPaid,
        subtotal,
        taxRate: taxRateValue,
        tax: totalTax,
        total,
        notes: notes?.trim() || null,
        termsAndConditions: termsAndConditions?.trim() || null,
        items: {
          create: purchaseItems
        }
      },
      include: {
        supplier: true,
        quotation: true,
        items: {
          include: {
            product: true
          },
          orderBy: { order: 'asc' }
        }
      }
    });

    // SYNC: Update linked ledger entry if it exists
    const linkedLedgerEntry = await prisma.ledgerEntry.findFirst({
      where: {
        purchaseId: purchaseId,
        doctorId: doctor.id
      }
    });

    if (linkedLedgerEntry) {
      const finalAmountPaid = amountPaid !== undefined ? parseFloat(amountPaid) : parseFloat(existingPurchase.amountPaid?.toString() || '0');
      await prisma.ledgerEntry.update({
        where: { id: linkedLedgerEntry.id },
        data: {
          amount: total,
          paymentStatus: calculatePaymentStatus(finalAmountPaid, total),
          amountPaid: finalAmountPaid
        }
      });
    }

    return NextResponse.json({ data: purchase });
  } catch (error: any) {
    console.error('Error al actualizar compra:', error);

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

// DELETE /api/practice-management/compras/:id
// Eliminar compra
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { doctor } = await getAuthenticatedDoctor(request);
    const resolvedParams = await params;
    const purchaseId = parseInt(resolvedParams.id);

    if (isNaN(purchaseId)) {
      return NextResponse.json(
        { error: 'ID de compra inválido' },
        { status: 400 }
      );
    }

    // Verificar propiedad
    const existingPurchase = await prisma.purchase.findFirst({
      where: {
        id: purchaseId,
        doctorId: doctor.id
      }
    });

    if (!existingPurchase) {
      return NextResponse.json(
        { error: 'Compra no encontrada' },
        { status: 404 }
      );
    }

    // Eliminar compra (cascada a items)
    await prisma.purchase.delete({
      where: { id: purchaseId }
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    console.error('Error al eliminar compra:', error);

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
