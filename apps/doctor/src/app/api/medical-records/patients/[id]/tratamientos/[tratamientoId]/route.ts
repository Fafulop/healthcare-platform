import { NextRequest, NextResponse } from 'next/server';
import { prisma, Prisma } from '@healthcare/database';
import { requireDoctorAuth, logAudit } from '@/lib/medical-auth';
import { handleApiError } from '@/lib/api-error-handler';
import { leerBody } from '@/lib/visitas';
import {
  INTERVALO_MAX, SESIONES_MAX, TRATAMIENTO_SELECT, cargarTratamiento, parseEnteroOpcional, parseEstadoTratamiento,
  ocupadasDelPaciente, parseNombre, parseNotas, parsePlantilla, rechazarPrecio, sesionesParaRespuesta,
} from '@/lib/tratamientos';

// VISITAS fase 2 T2 — docs/DESDE JUNIO/VISITAS/03-PLAN-fase-2.md §3. Permiso: `expedientes` (heredado).

type Params = { params: Promise<{ id: string; tratamientoId: string }> };

// GET — el tratamiento con sus sesiones (estado derivado, su visita y su cita recortada por permiso)
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const ctx = await requireDoctorAuth(request);
    const { id: patientId, tratamientoId } = await params;

    const tratamiento = await cargarTratamiento(ctx.doctorId, patientId, tratamientoId);
    if (!tratamiento) {
      return NextResponse.json({ error: 'Tratamiento not found' }, { status: 404 });
    }
    const [sesiones, ocupadas] = await Promise.all([
      sesionesParaRespuesta(ctx, patientId, { tratamientoId }),
      // T3: citas y visitas que ya son de alguna sesión del paciente (para los selectores).
      ocupadasDelPaciente(ctx.doctorId, patientId),
    ]);

    await logAudit({
      patientId, doctorId: ctx.doctorId, userId: ctx.userId, userRole: ctx.role,
      action: 'view_tratamiento', resourceType: 'tratamiento', resourceId: tratamientoId, request,
    });

    return NextResponse.json({ success: true, data: { ...tratamiento, sesiones }, ocupadas });
  } catch (error) {
    return handleApiError(error, 'GET /api/medical-records/patients/[id]/tratamientos/[tratamientoId]');
  }
}

// PATCH — { nombre?, notas?, estado?, plantillaSugeridaId?, sesionesPlaneadas?, intervaloDias? }
// `sesionesPlaneadas` sólo cambia el número del PLAN: nunca crea ni borra sesiones (G7).
export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const ctx = await requireDoctorAuth(request);
    const { id: patientId, tratamientoId } = await params;
    const body = await leerBody(request);
    rechazarPrecio(body);

    const antes = await cargarTratamiento(ctx.doctorId, patientId, tratamientoId);
    if (!antes) {
      return NextResponse.json({ error: 'Tratamiento not found' }, { status: 404 });
    }

    const data: Prisma.TratamientoUncheckedUpdateInput = {};
    if (body.nombre !== undefined) data.nombre = parseNombre(body.nombre);
    const notas = parseNotas(body.notas);
    if (notas !== undefined) data.notas = notas;
    const estado = parseEstadoTratamiento(body.estado);
    if (estado !== undefined) data.estado = estado;
    const sesionesPlaneadas = parseEnteroOpcional(body.sesionesPlaneadas, 'sesionesPlaneadas', SESIONES_MAX);
    if (sesionesPlaneadas !== undefined) data.sesionesPlaneadas = sesionesPlaneadas;
    const intervaloDias = parseEnteroOpcional(body.intervaloDias, 'intervaloDias', INTERVALO_MAX);
    if (intervaloDias !== undefined) data.intervaloDias = intervaloDias;
    // Re-enviar la MISMA plantilla (un formulario que manda todo) no la re-valida: pudo desactivarse.
    if (body.plantillaSugeridaId !== undefined && body.plantillaSugeridaId !== antes.plantillaSugeridaId) {
      data.plantillaSugeridaId = await parsePlantilla(ctx.doctorId, body.plantillaSugeridaId);
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 });
    }

    const updated = await prisma.tratamiento.update({
      where: { id: tratamientoId }, data, select: TRATAMIENTO_SELECT,
    });

    const changes: Record<string, unknown> = {};
    for (const k of ['nombre', 'estado', 'sesionesPlaneadas', 'intervaloDias', 'plantillaSugeridaId'] as const) {
      if (antes[k] !== updated[k]) changes[k] = { from: antes[k], to: updated[k] };
    }
    if (data.notas !== undefined) changes.notas = 'editado';
    await logAudit({
      patientId, doctorId: ctx.doctorId, userId: ctx.userId, userRole: ctx.role,
      action: 'update_tratamiento', resourceType: 'tratamiento', resourceId: tratamientoId,
      changes, request,
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    return handleApiError(error, 'PATCH /api/medical-records/patients/[id]/tratamientos/[tratamientoId]');
  }
}

// DELETE — sólo si NINGUNA sesión tiene cita ni visita. Si alguna tiene: 409 con el conteo, y el
// cliente lo marca «cancelado» con PATCH. Nunca toca citas ni visitas (la cascada sólo borra sesiones).
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const ctx = await requireDoctorAuth(request);
    const { id: patientId, tratamientoId } = await params;

    const tratamiento = await cargarTratamiento(ctx.doctorId, patientId, tratamientoId);
    if (!tratamiento) {
      return NextResponse.json({ error: 'Tratamiento not found' }, { status: 404 });
    }

    // Contar y borrar en UNA transacción con candados (FOR UPDATE), en este orden:
    //   1. el TRATAMIENTO: una sesión nueva (POST /sesiones) toma KEY SHARE sobre él por la FK, así
    //      que o ya está (y el paso 2 la ve) o espera y luego falla porque el tratamiento ya no existe;
    //   2. sus SESIONES: un PATCH que esté ligando una cita o visita termina antes (y se cuenta) o
    //      espera y ya no encuentra la sesión.
    // Sin los candados, la cascada podía borrar una sesión ligada entre el conteo y el DELETE.
    const where = { tratamientoId, patientId, doctorId: ctx.doctorId };
    const r = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM medical_records.tratamientos WHERE id = ${tratamientoId} FOR UPDATE`;
      await tx.$queryRaw`
        SELECT id FROM medical_records.tratamiento_sesiones WHERE tratamiento_id = ${tratamientoId} FOR UPDATE`;
      const [conCita, conVisita, total] = await Promise.all([
        // Sólo citas que siguen siendo de ESTE paciente (`citaEfectiva`): una vieja no se ve ni se
        // puede desligar desde aquí, así que no bloquea (la cascada sólo borra la sesión).
        tx.tratamientoSesion.count({ where: { ...where, booking: { is: { patientId } } } }),
        tx.tratamientoSesion.count({ where: { ...where, visitaId: { not: null } } }),
        tx.tratamientoSesion.count({ where }),
      ]);
      if (conCita > 0 || conVisita > 0) return { borrado: false as const, conCita, conVisita };
      await tx.tratamiento.delete({ where: { id: tratamientoId } });
      return { borrado: true as const, total };
    });
    if (!r.borrado) {
      return NextResponse.json(
        {
          error: 'El tratamiento tiene sesiones con cita o visita; márcalo como cancelado',
          conteo: { conCita: r.conCita, conVisita: r.conVisita },
        },
        { status: 409 },
      );
    }

    await logAudit({
      patientId, doctorId: ctx.doctorId, userId: ctx.userId, userRole: ctx.role,
      action: 'delete_tratamiento', resourceType: 'tratamiento', resourceId: tratamientoId,
      changes: { nombre: tratamiento.nombre, estado: tratamiento.estado, sesiones: r.total },
      request,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, 'DELETE /api/medical-records/patients/[id]/tratamientos/[tratamientoId]');
  }
}
