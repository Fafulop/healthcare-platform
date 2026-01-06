import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { getAuthenticatedDoctor } from '@/lib/auth';

// GET /api/practice-management/cotizaciones/:id
// Obtener cotización específica
export async function GET(
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

    const quotation = await prisma.quotation.findFirst({
      where: {
        id: quotationId,
        doctorId: doctor.id
      },
      include: {
        client: true,
        items: {
          include: {
            product: true
          },
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

    return NextResponse.json({ data: quotation });
  } catch (error: any) {
    console.error('Error al obtener cotización:', error);

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

// PUT /api/practice-management/cotizaciones/:id
// Actualizar cotización
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { doctor } = await getAuthenticatedDoctor(request);
    const resolvedParams = await params;
    const quotationId = parseInt(resolvedParams.id);
    const body = await request.json();

    if (isNaN(quotationId)) {
      return NextResponse.json(
        { error: 'ID de cotización inválido' },
        { status: 400 }
      );
    }

    // Verificar propiedad
    const existingQuotation = await prisma.quotation.findFirst({
      where: {
        id: quotationId,
        doctorId: doctor.id
      }
    });

    if (!existingQuotation) {
      return NextResponse.json(
        { error: 'Cotización no encontrada' },
        { status: 404 }
      );
    }

    const {
      clientId,
      issueDate,
      validUntil,
      items,
      notes,
      termsAndConditions,
      taxRate,
      status
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
    const quotationItems = items.map((item: any, index: number) => {
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
    // Total = subtotal (already discounted) + totalTax
    const total = subtotal + totalTax;

    // Eliminar items existentes y crear nuevos
    await prisma.quotationItem.deleteMany({
      where: { quotationId }
    });

    // Actualizar cotización
    const quotation = await prisma.quotation.update({
      where: { id: quotationId },
      data: {
        clientId: clientId ? parseInt(clientId) : existingQuotation.clientId,
        issueDate: issueDate ? new Date(issueDate) : existingQuotation.issueDate,
        validUntil: validUntil ? new Date(validUntil) : existingQuotation.validUntil,
        status: status || existingQuotation.status,
        subtotal,
        taxRate: taxRateValue,
        tax: totalTax,
        total,
        notes: notes?.trim() || null,
        termsAndConditions: termsAndConditions?.trim() || null,
        items: {
          create: quotationItems
        }
      },
      include: {
        client: true,
        items: {
          include: {
            product: true
          },
          orderBy: { order: 'asc' }
        }
      }
    });

    return NextResponse.json({ data: quotation });
  } catch (error: any) {
    console.error('Error al actualizar cotización:', error);

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

// DELETE /api/practice-management/cotizaciones/:id
// Eliminar cotización
export async function DELETE(
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

    // Verificar propiedad
    const existingQuotation = await prisma.quotation.findFirst({
      where: {
        id: quotationId,
        doctorId: doctor.id
      }
    });

    if (!existingQuotation) {
      return NextResponse.json(
        { error: 'Cotización no encontrada' },
        { status: 404 }
      );
    }

    // Eliminar cotización (cascada a items)
    await prisma.quotation.delete({
      where: { id: quotationId }
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    console.error('Error al eliminar cotización:', error);

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
