import { prisma } from '@healthcare/database';

// Parse "YYYY-MM-DD" as local midnight, avoiding UTC interpretation
export function normalizeDate(dateStr: string): Date {
  const parts = dateStr.split('-').map(Number);
  return new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0);
}

export interface ConflictEntry {
  date: string;
  startTime: string;
  endTime: string;
}

export interface ConflictResult {
  appointmentConflicts: any[];
  taskConflicts: any[];
  hasBookedAppointments: boolean;
  appointmentCheckFailed: boolean;
  taskCheckFailed: boolean;
}

export async function checkConflictsForEntry(
  doctorId: string,
  entry: ConflictEntry,
  excludeTaskId?: string
): Promise<ConflictResult> {
  const { date, startTime, endTime } = entry;

  // 1. Fetch appointment slot conflicts from remote API
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3003';
  const slotsUrl = `${apiUrl}/api/appointments/slots?doctorId=${doctorId}&startDate=${date}&endDate=${date}`;

  let appointmentConflicts: any[] = [];
  let appointmentCheckFailed = false;
  try {
    const slotsResponse = await fetch(slotsUrl);
    if (slotsResponse.ok) {
      const slotsData = await slotsResponse.json();
      const slots = slotsData.data || [];

      appointmentConflicts = slots.filter((slot: any) => {
        const isActive = slot.status === 'AVAILABLE' || slot.status === 'BOOKED';
        const overlaps = slot.startTime < endTime && slot.endTime > startTime;
        return isActive && overlaps;
      });
    } else {
      console.error('Appointment API returned non-ok status:', slotsResponse.status);
      appointmentCheckFailed = true;
    }
  } catch (error) {
    console.error('Error checking appointment conflicts:', error);
    appointmentCheckFailed = true;
  }

  // 2. Query local task conflicts
  const taskWhere: any = {
    doctorId,
    dueDate: normalizeDate(date),
    startTime: { not: null },
    endTime: { not: null },
    status: { in: ['PENDIENTE', 'EN_PROGRESO'] },
    AND: [
      { startTime: { lt: endTime } },
      { endTime: { gt: startTime } },
    ],
  };

  if (excludeTaskId) {
    taskWhere.id = { not: excludeTaskId };
  }

  let taskConflicts: any[] = [];
  let taskCheckFailed = false;
  try {
    taskConflicts = await prisma.task.findMany({
      where: taskWhere,
      select: {
        id: true,
        title: true,
        dueDate: true,
        startTime: true,
        endTime: true,
        status: true,
        priority: true,
      },
    });
  } catch (error) {
    console.error('Error checking task conflicts:', error);
    taskCheckFailed = true;
  }

  const hasBookedAppointments = appointmentConflicts.some(
    (slot: any) => slot.status === 'BOOKED'
  );

  return {
    appointmentConflicts,
    taskConflicts,
    hasBookedAppointments,
    appointmentCheckFailed,
    taskCheckFailed,
  };
}
