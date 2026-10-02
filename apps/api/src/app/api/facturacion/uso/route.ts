import { NextRequest, NextResponse } from 'next/server';
import { prisma, usoDeFacturas } from '@healthcare/database';
import { getAuthenticatedDoctor } from '@/lib/auth';

// GET /api/facturacion/uso — TIERS P4: cuántas facturas de ingreso lleva el doctor este mes y cuántas
// incluye su plan (Gratis 5 · plan de pago 25 + extra · PRO/LAB sin tope). Sólo lectura; la pantalla de
// Facturación lo enseña para que el tope nunca sea sorpresa. Cuelga de `facturacion` en el mapa de rutas.
export async function GET(request: NextRequest) {
  try {
    const { doctor } = await getAuthenticatedDoctor(request);
    const fila = await prisma.doctor.findUnique({ where: { id: doctor.id }, select: { tier: true } });
    const uso = await usoDeFacturas(prisma, doctor.id, fila?.tier ?? null);
    return NextResponse.json({ data: { ...uso, tier: fila?.tier ?? null } });
  } catch (error: any) {
    if (error.name === 'AuthError') {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
