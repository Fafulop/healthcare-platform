import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { getAuthenticatedDoctor } from '@/lib/auth';

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

    // Generar número de venta
    const saleNumber = await generateSaleNumber(doctor.id);

    // Calcular totales (reusar cálculos de la cotización)
    const subtotal = parseFloat(quotation.subtotal.toString());
    const tax = quotation.tax ? parseFloat(quotation.tax.toString()) : 0;
    const total = parseFloat(quotation.total.toString());

    // Convertir items de cotización a items de venta
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
      order: index
    }));

    // Crear venta vinculada a la cotización
    const sale = await prisma.sale.create({
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
        items: {
          create: saleItems
        }
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

    return NextResponse.json({ data: sale }, { status: 201 });
  } catch (error: any) {
    console.error('Error al convertir cotización a venta:', error);
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
async function generateSaleNumber(doctorId: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `VTA-${year}-`;

  const lastSale = await prisma.sale.findFirst({
    where: {
      doctorId,
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
    nextNumber = lastNumber + 1;
  }

  return `${prefix}${nextNumber.toString().padStart(3, '0')}`;
}
