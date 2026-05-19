// POST /api/appointments/fiscal-form-link — Create a fiscal form link for a patient.
// Authenticated: Doctor only.

import { NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { validateAuthToken } from '../../../../lib/auth';
import { randomBytes } from 'crypto';

const FISCAL_TEMPLATE_ID = 'FISCAL';

export async function POST(request: Request) {
  try {
    const { userId } = await validateAuthToken(request);

    const doctor = await prisma.doctor.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!doctor) {
      return NextResponse.json(
        { success: false, error: 'Doctor no encontrado' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { patientId } = body;

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
      // Regenerate token for existing link
      const token = randomBytes(20).toString('hex');
      await prisma.appointmentFormLink.update({
        where: { id: existing.id },
        data: { token },
      });

      const url = `${process.env.NEXT_PUBLIC_BASE_URL || 'https://tusalud.pro'}/formulario-fiscal/${token}`;
      return NextResponse.json({
        success: true,
        data: { token, url, regenerated: true },
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
