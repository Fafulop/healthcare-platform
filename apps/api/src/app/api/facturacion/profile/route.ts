import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { getAuthenticatedDoctor } from '@/lib/auth';

// GET /api/facturacion/profile
export async function GET(request: NextRequest) {
  try {
    const { doctor } = await getAuthenticatedDoctor(request);

    const profile = await prisma.doctorFiscalProfile.findUnique({
      where: { doctorId: doctor.id },
    });

    return NextResponse.json({ data: profile });
  } catch (error: any) {
    if (error.name === 'AuthError') {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// POST /api/facturacion/profile - Create or update fiscal profile
export async function POST(request: NextRequest) {
  try {
    const { doctor } = await getAuthenticatedDoctor(request);
    const body = await request.json();

    const { rfc, razonSocial, regimenFiscal, regimenFiscalDesc, codigoPostal } = body;

    if (!rfc || !razonSocial || !regimenFiscal || !codigoPostal) {
      return NextResponse.json(
        { error: 'RFC, razón social, régimen fiscal y código postal son requeridos' },
        { status: 400 }
      );
    }

    // Validate RFC format (12 chars for persona moral, 13 for persona fisica)
    const rfcClean = rfc.trim().toUpperCase();
    if (rfcClean.length < 12 || rfcClean.length > 13) {
      return NextResponse.json(
        { error: 'RFC inválido. Debe tener 12 o 13 caracteres.' },
        { status: 400 }
      );
    }

    // Validate codigo postal (5 digits)
    if (!/^\d{5}$/.test(codigoPostal)) {
      return NextResponse.json(
        { error: 'Código postal inválido. Debe ser de 5 dígitos.' },
        { status: 400 }
      );
    }

    const profile = await prisma.doctorFiscalProfile.upsert({
      where: { doctorId: doctor.id },
      create: {
        doctorId: doctor.id,
        rfc: rfcClean,
        razonSocial: razonSocial.trim(),
        regimenFiscal,
        regimenFiscalDesc: regimenFiscalDesc || null,
        codigoPostal,
      },
      update: {
        rfc: rfcClean,
        razonSocial: razonSocial.trim(),
        regimenFiscal,
        regimenFiscalDesc: regimenFiscalDesc || null,
        codigoPostal,
      },
    });

    return NextResponse.json({ data: profile }, { status: 200 });
  } catch (error: any) {
    if (error.name === 'AuthError') {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error saving fiscal profile:', error);
    return NextResponse.json({ error: 'Error al guardar perfil fiscal' }, { status: 500 });
  }
}
