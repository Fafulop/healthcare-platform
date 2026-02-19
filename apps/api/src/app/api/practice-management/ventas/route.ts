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

// GET /api/practice-management/ventas
// Obtener todas las ventas del doctor con filtros opcionales
export async function GET(request: NextRequest) {
  try {
    const { doctor } = await getAuthenticatedDoctor(request);
    const { searchParams } = new URL(request.url);

    const status = searchParams.get('status');
    const paymentStatus = searchParams.get('paymentStatus');
    const clientId = searchParams.get('clientId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const search = searchParams.get('search');

    const where: any = { doctorId: doctor.id };

    // Filtrar por estado de venta
    if (status && status !== 'all') {
      where.status = status;
    }

    // Filtrar por estado de pago
    if (paymentStatus && paymentStatus !== 'all') {
      where.paymentStatus = paymentStatus;
    }

    // Filtrar por cliente
    if (clientId) {
      where.clientId = parseInt(clientId);
    }

    // Filtrar por rango de fechas
    if (startDate || endDate) {
      where.saleDate = {};
      if (startDate) {
        where.saleDate.gte = new Date(startDate);
      }
      if (endDate) {
        where.saleDate.lte = new Date(endDate);
      }
    }

    // Buscar por número de venta o nombre de cliente
    if (search) {
      where.OR = [
        { saleNumber: { contains: search, mode: 'insensitive' } },
        { client: { businessName: { contains: search, mode: 'insensitive' } } }
      ];
    }

    const sales = await prisma.sale.findMany({
      where,
      include: {
        client: {
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
      orderBy: { saleDate: 'desc' }
    });

    return NextResponse.json({ data: sales });
  } catch (error: any) {
    console.error('Error al obtener ventas:', error);

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

// POST /api/practice-management/ventas
// Crear nueva venta
export async function POST(request: NextRequest) {
  try {
    const { doctor } = await getAuthenticatedDoctor(request);
    const body = await request.json();

    const {
      clientId,
      quotationId,
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

    // Validación
    if (!clientId) {
      return NextResponse.json(
        { error: 'El cliente es requerido' },
        { status: 400 }
      );
    }

    if (!items || items.length === 0) {
      return NextResponse.json(
        { error: 'Debe agregar al menos un producto o servicio' },
        { status: 400 }
      );
    }

    // Verificar que el cliente pertenece al doctor
    const client = await prisma.client.findFirst({
      where: {
        id: parseInt(clientId),
        doctorId: doctor.id
      }
    });

    if (!client) {
      return NextResponse.json(
        { error: 'Cliente no encontrado' },
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

    // Crear venta con retry para manejar race conditions en sale_number
    let sale: any = null;
    let saleNumber = '';
    for (let attempt = 0; attempt < 10; attempt++) {
      saleNumber = await generateSaleNumber();
      try {
        sale = await prisma.sale.create({
          data: {
            doctorId: doctor.id,
            clientId: parseInt(clientId),
            quotationId: quotationId ? parseInt(quotationId) : null,
            saleNumber,
            saleDate: saleDate ? new Date(saleDate) : new Date(),
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
        break;
      } catch (e: any) {
        if (e.code === 'P2002' && e.meta?.target?.includes('sale_number')) {
          continue;
        }
        throw e;
      }
    }
    if (!sale) throw new Error('No se pudo generar un número de venta único');

    // AUTO-CREATE LEDGER ENTRY for the sale
    const ledgerInternalId = await generateLedgerInternalId(doctor.id, 'ingreso');
    await prisma.ledgerEntry.create({
      data: {
        doctorId: doctor.id,
        amount: total,
        concept: `Venta ${saleNumber} - Cliente: ${client.businessName}`,
        entryType: 'ingreso',
        transactionDate: saleDate ? new Date(saleDate) : new Date(),
        area: 'Ventas',
        subarea: 'Ventas Generales',
        porRealizar: false,
        internalId: ledgerInternalId,
        transactionType: 'VENTA',
        saleId: sale.id,
        clientId: parseInt(clientId),
        paymentStatus: calculatePaymentStatus(amountPaid ? parseFloat(amountPaid) : 0, total),
        amountPaid: amountPaid ? parseFloat(amountPaid) : 0,
        formaDePago: 'transferencia'
      }
    });

    return NextResponse.json({ data: sale }, { status: 201 });
  } catch (error: any) {
    console.error('Error al crear venta:', error);
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

// Función auxiliar para generar número de venta
// Queries globally (not per-doctor) since sale_number has a global unique constraint
async function generateSaleNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `VTA-${year}-`;

  const lastSale = await prisma.sale.findFirst({
    where: {
      saleNumber: {
        startsWith: prefix
      }
    },
    orderBy: {
      saleNumber: 'desc'
    }
  });

  let nextNumber = 1;
  if (lastSale) {
    const lastNumber = parseInt(lastSale.saleNumber.split('-')[2]);
    if (!isNaN(lastNumber)) nextNumber = lastNumber + 1;
  }

  return `${prefix}${nextNumber.toString().padStart(3, '0')}`;
}
