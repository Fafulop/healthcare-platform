// POST /api/appointments/ranges/block
// Block a time window within existing availability ranges by splitting them.
// Ranges with active bookings in the block zone are protected (skipped).
// All mutations are wrapped in a transaction for atomicity.

import { NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { validateAuthToken } from '@/lib/auth';
import { logActivity } from '@/lib/activity-logger';

/** Validate that a time string is on a 15-minute boundary. */
function isValid15MinBoundary(time: string): boolean {
  const match = time.match(/^(\d{2}):(\d{2})$/);
  if (!match) return false;
  const h = Number(match[1]);
  const m = Number(match[2]);
  return h >= 0 && h <= 23 && [0, 15, 30, 45].includes(m);
}

function timeToMin(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function minToTime(m: number): string {
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

export async function POST(request: Request) {
  try {
    const { role, userId, doctorId: authenticatedDoctorId } = await validateAuthToken(request);

    const body = await request.json();
    const { doctorId, startDate, endDate, blockStartTime, blockEndTime, dryRun = true } = body;

    if (!doctorId || !startDate || !endDate || !blockStartTime || !blockEndTime) {
      return NextResponse.json(
        { success: false, error: 'Faltan campos requeridos: doctorId, startDate, endDate, blockStartTime, blockEndTime' },
        { status: 400 }
      );
    }

    // Authorization
    if (role === 'DOCTOR') {
      if (doctorId !== authenticatedDoctorId) {
        return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 403 });
      }
    } else if (role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 403 });
    }

    // Validate time boundaries
    if (!isValid15MinBoundary(blockStartTime) || !isValid15MinBoundary(blockEndTime)) {
      return NextResponse.json(
        { success: false, error: 'Los horarios deben ser en intervalos de 15 minutos (ej: 09:00, 09:15, 09:30, 09:45)' },
        { status: 400 }
      );
    }

    if (blockStartTime >= blockEndTime) {
      return NextResponse.json(
        { success: false, error: 'La hora de inicio del bloqueo debe ser anterior a la hora de fin' },
        { status: 400 }
      );
    }

    const blockStartMin = timeToMin(blockStartTime);
    const blockEndMin = timeToMin(blockEndTime);

    // Iterate all dates in the range
    const start = new Date(startDate + 'T12:00:00Z');
    const end = new Date(endDate + 'T12:00:00Z');
    const dates: Date[] = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const normalized = new Date(d);
      normalized.setUTCHours(0, 0, 0, 0);
      dates.push(new Date(normalized));
    }

    if (dates.length === 0) {
      return NextResponse.json(
        { success: false, error: 'El rango de fechas es inválido' },
        { status: 400 }
      );
    }

    // Collect all operations to execute
    interface SplitOp {
      rangeId: string;
      date: string;
      originalStart: string;
      originalEnd: string;
      action: 'delete' | 'update_start' | 'update_end' | 'split_middle';
      newStartTime?: string;
      newEndTime?: string;
      // For split_middle: two new sub-ranges
      subRange1?: { startTime: string; endTime: string };
      subRange2?: { startTime: string; endTime: string };
      // Preserved from original
      intervalMinutes: number;
      locationId: string | null;
    }

    const operations: SplitOp[] = [];
    const protectedRanges: Array<{
      date: string;
      startTime: string;
      endTime: string;
      activeBookings: Array<{ patientName: string; startTime: string; endTime: string }>;
    }> = [];

    for (const dateObj of dates) {
      const dateKey = dateObj.toISOString().split('T')[0];

      // Fetch ranges for this date that overlap the block window
      const ranges = await prisma.availabilityRange.findMany({
        where: {
          doctorId,
          date: dateObj,
          startTime: { lt: blockEndTime },
          endTime: { gt: blockStartTime },
        },
        select: {
          id: true,
          date: true,
          startTime: true,
          endTime: true,
          intervalMinutes: true,
          locationId: true,
        },
      });

      for (const range of ranges) {
        const rangeStartMin = timeToMin(range.startTime);
        const rangeEndMin = timeToMin(range.endTime);

        // Check for active bookings in the OVERLAP zone (not the entire range)
        const overlapStart = Math.max(rangeStartMin, blockStartMin);
        const overlapEnd = Math.min(rangeEndMin, blockEndMin);
        const overlapStartTime = minToTime(overlapStart);
        const overlapEndTime = minToTime(overlapEnd);

        const activeBookings = await prisma.booking.findMany({
          where: {
            doctorId,
            status: { in: ['PENDING', 'CONFIRMED'] },
            OR: [
              {
                slotId: null,
                date: range.date,
                startTime: { lt: overlapEndTime },
                endTime: { gt: overlapStartTime },
              },
              {
                slot: {
                  date: range.date,
                  startTime: { lt: overlapEndTime },
                  endTime: { gt: overlapStartTime },
                },
              },
            ],
          },
          select: { patientName: true, startTime: true, endTime: true },
        });

        if (activeBookings.length > 0) {
          protectedRanges.push({
            date: dateKey,
            startTime: range.startTime,
            endTime: range.endTime,
            activeBookings: activeBookings.map((b) => ({
              patientName: b.patientName,
              startTime: b.startTime ?? '',
              endTime: b.endTime ?? '',
            })),
          });
          continue;
        }

        // Determine split action
        const blockCoversAll = blockStartMin <= rangeStartMin && blockEndMin >= rangeEndMin;
        const blockCutsStart = blockStartMin <= rangeStartMin && blockEndMin < rangeEndMin;
        const blockCutsEnd = blockStartMin > rangeStartMin && blockEndMin >= rangeEndMin;
        const blockInMiddle = blockStartMin > rangeStartMin && blockEndMin < rangeEndMin;

        if (blockCoversAll) {
          operations.push({
            rangeId: range.id,
            date: dateKey,
            originalStart: range.startTime,
            originalEnd: range.endTime,
            action: 'delete',
            intervalMinutes: range.intervalMinutes,
            locationId: range.locationId,
          });
        } else if (blockCutsStart) {
          // New start = blockEndTime. Check if remaining range is long enough.
          const remaining = rangeEndMin - blockEndMin;
          if (remaining < range.intervalMinutes) {
            // Too short, just delete
            operations.push({
              rangeId: range.id,
              date: dateKey,
              originalStart: range.startTime,
              originalEnd: range.endTime,
              action: 'delete',
              intervalMinutes: range.intervalMinutes,
              locationId: range.locationId,
            });
          } else {
            operations.push({
              rangeId: range.id,
              date: dateKey,
              originalStart: range.startTime,
              originalEnd: range.endTime,
              action: 'update_start',
              newStartTime: blockEndTime,
              intervalMinutes: range.intervalMinutes,
              locationId: range.locationId,
            });
          }
        } else if (blockCutsEnd) {
          const remaining = blockStartMin - rangeStartMin;
          if (remaining < range.intervalMinutes) {
            operations.push({
              rangeId: range.id,
              date: dateKey,
              originalStart: range.startTime,
              originalEnd: range.endTime,
              action: 'delete',
              intervalMinutes: range.intervalMinutes,
              locationId: range.locationId,
            });
          } else {
            operations.push({
              rangeId: range.id,
              date: dateKey,
              originalStart: range.startTime,
              originalEnd: range.endTime,
              action: 'update_end',
              newEndTime: blockStartTime,
              intervalMinutes: range.intervalMinutes,
              locationId: range.locationId,
            });
          }
        } else if (blockInMiddle) {
          const leftLen = blockStartMin - rangeStartMin;
          const rightLen = rangeEndMin - blockEndMin;
          const leftValid = leftLen >= range.intervalMinutes;
          const rightValid = rightLen >= range.intervalMinutes;

          if (!leftValid && !rightValid) {
            // Both halves too short — delete entirely
            operations.push({
              rangeId: range.id,
              date: dateKey,
              originalStart: range.startTime,
              originalEnd: range.endTime,
              action: 'delete',
              intervalMinutes: range.intervalMinutes,
              locationId: range.locationId,
            });
          } else if (!leftValid) {
            // Only right half survives
            operations.push({
              rangeId: range.id,
              date: dateKey,
              originalStart: range.startTime,
              originalEnd: range.endTime,
              action: 'update_start',
              newStartTime: blockEndTime,
              intervalMinutes: range.intervalMinutes,
              locationId: range.locationId,
            });
          } else if (!rightValid) {
            // Only left half survives
            operations.push({
              rangeId: range.id,
              date: dateKey,
              originalStart: range.startTime,
              originalEnd: range.endTime,
              action: 'update_end',
              newEndTime: blockStartTime,
              intervalMinutes: range.intervalMinutes,
              locationId: range.locationId,
            });
          } else {
            // Both halves valid — split into two
            operations.push({
              rangeId: range.id,
              date: dateKey,
              originalStart: range.startTime,
              originalEnd: range.endTime,
              action: 'split_middle',
              subRange1: { startTime: range.startTime, endTime: blockStartTime },
              subRange2: { startTime: blockEndTime, endTime: range.endTime },
              intervalMinutes: range.intervalMinutes,
              locationId: range.locationId,
            });
          }
        }
      }
    }

    // Compute summary
    let rangesDeleted = 0;
    let rangesModified = 0;
    let rangesCreated = 0;
    for (const op of operations) {
      if (op.action === 'delete') rangesDeleted++;
      else if (op.action === 'update_start' || op.action === 'update_end') rangesModified++;
      else if (op.action === 'split_middle') { rangesDeleted++; rangesCreated += 2; }
    }

    // Dry run — return preview
    if (dryRun) {
      return NextResponse.json({
        success: true,
        dryRun: true,
        datesProcessed: dates.length,
        rangesAffected: operations.length,
        rangesDeleted,
        rangesModified,
        rangesCreated,
        protected: protectedRanges.length,
        protectedRanges,
      });
    }

    // Execute all operations in a transaction
    await prisma.$transaction(async (tx) => {
      for (const op of operations) {
        if (op.action === 'delete') {
          await tx.availabilityRange.delete({ where: { id: op.rangeId } });
        } else if (op.action === 'update_start') {
          await tx.availabilityRange.update({
            where: { id: op.rangeId },
            data: { startTime: op.newStartTime! },
          });
        } else if (op.action === 'update_end') {
          await tx.availabilityRange.update({
            where: { id: op.rangeId },
            data: { endTime: op.newEndTime! },
          });
        } else if (op.action === 'split_middle') {
          // Delete original
          await tx.availabilityRange.delete({ where: { id: op.rangeId } });
          // Fetch original's date for creating new ranges
          const dateObj = new Date(op.date + 'T00:00:00Z');
          // Create left sub-range
          await tx.availabilityRange.create({
            data: {
              doctorId,
              date: dateObj,
              startTime: op.subRange1!.startTime,
              endTime: op.subRange1!.endTime,
              intervalMinutes: op.intervalMinutes,
              locationId: op.locationId,
            },
          });
          // Create right sub-range
          await tx.availabilityRange.create({
            data: {
              doctorId,
              date: dateObj,
              startTime: op.subRange2!.startTime,
              endTime: op.subRange2!.endTime,
              intervalMinutes: op.intervalMinutes,
              locationId: op.locationId,
            },
          });
        }
      }
    });

    // Log activity
    logActivity({
      doctorId,
      userId,
      actionType: 'RANGES_BLOCKED',
      entityType: 'APPOINTMENT',
      entityId: doctorId,
      displayMessage: `Bloqueado horario ${blockStartTime}–${blockEndTime} (${startDate} a ${endDate}): ${operations.length} rango(s) afectados${protectedRanges.length > 0 ? `, ${protectedRanges.length} protegido(s)` : ''}`,
      icon: 'Ban',
      color: 'orange',
      metadata: {
        type: 'range_block',
        startDate,
        endDate,
        blockStartTime,
        blockEndTime,
        rangesDeleted,
        rangesModified,
        rangesCreated,
        protected: protectedRanges.length,
      },
    }).catch((err) => console.error('Activity log failed:', err));

    return NextResponse.json({
      success: true,
      datesProcessed: dates.length,
      rangesAffected: operations.length,
      rangesDeleted,
      rangesModified,
      rangesCreated,
      protected: protectedRanges.length,
      protectedRanges,
    });
  } catch (error) {
    console.error('Error blocking time in ranges:', error);

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
      { success: false, error: 'Error al bloquear horario' },
      { status: 500 }
    );
  }
}
