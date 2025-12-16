// POST /api/appointments/slots/bulk - Bulk operations on slots

import { NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, slotIds } = body;

    if (!action || !slotIds || !Array.isArray(slotIds) || slotIds.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'action and slotIds array are required',
        },
        { status: 400 }
      );
    }

    // Delete multiple slots
    if (action === 'delete') {
      // Check if any slots have bookings
      const slotsWithBookings = await prisma.appointmentSlot.findMany({
        where: {
          id: { in: slotIds },
        },
        include: {
          bookings: {
            where: { status: { notIn: ['CANCELLED'] } },
          },
        },
      });

      const hasBookings = slotsWithBookings.some(
        (slot) => slot.bookings.length > 0
      );

      if (hasBookings) {
        return NextResponse.json(
          {
            success: false,
            error:
              'Some slots have active bookings and cannot be deleted. Consider blocking them instead.',
          },
          { status: 400 }
        );
      }

      const deleted = await prisma.appointmentSlot.deleteMany({
        where: {
          id: { in: slotIds },
        },
      });

      return NextResponse.json({
        success: true,
        message: `Deleted ${deleted.count} slots`,
        count: deleted.count,
      });
    }

    // Block multiple slots
    if (action === 'block') {
      const updated = await prisma.appointmentSlot.updateMany({
        where: {
          id: { in: slotIds },
        },
        data: {
          status: 'BLOCKED',
        },
      });

      return NextResponse.json({
        success: true,
        message: `Blocked ${updated.count} slots`,
        count: updated.count,
      });
    }

    // Unblock multiple slots
    if (action === 'unblock') {
      const updated = await prisma.appointmentSlot.updateMany({
        where: {
          id: { in: slotIds },
          status: 'BLOCKED',
        },
        data: {
          status: 'AVAILABLE',
        },
      });

      return NextResponse.json({
        success: true,
        message: `Unblocked ${updated.count} slots`,
        count: updated.count,
      });
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Invalid action. Must be delete, block, or unblock',
      },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error performing bulk operation:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to perform bulk operation',
      },
      { status: 500 }
    );
  }
}
