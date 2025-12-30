// POST /api/reviews - Submit a review using a one-time token
// GET /api/reviews?token={token} - Verify review token

import { NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';

// GET - Verify review token
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        {
          success: false,
          error: 'token is required',
        },
        { status: 400 }
      );
    }

    // Find booking with this review token
    const booking = await prisma.booking.findUnique({
      where: { reviewToken: token },
      include: {
        doctor: {
          select: {
            doctorFullName: true,
            primarySpecialty: true,
          },
        },
        slot: {
          select: {
            date: true,
            startTime: true,
          },
        },
        review: true,
      },
    });

    // Check if token exists
    if (!booking) {
      return NextResponse.json(
        {
          success: false,
          valid: false,
          error: 'Invalid review token',
        },
        { status: 404 }
      );
    }

    // Check if token has already been used
    if (booking.reviewTokenUsed || booking.review) {
      return NextResponse.json(
        {
          success: false,
          valid: false,
          error: 'This review link has already been used',
        },
        { status: 400 }
      );
    }

    // Token is valid
    return NextResponse.json({
      success: true,
      valid: true,
      data: {
        doctorName: booking.doctor.doctorFullName,
        specialty: booking.doctor.primarySpecialty,
        appointmentDate: booking.slot.date,
        appointmentTime: booking.slot.startTime,
        patientName: booking.patientName,
      },
    });
  } catch (error) {
    console.error('Error verifying review token:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to verify token',
      },
      { status: 500 }
    );
  }
}

// POST - Submit review

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { token, rating, comment, patientName } = body;

    // Validation
    if (!token || !rating || !comment) {
      return NextResponse.json(
        {
          success: false,
          error: 'token, rating, and comment are required',
        },
        { status: 400 }
      );
    }

    // Validate rating is between 1-5
    if (rating < 1 || rating > 5 || !Number.isInteger(rating)) {
      return NextResponse.json(
        {
          success: false,
          error: 'rating must be an integer between 1 and 5',
        },
        { status: 400 }
      );
    }

    // Validate comment length
    if (comment.trim().length < 10) {
      return NextResponse.json(
        {
          success: false,
          error: 'comment must be at least 10 characters',
        },
        { status: 400 }
      );
    }

    if (comment.length > 1000) {
      return NextResponse.json(
        {
          success: false,
          error: 'comment must be less than 1000 characters',
        },
        { status: 400 }
      );
    }

    // Find booking with this review token
    const booking = await prisma.booking.findUnique({
      where: { reviewToken: token },
      include: {
        doctor: {
          select: {
            id: true,
            slug: true,
            doctorFullName: true,
          },
        },
        review: true,
      },
    });

    // Check if token exists
    if (!booking) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid review token',
        },
        { status: 404 }
      );
    }

    // Check if token has already been used
    if (booking.reviewTokenUsed || booking.review) {
      return NextResponse.json(
        {
          success: false,
          error: 'This review link has already been used',
        },
        { status: 400 }
      );
    }

    // Create review and mark token as used in a transaction
    const [review] = await prisma.$transaction([
      prisma.review.create({
        data: {
          doctorId: booking.doctorId,
          bookingId: booking.id,
          patientName: patientName?.trim() || null,
          rating,
          comment: comment.trim(),
          approved: true, // Auto-approve for MVP
        },
      }),
      prisma.booking.update({
        where: { id: booking.id },
        data: {
          reviewTokenUsed: true,
        },
      }),
    ]);

    // Trigger on-demand revalidation of doctor profile page
    const publicAppUrl = process.env.NEXT_PUBLIC_BASE_URL;
    const doctorSlug = booking.doctor.slug;

    if (publicAppUrl && doctorSlug) {
      try {
        await fetch(
          `${publicAppUrl}/api/revalidate?path=/doctores/${doctorSlug}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          }
        );
        console.log(`✅ Triggered revalidation for /doctores/${doctorSlug}`);
      } catch (revalidateError) {
        console.warn('⚠️ Failed to trigger revalidation:', revalidateError);
        // Don't fail the review submission if revalidation fails
      }
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          id: review.id,
          doctorName: booking.doctor.doctorFullName,
          rating: review.rating,
          createdAt: review.createdAt,
        },
        message: 'Review submitted successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error submitting review:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to submit review',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
