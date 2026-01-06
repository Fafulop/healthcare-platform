import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { getAuthenticatedDoctor } from '@/lib/auth';

// GET /api/practice-management/cotizaciones
// Obtener todas las cotizaciones del doctor con filtros opcionales
export async function GET(request: NextRequest) {
  try {
    const { doctor } = await getAuthenticatedDoctor(request);
    const { searchParams } = new URL(request.url);

    const status = searchParams.get('status');
    const clientId = searchParams.get('clientId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const search = searchParams.get('search');

    const where: any = { doctorId: doctor.id };

    // Filtrar por estado
    if (status && status !== 'all') {
      where.status = status;
    }

    // Filtrar por cliente
    if (clientId) {
      where.clientId = parseInt(clientId);
    }

    // Filtrar por rango de fechas
    if (startDate || endDate) {
      where.issueDate = {};
      if (startDate) {
        where.issueDate.gte = new Date(startDate);
      }
      if (endDate) {
        where.issueDate.lte = new Date(endDate);
      }
    }

    // Buscar por número de cotización o nombre de cliente
    if (search) {
      where.OR = [
        { quotationNumber: { contains: search, mode: 'insensitive' } },
        { client: { businessName: { contains: search, mode: 'insensitive' } } }
      ];
    }

    const quotations = await prisma.quotation.findMany({
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
      orderBy: { issueDate: 'desc' }
    });

    return NextResponse.json({ data: quotations });
  } catch (error: any) {
    console.error('Error al obtener cotizaciones:', error);

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

// POST /api/practice-management/cotizaciones
// Crear nueva cotización
export async function POST(request: NextRequest) {
  try {
    const { doctor } = await getAuthenticatedDoctor(request);
    const body = await request.json();

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

    // Generar número de cotización
    const quotationNumber = await generateQuotationNumber(doctor.id);

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

    // Crear cotización
    const quotation = await prisma.quotation.create({
      data: {
        doctorId: doctor.id,
        clientId: parseInt(clientId),
        quotationNumber,
        issueDate: issueDate ? new Date(issueDate) : new Date(),
        validUntil: validUntil ? new Date(validUntil) : getDefaultValidUntil(),
        status: status || 'DRAFT',
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

    return NextResponse.json({ data: quotation }, { status: 201 });
  } catch (error: any) {
    console.error('Error al crear cotización:', error);
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

// Función auxiliar para generar número de cotización
async function generateQuotationNumber(doctorId: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `COT-${year}-`;

  // Obtener última cotización del año
  const lastQuotation = await prisma.quotation.findFirst({
    where: {
      doctorId,
      quotationNumber: {
        startsWith: prefix
      }
    },
    orderBy: {
      quotationNumber: 'desc'
    }
  });

  let nextNumber = 1;
  if (lastQuotation) {
    const lastNumber = parseInt(lastQuotation.quotationNumber.split('-')[2]);
    nextNumber = lastNumber + 1;
  }

  return `${prefix}${nextNumber.toString().padStart(3, '0')}`;
}

// Función auxiliar para calcular fecha de vencimiento por defecto (30 días)
function getDefaultValidUntil(): Date {
  const date = new Date();
  date.setDate(date.getDate() + 30);
  return date;
}
