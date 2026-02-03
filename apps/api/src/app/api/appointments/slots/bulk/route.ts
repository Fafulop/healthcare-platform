// POST /api/appointments/slots/bulk - Bulk operations on slots

import { NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { logSlotsBulkDeleted, logSlotsBulkOpened, logSlotsBulkClosed } from '@/lib/activity-logger';

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

      // Log activity
      const doctorIdForDelete = slotsWithBookings[0]?.doctorId;
      if (doctorIdForDelete) {
        logSlotsBulkDeleted({ doctorId: doctorIdForDelete, count: deleted.count });
      }

      return NextResponse.json({
        success: true,
        message: `Deleted ${deleted.count} slots`,
        count: deleted.count,
      });
    }

    // Close multiple slots (prevent new bookings)
    if (action === 'close') {
      // Check if any slots have active bookings
      const slotsWithBookings = await prisma.appointmentSlot.findMany({
        where: {
          id: { in: slotIds },
        },
        include: {
          bookings: {
            where: { status: { notIn: ['CANCELLED', 'COMPLETED', 'NO_SHOW'] } },
          },
        },
      });

      const hasBookings = slotsWithBookings.some(
        (slot) => slot.bookings.length > 0
      );

      if (hasBookings) {
        const slotsWithActiveBookings = slotsWithBookings.filter(
          (slot) => slot.bookings.length > 0
        );
        return NextResponse.json(
          {
            success: false,
            error: `${slotsWithActiveBookings.length} horario(s) tienen reservas activas y no se pueden cerrar. Por favor cancela las reservas primero.`,
          },
          { status: 400 }
        );
      }

      const updated = await prisma.appointmentSlot.updateMany({
        where: {
          id: { in: slotIds },
        },
        data: {
          isOpen: false,
        },
      });

      // Log activity
      const doctorIdForClose = slotsWithBookings[0]?.doctorId;
      if (doctorIdForClose) {
        logSlotsBulkClosed({ doctorId: doctorIdForClose, count: updated.count });
      }

      return NextResponse.json({
        success: true,
        message: `Cerrados ${updated.count} horarios`,
        count: updated.count,
      });
    }

    // Open multiple slots (allow new bookings)
    if (action === 'open') {
      // Fetch one slot to get doctorId for logging
      const sampleSlot = await prisma.appointmentSlot.findFirst({
        where: { id: { in: slotIds } },
        select: { doctorId: true },
      });

      const updated = await prisma.appointmentSlot.updateMany({
        where: {
          id: { in: slotIds },
        },
        data: {
          isOpen: true,
        },
      });

      // Log activity
      if (sampleSlot) {
        logSlotsBulkOpened({ doctorId: sampleSlot.doctorId, count: updated.count });
      }

      return NextResponse.json({
        success: true,
        message: `Abiertos ${updated.count} horarios`,
        count: updated.count,
      });
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Invalid action. Must be delete, close, or open',
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
