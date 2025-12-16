// PUT /api/appointments/slots/[id] - Update a single slot
// DELETE /api/appointments/slots/[id] - Delete a single slot
// PATCH /api/appointments/slots/[id] - Update slot status (block/unblock)

import { NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';

// Helper function to calculate final price
function calculateFinalPrice(
  basePrice: number,
  discount: number | null,
  discountType: string | null
): number {
  if (!discount || !discountType) return basePrice;

  if (discountType === 'PERCENTAGE') {
    return basePrice - (basePrice * discount) / 100;
  } else if (discountType === 'FIXED') {
    return Math.max(0, basePrice - discount);
  }

  return basePrice;
}

// PUT - Update slot
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { startTime, endTime, duration, basePrice, discount, discountType, status } =
      body;

    // Check if slot exists and isn't booked
    const existingSlot = await prisma.appointmentSlot.findUnique({
      where: { id },
      include: {
        bookings: {
          where: { status: { notIn: ['CANCELLED'] } },
        },
      },
    });

    if (!existingSlot) {
      return NextResponse.json(
        { success: false, error: 'Slot not found' },
        { status: 404 }
      );
    }

    // Prevent editing if slot has active bookings (except for blocking)
    if (existingSlot.bookings.length > 0 && status !== 'BLOCKED') {
      return NextResponse.json(
        {
          success: false,
          error: 'Cannot edit slot with active bookings',
        },
        { status: 400 }
      );
    }

    const finalPrice = calculateFinalPrice(basePrice, discount, discountType);

    const updated = await prisma.appointmentSlot.update({
      where: { id },
      data: {
        ...(startTime && { startTime }),
        ...(endTime && { endTime }),
        ...(duration && { duration }),
        ...(basePrice !== undefined && { basePrice }),
        ...(discount !== undefined && { discount }),
        ...(discountType !== undefined && { discountType }),
        ...(basePrice !== undefined && { finalPrice }),
        ...(status && { status }),
      },
    });

    return NextResponse.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    console.error('Error updating slot:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update slot',
      },
      { status: 500 }
    );
  }
}

// DELETE - Delete slot
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Check if slot has bookings
    const slot = await prisma.appointmentSlot.findUnique({
      where: { id },
      include: {
        bookings: {
          where: { status: { notIn: ['CANCELLED'] } },
        },
      },
    });

    if (!slot) {
      return NextResponse.json(
        { success: false, error: 'Slot not found' },
        { status: 404 }
      );
    }

    if (slot.bookings.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Cannot delete slot with active bookings. Consider blocking it instead.',
        },
        { status: 400 }
      );
    }

    await prisma.appointmentSlot.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: 'Slot deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting slot:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete slot',
      },
      { status: 500 }
    );
  }
}

// PATCH - Update slot status (block/unblock)
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { status } = body;

    if (!status || !['AVAILABLE', 'BLOCKED'].includes(status)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid status. Must be AVAILABLE or BLOCKED',
        },
        { status: 400 }
      );
    }

    const updated = await prisma.appointmentSlot.update({
      where: { id },
      data: { status },
    });

    return NextResponse.json({
      success: true,
      data: updated,
      message: `Slot ${status === 'BLOCKED' ? 'blocked' : 'unblocked'} successfully`,
    });
  } catch (error) {
    console.error('Error updating slot status:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update slot status',
      },
      { status: 500 }
    );
  }
}
