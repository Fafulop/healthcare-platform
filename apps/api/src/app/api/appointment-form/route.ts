// GET  /api/appointment-form?token={token} — Public. Validate token, return template + appointment context.
// POST /api/appointment-form                — Public. Submit filled form data.
// No authentication required — called by patients from apps/public.

import { NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { isTelegramConfigured, sendFormSubmittedTelegram } from '@/lib/telegram';

// Returns today's date as YYYY-MM-DD in Mexico City timezone.
function todayMexicoCity(): string {
  return new Date().toLocaleString('sv-SE', { timeZone: 'America/Mexico_City' }).split(' ')[0];
}

// Resolves the appointment date string (YYYY-MM-DD) from a booking.
// Prefers slot.date for slot-based bookings, falls back to booking.date for freeform.
function resolveAppointmentDate(
  slot: { date: Date } | null,
  bookingDate: Date | null
): string | null {
  const raw = slot?.date ?? bookingDate ?? null;
  return raw ? raw.toISOString().split('T')[0] : null;
}

function resolveAppointmentTime(
  slot: { startTime: string } | null,
  bookingStartTime: string | null
): string | null {
  return slot?.startTime ?? bookingStartTime ?? null;
}

// GET — Validate token and return data needed to render the public form
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Se requiere el token' },
        { status: 400 }
      );
    }

    // Fetch form link with booking (+ slot) and doctor
    const formLink = await prisma.appointmentFormLink.findUnique({
      where: { token },
      include: {
        doctor: {
          select: {
            doctorFullName: true,
            primarySpecialty: true,
          },
        },
        booking: {
          select: {
            date: true,
            startTime: true,
            slot: {
              select: {
                date: true,
                startTime: true,
              },
            },
          },
        },
      },
    });

    if (!formLink) {
      return NextResponse.json(
        { success: false, error: 'Este enlace no es válido' },
        { status: 404 }
      );
    }

    if (formLink.status === 'SUBMITTED') {
      return NextResponse.json(
        { success: false, error: 'Este formulario ya fue enviado', alreadySubmitted: true },
        { status: 410 }
      );
    }

    // Check expiry: if the appointment date is strictly before today, the link has expired
    const appointmentDate = resolveAppointmentDate(formLink.booking?.slot ?? null, formLink.booking?.date ?? null);
    if (appointmentDate && appointmentDate < todayMexicoCity()) {
      return NextResponse.json(
        { success: false, error: 'Este enlace ha expirado', expired: true },
        { status: 410 }
      );
    }

    // Fetch the template (cross-schema lookup by plain string templateId)
    const template = await prisma.encounterTemplate.findUnique({
      where: { id: formLink.templateId },
      select: {
        name: true,
        description: true,
        customFields: true,
      },
    });

    if (!template) {
      return NextResponse.json(
        { success: false, error: 'La plantilla de este formulario ya no está disponible' },
        { status: 404 }
      );
    }

    // Filter out file-type fields — file uploads are not supported on the public form
    const customFields = Array.isArray(template.customFields)
      ? (template.customFields as any[]).filter((f) => f.type !== 'file')
      : [];

    return NextResponse.json({
      success: true,
      data: {
        patientName: formLink.patientName,
        doctorName: formLink.doctor.doctorFullName,
        doctorSpecialty: formLink.doctor.primarySpecialty,
        appointmentDate,
        appointmentTime: resolveAppointmentTime(formLink.booking?.slot ?? null, formLink.booking?.startTime ?? null),
        template: {
          name: template.name,
          description: template.description,
          customFields,
        },
      },
    });
  } catch (error) {
    console.error('Error validating appointment form token:', error);
    return NextResponse.json(
      { success: false, error: 'Error al validar el enlace' },
      { status: 500 }
    );
  }
}

// POST — Submit the filled form
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { token, data } = body;

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Se requiere el token' },
        { status: 400 }
      );
    }

    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return NextResponse.json(
        { success: false, error: 'Los datos del formulario deben ser un objeto' },
        { status: 400 }
      );
    }

    // Fetch form link with booking slot for expiry check + doctor for Telegram
    const formLink = await prisma.appointmentFormLink.findUnique({
      where: { token },
      include: {
        doctor: { select: { telegramChatId: true, telegramNotifyForm: true } },
        booking: {
          select: {
            date: true,
            startTime: true,
            patientId: true,
            slot: { select: { date: true, startTime: true } },
          },
        },
      },
    });

    if (!formLink) {
      return NextResponse.json(
        { success: false, error: 'Este enlace no es válido' },
        { status: 404 }
      );
    }

    if (formLink.status === 'SUBMITTED') {
      return NextResponse.json(
        { success: false, error: 'Este formulario ya fue enviado', alreadySubmitted: true },
        { status: 410 }
      );
    }

    const appointmentDate = resolveAppointmentDate(formLink.booking?.slot ?? null, formLink.booking?.date ?? null);
    if (appointmentDate && appointmentDate < todayMexicoCity()) {
      return NextResponse.json(
        { success: false, error: 'Este enlace ha expirado', expired: true },
        { status: 410 }
      );
    }

    // Mark as submitted; if booking is already linked to a patient, stamp patientId directly
    await prisma.appointmentFormLink.update({
      where: { id: formLink.id },
      data: {
        status: 'SUBMITTED',
        submissionData: data,
        submittedAt: new Date(),
        ...(formLink.booking?.patientId ? { patientId: formLink.booking.patientId } : {}),
      },
    });

    // Notify doctor via Telegram (fire-and-forget)
    if (isTelegramConfigured() && formLink.doctor?.telegramChatId && formLink.doctor?.telegramNotifyForm) {
      sendFormSubmittedTelegram(formLink.doctor.telegramChatId, {
        patientName: formLink.patientName,
        date: appointmentDate,
        startTime: resolveAppointmentTime(formLink.booking?.slot ?? null, formLink.booking?.startTime ?? null),
      }).catch((err) => console.error('Telegram form-submitted notification failed:', err));
    }

    return NextResponse.json(
      { success: true, message: '¡Formulario enviado exitosamente!' },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error submitting appointment form:', error);
    return NextResponse.json(
      { success: false, error: 'Error al enviar el formulario' },
      { status: 500 }
    );
  }
}
