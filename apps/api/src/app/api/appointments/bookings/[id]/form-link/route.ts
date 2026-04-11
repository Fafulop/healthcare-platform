// POST /api/appointments/bookings/[id]/form-link
// Generate (or regenerate) a pre-appointment form link for a CONFIRMED booking.
// One link per booking. If a PENDING link already exists, regenerates the token and updates the template.
// Returns 409 if the patient has already submitted the form.

import { NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { randomBytes } from 'crypto';
import { getAuthenticatedDoctor } from '@/lib/auth';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { doctor } = await getAuthenticatedDoctor(request);
    const { id: bookingId } = await params;

    const body = await request.json();
    const { templateId } = body;

    if (!templateId) {
      return NextResponse.json(
        { success: false, error: 'Se requiere una plantilla (templateId)' },
        { status: 400 }
      );
    }

    // 1. Verify booking exists and belongs to this doctor
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: {
        id: true,
        doctorId: true,
        status: true,
        patientName: true,
        patientEmail: true,
        patientId: true,
        formLink: {
          select: { id: true, status: true },
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
        { success: false, error: 'Solo se puede enviar un formulario a citas confirmadas (Agendada)' },
        { status: 400 }
      );
    }

    // 2. Verify template exists, belongs to this doctor, is a custom template, and is marked as isPreAppointment.
    // isCustom: true is required — only custom templates have customFields for the public form to render.
    const template = await prisma.encounterTemplate.findFirst({
      where: {
        id: templateId,
        doctorId: doctor.id,
        isCustom: true,
        isPreAppointment: true,
        isActive: true,
      },
      select: { id: true },
    });

    if (!template) {
      return NextResponse.json(
        { success: false, error: 'Plantilla no encontrada o no está marcada como pre-cita' },
        { status: 404 }
      );
    }

    const token = randomBytes(20).toString('hex');
    const publicUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://tusalud.pro';

    // 3. Check existing form link for this booking
    if (booking.formLink) {
      if (booking.formLink.status === 'SUBMITTED') {
        return NextResponse.json(
          { success: false, error: 'El paciente ya envió este formulario' },
          { status: 409 }
        );
      }

      // PENDING — regenerate token, update template, and refresh patient info from booking
      await prisma.appointmentFormLink.update({
        where: { id: booking.formLink.id },
        data: {
          token,
          templateId,
          patientName: booking.patientName,
          patientEmail: booking.patientEmail,
          patientId: booking.patientId ?? null,
        },
      });

      return NextResponse.json({
        success: true,
        data: {
          token,
          url: `${publicUrl}/formulario-cita/${token}`,
          regenerated: true,
        },
      });
    }

    // 4. Create new form link
    await prisma.appointmentFormLink.create({
      data: {
        token,
        doctorId: doctor.id,
        bookingId,
        templateId,
        patientName: booking.patientName,
        patientEmail: booking.patientEmail,
        patientId: booking.patientId ?? null,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        token,
        url: `${publicUrl}/formulario-cita/${token}`,
        regenerated: false,
      },
    });
  } catch (error) {
    console.error('Error generating appointment form link:', error);
    return NextResponse.json(
      { success: false, error: 'Error al generar el enlace del formulario' },
      { status: 500 }
    );
  }
}

// DELETE /api/appointments/bookings/[id]/form-link
// PENDING → hard delete (no patient data to preserve)
// SUBMITTED → detach only (bookingId = null), keeps record in patient expediente via patientId
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { doctor } = await getAuthenticatedDoctor(request);
    const { id: bookingId } = await params;

    // Verify booking exists and belongs to this doctor
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: {
        doctorId: true,
        formLink: { select: { id: true, status: true } },
      },
    });

    if (!booking) {
      return NextResponse.json({ success: false, error: 'Cita no encontrada' }, { status: 404 });
    }

    if (booking.doctorId !== doctor.id) {
      return NextResponse.json({ success: false, error: 'No tienes permiso para esta cita' }, { status: 403 });
    }

    if (!booking.formLink) {
      return NextResponse.json({ success: false, error: 'Esta cita no tiene formulario' }, { status: 404 });
    }

    if (booking.formLink.status === 'SUBMITTED') {
      // Detach only — preserve in patient expediente via formLink.patientId
      await prisma.appointmentFormLink.update({
        where: { id: booking.formLink.id },
        data: { bookingId: null },
      });
    } else {
      // PENDING — hard delete, no patient data was captured
      await prisma.appointmentFormLink.delete({ where: { id: booking.formLink.id } });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting appointment form link:', error);
    return NextResponse.json(
      { success: false, error: 'Error al eliminar el formulario' },
      { status: 500 }
    );
  }
}
