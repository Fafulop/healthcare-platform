// POST /api/appointments/fiscal-form-link — Create a fiscal form link for a patient.
// Authenticated: Doctor only.

import { NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { validateAuthToken } from '../../../../lib/auth';
import { randomBytes } from 'crypto';

const FISCAL_TEMPLATE_ID = 'FISCAL';

export async function POST(request: Request) {
  try {
    const { doctorId } = await validateAuthToken(request);

    if (!doctorId) {
      return NextResponse.json(
        { success: false, error: 'Doctor no encontrado' },
        { status: 404 }
      );
    }

    const doctor = { id: doctorId };

    const body = await request.json();
    // `regenerar` es EXPLÍCITO. Antes no existía y este endpoint rotaba el token en CADA
    // llamada si ya había un enlace PENDIENTE: el doctor mandaba el enlace por WhatsApp,
    // volvía a la tabla (o refrescaba, que le borraba el estado en pantalla), hacía clic otra
    // vez creyendo que empezaba y el enlace que el paciente YA tenía dejaba de servir — sin
    // aviso de ningún lado. Ahora reclamar el enlace existente es la operación por defecto y
    // rotar el token solo pasa si alguien lo pide a propósito.
    const { patientId, regenerar } = body;

    if (!patientId) {
      return NextResponse.json(
        { success: false, error: 'Se requiere patientId' },
        { status: 400 }
      );
    }

    // Verify patient belongs to this doctor
    const patient = await prisma.patient.findFirst({
      where: { id: patientId, doctorId: doctor.id },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        requiereFactura: true,
        rfc: true,
      },
    });

    if (!patient) {
      return NextResponse.json(
        { success: false, error: 'Paciente no encontrado' },
        { status: 404 }
      );
    }

    // If patient already has fiscal data, inform the doctor
    if (patient.rfc && patient.requiereFactura) {
      return NextResponse.json(
        {
          success: false,
          error: 'Este paciente ya tiene datos fiscales registrados. Puedes editarlos desde su expediente.',
          existingRfc: patient.rfc,
        },
        { status: 409 }
      );
    }

    // Check if there's already a PENDING fiscal form for this patient
    const existing = await prisma.appointmentFormLink.findFirst({
      where: {
        doctorId: doctor.id,
        patientId: patient.id,
        templateId: FISCAL_TEMPLATE_ID,
        status: 'PENDING',
      },
    });

    if (existing) {
      // Por defecto se DEVUELVE el enlace que ya existe — el que el paciente puede tener en la
      // mano. Solo con `regenerar: true` se rota el token, y eso INVALIDA el anterior: es una
      // acción que el doctor tiene que pedir sabiendo lo que hace.
      const token = regenerar === true
        ? randomBytes(20).toString('hex')
        : existing.token;

      if (regenerar === true) {
        await prisma.appointmentFormLink.update({
          where: { id: existing.id },
          data: { token },
        });
      }

      const url = `${process.env.NEXT_PUBLIC_BASE_URL || 'https://tusalud.pro'}/formulario-fiscal/${token}`;
      return NextResponse.json({
        success: true,
        data: { token, url, regenerated: regenerar === true, reutilizado: regenerar !== true },
      });
    }

    // Create new fiscal form link
    const token = randomBytes(20).toString('hex');
    await prisma.appointmentFormLink.create({
      data: {
        token,
        doctorId: doctor.id,
        patientId: patient.id,
        templateId: FISCAL_TEMPLATE_ID,
        patientName: `${patient.firstName} ${patient.lastName}`,
        patientEmail: patient.email || '',
        status: 'PENDING',
      },
    });

    const url = `${process.env.NEXT_PUBLIC_BASE_URL || 'https://tusalud.pro'}/formulario-fiscal/${token}`;

    return NextResponse.json({
      success: true,
      data: { token, url, regenerated: false },
    });
  } catch (error) {
    console.error('Error creating fiscal form link:', error);
    return NextResponse.json(
      { success: false, error: 'Error al crear el enlace del formulario fiscal' },
      { status: 500 }
    );
  }
}
