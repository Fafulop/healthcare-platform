import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { getAuthenticatedDoctor } from '@/lib/auth';
import {
  calculatePaymentStatus,
  generateSaleNumber,
  generateLedgerInternalId,
  computeItemTotals,
  parsePagination,
  buildPaginationMeta,
  getDefaultArea,
  withSalePatients,
  resolveSalePatient,
  salePatientName, VALID_FORMAS_DE_PAGO } from '@/lib/practice-utils';

// GET /api/practice-management/ventas
export async function GET(request: NextRequest) {
  try {
    const { doctor } = await getAuthenticatedDoctor(request);
    const { searchParams } = new URL(request.url);

    const status = searchParams.get('status');
    const paymentStatus = searchParams.get('paymentStatus');
    const clientId = searchParams.get('clientId');
    const patientId = searchParams.get('patientId');
    const visitaId = searchParams.get('visitaId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const search = searchParams.get('search');

    const where: any = { doctorId: doctor.id };

    if (status && status !== 'all') where.status = status;
    if (paymentStatus && paymentStatus !== 'all') where.paymentStatus = paymentStatus;
    if (clientId) where.clientId = parseInt(clientId);
    if (patientId) where.patientId = patientId;
    if (visitaId) where.visitaId = visitaId;

    if (startDate || endDate) {
      where.saleDate = {};
      if (startDate) where.saleDate.gte = new Date(startDate);
      if (endDate) where.saleDate.lte = new Date(endDate);
    }

    if (search) {
      // The patient is a plain link (no relation to filter through): match names first, then ids.
      const words = search.trim().split(/\s+/).filter(Boolean);
      const matchingPatients = words.length
        ? await prisma.patient.findMany({
            where: {
              doctorId: doctor.id,
              AND: words.map((w) => ({
                OR: [
                  { firstName: { contains: w, mode: 'insensitive' as const } },
                  { lastName: { contains: w, mode: 'insensitive' as const } },
                ],
              })),
            },
            select: { id: true },
            take: 200,
          })
        : [];
      where.OR = [
        { saleNumber: { contains: search, mode: 'insensitive' } },
        { client: { businessName: { contains: search, mode: 'insensitive' } } },
        ...(matchingPatients.length ? [{ patientId: { in: matchingPatients.map((p) => p.id) } }] : []),
      ];
    }

    const pagination = parsePagination(searchParams);
    const [total, sales] = await prisma.$transaction([
      prisma.sale.count({ where }),
      prisma.sale.findMany({
        where,
        include: {
          client: {
            select: { id: true, businessName: true, contactName: true, email: true, phone: true },
          },
          quotation: { select: { id: true, quotationNumber: true } },
          items: {
            include: { product: { select: { id: true, name: true, sku: true } } },
            orderBy: { order: 'asc' },
          },
        },
        orderBy: { saleDate: 'desc' },
        skip: pagination.skip,
        take: pagination.limit,
      }),
    ]);

    return NextResponse.json({
      data: await withSalePatients(doctor.id, sales),
      pagination: buildPaginationMeta(total, pagination),
    });
  } catch (error: any) {
    console.error('Error al obtener ventas:', error);
    if (error.message?.includes('Doctor') || error.message?.includes('access required')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// POST /api/practice-management/ventas
export async function POST(request: NextRequest) {
  try {
    const { doctor } = await getAuthenticatedDoctor(request);
    const body = await request.json();

    const {
      patientId,
      visitaId,
      quotationId,
      saleDate,
      deliveryDate,
      items,
      notes,
      termsAndConditions,
      taxRate,
      status,
      amountPaid,
      formaDePago,
    } = body;

    if (!items || items.length === 0) {
      return NextResponse.json(
        { error: 'Debe agregar al menos un producto o servicio' },
        { status: 400 }
      );
    }

    // VENTAS PACIENTE paso 3: the buyer is ALWAYS a patient (the old form made a name-matched copy of
    // the patient in `clients`). Ownership of patient + visita checked.
    const paciente = await resolveSalePatient(doctor.id, patientId, visitaId);
    if ('error' in paciente) {
      return NextResponse.json({ error: paciente.error }, { status: paciente.status });
    }
    const buyerName = salePatientName(paciente.patient);

    // Verify quotation ownership if provided
    if (quotationId) {
      const quotation = await prisma.quotation.findFirst({
        where: { id: parseInt(quotationId), doctorId: doctor.id },
      });
      if (!quotation) {
        return NextResponse.json({ error: 'Cotización no encontrada' }, { status: 404 });
      }
    }

    const { subtotal, totalTax, total, items: saleItems } = computeItemTotals(items);
    const taxRateValue = taxRate !== undefined ? parseFloat(taxRate) : 0.16;
    const paidAmount = amountPaid ? parseFloat(amountPaid) : 0;
    const saleDateValue = saleDate ? new Date(saleDate) : new Date();

    // Retry loop to handle race conditions on saleNumber unique constraint
    let sale: any = null;
    for (let attempt = 0; attempt < 10; attempt++) {
      try {
        sale = await prisma.$transaction(async (tx) => {
          const saleNumber = await generateSaleNumber(doctor.id, tx);
          const ledgerInternalId = await generateLedgerInternalId(doctor.id, 'ingreso', tx);

          const newSale = await tx.sale.create({
            data: {
              doctorId: doctor.id,
              patientId: paciente.patient.id,
              visitaId: paciente.visitaId,
              quotationId: quotationId ? parseInt(quotationId) : null,
              saleNumber,
              saleDate: saleDateValue,
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
              items: { create: saleItems },
            },
            include: {
              client: true,
              quotation: true,
              items: { include: { product: true }, orderBy: { order: 'asc' } },
            },
          });

          const defaultArea = await getDefaultArea(doctor.id, 'INGRESO', tx);

          await tx.ledgerEntry.create({
            data: {
              doctorId: doctor.id,
              amount: total,
              concept: `Venta ${saleNumber} - Paciente: ${buyerName}`,
              entryType: 'ingreso',
              transactionDate: saleDateValue,
              area: defaultArea.area,
              subarea: defaultArea.subarea,
              porRealizar: false,
              internalId: ledgerInternalId,
              transactionType: 'VENTA',
              saleId: newSale.id,
              patientId: paciente.patient.id,
              // Same as a cita's entry: Flujo de Dinero shows this name (patient sales have no client).
              counterpartyName: buyerName,
              paymentStatus: calculatePaymentStatus(paidAmount, total),
              amountPaid: paidAmount,
              // H-001: la elige el formulario de la venta; sin una válida, «efectivo» (como la cita y la BD).
              formaDePago: VALID_FORMAS_DE_PAGO.includes(formaDePago) ? formaDePago : 'efectivo',
              origin: 'venta',
            },
          });

          return newSale;
        });
        break;
      } catch (e: any) {
        if (e.code === 'P2002' && e.meta?.target?.includes('sale_number')) continue;
        throw e;
      }
    }
    if (!sale) throw new Error('No se pudo generar un número de venta único');

    return NextResponse.json({ data: { ...sale, patient: paciente.patient } }, { status: 201 });
  } catch (error: any) {
    console.error('Error al crear venta:', error);
    if (error.message?.includes('Doctor') || error.message?.includes('access required')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: 'Error interno del servidor', details: error.message },
      { status: 500 }
    );
  }
}
