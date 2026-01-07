import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { getAuthenticatedDoctor } from '@/lib/auth';

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
        facturasXml: true
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
        transactionDate: new Date(transactionDate),
        area: area.trim(),
        subarea: subarea.trim(),
        porRealizar: porRealizar !== undefined ? porRealizar : existingEntry.porRealizar
      },
      include: {
        attachments: true,
        facturas: true,
        facturasXml: true
      }
    });

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

    // Delete ledger entry (cascades to attachments, facturas, facturasXml)
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

    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
