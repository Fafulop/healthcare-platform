// PUT /api/appointments/slots/[id] - Update a single slot
// DELETE /api/appointments/slots/[id] - Delete a single slot
// PATCH /api/appointments/slots/[id] - Update slot status (block/unblock)

import { NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { logSlotDeleted, logSlotOpened, logSlotClosed, logSlotUpdated } from '@/lib/activity-logger';
import { updateSlotEvent, deleteEvent, resolveTokens } from '@/lib/google-calendar';

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

    // Prevent editing time/price fields if slot has active bookings (use PATCH for isOpen)
    const hasActiveBookings = existingSlot.bookings.length > 0;
    const isEditingFields = startTime !== undefined || endTime !== undefined || duration !== undefined || basePrice !== undefined || discount !== undefined || discountType !== undefined;
    if (hasActiveBookings && isEditingFields) {
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

    // Log activity for field changes (not isOpen toggle — that's handled by PATCH)
    const changedFields: string[] = [];
    if (startTime !== undefined && startTime !== existingSlot.startTime) changedFields.push("hora inicio");
    if (endTime !== undefined && endTime !== existingSlot.endTime) changedFields.push("hora fin");
    if (duration !== undefined && duration !== existingSlot.duration) changedFields.push("duración");
    if (basePrice !== undefined && basePrice !== existingSlot.basePrice.toNumber()) changedFields.push("precio");
    if (discount !== undefined) changedFields.push("descuento");
    if (discountType !== undefined) changedFields.push("tipo descuento");

    if (changedFields.length > 0) {
      logSlotUpdated({
        doctorId: existingSlot.doctorId,
        slotId: id,
        startTime: updated.startTime,
        endTime: updated.endTime,
        date: updated.date.toISOString().split('T')[0],
        changedFields,
      });
    }

    // Sync to Google Calendar (fire-and-forget)
    if (updated.googleEventId) {
      getCalendarTokens(existingSlot.doctorId).then(tokens => {
        if (!tokens) return;
        const dateStr = updated.date.toISOString().split('T')[0];
        updateSlotEvent(tokens.accessToken, tokens.refreshToken, tokens.calendarId, updated.googleEventId!, {
          id: updated.id,
          date: dateStr,
          startTime: updated.startTime,
          endTime: updated.endTime,
          isOpen: updated.isOpen,
          finalPrice: updated.finalPrice.toNumber(),
        }).catch((err) => console.error('[GCal sync] updateSlotEvent (PUT):', err));
      }).catch((err) => console.error('[GCal sync] getCalendarTokens (PUT):', err));
    }

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

    // Check if slot has active (non-terminal) bookings
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
          error:
            'Cannot delete slot with active bookings. Consider blocking it instead.',
        },
        { status: 400 }
      );
    }

    // Sync deletion to Google Calendar (fire-and-forget, before DB delete)
    if (slot.googleEventId) {
      getCalendarTokens(slot.doctorId).then(tokens => {
        if (!tokens) return;
        deleteEvent(tokens.accessToken, tokens.refreshToken, tokens.calendarId, slot.googleEventId!).catch((err) => console.error('[GCal sync] deleteEvent (slot DELETE):', err));
      }).catch((err) => console.error('[GCal sync] getCalendarTokens (slot DELETE):', err));
    }

    await prisma.appointmentSlot.delete({
      where: { id },
    });

    // Log activity
    logSlotDeleted({
      doctorId: slot.doctorId,
      slotId: slot.id,
      startTime: slot.startTime,
      endTime: slot.endTime,
      date: slot.date.toISOString().split('T')[0],
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

    // Log activity
    const dateStr = updated.date.toISOString().split('T')[0];
    if (isOpen) {
      logSlotOpened({
        doctorId: updated.doctorId,
        slotId: updated.id,
        startTime: updated.startTime,
        endTime: updated.endTime,
        date: dateStr,
      });
    } else {
      logSlotClosed({
        doctorId: updated.doctorId,
        slotId: updated.id,
        startTime: updated.startTime,
        endTime: updated.endTime,
        date: dateStr,
      });
    }

    // Sync to Google Calendar (fire-and-forget)
    if (updated.googleEventId) {
      getCalendarTokens(updated.doctorId).then(tokens => {
        if (!tokens) return;
        const dateStr = updated.date.toISOString().split('T')[0];
        updateSlotEvent(tokens.accessToken, tokens.refreshToken, tokens.calendarId, updated.googleEventId!, {
          id: updated.id,
          date: dateStr,
          startTime: updated.startTime,
          endTime: updated.endTime,
          isOpen: updated.isOpen,
          finalPrice: updated.finalPrice.toNumber(),
        }).catch((err) => console.error('[GCal sync] updateSlotEvent (PATCH isOpen):', err));
      }).catch((err) => console.error('[GCal sync] getCalendarTokens (PATCH isOpen):', err));
    }

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
