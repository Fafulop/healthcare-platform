// POST /api/appointments/slots/bulk - Bulk operations on slots

import { NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { logSlotsBulkDeleted, logSlotsBulkOpened, logSlotsBulkClosed } from '@/lib/activity-logger';
import { deleteEvent, updateSlotEvent, resolveTokens } from '@/lib/google-calendar';

async function getCalendarTokens(doctorId: string) {
  const doctor = await prisma.doctor.findUnique({
    where: { id: doctorId },
    select: {
      googleCalendarId: true,
      googleCalendarEnabled: true,
      user: {
        select: {
          id: true,
          googleAccessToken: true,
          googleRefreshToken: true,
          googleTokenExpiry: true,
        },
      },
    },
  });
  if (!doctor?.googleCalendarEnabled || !doctor.googleCalendarId || !doctor.user) return null;
  try {
    const { accessToken, refreshToken, updatedToken } = await resolveTokens(doctor.user);
    if (updatedToken) {
      await prisma.user.update({
        where: { id: doctor.user.id },
        data: { googleAccessToken: updatedToken.accessToken, googleTokenExpiry: updatedToken.expiresAt },
      });
    }
    return { accessToken, refreshToken, calendarId: doctor.googleCalendarId };
  } catch { return null; }
}

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

      const deleted = await prisma.appointmentSlot.deleteMany({
        where: {
          id: { in: slotIds },
        },
      });

      // Log activity + sync to Google Calendar (fire-and-forget)
      const doctorIdForDelete = slotsWithBookings[0]?.doctorId;
      if (doctorIdForDelete) {
        logSlotsBulkDeleted({ doctorId: doctorIdForDelete, count: deleted.count });
        getCalendarTokens(doctorIdForDelete).then(tokens => {
          if (!tokens) return;
          for (const slot of slotsWithBookings) {
            if (slot.googleEventId) {
              deleteEvent(tokens.accessToken, tokens.refreshToken, tokens.calendarId, slot.googleEventId)
                .catch((err) => console.error('[GCal sync] deleteEvent (bulk DELETE):', err));
            }
          }
        }).catch((err) => console.error('[GCal sync] getCalendarTokens (bulk DELETE):', err));
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

      // Log activity + sync to Google Calendar (fire-and-forget)
      const doctorIdForClose = slotsWithBookings[0]?.doctorId;
      if (doctorIdForClose) {
        logSlotsBulkClosed({ doctorId: doctorIdForClose, count: updated.count });
        getCalendarTokens(doctorIdForClose).then(tokens => {
          if (!tokens) return;
          for (const slot of slotsWithBookings) {
            if (slot.googleEventId) {
              const dateStr = slot.date.toISOString().split('T')[0];
              updateSlotEvent(tokens.accessToken, tokens.refreshToken, tokens.calendarId, slot.googleEventId, {
                id: slot.id,
                date: dateStr,
                startTime: slot.startTime,
                endTime: slot.endTime,
                isOpen: false,
                finalPrice: Number(slot.finalPrice),
              }).catch((err) => console.error('[GCal sync] updateSlotEvent (bulk CLOSE):', err));
            }
          }
        }).catch((err) => console.error('[GCal sync] getCalendarTokens (bulk CLOSE):', err));
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
        where: { id: { in: slotIds } },
        select: { id: true, doctorId: true, date: true, startTime: true, endTime: true, finalPrice: true, googleEventId: true },
      });

      const updated = await prisma.appointmentSlot.updateMany({
        where: { id: { in: slotIds } },
        data: { isOpen: true },
      });

      // Log activity + sync to Google Calendar (fire-and-forget)
      const doctorIdForOpen = slotsToOpen[0]?.doctorId;
      if (doctorIdForOpen) {
        logSlotsBulkOpened({ doctorId: doctorIdForOpen, count: updated.count });
        getCalendarTokens(doctorIdForOpen).then(tokens => {
          if (!tokens) return;
          for (const slot of slotsToOpen) {
            if (slot.googleEventId) {
              const dateStr = slot.date.toISOString().split('T')[0];
              updateSlotEvent(tokens.accessToken, tokens.refreshToken, tokens.calendarId, slot.googleEventId, {
                id: slot.id,
                date: dateStr,
                startTime: slot.startTime,
                endTime: slot.endTime,
                isOpen: true,
                finalPrice: Number(slot.finalPrice),
              }).catch((err) => console.error('[GCal sync] updateSlotEvent (bulk OPEN):', err));
            }
          }
        }).catch((err) => console.error('[GCal sync] getCalendarTokens (bulk OPEN):', err));
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
