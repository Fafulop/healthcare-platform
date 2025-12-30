// POST /api/appointments/bookings - Create a new booking
// GET /api/appointments/bookings - Get bookings (for doctor or admin)

import { NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import {
  sendPatientSMS,
  sendDoctorSMS,
  isSMSConfigured,
} from '@/lib/sms';

// Helper to generate confirmation code
function generateConfirmationCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// POST - Create a booking
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      slotId,
      patientName,
      patientEmail,
      patientPhone,
      patientWhatsapp,
      notes,
    } = body;

    // Validation
    if (!slotId || !patientName || !patientEmail || !patientPhone) {
      return NextResponse.json(
        {
          success: false,
          error: 'slotId, patientName, patientEmail, and patientPhone are required',
        },
        { status: 400 }
      );
    }

    // Check if slot exists and is available
    const slot = await prisma.appointmentSlot.findUnique({
      where: { id: slotId },
      include: {
        bookings: {
          where: { status: { notIn: ['CANCELLED'] } },
        },
      },
    });

    if (!slot) {
      return NextResponse.json(
        { success: false, error: 'Appointment slot not found' },
        { status: 404 }
      );
    }

    if (slot.status === 'BLOCKED') {
      return NextResponse.json(
        { success: false, error: 'This slot is not available for booking' },
        { status: 400 }
      );
    }

    if (slot.currentBookings >= slot.maxBookings) {
      return NextResponse.json(
        { success: false, error: 'This slot is fully booked' },
        { status: 400 }
      );
    }

    // Generate confirmation code
    const confirmationCode = generateConfirmationCode();

    // Create booking and update slot in a transaction
    const [booking, updatedSlot] = await prisma.$transaction([
      prisma.booking.create({
        data: {
          slotId,
          doctorId: slot.doctorId,
          patientName,
          patientEmail,
          patientPhone,
          patientWhatsapp,
          notes,
          finalPrice: slot.finalPrice,
          confirmationCode,
          status: 'PENDING',
        },
      }),
      prisma.appointmentSlot.update({
        where: { id: slotId },
        data: {
          currentBookings: { increment: 1 },
          status:
            slot.currentBookings + 1 >= slot.maxBookings ? 'BOOKED' : 'AVAILABLE',
        },
      }),
    ]);

    // Include slot details in response
    const bookingWithSlot = await prisma.booking.findUnique({
      where: { id: booking.id },
      include: {
        slot: true,
        doctor: {
          select: {
            doctorFullName: true,
            primarySpecialty: true,
            clinicAddress: true,
            clinicPhone: true,
            clinicWhatsapp: true,
          },
        },
      },
    });

    // Send SMS notifications (async, non-blocking)
    if (isSMSConfigured() && bookingWithSlot) {
      const smsDetails = {
        patientName,
        patientPhone: patientPhone,
        doctorName: bookingWithSlot.doctor.doctorFullName,
        doctorPhone: bookingWithSlot.doctor.clinicPhone || undefined,
        date: bookingWithSlot.slot.date.toISOString(),
        startTime: bookingWithSlot.slot.startTime,
        endTime: bookingWithSlot.slot.endTime,
        duration: bookingWithSlot.slot.duration,
        finalPrice: bookingWithSlot.finalPrice,
        confirmationCode,
        clinicAddress: bookingWithSlot.doctor.clinicAddress || undefined,
        specialty: bookingWithSlot.doctor.primarySpecialty || undefined,
      };

      // Send to patient (don't await - let it run in background)
      sendPatientSMS(smsDetails).catch((error) =>
        console.error('SMS patient notification failed:', error)
      );

      // Send to doctor (don't await - let it run in background)
      sendDoctorSMS(smsDetails).catch((error) =>
        console.error('SMS doctor notification failed:', error)
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: bookingWithSlot,
        message: 'Booking created successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating booking:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create booking',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// GET - Get bookings (filtered by doctor or email)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const doctorId = searchParams.get('doctorId');
    const patientEmail = searchParams.get('patientEmail');
    const status = searchParams.get('status');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const where: any = {};

    if (doctorId) {
      where.doctorId = doctorId;
    }

    if (patientEmail) {
      where.patientEmail = patientEmail;
    }

    if (status) {
      where.status = status;
    }

    // Date range filter on the slot
    if (startDate || endDate) {
      where.slot = {};
      if (startDate && endDate) {
        where.slot.date = {
          gte: new Date(startDate),
          lte: new Date(endDate),
        };
      } else if (startDate) {
        where.slot.date = { gte: new Date(startDate) };
      }
    }

    const bookings = await prisma.booking.findMany({
      where,
      include: {
        slot: true,
        doctor: {
          select: {
            doctorFullName: true,
            primarySpecialty: true,
            clinicAddress: true,
            clinicPhone: true,
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }],
    });

    return NextResponse.json({
      success: true,
      count: bookings.length,
      data: bookings,
    });
  } catch (error) {
    console.error('Error fetching bookings:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch bookings',
      },
      { status: 500 }
    );
  }
}
