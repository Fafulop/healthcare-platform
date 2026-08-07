// GET    /api/appointments/ranges/[id] - Get a single availability range
// DELETE /api/appointments/ranges/[id] - Delete a range. NO bloquea si hay citas dentro: una
//        cita no depende de su rango (sin FK ni cascade). Devuelve `affectedBookings` = las que
//        siguen agendadas ahí. Con `?dryRun=1` sólo las cuenta y NO borra.

import { NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { validateAuthToken } from '@/lib/auth';
import { logActivity } from '@/lib/activity-logger';

// ---------------------------------------------------------------------------
// GET — Single range by ID
// ---------------------------------------------------------------------------

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { role, userId, doctorId: authenticatedDoctorId } = await validateAuthToken(request);
    const { id } = await params;

    const range = await prisma.availabilityRange.findUnique({
      where: { id },
      include: {
        location: { select: { id: true, name: true, address: true } },
      },
    });

    if (!range) {
      return NextResponse.json(
        { success: false, error: 'Availability range not found' },
        { status: 404 }
      );
    }

    // Doctors can only see their own ranges
    if (role === 'DOCTOR' && range.doctorId !== authenticatedDoctorId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      );
    }

    return NextResponse.json({ success: true, data: range });
  } catch (error) {
    console.error('Error fetching availability range:', error);

    if (error instanceof Error && (error.message.includes('authorization') || error.message.includes('token') || error.message.includes('authentication'))) {
      return NextResponse.json({ success: false, error: error.message }, { status: 401 });
    }

    return NextResponse.json(
      { success: false, error: 'Failed to fetch availability range' },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// DELETE — Remove a range. Las citas de adentro NO lo impiden ni se tocan.
// ---------------------------------------------------------------------------

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    // `?dryRun=1` = contar sin borrar, para poder ADVERTIR al doctor ANTES. Borrar un rango es
    // irreversible (no hay soft delete en `availability_ranges`) y el camino masivo ya hace su
    // preview con `dryRun`; sin esto, el borrado de UNO era la única operación destructiva de
    // rangos que informaba DESPUÉS de consumarse.
    const dryRun = new URL(request.url).searchParams.get('dryRun') === '1';

    // Authenticate
    const { role, userId, doctorId: authenticatedDoctorId } = await validateAuthToken(request);

    // Fetch the range
    const range = await prisma.availabilityRange.findUnique({
      where: { id },
      select: {
        id: true,
        doctorId: true,
        date: true,
        startTime: true,
        endTime: true,
      },
    });

    if (!range) {
      return NextResponse.json(
        { success: false, error: 'Availability range not found' },
        { status: 404 }
      );
    }

    // Authorization: doctors can only delete their own ranges
    if (role === 'DOCTOR') {
      if (range.doctorId !== authenticatedDoctorId) {
        return NextResponse.json(
          { success: false, error: 'Unauthorized — you can only delete your own ranges' },
          { status: 403 }
        );
      }
    } else if (role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // Citas activas que caen dentro de la ventana de este rango.
    // Activa = PENDING o CONFIRMED (no canceladas/completadas/no-show).
    // Cubre las de rango (slotId = null) y las legacy basadas en slot.
    //
    // ⚠️ Esto YA NO BLOQUEA el borrado — antes contestaba 409 "Cancela las citas primero".
    // Se levanta a propósito: **una cita no depende de su rango.** `AvailabilityRange` no tiene
    // ninguna relación con `Booking` en el schema — ni FK ni cascade — así que borrar el rango
    // no puede tocar las citas, y el calculador de disponibilidad usa las citas como ventanas
    // ocupadas por sí solas. El rango sólo dice "aquí publico horarios"; retirarlo no cancela
    // nada. El borrado MASIVO (`ranges/bulk`) ya se comportaba así, y bloquear sólo el borrado
    // de uno era la inconsistencia, no el permiso.
    //
    // Se siguen consultando para poder DECIRLE al doctor qué citas siguen agendadas ahí.
    const activeBookings = await prisma.booking.findMany({
      where: {
        doctorId: range.doctorId,
        status: { in: ['PENDING', 'CONFIRMED'] },
        OR: [
          // Range-based bookings (freeform: slotId is null)
          {
            slotId: null,
            date: range.date,
            startTime: { lt: range.endTime },
            endTime: { gt: range.startTime },
          },
          // Legacy slot-based bookings
          {
            slot: {
              date: range.date,
              startTime: { lt: range.endTime },
              endTime: { gt: range.startTime },
            },
          },
        ],
      },
      select: { id: true, patientName: true, startTime: true, endTime: true },
    });

    const affectedBookings = activeBookings.map((b) => ({
      id: b.id,
      patientName: b.patientName,
      startTime: b.startTime,
      endTime: b.endTime,
    }));

    // Preview: se contesta ANTES de borrar y sin borrar nada.
    if (dryRun) {
      return NextResponse.json({ success: true, dryRun: true, affectedBookings });
    }

    await prisma.availabilityRange.delete({ where: { id } });

    // ⚠️ DIFERENCIA CONOCIDA con el borrado masivo, que NO se cerró aquí: `ranges/bulk` borra
    // además los `blockedTime` de las fechas que se quedan con CERO rangos; este camino no.
    // Consecuencia: si el doctor bloquea 10:00–12:00, borra el único rango de ese día y después
    // crea un rango nuevo ahí, el bloqueo huérfano revive y parte del rango nuevo no se le
    // ofrece a nadie, sin nada en la UI que lo explique.
    // Se deja así a propósito y no por descuido: la cascada del masivo es justo lo que el agente
    // evita usando SIEMPRE el camino individual (RNG-12), así que replicarla aquí le quitaría al
    // agente su única salida segura. Cerrar esta diferencia es un cambio de comportamiento con
    // su propia decisión, no un efecto secundario de haber quitado el 409.
    // Levantar el 409 NO empeora esto: un rango con citas no tenía por qué ser inmune al
    // problema, simplemente antes no llegaba hasta aquí.

    // Log activity
    const dateKey = range.date.toISOString().split('T')[0];
    logActivity({
      doctorId: range.doctorId,
      userId,
      actionType: 'RANGE_DELETED',
      entityType: 'APPOINTMENT',
      entityId: id,
      displayMessage: `Eliminado rango de disponibilidad: ${range.startTime}–${range.endTime} (${dateKey})`,
      icon: 'Trash2',
      color: 'red',
      metadata: {
        type: 'availability_range',
        date: dateKey,
        startTime: range.startTime,
        endTime: range.endTime,
      },
    }).catch((err) => console.error('Activity log failed:', err));

    // `affectedBookings` va en la respuesta para que la UI pueda decir CUÁNTAS citas siguen
    // agendadas en ese horario. Nombre nuevo a propósito: el viejo `activeBookings` viajaba en
    // una respuesta de ERROR y significaba "por esto no se borró"; ahora el borrado ya ocurrió y
    // significa "esto sigue en pie". Reusar el nombre habría dejado dos sentidos opuestos para
    // el mismo campo según el `success`.
    return NextResponse.json({
      success: true,
      message: 'Availability range deleted',
      affectedBookings,
    });
  } catch (error) {
    console.error('Error deleting availability range:', error);

    if (error instanceof Error) {
      if (
        error.message.includes('authorization') ||
        error.message.includes('token') ||
        error.message.includes('authentication')
      ) {
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 401 }
        );
      }
    }

    return NextResponse.json(
      { success: false, error: 'Failed to delete availability range' },
      { status: 500 }
    );
  }
}
