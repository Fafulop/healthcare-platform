// POST /api/appointments/slots/bulk - Bulk operations on slots

import { NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { validateAuthToken } from '@/lib/auth';
import { logSlotsBulkDeleted, logSlotsBulkOpened, logSlotsBulkClosed } from '@/lib/activity-logger';

export async function POST(request: Request) {
  try {
    const { role, doctorId: authenticatedDoctorId } = await validateAuthToken(request);

    if (role !== 'DOCTOR' && role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

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

    // Scope slot queries to the authenticated doctor (admins can act on any doctor's slots)
    const ownershipWhere: { id: { in: string[] }; doctorId?: string } = { id: { in: slotIds } };
    if (role === 'DOCTOR') ownershipWhere.doctorId = authenticatedDoctorId!;

    // Delete multiple slots
    if (action === 'delete') {
      const slotsWithBookings = await prisma.appointmentSlot.findMany({
        where: {
          ...ownershipWhere,
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
        return NextResponse.json(
          {
            success: false,
            error:
              'Some slots have active bookings and cannot be deleted. Consider blocking them instead.',
          },
          { status: 400 }
        );
      }

      const [, deleted] = await prisma.$transaction([
        prisma.booking.updateMany({
          where: { slotId: { in: slotIds }, status: { in: ['CANCELLED', 'COMPLETED', 'NO_SHOW'] } },
          data: { slotId: null },
        }),
        prisma.appointmentSlot.deleteMany({
          where: { ...ownershipWhere },
        }),
      ]);

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
      const slotsWithBookings = await prisma.appointmentSlot.findMany({
        where: {
          ...ownershipWhere,
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
        where: { ...ownershipWhere },
        data: {
          isOpen: false,
        },
      });

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
      const slotsToOpen = await prisma.appointmentSlot.findMany({
        where: { ...ownershipWhere },
        select: { id: true, doctorId: true },
      });

      const updated = await prisma.appointmentSlot.updateMany({
        where: { ...ownershipWhere },
        data: { isOpen: true },
      });

      const doctorIdForOpen = slotsToOpen[0]?.doctorId;
      if (doctorIdForOpen) {
        logSlotsBulkOpened({ doctorId: doctorIdForOpen, count: updated.count });
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

    if (error instanceof Error) {
      if (
        error.message.includes('authorization') ||
        error.message.includes('token') ||
        error.message.includes('authentication')
      ) {
        return NextResponse.json({ success: false, error: error.message }, { status: 401 });
      }
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to perform bulk operation',
      },
      { status: 500 }
    );
  }
}
