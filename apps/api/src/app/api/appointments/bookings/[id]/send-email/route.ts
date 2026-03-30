// POST /api/appointments/bookings/[id]/send-email
// Send appointment confirmation email to the patient via the doctor's Gmail account.
// Requires booking status = CONFIRMED and doctor's Google OAuth tokens with gmail.send scope.

import { NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { getAuthenticatedDoctor } from '@/lib/auth';
import { resolveTokens } from '@/lib/google-calendar';
import { sendAppointmentConfirmationEmail } from '@/lib/gmail';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  let doctor: Awaited<ReturnType<typeof getAuthenticatedDoctor>>['doctor'];
  try {
    ({ doctor } = await getAuthenticatedDoctor(request));
  } catch {
    return NextResponse.json(
      { success: false, error: 'No autorizado' },
      { status: 401 }
    );
  }

  try {
    const { id: bookingId } = await params;

    // 1. Fetch booking with slot and doctor details
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        slot: { select: { date: true, startTime: true, endTime: true } },
        doctor: {
          select: {
            id: true,
            doctorFullName: true,
            primarySpecialty: true,
            user: {
              select: {
                id: true,
                email: true,
                googleAccessToken: true,
                googleRefreshToken: true,
                googleTokenExpiry: true,
              },
            },
          },
        },
      },
    });

    if (!booking) {
      return NextResponse.json(
        { success: false, error: 'Cita no encontrada' },
        { status: 404 }
      );
    }

    if (booking.doctorId !== doctor.id) {
      return NextResponse.json(
        { success: false, error: 'No tienes permiso para esta cita' },
        { status: 403 }
      );
    }

    if (booking.status !== 'CONFIRMED') {
      return NextResponse.json(
        { success: false, error: 'Solo se puede enviar correo para citas con estado Agendada' },
        { status: 400 }
      );
    }

    if (!booking.patientEmail) {
      return NextResponse.json(
        { success: false, error: 'El paciente no tiene correo registrado' },
        { status: 400 }
      );
    }

    // 2. Resolve Google OAuth tokens
    const doctorUser = booking.doctor.user;
    if (!doctorUser?.googleAccessToken) {
      return NextResponse.json(
        {
          success: false,
          error: 'Necesitas conectar tu cuenta de Google para enviar correos. Cierra sesión e inicia sesión de nuevo.',
          code: 'NO_GOOGLE_TOKEN',
        },
        { status: 422 }
      );
    }

    let accessToken: string;
    let refreshToken: string | null;

    try {
      const resolved = await resolveTokens(doctorUser);
      accessToken = resolved.accessToken;
      refreshToken = resolved.refreshToken;

      // Persist refreshed token if updated
      if (resolved.updatedToken) {
        await prisma.user.update({
          where: { id: doctorUser.id },
          data: {
            googleAccessToken: resolved.updatedToken.accessToken,
            googleTokenExpiry: resolved.updatedToken.expiresAt,
          },
        });
      }
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: 'Tu sesión de Google expiró. Cierra sesión e inicia sesión de nuevo para renovar los permisos.',
          code: 'TOKEN_EXPIRED',
        },
        { status: 422 }
      );
    }

    // 3. Build email data
    const date =
      booking.slot?.date
        ? booking.slot.date.toISOString()
        : (booking.date?.toISOString() ?? '');
    const startTime = booking.slot?.startTime ?? booking.startTime ?? '';
    const endTime = booking.slot?.endTime ?? booking.endTime ?? '';

    // 4. Send email
    try {
      await sendAppointmentConfirmationEmail(
        {
          patientName: booking.patientName,
          patientEmail: booking.patientEmail,
          doctorName: booking.doctor.doctorFullName ?? doctor.doctorFullName,
          specialty: booking.doctor.primarySpecialty ?? null,
          date,
          startTime,
          endTime,
          serviceName: booking.serviceName,
          appointmentMode: booking.appointmentMode,
          isFirstTime: booking.isFirstTime,
          confirmationCode: booking.confirmationCode ?? '',
          finalPrice: Number(booking.finalPrice),
          notes: booking.notes,
        },
        accessToken,
        refreshToken,
        booking.doctor.doctorFullName ?? doctor.doctorFullName,
        doctorUser.email!
      );
    } catch (gmailError: any) {
      // Gmail API returns 403 when the token lacks gmail.send scope
      const status = gmailError?.status ?? gmailError?.code;
      if (status === 403 || status === 401) {
        return NextResponse.json(
          {
            success: false,
            error: 'Tu cuenta de Google no tiene permisos para enviar correos. Cierra sesión e inicia sesión de nuevo para otorgar el permiso.',
            code: 'GMAIL_SCOPE_MISSING',
          },
          { status: 422 }
        );
      }
      throw gmailError;
    }

    // 5. Persist send timestamp
    const sentAt = new Date();
    await prisma.booking.update({
      where: { id: bookingId },
      data: { confirmationEmailSentAt: sentAt },
    });

    return NextResponse.json({
      success: true,
      message: `Correo de confirmación enviado a ${booking.patientEmail}`,
      sentAt: sentAt.toISOString(),
    });
  } catch (error) {
    console.error('Error sending appointment confirmation email:', error);
    return NextResponse.json(
      { success: false, error: 'Error al enviar el correo' },
      { status: 500 }
    );
  }
}
