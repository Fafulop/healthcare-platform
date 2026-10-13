// GET /api/facturacion/prefill/visita/[visitaId] — VISITAS 11-PLAN (2026-10-12): el prellenado de «Facturar»
// desde la visita (la cita + sus ventas en UNA factura). Lo arma `lib/factura-visita.ts` (regla 0: qué entra,
// qué no y por qué, conceptos, forma y método de pago — todo aquí). Sólo lee.
// Permiso: route-permissions `facturacion` (el prefijo de todo /facturacion). La visita debe ser del doctor.
import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedDoctor } from '@/lib/auth';
import { armarFacturaDeVisita } from '@/lib/factura-visita';

export async function GET(request: NextRequest, { params }: { params: Promise<{ visitaId: string }> }) {
  try {
    const { doctor } = await getAuthenticatedDoctor(request);
    const { visitaId } = await params;
    const data = await armarFacturaDeVisita(doctor.id, visitaId);
    if (!data) return NextResponse.json({ error: 'Visita no encontrada' }, { status: 404 });
    return NextResponse.json({ data });
  } catch (error: any) {
    if (error.name === 'AuthError') {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('[prefill visita] error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
