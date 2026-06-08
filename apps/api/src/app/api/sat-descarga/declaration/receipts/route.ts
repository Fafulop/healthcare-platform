import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { getAuthenticatedDoctor } from '@/lib/auth';

/**
 * GET /api/sat-descarga/declaration/receipts?year=2026
 * Returns all declaration receipts for a year.
 */
export async function GET(request: NextRequest) {
  try {
    const { doctor } = await getAuthenticatedDoctor(request);
    const url = new URL(request.url);
    const year = parseInt(url.searchParams.get('year') || String(new Date().getFullYear()), 10);

    const receipts = await prisma.satDeclarationReceipt.findMany({
      where: { doctorId: doctor.id, year },
      orderBy: { month: 'asc' },
      select: {
        id: true,
        year: true,
        month: true,
        isrPagado: true,
        ivaPagado: true,
        pdfUrl: true,
        pdfFileName: true,
        notes: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      data: receipts.map(r => ({
        ...r,
        isrPagado: r.isrPagado ? Number(r.isrPagado) : null,
        ivaPagado: r.ivaPagado ? Number(r.ivaPagado) : null,
      })),
    });
  } catch (error: any) {
    if (error.name === 'AuthError') {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error fetching declaration receipts:', error);
    return NextResponse.json({ error: 'Error al obtener acuses' }, { status: 500 });
  }
}

/**
 * PUT /api/sat-descarga/declaration/receipts
 * Upsert a declaration receipt (amounts + PDF).
 *
 * Body: { year, month, isrPagado?, ivaPagado?, pdfUrl?, pdfFileName?, notes? }
 */
export async function PUT(request: NextRequest) {
  try {
    const { doctor } = await getAuthenticatedDoctor(request);
    const body = await request.json();
    const { year, month, isrPagado, ivaPagado, pdfUrl, pdfFileName, notes } = body;

    if (!year || !month || month < 1 || month > 13) {
      return NextResponse.json({ error: 'Año y mes requeridos (1-12 mensual, 13 anual)' }, { status: 400 });
    }

    const receipt = await prisma.satDeclarationReceipt.upsert({
      where: {
        doctorId_year_month: { doctorId: doctor.id, year, month },
      },
      create: {
        doctorId: doctor.id,
        year,
        month,
        isrPagado: isrPagado ?? null,
        ivaPagado: ivaPagado ?? null,
        pdfUrl: pdfUrl ?? null,
        pdfFileName: pdfFileName ?? null,
        notes: notes ?? null,
      },
      update: {
        ...(isrPagado !== undefined && { isrPagado: isrPagado }),
        ...(ivaPagado !== undefined && { ivaPagado: ivaPagado }),
        ...(pdfUrl !== undefined && { pdfUrl }),
        ...(pdfFileName !== undefined && { pdfFileName }),
        ...(notes !== undefined && { notes }),
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        ...receipt,
        isrPagado: receipt.isrPagado ? Number(receipt.isrPagado) : null,
        ivaPagado: receipt.ivaPagado ? Number(receipt.ivaPagado) : null,
      },
    });
  } catch (error: any) {
    if (error.name === 'AuthError') {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error saving declaration receipt:', error);
    return NextResponse.json({ error: 'Error al guardar acuse' }, { status: 500 });
  }
}

/**
 * DELETE /api/sat-descarga/declaration/receipts?year=2026&month=1
 * Delete a receipt (clears amounts + PDF for that month).
 */
export async function DELETE(request: NextRequest) {
  try {
    const { doctor } = await getAuthenticatedDoctor(request);
    const url = new URL(request.url);
    const year = parseInt(url.searchParams.get('year') || '0', 10);
    const month = parseInt(url.searchParams.get('month') || '0', 10);

    if (!year || !month) {
      return NextResponse.json({ error: 'Año y mes requeridos' }, { status: 400 });
    }

    await prisma.satDeclarationReceipt.deleteMany({
      where: { doctorId: doctor.id, year, month },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.name === 'AuthError') {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error deleting declaration receipt:', error);
    return NextResponse.json({ error: 'Error al eliminar acuse' }, { status: 500 });
  }
}
