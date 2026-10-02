import { NextRequest, NextResponse } from 'next/server';
import { prisma, Prisma, repreciarCitaDeSesion } from '@healthcare/database';
import { requireDoctorAuth, logAudit } from '@/lib/medical-auth';
import { AppError, handleApiError } from '@/lib/api-error-handler';
import { leerBody, puedeVer } from '@/lib/visitas';
import {
  auditarEfectosDeLigar, cargarSesion, citaEfectiva, escribirSesion, parseNotas, parsePrecioSesion,
  parseServicioSesion, planLigarCitaASesion, sesionesParaRespuesta, validarVisitaParaSesion, type PlanLigarCita,
} from '@/lib/tratamientos';

// VISITAS fase 2 T2 — docs/DESDE JUNIO/VISITAS/03-PLAN-fase-2.md §3 + G1, G2, G4. Permiso:
// `expedientes` (heredado); ligar/desligar una CITA además exige `citas`.

type Params = { params: Promise<{ id: string; tratamientoId: string; sesionId: string }> };

// PATCH — { bookingId?: string|null, visitaId?: string|null, cancelada?: boolean, notas?: string|null }
//
//   · Ligar una cita: `planLigarCitaASesion` (mismo paciente, activa, de ninguna otra sesión). Si la
//     cita ya tiene visita, la sesión la guarda (P2 revisado); si la que tiene es la sesión, esa
//     visita pasa a ser la de la cita (G2).
//   · Desligar la cita: si la visita guardada ES la de esa cita, se suelta también — desligar a
//     propósito dice «esta cita no era de la sesión», y su visita tampoco. (P2 protege de lo que
//     pasa SIN que el doctor lo pida: cita borrada o re-ligada.)
//   · Ligar o soltar una visita: sólo SIN cita (con cita, su visita es la de la cita; re-enviar la
//     que se muestra no es cambiarla). La visita no puede tener cita propia.
//   · `cancelada` manda en el estado (P1). Cancelar NO cancela la cita: eso es de la agenda (G8).
export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const ctx = await requireDoctorAuth(request);
    const { id: patientId, tratamientoId, sesionId } = await params;
    const body = await leerBody(request);

    const s = await cargarSesion(ctx.doctorId, patientId, tratamientoId, sesionId);
    if (!s) {
      return NextResponse.json({ error: 'Sesión not found' }, { status: 404 });
    }

    const data: Prisma.TratamientoSesionUncheckedUpdateInput = {};

    if (body.cancelada !== undefined) {
      if (typeof body.cancelada !== 'boolean') throw new AppError('cancelada debe ser true/false', 400);
      if (body.cancelada !== s.cancelada) data.cancelada = body.cancelada;
    }
    const notas = parseNotas(body.notas);
    if (notas !== undefined) data.notas = notas;

    // TRATAMIENTOS v2 · V1 — servicio y precio de la sesión (06-PLAN §4).
    const servicio = await parseServicioSesion(ctx.doctorId, body, s.servicioId);
    if (servicio.servicioId !== undefined && servicio.servicioId !== s.servicioId) data.servicioId = servicio.servicioId;
    if (servicio.servicioNombre !== undefined && servicio.servicioNombre !== s.servicioNombre) data.servicioNombre = servicio.servicioNombre;
    const precio = parsePrecioSesion(ctx, body.precio);
    const precioAntes = s.precio === null ? null : Number(s.precio);
    if (precio !== undefined && precio !== precioAntes) data.precio = precio;

    // Lo que la sesión MUESTRA hoy. Una cita vieja (G1: de otro paciente o de ninguno) no se
    // muestra, así que tampoco cuenta como «tiene cita» para nada de lo que sigue.
    const citaActual = citaEfectiva(s);
    const visitaDeLaCita = citaActual ? s.booking?.visita?.id ?? null : null;
    const visitaMostrada = s.visitaId ?? visitaDeLaCita;

    // 1. La cita. Re-enviar la que se muestra no es cambiarla.
    let visitaGuardada = s.visitaId;
    let bookingFinal = citaActual;
    let plan: PlanLigarCita | null = null;
    if (body.bookingId !== undefined && body.bookingId !== citaActual) {
      if (body.bookingId === null) {
        if (!puedeVer(ctx, 'citas')) throw new AppError('PERMISSION_BLOCKED', 403);
        bookingFinal = null;
        data.bookingId = null;
        if (s.visitaId && s.visitaId === visitaDeLaCita) {
          visitaGuardada = null;
          data.visitaId = null;
        }
      } else {
        // CAMBIAR de cita: la visita guardada que era de la cita anterior se va con ella (igual que
        // al desligar); si no, la cita nueva chocaría con una visita que no es suya.
        const visitaQueSeQueda = s.visitaId && s.visitaId === visitaDeLaCita ? null : s.visitaId;
        plan = await planLigarCitaASesion(ctx, s, body.bookingId, visitaQueSeQueda);
        bookingFinal = body.bookingId as string;
        data.bookingId = bookingFinal;
        if (plan.visitaDeSesion !== s.visitaId) data.visitaId = plan.visitaDeSesion;
        visitaGuardada = plan.visitaDeSesion;
      }
    }

    // 2. La visita. Re-enviar la que se mostraba (un formulario que manda todo) no es cambiarla,
    // aunque el paso 1 la haya soltado junto con su cita.
    const visitaPedida = body.visitaId === visitaMostrada ? undefined : body.visitaId;
    if (visitaPedida !== undefined) {
      if (bookingFinal) {
        // Con cita, la visita es la de su cita: soltarla o cambiarla aquí borraría en silencio la
        // protección de P2 mientras la respuesta seguiría mostrando la misma visita.
        throw new AppError('La sesión tiene cita: su visita es la de su cita', 409);
      }
      if (visitaPedida === null) {
        if (visitaGuardada) data.visitaId = null;
      } else if (visitaPedida !== visitaGuardada) {
        data.visitaId = await validarVisitaParaSesion(ctx.doctorId, s, visitaPedida);
      }
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 });
    }

    // Si cambia la cita o la visita, sólo si la sesión SIGUE como se leyó: un reagendado (u otra
    // pestaña) que la movió entre la lectura y aquí da 409 en vez de quedar pisado.
    const tocaLigas = data.bookingId !== undefined || data.visitaId !== undefined;
    await escribirSesion(
      s.id, data, plan, bookingFinal,
      tocaLigas ? { bookingId: s.bookingId, visitaId: s.visitaId } : undefined,
    );

    // V1: el precio de la sesión baja a su cita (decisión 6: concluirla pre-llena ese precio) cuando
    // cambia el precio O se le liga una cita, con la MISMA regla que agendar/reagendar
    // (`repreciarCitaDeSesion`: sólo una cita que aún es plan, sin cobro ni link activo). Es un dato
    // de la AGENDA: además de `flujo` (el precio) exige `citas`.
    const precioFinal = data.precio !== undefined ? (data.precio as number | null) : precioAntes;
    const citaNueva = data.bookingId !== undefined && !!bookingFinal;
    let citaRepreciada = false;
    if (bookingFinal && precioFinal !== null && (data.precio !== undefined || citaNueva) && puedeVer(ctx, 'citas')) {
      citaRepreciada = await repreciarCitaDeSesion(prisma, { doctorId: ctx.doctorId, bookingId: bookingFinal, precio: precioFinal });
    }

    const changes: Record<string, unknown> = {};
    if (data.servicioId !== undefined) changes.servicioId = { from: s.servicioId, to: data.servicioId };
    if (data.servicioNombre !== undefined) changes.servicioNombre = { from: s.servicioNombre, to: data.servicioNombre };
    if (data.precio !== undefined) changes.precio = { from: precioAntes, to: data.precio };
    if (citaRepreciada) changes.citaRepreciada = { bookingId: bookingFinal, precio: precioFinal };
    if (data.bookingId !== undefined) changes.bookingId = { from: citaActual, to: bookingFinal };
    if (data.visitaId !== undefined) changes.visitaId = { from: s.visitaId, to: data.visitaId };
    if (data.cancelada !== undefined) changes.cancelada = { from: s.cancelada, to: data.cancelada };
    if (data.notas !== undefined) changes.notas = 'editado';
    const action = data.bookingId !== undefined ? 'link_sesion_cita'
      : data.visitaId !== undefined ? 'link_sesion_visita'
      : 'update_sesion';
    const audit = { doctorId: ctx.doctorId, userId: ctx.userId, userRole: ctx.role, request };
    await logAudit({
      ...audit, patientId, action, resourceType: 'tratamiento_sesion', resourceId: s.id,
      changes: { tratamientoId, numero: s.numero, ...changes },
    });
    if (bookingFinal) await auditarEfectosDeLigar(ctx, request, patientId, plan, bookingFinal);

    const [out] = await sesionesParaRespuesta(ctx, patientId, { id: s.id });
    return NextResponse.json({ success: true, data: out });
  } catch (error) {
    return handleApiError(error, 'PATCH /api/medical-records/patients/[id]/tratamientos/[tratamientoId]/sesiones/[sesionId]');
  }
}

// DELETE — sólo si la sesión no tiene cita ni visita. Si tiene: 409 y el cliente la cancela con
// PATCH. Nunca cancela la cita en silencio (DISEÑO §4): eso es de la agenda.
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const ctx = await requireDoctorAuth(request);
    const { id: patientId, tratamientoId, sesionId } = await params;

    const s = await cargarSesion(ctx.doctorId, patientId, tratamientoId, sesionId);
    if (!s) {
      return NextResponse.json({ error: 'Sesión not found' }, { status: 404 });
    }
    // Una cita vieja (G1) no cuenta: la respuesta no la muestra y no hay forma de desligarla.
    const conCita = !!citaEfectiva(s);
    if (conCita || s.visitaId) {
      return NextResponse.json(
        { error: 'La sesión tiene cita o visita; márcala como cancelada', conCita, conVisita: !!s.visitaId },
        { status: 409 },
      );
    }

    // Condicionado a que la cita y la visita SIGAN como se leyeron: si otra petición la ligó entre
    // la lectura y aquí, no se borra (count = 0 → 409).
    const { count } = await prisma.tratamientoSesion.deleteMany({
      where: { id: s.id, bookingId: s.bookingId, visitaId: null },
    });
    if (count === 0) {
      return NextResponse.json({ error: 'La sesión cambió mientras se borraba; recarga' }, { status: 409 });
    }

    await logAudit({
      patientId, doctorId: ctx.doctorId, userId: ctx.userId, userRole: ctx.role,
      action: 'delete_sesion', resourceType: 'tratamiento_sesion', resourceId: s.id,
      changes: { tratamientoId, numero: s.numero, cancelada: s.cancelada },
      request,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, 'DELETE /api/medical-records/patients/[id]/tratamientos/[tratamientoId]/sesiones/[sesionId]');
  }
}
