// DELETE /api/reviews/[id] - Delete a review (doctor or admin only)

import { NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { validateAuthToken } from '@/lib/auth';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Authenticate
    let authUser;
    try {
      authUser = await validateAuthToken(request);
    } catch (error) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Find the review
    const review = await prisma.review.findUnique({
      where: { id },
      select: {
        id: true,
        doctorId: true,
      },
    });

    if (!review) {
      return NextResponse.json(
        { success: false, error: 'Review not found' },
        { status: 404 }
      );
    }

    // Authorization: doctor can only delete reviews on their own profile
    if (authUser.role === 'DOCTOR') {
      if (review.doctorId !== authUser.doctorId) {
        return NextResponse.json(
          { success: false, error: 'No tienes permiso para eliminar esta opinion.' },
          { status: 403 }
        );
      }
    } else if (authUser.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    // Delete the review
    await prisma.review.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: 'Review deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting review:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete review',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
