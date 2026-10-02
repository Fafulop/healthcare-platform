import { NextRequest, NextResponse } from 'next/server';
import { prisma, type Prisma } from '@healthcare/database';
import { getAuthenticatedDoctor, AuthError } from '@/lib/auth';
import { findBookingOverlap } from '@/lib/booking-overlap';
import { timeToMinutes, minutesToTime } from '@/lib/availability-calculator';

/**
 * POST /api/appointments/disponibilidad — ¿están libres estos horarios? READ-ONLY.
 *
 * TRATAMIENTOS v2 · V3 (docs/DESDE JUNIO/VISITAS/06-PLAN-tratamientos-v2.md §6): las filas de sesiones
 * dicen ✅/🔴 ANTES de confirmar. Corre las MISMAS dos revisiones que crea una cita en
 * `range-bookings/instant` — `findBookingOverlap` (citas activas, con su bloque extendido, sin buffer:
 * es el camino del doctor) y `blockedTime` — sin el candado del día y sin crear nada. Además revisa
 * las filas ENTRE SÍ (dos sesiones a la misma hora). Es un AVISO: al crear, el servidor revisa otra vez
 * (alguien pudo agendar en medio).
 *
 * Body: { items: [{ date: "YYYY-MM-DD", startTime: "HH:MM", serviceId: string }] } (máx 100 = SESIONES_MAX)
 * → { data: [{ ok: true } | { ok: false, motivo: 'cita'|'bloqueo'|'entre_filas'|'invalido', desde?, hasta?, fila? }] }
 * Permiso: `citas` (prefijo `appointments`).
 */
type Item = { date?: unknown; startTime?: unknown; serviceId?: unknown };
type Resultado =
  | { ok: true }
  | { ok: false; motivo: 'cita' | 'bloqueo' | 'entre_filas' | 'invalido'; desde?: string; hasta?: string; fila?: number };

const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const HORA = /^\d{2}:\d{2}$/;

export async function POST(request: NextRequest) {
  try {
    const { doctor } = await getAuthenticatedDoctor(request);
    const body = await request.json().catch(() => null);
    // Hasta 100: lo mismo que admite un tratamiento (SESIONES_MAX). Cortar antes dejaba filas sin
    // respuesta que nunca podían confirmarse.
    const items: Item[] = Array.isArray(body?.items) ? body.items.slice(0, 100) : [];
    if (!items.length) return NextResponse.json({ error: 'items requerido' }, { status: 400 });

    const serviceIds = [...new Set(items.map((i) => i.serviceId).filter((x): x is string => typeof x === 'string'))];
    const servicios = await prisma.service.findMany({
      where: { id: { in: serviceIds }, doctorId: doctor.id },
      select: { id: true, durationMinutes: true },
    });
    const duracion = new Map(servicios.map((s) => [s.id, s.durationMinutes]));

    // Ventanas normalizadas (o null si la fila es inválida), para revisar contra la agenda y entre sí.
    const ventanas = items.map((i) => {
      const dur = typeof i.serviceId === 'string' ? duracion.get(i.serviceId) : undefined;
      if (typeof i.date !== 'string' || !FECHA.test(i.date) || typeof i.startTime !== 'string' || !HORA.test(i.startTime.slice(0, 5)) || !dur) {
        return null;
      }
      const start = i.startTime.slice(0, 5);
      const ini = timeToMinutes(start);
      const fin = ini + dur;
      if (fin > 24 * 60) return null;
      const dia = new Date(i.date + 'T12:00:00Z');
      dia.setUTCHours(0, 0, 0, 0);
      return { date: i.date, dia, start, end: minutesToTime(fin), ini, fin };
    });

    // `findBookingOverlap` acepta un cliente de transacción; aquí sólo LEE, así que el cliente normal sirve.
    const db = prisma as unknown as Prisma.TransactionClient;
    const data: Resultado[] = await Promise.all(ventanas.map(async (v, idx): Promise<Resultado> => {
      if (!v) return { ok: false, motivo: 'invalido' };
      const choque = await findBookingOverlap(db, { doctorId: doctor.id, date: v.dia, startTime: v.start, endTime: v.end });
      if (choque) return { ok: false, motivo: 'cita', desde: choque.startTime, hasta: choque.blockEndTime };
      const bloqueo = await prisma.blockedTime.findFirst({
        where: { doctorId: doctor.id, date: v.dia, startTime: { lt: v.end }, endTime: { gt: v.start } },
        select: { startTime: true, endTime: true },
      });
      if (bloqueo) return { ok: false, motivo: 'bloqueo', desde: bloqueo.startTime, hasta: bloqueo.endTime };
      // Entre filas: choca con una fila ANTERIOR (la primera se queda, la segunda se marca).
      for (let j = 0; j < idx; j++) {
        const o = ventanas[j];
        if (o && o.date === v.date && o.ini < v.fin && v.ini < o.fin) {
          return { ok: false, motivo: 'entre_filas', desde: o.start, hasta: o.end, fila: j };
        }
      }
      return { ok: true };
    }));

    return NextResponse.json({ data });
  } catch (error: any) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error al revisar disponibilidad:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
