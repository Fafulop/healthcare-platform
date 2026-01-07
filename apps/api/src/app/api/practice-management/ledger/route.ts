import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { getAuthenticatedDoctor } from '@/lib/auth';

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
        facturasXml: true
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
      porRealizar
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

    // Create ledger entry
    const entry = await prisma.ledgerEntry.create({
      data: {
        doctorId: doctor.id,
        amount: amount,
        concept: concept.trim(),
        bankAccount: bankAccount?.trim() || null,
        formaDePago: formaDePago || 'efectivo',
        internalId: finalInternalId,
        bankMovementId: bankMovementId?.trim() || null,
        entryType: entryType,
        transactionDate: new Date(transactionDate),
        area: area.trim(),
        subarea: subarea.trim(),
        porRealizar: porRealizar || false
      },
      include: {
        attachments: true,
        facturas: true,
        facturasXml: true
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
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
