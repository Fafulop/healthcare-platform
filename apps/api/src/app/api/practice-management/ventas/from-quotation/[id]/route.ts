import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { getAuthenticatedDoctor } from '@/lib/auth';
import { generateSaleNumber, generateLedgerInternalId } from '@/lib/practice-utils';

// POST /api/practice-management/ventas/from-quotation/:id
// Convertir cotización a venta
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { doctor } = await getAuthenticatedDoctor(request);
    const resolvedParams = await params;
    const quotationId = parseInt(resolvedParams.id);

    if (isNaN(quotationId)) {
      return NextResponse.json(
        { error: 'ID de cotización inválido' },
        { status: 400 }
      );
    }

    // Verificar que la cotización pertenece al doctor
    const quotation = await prisma.quotation.findFirst({
      where: {
        id: quotationId,
        doctorId: doctor.id
      },
      include: {
        items: {
          orderBy: { order: 'asc' }
        }
      }
    });

    if (!quotation) {
      return NextResponse.json(
        { error: 'Cotización no encontrada' },
        { status: 404 }
      );
    }

    const subtotal = parseFloat(quotation.subtotal.toString());
    const tax = quotation.tax ? parseFloat(quotation.tax.toString()) : 0;
    const total = parseFloat(quotation.total.toString());

    const saleItems = quotation.items.map((item, index) => ({
      productId: item.productId,
      itemType: item.itemType,
      description: item.description,
      sku: item.sku,
      quantity: parseFloat(item.quantity.toString()),
      unit: item.unit,
      unitPrice: parseFloat(item.unitPrice.toString()),
      discountRate: item.discountRate ? parseFloat(item.discountRate.toString()) : 0,
      taxRate: item.taxRate ? parseFloat(item.taxRate.toString()) : 0.16,
      taxAmount: item.taxAmount ? parseFloat(item.taxAmount.toString()) : 0,
      subtotal: parseFloat(item.subtotal.toString()),
      order: index,
    }));

    // Retry loop to handle race conditions on saleNumber unique constraint
    // Number generation must be OUTSIDE the transaction so each retry reads fresh DB state
    let sale: any = null;
    for (let attempt = 0; attempt < 10; attempt++) {
      try {
        const saleNumber = await generateSaleNumber(doctor.id);
        const ledgerInternalId = await generateLedgerInternalId(doctor.id, 'ingreso');
        sale = await prisma.$transaction(async (tx) => {
          const newSale = await tx.sale.create({
            data: {
              doctorId: doctor.id,
              clientId: quotation.clientId,
              quotationId: quotation.id,
              saleNumber,
              saleDate: new Date(),
              deliveryDate: null,
              status: 'PENDING',
              paymentStatus: 'PENDING',
              amountPaid: 0,
              subtotal,
              taxRate: quotation.taxRate ? parseFloat(quotation.taxRate.toString()) : 0.16,
              tax,
              total,
              notes: quotation.notes,
              termsAndConditions: quotation.termsAndConditions,
              items: { create: saleItems },
            },
            include: {
              client: true,
              quotation: { select: { id: true, quotationNumber: true, issueDate: true } },
              items: { include: { product: true }, orderBy: { order: 'asc' } },
            },
          });

          const client = await tx.client.findUnique({ where: { id: quotation.clientId } });

          await tx.ledgerEntry.create({
            data: {
              doctorId: doctor.id,
              amount: total,
              concept: `Venta ${saleNumber} - Cliente: ${client?.businessName || 'Sin nombre'}`,
              entryType: 'ingreso',
              transactionDate: new Date(),
              area: 'Ventas',
              subarea: 'Ventas Generales',
              porRealizar: false,
              internalId: ledgerInternalId,
              transactionType: 'VENTA',
              saleId: newSale.id,
              clientId: quotation.clientId,
              paymentStatus: 'PENDING',
              amountPaid: 0,
              formaDePago: 'transferencia',
            },
          });

          // Auto-approve the quotation
          await tx.quotation.update({
            where: { id: quotationId },
            data: { status: 'APPROVED' },
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

    return NextResponse.json({ data: sale }, { status: 201 });
  } catch (error: any) {
    console.error('Error al convertir cotización a venta:', error);
    if (error.message?.includes('Doctor') || error.message?.includes('access required')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: error.message || 'Error interno del servidor', code: error.code }, { status: 500 });
  }
}


