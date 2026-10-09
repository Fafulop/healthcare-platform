import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { requireDoctorAuth, logAudit } from '@/lib/medical-auth';
import { AppError, handleApiError } from '@/lib/api-error-handler';
import { leerBody } from '@/lib/visitas';
import {
  INTERVALO_MAX, SESIONES_MAX, TRATAMIENTO_SELECT, conteosPorTratamiento, crearSeguimientoDeVisita, diaDeVisita,
  parseEnteroOpcional, parseNombre, parsePrecioSesion, parseServicioSesion,
  parseNotas, parsePlantilla, rechazarPrecioPaquete, unicaDeSesion,
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
    // V2 (2026-10-02): ya no hay paquetes — el total es la suma de las sesiones.
    rechazarPrecioPaquete(body.precioPaquete);

    const patient = await prisma.patient.findFirst({
      where: { id: patientId, doctorId: ctx.doctorId },
      select: { id: true },
    });
    if (!patient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 });
    }

    if (body.desdeVisita !== undefined) return await crearDesdeVisita(ctx, request, patientId, body);

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
        patientId, doctorId: ctx.doctorId, nombre, sesionesPlaneadas, intervaloDias, plantillaSugeridaId, notas,
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

/**
 * VISITAS 07-PLAN P3a — «Agendar seguimiento» desde una visita SUELTA. Body: { desdeVisita, sesion?:
 * { servicioId?, servicioNombre?, precio? } }. En UNA transacción nace «Seguimiento del <día>» con sesión
 * 1 = esa visita (y su cita, si no es de otra sesión — `crearSeguimientoDeVisita`, la misma regla que
 * «Nueva Visita» → seguimiento) y sesión 2 = la del seguimiento con su servicio y precio. La CITA de la
 * sesión 2 la agenda después la pantalla (`paraSesion`), como «Nuevo tratamiento». Una visita que YA
 * es de un tratamiento (por sí o por su cita) → 409: su seguimiento se agrega desde ese tratamiento.
 */
async function crearDesdeVisita(
  ctx: Awaited<ReturnType<typeof requireDoctorAuth>>, request: NextRequest, patientId: string, body: Record<string, any>,
) {
  if (typeof body.desdeVisita !== 'string' || !body.desdeVisita) throw new AppError('desdeVisita inválido', 400);
  const visitaId: string = body.desdeVisita;
  const r = (body.sesion && typeof body.sesion === 'object' ? body.sesion : {}) as Record<string, unknown>;
  const sv = await parseServicioSesion(ctx.doctorId, r, null);
  const sesion2 = {
    servicioId: sv.servicioId ?? null,
    servicioNombre: sv.servicioNombre ?? null,
    precio: r.precio === undefined ? null : parsePrecioSesion(ctx, r.precio) ?? null,
  };

  const hecho = await prisma.$transaction(async (tx) => {
    const v = await tx.visita.findFirst({
      where: { id: visitaId, patientId, doctorId: ctx.doctorId },
      select: { id: true, fecha: true, bookingId: true, tratamientoSesion: { select: { id: true } } },
    });
    if (!v) throw new AppError('La visita no existe o no es de este paciente', 404);
    const deSuCita = v.bookingId
      ? await tx.tratamientoSesion.findFirst({ where: { bookingId: v.bookingId }, select: { id: true } })
      : null;
    if (v.tratamientoSesion || deSuCita) {
      throw new AppError('Esta visita ya es de un tratamiento: agrega su seguimiento desde ese tratamiento', 409);
    }
    const c = await crearSeguimientoDeVisita(tx, ctx.doctorId, patientId, v, await diaDeVisita(ctx.doctorId, v));
    const s2 = await tx.tratamientoSesion.create({
      data: { tratamientoId: c.tratamientoId, patientId, doctorId: ctx.doctorId, numero: 2, ...sesion2 },
      select: { id: true },
    });
    return { ...c, sesion2Id: s2.id };
  }).catch((e) => {
    if (e instanceof AppError) throw e;
    unicaDeSesion(e); // dos clics a la vez: la visita ya es de la sesión 1 del otro → 409 legible
  });

  const audit = { patientId, doctorId: ctx.doctorId, userId: ctx.userId, userRole: ctx.role, request };
  await logAudit({
    ...audit, action: 'create_tratamiento', resourceType: 'tratamiento', resourceId: hecho.tratamientoId,
    changes: { nombre: hecho.nombre, motivo: 'seguimiento agendado desde la visita', visitaId },
  });
  await logAudit({
    ...audit, action: 'create_sesion', resourceType: 'tratamiento_sesion', resourceId: hecho.sesionId,
    changes: { tratamientoId: hecho.tratamientoId, numero: 1, visitaId, motivo: 'la visita del seguimiento' },
  });
  await logAudit({
    ...audit, action: 'create_sesion', resourceType: 'tratamiento_sesion', resourceId: hecho.sesion2Id,
    changes: {
      tratamientoId: hecho.tratamientoId, numero: 2, servicio: sesion2.servicioNombre, precio: sesion2.precio,
      motivo: 'el seguimiento',
    },
  });

  return NextResponse.json({
    success: true,
    data: {
      id: hecho.tratamientoId, nombre: hecho.nombre,
      sesiones: [{ id: hecho.sesionId, numero: 1 }, { id: hecho.sesion2Id, numero: 2 }],
    },
  }, { status: 201 });
}
