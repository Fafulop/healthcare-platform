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

// Helper function to generate internal ID
async function generateInternalId(doctorId: string, entryType: string): Promise<string> {
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

// Helper function to generate sale number
async function generateSaleNumber(doctorId: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `VTA-${year}-`;

  const lastSale = await prisma.sale.findFirst({
    where: {
      doctorId,
      saleNumber: { startsWith: prefix }
    },
    orderBy: { saleNumber: 'desc' }
  });

  let nextNumber = 1;
  if (lastSale) {
    const lastNumber = parseInt(lastSale.saleNumber.split('-')[2]);
    nextNumber = lastNumber + 1;
  }

  return `${prefix}${nextNumber.toString().padStart(3, '0')}`;
}

// Helper function to generate purchase number
async function generatePurchaseNumber(doctorId: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `CMP-${year}-`;

  const lastPurchase = await prisma.purchase.findFirst({
    where: {
      doctorId,
      purchaseNumber: { startsWith: prefix }
    },
    orderBy: { purchaseNumber: 'desc' }
  });

  let nextNumber = 1;
  if (lastPurchase) {
    const lastNumber = parseInt(lastPurchase.purchaseNumber.split('-')[2]);
    nextNumber = lastNumber + 1;
  }

  return `${prefix}${nextNumber.toString().padStart(3, '0')}`;
}

// GET /api/practice-management/ledger
// Get all ledger entries for authenticated doctor with optional filtering
export async function GET(request: NextRequest) {
  try {
    const { doctor } = await getAuthenticatedDoctor(request);
    const { searchParams } = new URL(request.url);

    const entryType = searchParams.get('entryType');
    const area = searchParams.get('area');
    const subarea = searchParams.get('subarea');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const porRealizar = searchParams.get('porRealizar');
    const bankAccount = searchParams.get('bankAccount');
    const search = searchParams.get('search');

    const where: any = { doctorId: doctor.id };

    // Filter by entry type
    if (entryType && ['ingreso', 'egreso'].includes(entryType)) {
      where.entryType = entryType;
    }

    // Filter by area
    if (area) {
      where.area = area;
    }

    // Filter by subarea
    if (subarea) {
      where.subarea = subarea;
    }

    // Filter by date range
    if (startDate || endDate) {
      where.transactionDate = {};
      if (startDate) {
        where.transactionDate.gte = new Date(startDate);
      }
      if (endDate) {
        where.transactionDate.lte = new Date(endDate);
      }
    }

    // Filter by por realizar
    if (porRealizar) {
      where.porRealizar = porRealizar === 'true';
    }

    // Filter by bank account
    if (bankAccount) {
      where.bankAccount = bankAccount;
    }

    // Search across concept and internal ID
    if (search) {
      where.OR = [
        { concept: { contains: search, mode: 'insensitive' } },
        { internalId: { contains: search, mode: 'insensitive' } }
      ];
    }

    const entries = await prisma.ledgerEntry.findMany({
      where,
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
      },
      orderBy: { transactionDate: 'desc' }
    });

    return NextResponse.json({ data: entries });
  } catch (error: any) {
    console.error('Error fetching ledger entries:', error);

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

// POST /api/practice-management/ledger
// Create a new ledger entry for authenticated doctor
export async function POST(request: NextRequest) {
  try {
    const { doctor } = await getAuthenticatedDoctor(request);
    const body = await request.json();

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
      transactionType,
      clientId,
      supplierId,
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

    // Concept is optional, but if provided, must be a string and not exceed 500 chars
    if (concept && typeof concept === 'string' && concept.length > 500) {
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

    // TransactionDate defaults to today if not provided
    // Extract YYYY-MM-DD portion to avoid timezone shift when parsing
    const rawTransactionDate = transactionDate || new Date().toISOString().split('T')[0];
    const finalTransactionDate = rawTransactionDate.split('T')[0];

    // Area and subarea are optional - validate format if provided
    if (area !== undefined && area !== null && typeof area !== 'string') {
      return NextResponse.json(
        { error: 'El área debe ser texto' },
        { status: 400 }
      );
    }

    if (subarea !== undefined && subarea !== null && typeof subarea !== 'string') {
      return NextResponse.json(
        { error: 'La subárea debe ser texto' },
        { status: 400 }
      );
    }

    // Validate transaction type and related fields
    const txType = transactionType || 'N/A';
    if (!['N/A', 'COMPRA', 'VENTA'].includes(txType)) {
      return NextResponse.json(
        { error: 'Tipo de transacción inválido' },
        { status: 400 }
      );
    }

    // If VENTA, require clientId and paymentStatus
    if (txType === 'VENTA') {
      if (!clientId) {
        return NextResponse.json(
          { error: 'El cliente es requerido para ventas' },
          { status: 400 }
        );
      }
      if (!paymentStatus || !['PENDING', 'PARTIAL', 'PAID'].includes(paymentStatus)) {
        return NextResponse.json(
          { error: 'Estado de pago requerido y debe ser PENDING, PARTIAL o PAID' },
          { status: 400 }
        );
      }
    }

    // If COMPRA, require supplierId and paymentStatus
    if (txType === 'COMPRA') {
      if (!supplierId) {
        return NextResponse.json(
          { error: 'El proveedor es requerido para compras' },
          { status: 400 }
        );
      }
      if (!paymentStatus || !['PENDING', 'PARTIAL', 'PAID'].includes(paymentStatus)) {
        return NextResponse.json(
          { error: 'Estado de pago requerido y debe ser PENDING, PARTIAL, PAID' },
          { status: 400 }
        );
      }
    }

    // Validate formaDePago if provided
    if (formaDePago && !['efectivo', 'transferencia', 'tarjeta', 'cheque', 'deposito'].includes(formaDePago)) {
      return NextResponse.json(
        { error: 'Forma de pago inválida' },
        { status: 400 }
      );
    }

    // Generate or validate internal ID
    let finalInternalId = internalId?.trim();

    if (!finalInternalId) {
      finalInternalId = await generateInternalId(doctor.id, entryType);
    }

    // Check uniqueness of internal ID
    const existingEntry = await prisma.ledgerEntry.findFirst({
      where: {
        doctorId: doctor.id,
        internalId: finalInternalId
      }
    });

    if (existingEntry) {
      return NextResponse.json(
        { error: 'El ID interno ya existe' },
        { status: 409 }
      );
    }

    let saleId: number | null = null;
    let purchaseId: number | null = null;

    // SCENARIO B: Create Sale if transactionType is VENTA
    if (txType === 'VENTA') {
      const saleNumber = await generateSaleNumber(doctor.id);

      const sale = await prisma.sale.create({
        data: {
          doctorId: doctor.id,
          clientId: parseInt(clientId),
          saleNumber,
          saleDate: new Date(finalTransactionDate + 'T12:00:00'),
          status: 'CONFIRMED',
          paymentStatus: paymentStatus,
          amountPaid: amountPaid ? parseFloat(amountPaid) : (paymentStatus === 'PAID' ? amount : 0),
          subtotal: amount / 1.16, // Assuming 16% tax
          taxRate: 0.16,
          tax: amount - (amount / 1.16),
          total: amount,
          notes: concept?.trim() || null,
          items: {
            create: [{
              itemType: 'service',
              description: concept?.trim() || 'Servicio desde Flujo de Dinero',
              quantity: 1,
              unit: 'servicio',
              unitPrice: amount / 1.16,
              discountRate: 0,
              taxRate: 0.16,
              taxAmount: amount - (amount / 1.16),
              subtotal: amount / 1.16,
              order: 0
            }]
          }
        }
      });

      saleId = sale.id;
    }

    // SCENARIO C: Create Purchase if transactionType is COMPRA
    if (txType === 'COMPRA') {
      const purchaseNumber = await generatePurchaseNumber(doctor.id);

      const purchase = await prisma.purchase.create({
        data: {
          doctorId: doctor.id,
          supplierId: parseInt(supplierId),
          purchaseNumber,
          purchaseDate: new Date(finalTransactionDate + 'T12:00:00'),
          status: 'CONFIRMED',
          paymentStatus: paymentStatus,
          amountPaid: amountPaid ? parseFloat(amountPaid) : (paymentStatus === 'PAID' ? amount : 0),
          subtotal: amount / 1.16, // Assuming 16% tax
          taxRate: 0.16,
          tax: amount - (amount / 1.16),
          total: amount,
          notes: concept?.trim() || null,
          items: {
            create: [{
              itemType: 'service',
              description: concept?.trim() || 'Servicio desde Flujo de Dinero',
              quantity: 1,
              unit: 'servicio',
              unitPrice: amount / 1.16,
              discountRate: 0,
              taxRate: 0.16,
              taxAmount: amount - (amount / 1.16),
              subtotal: amount / 1.16,
              order: 0
            }]
          }
        }
      });

      purchaseId = purchase.id;
    }

    // Create ledger entry
    const entry = await prisma.ledgerEntry.create({
      data: {
        doctorId: doctor.id,
        amount: amount,
        concept: concept?.trim() || '',
        bankAccount: bankAccount?.trim() || null,
        formaDePago: formaDePago || 'efectivo',
        internalId: finalInternalId,
        bankMovementId: bankMovementId?.trim() || null,
        entryType: entryType,
        transactionDate: new Date(finalTransactionDate + 'T12:00:00'),
        area: area?.trim() || null,
        subarea: subarea?.trim() || null,
        porRealizar: porRealizar || false,
        transactionType: txType,
        saleId: saleId,
        purchaseId: purchaseId,
        clientId: clientId ? parseInt(clientId) : null,
        supplierId: supplierId ? parseInt(supplierId) : null,
        paymentStatus: calculatePaymentStatus(amountPaid ? parseFloat(amountPaid) : 0, amount),
        amountPaid: amountPaid ? parseFloat(amountPaid) : 0
      },
      include: {
        attachments: true,
        facturas: true,
        facturasXml: true,
        client: true,
        supplier: true,
        sale: true,
        purchase: true
      }
    });

    return NextResponse.json({ data: entry }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating ledger entry:', error);

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
      { error: 'Error interno del servidor', details: error.message },
      { status: 500 }
    );
  }
}
