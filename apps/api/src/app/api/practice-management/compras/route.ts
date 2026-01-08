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

// Helper function to generate ledger internal ID
async function generateLedgerInternalId(doctorId: string, entryType: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = entryType === 'ingreso' ? `ING-${year}-` : `EGR-${year}-`;

  const lastEntry = await prisma.ledgerEntry.findFirst({
    where: {
      doctorId,
      internalId: { startsWith: prefix }
    },
    orderBy: { internalId: 'desc' }
  });

  let nextNumber = 1;
  if (lastEntry) {
    const parts = lastEntry.internalId.split('-');
    const lastNumber = parseInt(parts[2]);
    if (!isNaN(lastNumber)) {
      nextNumber = lastNumber + 1;
    }
  }

  return `${prefix}${nextNumber.toString().padStart(3, '0')}`;
}

// GET /api/practice-management/compras
// Obtener todas las compras del doctor con filtros opcionales
export async function GET(request: NextRequest) {
  try {
    const { doctor } = await getAuthenticatedDoctor(request);
    const { searchParams } = new URL(request.url);

    const status = searchParams.get('status');
    const paymentStatus = searchParams.get('paymentStatus');
    const supplierId = searchParams.get('supplierId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const search = searchParams.get('search');

    const where: any = { doctorId: doctor.id };

    // Filtrar por estado de compra
    if (status && status !== 'all') {
      where.status = status;
    }

    // Filtrar por estado de pago
    if (paymentStatus && paymentStatus !== 'all') {
      where.paymentStatus = paymentStatus;
    }

    // Filtrar por proveedor
    if (supplierId) {
      where.supplierId = parseInt(supplierId);
    }

    // Filtrar por rango de fechas
    if (startDate || endDate) {
      where.purchaseDate = {};
      if (startDate) {
        where.purchaseDate.gte = new Date(startDate);
      }
      if (endDate) {
        where.purchaseDate.lte = new Date(endDate);
      }
    }

    // Buscar por número de compra o nombre de proveedor
    if (search) {
      where.OR = [
        { purchaseNumber: { contains: search, mode: 'insensitive' } },
        { supplier: { businessName: { contains: search, mode: 'insensitive' } } }
      ];
    }

    const purchases = await prisma.purchase.findMany({
      where,
      include: {
        supplier: {
          select: {
            id: true,
            businessName: true,
            contactName: true,
            email: true,
            phone: true
          }
        },
        quotation: {
          select: {
            id: true,
            quotationNumber: true
          }
        },
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                sku: true
              }
            }
          },
          orderBy: { order: 'asc' }
        }
      },
      orderBy: { purchaseDate: 'desc' }
    });

    return NextResponse.json({ data: purchases });
  } catch (error: any) {
    console.error('Error al obtener compras:', error);

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

// POST /api/practice-management/compras
// Crear nueva compra
export async function POST(request: NextRequest) {
  try {
    const { doctor } = await getAuthenticatedDoctor(request);
    const body = await request.json();

    const {
      supplierId,
      quotationId,
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

    // Validación
    if (!supplierId) {
      return NextResponse.json(
        { error: 'El proveedor es requerido' },
        { status: 400 }
      );
    }

    if (!items || items.length === 0) {
      return NextResponse.json(
        { error: 'Debe agregar al menos un producto o servicio' },
        { status: 400 }
      );
    }

    // Verificar que el proveedor pertenece al doctor
    const supplier = await prisma.proveedor.findFirst({
      where: {
        id: parseInt(supplierId),
        doctorId: doctor.id
      }
    });

    if (!supplier) {
      return NextResponse.json(
        { error: 'Proveedor no encontrado' },
        { status: 404 }
      );
    }

    // Si hay quotationId, verificar que pertenece al doctor
    if (quotationId) {
      const quotation = await prisma.quotation.findFirst({
        where: {
          id: parseInt(quotationId),
          doctorId: doctor.id
        }
      });

      if (!quotation) {
        return NextResponse.json(
          { error: 'Cotización no encontrada' },
          { status: 404 }
        );
      }
    }

    // Generar número de compra
    const purchaseNumber = await generatePurchaseNumber(doctor.id);

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

    // Crear compra
    const purchase = await prisma.purchase.create({
      data: {
        doctorId: doctor.id,
        supplierId: parseInt(supplierId),
        quotationId: quotationId ? parseInt(quotationId) : null,
        purchaseNumber,
        purchaseDate: purchaseDate ? new Date(purchaseDate) : new Date(),
        deliveryDate: deliveryDate ? new Date(deliveryDate) : null,
        status: status || 'PENDING',
        paymentStatus: calculatePaymentStatus(amountPaid ? parseFloat(amountPaid) : 0, total),
        amountPaid: amountPaid ? parseFloat(amountPaid) : 0,
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

    // AUTO-CREATE LEDGER ENTRY for the purchase
    const ledgerInternalId = await generateLedgerInternalId(doctor.id, 'egreso');
    await prisma.ledgerEntry.create({
      data: {
        doctorId: doctor.id,
        amount: total,
        concept: `Compra ${purchaseNumber} - Proveedor: ${supplier.businessName}`,
        entryType: 'egreso',
        transactionDate: purchaseDate ? new Date(purchaseDate) : new Date(),
        area: 'Compras',
        subarea: 'Compras Generales',
        porRealizar: false,
        internalId: ledgerInternalId,
        transactionType: 'COMPRA',
        purchaseId: purchase.id,
        supplierId: parseInt(supplierId),
        paymentStatus: calculatePaymentStatus(amountPaid ? parseFloat(amountPaid) : 0, total),
        amountPaid: amountPaid ? parseFloat(amountPaid) : 0,
        formaDePago: 'transferencia'
      }
    });

    return NextResponse.json({ data: purchase }, { status: 201 });
  } catch (error: any) {
    console.error('Error al crear compra:', error);
    console.error('Error details:', JSON.stringify(error, null, 2));

    if (error.message.includes('Doctor') || error.message.includes('access required')) {
      return NextResponse.json(
        { error: error.message },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: 'Error interno del servidor', details: error.message },
      { status: 500 }
    );
  }
}

// Función auxiliar para generar número de compra
async function generatePurchaseNumber(doctorId: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `CMP-${year}-`;

  // Obtener última compra del año
  const lastPurchase = await prisma.purchase.findFirst({
    where: {
      doctorId,
      purchaseNumber: {
        startsWith: prefix
      }
    },
    orderBy: {
      purchaseNumber: 'desc'
    }
  });

  let nextNumber = 1;
  if (lastPurchase) {
    const lastNumber = parseInt(lastPurchase.purchaseNumber.split('-')[2]);
    nextNumber = lastNumber + 1;
  }

  return `${prefix}${nextNumber.toString().padStart(3, '0')}`;
}
