import { prisma } from "@healthcare/database";

export type ActivityActionType =
  | "TASK_CREATED"
  | "TASK_UPDATED"
  | "TASK_COMPLETED"
  | "TASK_DELETED"
  | "TASK_BULK_DELETED"
  | "TASK_STATUS_CHANGED"
  | "TASK_CANCELLED"
  | "SLOTS_CREATED"
  | "SLOT_DELETED"
  | "SLOTS_BULK_DELETED"
  | "SLOT_OPENED"
  | "SLOT_CLOSED"
  | "SLOTS_BULK_OPENED"
  | "SLOTS_BULK_CLOSED"
  | "BOOKING_CONFIRMED"
  | "BOOKING_CANCELLED"
  | "BOOKING_COMPLETED"
  | "BOOKING_NO_SHOW";

export type ActivityEntityType = "TASK" | "APPOINTMENT" | "BOOKING" | "PRESCRIPTION" | "PATIENT";

interface LogActivityParams {
  doctorId: string;
  actionType: ActivityActionType;
  entityType: ActivityEntityType;
  entityId?: string;
  displayMessage: string;
  icon?: string;
  color?: string;
  metadata?: Record<string, any>;
  userId?: string;
}

export async function logActivity(params: LogActivityParams) {
  try {
    await prisma.activityLog.create({
      data: {
        doctorId: params.doctorId,
        actionType: params.actionType,
        entityType: params.entityType,
        entityId: params.entityId,
        displayMessage: params.displayMessage,
        icon: params.icon,
        color: params.color,
        metadata: params.metadata || {},
        userId: params.userId,
      },
    });
  } catch (error) {
    console.error("Failed to log activity:", error);
  }
}

export async function logSlotsCreated(params: {
  doctorId: string;
  count: number;
  mode: string;
  date?: string;
  startDate?: string;
  endDate?: string;
  startTime: string;
  endTime: string;
  duration: number;
  basePrice: number;
}) {
  const dateInfo = params.mode === "single"
    ? params.date || ""
    : `${params.startDate} a ${params.endDate}`;

  await logActivity({
    doctorId: params.doctorId,
    actionType: "SLOTS_CREATED",
    entityType: "APPOINTMENT",
    displayMessage: `Creados ${params.count} horarios para ${dateInfo}`,
    icon: "CalendarPlus",
    color: "purple",
    metadata: {
      count: params.count,
      mode: params.mode,
      date: params.date,
      startDate: params.startDate,
      endDate: params.endDate,
      startTime: params.startTime,
      endTime: params.endTime,
      duration: params.duration,
      basePrice: params.basePrice,
    },
  });
}

export async function logSlotDeleted(params: {
  doctorId: string;
  slotId: string;
  startTime: string;
  endTime: string;
  date: string;
}) {
  await logActivity({
    doctorId: params.doctorId,
    actionType: "SLOT_DELETED",
    entityType: "APPOINTMENT",
    entityId: params.slotId,
    displayMessage: `Horario eliminado: ${params.startTime}-${params.endTime}, ${params.date}`,
    icon: "Trash2",
    color: "red",
    metadata: {
      slotId: params.slotId,
      startTime: params.startTime,
      endTime: params.endTime,
      date: params.date,
    },
  });
}

export async function logSlotsBulkDeleted(params: {
  doctorId: string;
  count: number;
}) {
  await logActivity({
    doctorId: params.doctorId,
    actionType: "SLOTS_BULK_DELETED",
    entityType: "APPOINTMENT",
    displayMessage: `Eliminados ${params.count} horarios`,
    icon: "Trash2",
    color: "red",
    metadata: {
      count: params.count,
    },
  });
}

export async function logSlotOpened(params: {
  doctorId: string;
  slotId: string;
  startTime: string;
  endTime: string;
  date: string;
}) {
  await logActivity({
    doctorId: params.doctorId,
    actionType: "SLOT_OPENED",
    entityType: "APPOINTMENT",
    entityId: params.slotId,
    displayMessage: `Horario abierto: ${params.startTime}-${params.endTime}, ${params.date}`,
    icon: "Unlock",
    color: "green",
    metadata: {
      slotId: params.slotId,
      startTime: params.startTime,
      endTime: params.endTime,
      date: params.date,
    },
  });
}

export async function logSlotClosed(params: {
  doctorId: string;
  slotId: string;
  startTime: string;
  endTime: string;
  date: string;
}) {
  await logActivity({
    doctorId: params.doctorId,
    actionType: "SLOT_CLOSED",
    entityType: "APPOINTMENT",
    entityId: params.slotId,
    displayMessage: `Horario cerrado: ${params.startTime}-${params.endTime}, ${params.date}`,
    icon: "Lock",
    color: "gray",
    metadata: {
      slotId: params.slotId,
      startTime: params.startTime,
      endTime: params.endTime,
      date: params.date,
    },
  });
}

export async function logSlotsBulkOpened(params: {
  doctorId: string;
  count: number;
}) {
  await logActivity({
    doctorId: params.doctorId,
    actionType: "SLOTS_BULK_OPENED",
    entityType: "APPOINTMENT",
    displayMessage: `Abiertos ${params.count} horarios`,
    icon: "Unlock",
    color: "green",
    metadata: {
      count: params.count,
    },
  });
}

export async function logSlotsBulkClosed(params: {
  doctorId: string;
  count: number;
}) {
  await logActivity({
    doctorId: params.doctorId,
    actionType: "SLOTS_BULK_CLOSED",
    entityType: "APPOINTMENT",
    displayMessage: `Cerrados ${params.count} horarios`,
    icon: "Lock",
    color: "gray",
    metadata: {
      count: params.count,
    },
  });
}

export async function logBookingConfirmed(params: {
  doctorId: string;
  bookingId: string;
  patientName: string;
  date: string;
  time: string;
  confirmationCode?: string;
}) {
  await logActivity({
    doctorId: params.doctorId,
    actionType: "BOOKING_CONFIRMED",
    entityType: "BOOKING",
    entityId: params.bookingId,
    displayMessage: `Cita confirmada: ${params.patientName} - ${params.date} ${params.time}`,
    icon: "CheckCircle2",
    color: "green",
    metadata: {
      bookingId: params.bookingId,
      patientName: params.patientName,
      date: params.date,
      time: params.time,
      confirmationCode: params.confirmationCode,
    },
  });
}

export async function logBookingCancelled(params: {
  doctorId: string;
  bookingId: string;
  patientName: string;
  date: string;
  time: string;
  confirmationCode?: string;
}) {
  await logActivity({
    doctorId: params.doctorId,
    actionType: "BOOKING_CANCELLED",
    entityType: "BOOKING",
    entityId: params.bookingId,
    displayMessage: `Cita cancelada: ${params.patientName} - ${params.date} ${params.time}`,
    icon: "XCircle",
    color: "red",
    metadata: {
      bookingId: params.bookingId,
      patientName: params.patientName,
      date: params.date,
      time: params.time,
      confirmationCode: params.confirmationCode,
    },
  });
}

export async function logBookingCompleted(params: {
  doctorId: string;
  bookingId: string;
  patientName: string;
  date: string;
  time: string;
  confirmationCode?: string;
}) {
  await logActivity({
    doctorId: params.doctorId,
    actionType: "BOOKING_COMPLETED",
    entityType: "BOOKING",
    entityId: params.bookingId,
    displayMessage: `Cita completada: ${params.patientName} - ${params.date} ${params.time}`,
    icon: "CheckCircle2",
    color: "blue",
    metadata: {
      bookingId: params.bookingId,
      patientName: params.patientName,
      date: params.date,
      time: params.time,
      confirmationCode: params.confirmationCode,
    },
  });
}

export async function logBookingNoShow(params: {
  doctorId: string;
  bookingId: string;
  patientName: string;
  date: string;
  time: string;
  confirmationCode?: string;
}) {
  await logActivity({
    doctorId: params.doctorId,
    actionType: "BOOKING_NO_SHOW",
    entityType: "BOOKING",
    entityId: params.bookingId,
    displayMessage: `Paciente no asistio: ${params.patientName} - ${params.date} ${params.time}`,
    icon: "AlertCircle",
    color: "yellow",
    metadata: {
      bookingId: params.bookingId,
      patientName: params.patientName,
      date: params.date,
      time: params.time,
      confirmationCode: params.confirmationCode,
    },
  });
}
