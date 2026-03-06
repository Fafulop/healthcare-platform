import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { getAuthenticatedDoctor } from '@/lib/auth';
import {
  calculatePaymentStatus,
  generatePurchaseNumber,
  generateLedgerInternalId,
  computeItemTotals,
  parsePagination,
  buildPaginationMeta,
} from '@/lib/practice-utils';

// GET /api/practice-management/compras
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

    if (status && status !== 'all') where.status = status;
    if (paymentStatus && paymentStatus !== 'all') where.paymentStatus = paymentStatus;
    if (supplierId) where.supplierId = parseInt(supplierId);

    if (startDate || endDate) {
      where.purchaseDate = {};
      if (startDate) where.purchaseDate.gte = new Date(startDate);
      if (endDate) where.purchaseDate.lte = new Date(endDate);
    }

    if (search) {
      where.OR = [
        { purchaseNumber: { contains: search, mode: 'insensitive' } },
        { supplier: { businessName: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const pagination = parsePagination(searchParams);
    const [total, purchases] = await prisma.$transaction([
      prisma.purchase.count({ where }),
      prisma.purchase.findMany({
        where,
        include: {
          supplier: {
            select: { id: true, businessName: true, contactName: true, email: true, phone: true },
          },
          quotation: { select: { id: true, quotationNumber: true } },
          items: {
            include: { product: { select: { id: true, name: true, sku: true } } },
            orderBy: { order: 'asc' },
          },
        },
        orderBy: { purchaseDate: 'desc' },
        skip: pagination.skip,
        take: pagination.limit,
      }),
    ]);

    return NextResponse.json({ data: purchases, pagination: buildPaginationMeta(total, pagination) });
  } catch (error: any) {
    console.error('Error al obtener compras:', error);
    if (error.message?.includes('Doctor') || error.message?.includes('access required')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// POST /api/practice-management/compras
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
      amountPaid,
      formaDePago,
    } = body;

    if (!supplierId) {
      return NextResponse.json({ error: 'El proveedor es requerido' }, { status: 400 });
    }
    if (!items || items.length === 0) {
      return NextResponse.json(
        { error: 'Debe agregar al menos un producto o servicio' },
        { status: 400 }
      );
    }

    // Verify supplier ownership
    const supplier = await prisma.proveedor.findFirst({
      where: { id: parseInt(supplierId), doctorId: doctor.id },
    });
    if (!supplier) {
      return NextResponse.json({ error: 'Proveedor no encontrado' }, { status: 404 });
    }

    // Verify quotation ownership if provided
    if (quotationId) {
      const quotation = await prisma.quotation.findFirst({
        where: { id: parseInt(quotationId), doctorId: doctor.id },
      });
      if (!quotation) {
        return NextResponse.json({ error: 'Cotización no encontrada' }, { status: 404 });
      }
    }

    const { subtotal, totalTax, total, items: purchaseItems } = computeItemTotals(items);
    const taxRateValue = taxRate !== undefined ? parseFloat(taxRate) : 0.16;
    const paidAmount = amountPaid ? parseFloat(amountPaid) : 0;
    const purchaseDateValue = purchaseDate ? new Date(purchaseDate) : new Date();

    const purchase = await prisma.$transaction(async (tx) => {
      const purchaseNumber = await generatePurchaseNumber(doctor.id, tx);
      const ledgerInternalId = await generateLedgerInternalId(doctor.id, 'egreso', tx);

      const newPurchase = await tx.purchase.create({
        data: {
          doctorId: doctor.id,
          supplierId: parseInt(supplierId),
          quotationId: quotationId ? parseInt(quotationId) : null,
          purchaseNumber,
          purchaseDate: purchaseDateValue,
          deliveryDate: deliveryDate ? new Date(deliveryDate) : null,
          status: status || 'PENDING',
          paymentStatus: calculatePaymentStatus(paidAmount, total),
          amountPaid: paidAmount,
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

      await tx.ledgerEntry.create({
        data: {
          doctorId: doctor.id,
          amount: total,
          concept: `Compra ${purchaseNumber} - Proveedor: ${supplier.businessName}`,
          entryType: 'egreso',
          transactionDate: purchaseDateValue,
          area: 'Compras',
          subarea: 'Compras Generales',
          porRealizar: false,
          internalId: ledgerInternalId,
          transactionType: 'COMPRA',
          purchaseId: newPurchase.id,
          supplierId: parseInt(supplierId),
          paymentStatus: calculatePaymentStatus(paidAmount, total),
          amountPaid: paidAmount,
          formaDePago: formaDePago || 'transferencia',
        },
      });

      return newPurchase;
    });

    return NextResponse.json({ data: purchase }, { status: 201 });
  } catch (error: any) {
    console.error('Error al crear compra:', error);
    if (error.message?.includes('Doctor') || error.message?.includes('access required')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: 'Error interno del servidor', details: error.message },
      { status: 500 }
    );
  }
}
