import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { requireDoctorAuth, logAudit } from '@/lib/medical-auth';
import { handleApiError } from '@/lib/api-error-handler';
import { leerBody } from '@/lib/visitas';
import {
  INTERVALO_MAX, SESIONES_MAX, TRATAMIENTO_SELECT, conteosPorTratamiento, parseEnteroOpcional, parseNombre,
  parseNotas, parsePlantilla, rechazarPrecio,
} from '@/lib/tratamientos';

// VISITAS fase 2 T2 — docs/DESDE JUNIO/VISITAS/03-PLAN-fase-2.md §3. Permiso: `expedientes` (heredado).

const ORDEN_ESTADO: Record<string, number> = { activo: 0, terminado: 1, cancelado: 2 };

// GET /api/medical-records/patients/:id/tratamientos — activos primero, luego el más reciente
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireDoctorAuth(request);
    const { id: patientId } = await params;

    const patient = await prisma.patient.findFirst({
      where: { id: patientId, doctorId: ctx.doctorId },
      select: { id: true },
    });
    if (!patient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 });
    }

    const tratamientos = await prisma.tratamiento.findMany({
      where: { patientId, doctorId: ctx.doctorId },
      orderBy: { createdAt: 'desc' },
      select: TRATAMIENTO_SELECT,
    });
    const conteos = await conteosPorTratamiento(ctx.doctorId, patientId, tratamientos.map((t) => t.id));

    const data = tratamientos
      .map((t) => ({ ...t, conteo: conteos.get(t.id) }))
      .sort((a, b) => (ORDEN_ESTADO[a.estado] ?? 9) - (ORDEN_ESTADO[b.estado] ?? 9));

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return handleApiError(error, 'GET /api/medical-records/patients/[id]/tratamientos');
  }
}

// POST /api/medical-records/patients/:id/tratamientos
// Body: { nombre, sesionesPlaneadas?, intervaloDias?, plantillaSugeridaId?, notas? }
// Con `sesionesPlaneadas = N` crea las N sesiones «por agendar» (1..N) en la misma transacción.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireDoctorAuth(request);
    const { id: patientId } = await params;
    const body = await leerBody(request);
    rechazarPrecio(body);

    const patient = await prisma.patient.findFirst({
      where: { id: patientId, doctorId: ctx.doctorId },
      select: { id: true },
    });
    if (!patient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 });
    }

    const nombre = parseNombre(body.nombre);
    const sesionesPlaneadas = parseEnteroOpcional(body.sesionesPlaneadas, 'sesionesPlaneadas', SESIONES_MAX) ?? null;
    const intervaloDias = parseEnteroOpcional(body.intervaloDias, 'intervaloDias', INTERVALO_MAX) ?? null;
    const notas = parseNotas(body.notas) ?? null;
    const plantillaSugeridaId = (await parsePlantilla(ctx.doctorId, body.plantillaSugeridaId)) ?? null;

    // Escritura anidada = una sola transacción: o nacen el tratamiento y sus N sesiones, o nada.
    const tratamiento = await prisma.tratamiento.create({
      data: {
        patientId, doctorId: ctx.doctorId, nombre, sesionesPlaneadas, intervaloDias, plantillaSugeridaId, notas,
        ...(sesionesPlaneadas
          ? {
              sesiones: {
                createMany: {
                  data: Array.from({ length: sesionesPlaneadas }, (_, i) => ({
                    patientId, doctorId: ctx.doctorId, numero: i + 1,
                  })),
                },
              },
            }
          : {}),
      },
      select: TRATAMIENTO_SELECT,
    });
    await logAudit({
      patientId, doctorId: ctx.doctorId, userId: ctx.userId, userRole: ctx.role,
      action: 'create_tratamiento', resourceType: 'tratamiento', resourceId: tratamiento.id,
      changes: { nombre, sesionesPlaneadas, intervaloDias, plantillaSugeridaId, conNotas: !!notas },
      request,
    });

    return NextResponse.json({ success: true, data: tratamiento }, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'POST /api/medical-records/patients/[id]/tratamientos');
  }
}
