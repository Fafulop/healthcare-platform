import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { requireDoctorAuth, logAudit } from '@/lib/medical-auth';
import { AppError, handleApiError } from '@/lib/api-error-handler';
import { leerBody } from '@/lib/visitas';
import {
  INTERVALO_MAX, SESIONES_MAX, TRATAMIENTO_SELECT, conteosPorTratamiento, parseEnteroOpcional, parseNombre,
  parsePrecioSesion, parseServicioSesion,
  parseNotas, parsePlantilla, parsePrecioPaquete,
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
// Body: { nombre, sesionesPlaneadas?, intervaloDias?, plantillaSugeridaId?, notas?, sesiones?: [{ servicioId?, servicioNombre?, precio? }] }
// Con `sesionesPlaneadas = N` crea las N sesiones «por agendar» (1..N) en la misma transacción.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireDoctorAuth(request);
    const { id: patientId } = await params;
    const body = await leerBody(request);
    const precioPaquete = parsePrecioPaquete(ctx, body.precioPaquete) ?? null;

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

    // TRATAMIENTOS v2 · V3: `sesiones` (opcional) = el servicio y el precio de CADA sesión, en orden
    // (1..N). Si viene, su largo es N. El precio exige `flujo` (parsePrecioSesion); el servicio debe ser
    // del doctor (parseServicioSesion).
    let porSesion: { servicioId: string | null; servicioNombre: string | null; precio: number | null }[] = [];
    if (body.sesiones !== undefined) {
      if (!Array.isArray(body.sesiones) || !sesionesPlaneadas || body.sesiones.length !== sesionesPlaneadas) {
        throw new AppError('sesiones debe traer una entrada por sesión planeada', 400);
      }
      porSesion = await Promise.all(body.sesiones.map(async (raw: unknown) => {
        const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
        const sv = await parseServicioSesion(ctx.doctorId, r, null);
        return {
          servicioId: sv.servicioId ?? null,
          servicioNombre: sv.servicioNombre ?? null,
          precio: r.precio === undefined ? null : parsePrecioSesion(ctx, r.precio) ?? null,
        };
      }));
    }

    // Escritura anidada = una sola transacción: o nacen el tratamiento y sus N sesiones, o nada.
    const tratamiento = await prisma.tratamiento.create({
      data: {
        patientId, doctorId: ctx.doctorId, nombre, sesionesPlaneadas, intervaloDias, plantillaSugeridaId, notas, precioPaquete,
        ...(sesionesPlaneadas
          ? {
              sesiones: {
                createMany: {
                  data: Array.from({ length: sesionesPlaneadas }, (_, i) => ({
                    patientId, doctorId: ctx.doctorId, numero: i + 1,
                    ...(porSesion[i] ?? {}),
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
      changes: {
        nombre, sesionesPlaneadas, intervaloDias, plantillaSugeridaId, conNotas: !!notas,
        ...(precioPaquete !== null ? { precioPaquete } : {}),
        ...(porSesion.length ? { sesiones: porSesion.map((p, i) => ({ numero: i + 1, servicio: p.servicioNombre, precio: p.precio })) } : {}),
      },
      request,
    });

    // V3: la pantalla agenda la cita de cada sesión en seguida (`paraSesion`): necesita sus ids.
    const sesiones = sesionesPlaneadas
      ? await prisma.tratamientoSesion.findMany({
          where: { tratamientoId: tratamiento.id, doctorId: ctx.doctorId },
          orderBy: { numero: 'asc' },
          select: { id: true, numero: true },
        })
      : [];
    return NextResponse.json({ success: true, data: { ...tratamiento, sesiones } }, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'POST /api/medical-records/patients/[id]/tratamientos');
  }
}
