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
    const { startTime, endTime, duration, basePrice, discount, discountType, isOpen } =
      body;

    // Check if slot exists and isn't booked
    const existingSlot = await prisma.appointmentSlot.findUnique({
      where: { id },
      include: {
        bookings: {
          where: { status: { notIn: ['CANCELLED', 'COMPLETED', 'NO_SHOW'] } },
        },
      },
    });

    if (!existingSlot) {
      return NextResponse.json(
        { success: false, error: 'Slot not found' },
        { status: 404 }
      );
    }

    // Prevent editing if slot has active bookings (except for toggling isOpen)
    if (existingSlot.bookings.length > 0 && isOpen !== existingSlot.isOpen) {
      return NextResponse.json(
        {
          success: false,
          error: 'Cannot edit slot with active bookings',
        },
        { status: 400 }
      );
    }

    // Calculate final price if basePrice or discount fields are being updated
    const finalPrice =
      basePrice !== undefined || discount !== undefined || discountType !== undefined
        ? calculateFinalPrice(
            basePrice !== undefined ? basePrice : existingSlot.basePrice.toNumber(),
            discount !== undefined ? discount : existingSlot.discount?.toNumber() ?? null,
            discountType !== undefined ? discountType : existingSlot.discountType
          )
        : undefined;

    const updated = await prisma.appointmentSlot.update({
      where: { id },
      data: {
        ...(startTime !== undefined && { startTime }),
        ...(endTime !== undefined && { endTime }),
        ...(duration !== undefined && { duration }),
        ...(basePrice !== undefined && { basePrice }),
        ...(discount !== undefined && { discount }),
        ...(discountType !== undefined && { discountType }),
        ...(finalPrice !== undefined && { finalPrice }),
        ...(isOpen !== undefined && { isOpen }),
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

// PATCH - Toggle slot open/closed (replaces block/unblock)
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { isOpen } = body;

    if (typeof isOpen !== 'boolean') {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid isOpen. Must be a boolean (true or false)',
        },
        { status: 400 }
      );
    }

    // Check if slot has bookings when trying to close it
    if (!isOpen) {
      const slot = await prisma.appointmentSlot.findUnique({
        where: { id },
        include: {
          bookings: {
            where: { status: { notIn: ['CANCELLED', 'COMPLETED', 'NO_SHOW'] } },
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
            error: `Cannot close slot with ${slot.bookings.length} active booking(s). Please cancel the bookings first.`,
          },
          { status: 400 }
        );
      }
    }

    const updated = await prisma.appointmentSlot.update({
      where: { id },
      data: { isOpen },
    });

    return NextResponse.json({
      success: true,
      data: updated,
      message: `Slot ${isOpen ? 'opened for bookings' : 'closed for bookings'}`,
    });
  } catch (error) {
    console.error('Error updating slot isOpen status:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update slot status',
      },
      { status: 500 }
    );
  }
}
