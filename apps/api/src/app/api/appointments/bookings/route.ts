// POST /api/appointments/bookings - Create a new booking
// GET /api/appointments/bookings - Get bookings (for doctor or admin)

import { NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import crypto from 'crypto';
import {
  sendPatientSMS,
  sendDoctorSMS,
  isSMSConfigured,
} from '@/lib/sms';
import { validateAuthToken } from '@/lib/auth';

// Helper to generate confirmation code
function generateConfirmationCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Helper to generate unique review token
function generateReviewToken(): string {
  return crypto.randomBytes(32).toString('hex');
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

    if (!slot.isOpen) {
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

    // Generate confirmation code and review token
    const confirmationCode = generateConfirmationCode();
    const reviewToken = generateReviewToken();

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
          reviewToken,
          status: 'PENDING',
        },
      }),
      prisma.appointmentSlot.update({
        where: { id: slotId },
        data: {
          currentBookings: { increment: 1 },
          // Note: Availability is now determined by isOpen and currentBookings < maxBookings
          // No need to update status field (removed from schema)
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
        finalPrice: Number(bookingWithSlot.finalPrice),
        confirmationCode,
        clinicAddress: bookingWithSlot.doctor.clinicAddress || undefined,
        specialty: bookingWithSlot.doctor.primarySpecialty || undefined,
        reviewToken,
      };

      // Send PENDING SMS to patient (acknowledgment that request was received)
      sendPatientSMS(smsDetails, 'PENDING').catch((error) =>
        console.error('SMS patient notification (PENDING) failed:', error)
      );

      // Send to doctor (don't await - let it run in background)
      sendDoctorSMS(smsDetails).catch((error) =>
        console.error('SMS doctor notification failed:', error)
      );

      // TODO: Send email to patient (future implementation)
      // sendPatientEmail(emailDetails, 'PENDING').catch(...)
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
    // Authenticate user
    const { email, role, userId, doctorId: authenticatedDoctorId } = await validateAuthToken(request);

    const { searchParams } = new URL(request.url);
    const requestedDoctorId = searchParams.get('doctorId');
    const patientEmail = searchParams.get('patientEmail');
    const status = searchParams.get('status');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const where: any = {};

    // Authorization scoping: doctors can only see their own bookings
    if (role === 'ADMIN') {
      // Admins can filter by doctorId if provided, otherwise see all
      if (requestedDoctorId) {
        where.doctorId = requestedDoctorId;
      }
    } else if (role === 'DOCTOR') {
      // Doctors can ONLY see their own bookings
      if (!authenticatedDoctorId) {
        return NextResponse.json(
          {
            success: false,
            error: 'Doctor profile not found for this user',
          },
          { status: 403 }
        );
      }

      // Force scope to authenticated doctor's ID only
      where.doctorId = authenticatedDoctorId;
    } else {
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized - only doctors and admins can view bookings',
        },
        { status: 403 }
      );
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

    // Handle authentication errors
    if (error instanceof Error) {
      if (
        error.message.includes('authorization') ||
        error.message.includes('token') ||
        error.message.includes('authentication')
      ) {
        return NextResponse.json(
          {
            success: false,
            error: error.message,
          },
          { status: 401 }
        );
      }
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch bookings',
      },
      { status: 500 }
    );
  }
}
