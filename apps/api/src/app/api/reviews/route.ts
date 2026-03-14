// POST /api/reviews - Submit a review using a one-time token
// GET /api/reviews?token={token} - Verify review token

import { NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';

// GET - Verify review token (booking-based or standalone)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'token is required' },
        { status: 400 }
      );
    }

    // 1. Try booking-based token
    const booking = await prisma.booking.findUnique({
      where: { reviewToken: token },
      include: {
        doctor: { select: { doctorFullName: true, primarySpecialty: true } },
        slot: { select: { date: true, startTime: true } },
        review: true,
      },
    });

    if (booking) {
      if (booking.reviewTokenUsed || booking.review) {
        return NextResponse.json(
          { success: false, valid: false, error: 'This review link has already been used' },
          { status: 400 }
        );
      }
      return NextResponse.json({
        success: true,
        valid: true,
        data: {
          doctorName: booking.doctor.doctorFullName,
          specialty: booking.doctor.primarySpecialty,
          appointmentDate: booking.slot?.date ?? booking.date,
          appointmentTime: booking.slot?.startTime ?? booking.startTime,
          patientName: booking.patientName,
        },
      });
    }

    // 2. Try standalone review link
    const reviewLink = await prisma.reviewLink.findUnique({
      where: { token },
      include: { doctor: { select: { doctorFullName: true, primarySpecialty: true } } },
    });

    if (!reviewLink) {
      return NextResponse.json(
        { success: false, valid: false, error: 'Invalid review token' },
        { status: 404 }
      );
    }

    if (reviewLink.used) {
      return NextResponse.json(
        { success: false, valid: false, error: 'This review link has already been used' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      valid: true,
      data: {
        doctorName: reviewLink.doctor.doctorFullName,
        specialty: reviewLink.doctor.primarySpecialty,
        appointmentDate: null,
        appointmentTime: null,
        patientName: reviewLink.patientName,
      },
    });
  } catch (error) {
    console.error('Error verifying review token:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to verify token' },
      { status: 500 }
    );
  }
}

// POST - Submit review (booking-based or standalone)
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { token, rating, comment, patientName } = body;

    if (!token || !rating || !comment) {
      return NextResponse.json(
        { success: false, error: 'token, rating, and comment are required' },
        { status: 400 }
      );
    }

    if (rating < 1 || rating > 5 || !Number.isInteger(rating)) {
      return NextResponse.json(
        { success: false, error: 'rating must be an integer between 1 and 5' },
        { status: 400 }
      );
    }

    if (comment.trim().length < 10) {
      return NextResponse.json(
        { success: false, error: 'comment must be at least 10 characters' },
        { status: 400 }
      );
    }

    if (comment.length > 1000) {
      return NextResponse.json(
        { success: false, error: 'comment must be less than 1000 characters' },
        { status: 400 }
      );
    }

    // 1. Try booking-based token
    const booking = await prisma.booking.findUnique({
      where: { reviewToken: token },
      include: {
        doctor: { select: { id: true, slug: true, doctorFullName: true } },
        review: true,
      },
    });

    if (booking) {
      if (booking.reviewTokenUsed || booking.review) {
        return NextResponse.json(
          { success: false, error: 'This review link has already been used' },
          { status: 400 }
        );
      }

      const [review] = await prisma.$transaction([
        prisma.review.create({
          data: {
            doctorId: booking.doctorId,
            bookingId: booking.id,
            patientName: patientName?.trim() || null,
            rating,
            comment: comment.trim(),
            approved: true,
          },
        }),
        prisma.booking.update({
          where: { id: booking.id },
          data: { reviewTokenUsed: true },
        }),
      ]);

      await triggerRevalidation(booking.doctor.slug);

      return NextResponse.json(
        {
          success: true,
          data: { id: review.id, doctorName: booking.doctor.doctorFullName, rating: review.rating, createdAt: review.createdAt },
          message: 'Review submitted successfully',
        },
        { status: 201 }
      );
    }

    // 2. Try standalone review link
    const reviewLink = await prisma.reviewLink.findUnique({
      where: { token },
      include: { doctor: { select: { id: true, slug: true, doctorFullName: true } } },
    });

    if (!reviewLink) {
      return NextResponse.json(
        { success: false, error: 'Invalid review token' },
        { status: 404 }
      );
    }

    if (reviewLink.used) {
      return NextResponse.json(
        { success: false, error: 'This review link has already been used' },
        { status: 400 }
      );
    }

    const [review] = await prisma.$transaction([
      prisma.review.create({
        data: {
          doctorId: reviewLink.doctorId,
          patientName: patientName?.trim() || reviewLink.patientName || null,
          rating,
          comment: comment.trim(),
          approved: true,
        },
      }),
      prisma.reviewLink.update({
        where: { id: reviewLink.id },
        data: { used: true },
      }),
    ]);

    await triggerRevalidation(reviewLink.doctor.slug);

    return NextResponse.json(
      {
        success: true,
        data: { id: review.id, doctorName: reviewLink.doctor.doctorFullName, rating: review.rating, createdAt: review.createdAt },
        message: 'Review submitted successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error submitting review:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to submit review', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

async function triggerRevalidation(doctorSlug: string) {
  const publicAppUrl = process.env.NEXT_PUBLIC_BASE_URL;
  if (!publicAppUrl || !doctorSlug) return;
  try {
    await fetch(`${publicAppUrl}/api/revalidate?path=/doctores/${doctorSlug}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    // Non-fatal
  }
}
