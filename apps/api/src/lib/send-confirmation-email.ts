// Shared utility: auto-send appointment confirmation email to patient.
// Called after a booking is created (doctor flow) or confirmed (pending → confirmed).
// Sets confirmationEmailSentAt so the UI shows "Reenviar" instead of "Correo" by default.
// For TELEMEDICINA appointments, creates a Google Meet link before sending (same as manual send).

import { prisma } from '@healthcare/database';
import { resolveTokens, ensureMeetLink } from '@/lib/google-calendar';
import { sendAppointmentConfirmationEmail } from '@/lib/gmail';
import { getCalendarTokens } from '@/lib/appointments-utils';

export async function sendBookingConfirmationEmail(bookingId: string): Promise<void> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      slot: {
        select: {
          date: true,
          startTime: true,
          endTime: true,
          googleEventId: true,
          location: { select: { name: true, address: true, phone: true } },
        },
      },
      doctor: {
        select: {
          doctorFullName: true,
          primarySpecialty: true,
          clinicAddress: true,
          clinicPhone: true,
          user: {
            select: {
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

  if (!booking?.patientEmail) return;
  if (!booking.doctor.user?.googleAccessToken || !booking.doctor.user?.email) return;

  const { accessToken, refreshToken } = await resolveTokens(booking.doctor.user);

  const date = booking.slot?.date
    ? booking.slot.date.toISOString()
    : (booking.date?.toISOString() ?? '');
  const startTime = booking.slot?.startTime ?? booking.startTime ?? '';
  const endTime = booking.slot?.endTime ?? booking.endTime ?? '';
  const clinicAddress =
    booking.slot?.location?.address ?? booking.doctor.clinicAddress ?? undefined;
  const clinicPhone =
    booking.slot?.location?.phone ?? booking.doctor.clinicPhone ?? undefined;

  // For TELEMEDICINA: create Google Meet link before sending (same as manual send-email route)
  let meetLink: string | null = booking.meetLink ?? null;
  if (booking.appointmentMode === 'TELEMEDICINA' && !meetLink) {
    try {
      const calTokens = await getCalendarTokens(booking.doctorId);
      const calAccessToken = calTokens?.accessToken ?? accessToken;
      const calRefreshToken = calTokens?.refreshToken ?? refreshToken;
      const calendarId = calTokens?.calendarId ?? 'primary';
      const googleEventId = booking.slot?.googleEventId ?? booking.googleEventId ?? null;

      const result = await ensureMeetLink(
        calAccessToken,
        calRefreshToken,
        calendarId,
        googleEventId,
        bookingId,
        {
          date: date.split('T')[0],
          startTime,
          endTime,
          patientName: booking.patientName,
        }
      );

      if (result) {
        meetLink = result.meetUrl;
      }
    } catch (meetError) {
      // Non-blocking: send email without Meet link if creation fails
      console.error('[Meet] Failed to create Meet link during auto-send:', meetError);
    }
  }

  await sendAppointmentConfirmationEmail(
    {
      patientName: booking.patientName,
      patientEmail: booking.patientEmail,
      doctorName: booking.doctor.doctorFullName,
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
      clinicAddress,
      clinicPhone,
      isRescheduled: booking.isRescheduled,
      meetLink,
    },
    accessToken,
    refreshToken,
    booking.doctor.doctorFullName,
    booking.doctor.user.email
  );

  // Single update: persist meetLink (if created) + confirmationEmailSentAt together
  await prisma.booking.update({
    where: { id: bookingId },
    data: {
      ...(meetLink && meetLink !== booking.meetLink ? { meetLink } : {}),
      confirmationEmailSentAt: new Date(),
    },
  });
}
