import { NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { AuthError, validateAuthToken } from '@/lib/auth';
import { resolveTokens } from '@/lib/google-calendar';
import { sendTreatmentScheduleEmail } from '@/lib/gmail';

/**
 * POST /api/appointments/bookings/resumen-tratamiento — { bookingIds: string[] }
 *
 * TRATAMIENTOS T5 — «Agendar sesiones» crea cada cita por `range-bookings/instant` con
 * `avisoEnResumen` (sin correo por cita) y al final llama aquí: UN correo al paciente con todas.
 * Sólo citas del doctor autenticado, de UN mismo paciente y activas. Igual que la confirmación de
 * una cita: va al correo del EXPEDIENTE (o la copia de la cita) y sólo si la cuenta de Google del
 * doctor está conectada; si no, `{ enviado: false, motivo }` (la pantalla lo dice, no lo afirma).
 */
export async function POST(request: Request) {
  try {
    const { role, doctorId: authenticatedDoctorId } = await validateAuthToken(request);
    const body = await request.json().catch(() => null);
    const ids: unknown = body?.bookingIds;
    if (!Array.isArray(ids) || ids.length === 0 || ids.length > 100 || !ids.every((x) => typeof x === 'string' && x)) {
      return NextResponse.json({ success: false, error: 'bookingIds inválidos' }, { status: 400 });
    }

    const citas = await prisma.booking.findMany({
      where: {
        id: { in: ids as string[] },
        ...(role === 'ADMIN' ? {} : { doctorId: authenticatedDoctorId ?? '__nadie__' }),
        status: { in: ['PENDING', 'CONFIRMED'] },
      },
      select: {
        id: true, doctorId: true, patientId: true, patientName: true, patientEmail: true,
        date: true, startTime: true, endTime: true, confirmationCode: true,
        slot: { select: { date: true, startTime: true, endTime: true } },
        location: { select: { name: true, address: true, phone: true } },
        patient: { select: { email: true } },
        tratamientoSesion: { select: { numero: true, tratamiento: { select: { nombre: true, sesionesPlaneadas: true } } } },
        doctor: {
          select: {
            doctorFullName: true, primarySpecialty: true, clinicAddress: true, clinicPhone: true,
            user: { select: { id: true, email: true, googleAccessToken: true, googleRefreshToken: true, googleTokenExpiry: true } },
          },
        },
      },
    });
    if (citas.length === 0) {
      return NextResponse.json({ success: false, error: 'No hay citas activas de este doctor' }, { status: 404 });
    }
    const pacientes = new Set(citas.map((c) => c.patientId));
    const doctores = new Set(citas.map((c) => c.doctorId));
    if (pacientes.size !== 1 || doctores.size !== 1 || !citas[0].patientId) {
      return NextResponse.json({ success: false, error: 'Las citas tienen que ser de un mismo paciente con expediente' }, { status: 409 });
    }

    const primera = citas[0];
    const destinatario = primera.patient?.email?.trim() || primera.patientEmail?.trim() || '';
    if (!destinatario) return NextResponse.json({ success: true, enviado: false, motivo: 'sin_correo' });
    const user = primera.doctor.user;
    if (!user?.googleAccessToken || !user.email) {
      return NextResponse.json({ success: true, enviado: false, motivo: 'sin_google' });
    }

    const { accessToken, refreshToken, updatedToken } = await resolveTokens(user);
    if (updatedToken && user.id) {
      await prisma.user.update({
        where: { id: user.id },
        data: { googleAccessToken: updatedToken.accessToken, googleTokenExpiry: updatedToken.expiresAt },
      });
    }

    const filas = citas
      .map((c) => ({
        etiqueta: c.tratamientoSesion
          ? `Sesión ${c.tratamientoSesion.numero}${c.tratamientoSesion.tratamiento.sesionesPlaneadas ? ` de ${c.tratamientoSesion.tratamiento.sesionesPlaneadas}` : ''}`
          : 'Cita',
        date: (c.slot?.date ?? c.date)?.toISOString() ?? '',
        startTime: c.slot?.startTime ?? c.startTime ?? '',
        endTime: c.slot?.endTime ?? c.endTime ?? '',
        confirmationCode: c.confirmationCode ?? '',
        lugarId: c.location ? `${c.location.name}|${c.location.address}` : '',
        lugar: c.location ? [c.location.name, c.location.address].filter(Boolean).join(' · ') : null,
      }))
      .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
    const tratamiento = citas.find((c) => c.tratamientoSesion)?.tratamientoSesion?.tratamiento.nombre ?? 'tu tratamiento';
    // Cada cita toma su consultorio del rango de SU día: si no son todas el mismo, va en cada fila
    // (y no uno solo abajo que sería falso para algunas).
    const mismoLugar = new Set(filas.map((f) => f.lugarId)).size === 1;
    const lugar = mismoLugar ? primera.location : null;

    await sendTreatmentScheduleEmail(
      {
        patientName: primera.patientName,
        patientEmail: destinatario,
        doctorName: primera.doctor.doctorFullName,
        specialty: primera.doctor.primarySpecialty ?? null,
        tratamiento,
        clinicName: lugar?.name ?? null,
        clinicAddress: mismoLugar ? lugar?.address ?? primera.doctor.clinicAddress ?? null : null,
        clinicPhone: mismoLugar ? lugar?.phone ?? primera.doctor.clinicPhone ?? null : null,
        citas: filas.map(({ lugarId: _, lugar: l, ...f }) => ({ ...f, lugar: mismoLugar ? null : l })),
      },
      accessToken,
      refreshToken,
      primera.doctor.doctorFullName,
      user.email,
    );

    // Como la confirmación de una cita: la UI deja de ofrecer «Correo» y ofrece «Reenviar».
    await prisma.booking.updateMany({
      where: { id: { in: citas.map((c) => c.id) } },
      data: { confirmationEmailSentAt: new Date() },
    });

    return NextResponse.json({ success: true, enviado: true, citas: citas.length });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    }
    console.error('[tratamientos] resumen de sesiones falló:', error);
    return NextResponse.json({ success: false, error: 'No se pudo enviar el resumen' }, { status: 500 });
  }
}
