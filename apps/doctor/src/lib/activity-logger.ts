import { prisma } from "@healthcare/database";

/**
 * Activity Logger Utility
 * Provides helper functions to log user activities for the "Actividad Reciente" dashboard table
 */

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
  | "BOOKING_CREATED"
  | "BOOKING_CONFIRMED"
  | "BOOKING_CANCELLED"
  | "BOOKING_COMPLETED"
  | "BOOKING_NO_SHOW"
  | "SLOT_UPDATED"
  | "PATIENT_CREATED"
  | "PATIENT_UPDATED"
  | "PATIENT_ARCHIVED"
  | "ENCOUNTER_CREATED"
  | "ENCOUNTER_UPDATED"
  | "ENCOUNTER_DELETED"
  | "PRESCRIPTION_CREATED"
  | "PRESCRIPTION_ISSUED"
  | "PRESCRIPTION_CANCELLED";

export type ActivityEntityType = "TASK" | "APPOINTMENT" | "BOOKING" | "PRESCRIPTION" | "PATIENT" | "ENCOUNTER";

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

/**
 * Generic function to log an activity
 */
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
    // Don't throw - logging should not break the main operation
  }
}

/**
 * Log task creation
 */
export async function logTaskCreated(params: {
  doctorId: string;
  taskId: string;
  taskTitle: string;
  priority: string;
  category: string;
  dueDate?: Date;
  patientName?: string;
  userId?: string;
}) {
  const priorityText = params.priority === "ALTA" ? "Alta" : params.priority === "MEDIA" ? "Media" : "Baja";
  const categoryText = getCategoryDisplayName(params.category);

  let message = `Nueva tarea: ${params.taskTitle}`;
  if (params.patientName) {
    message += ` (Paciente: ${params.patientName})`;
  }

  await logActivity({
    doctorId: params.doctorId,
    actionType: "TASK_CREATED",
    entityType: "TASK",
    entityId: params.taskId,
    displayMessage: message,
    icon: "CheckSquare",
    color: "blue",
    metadata: {
      taskTitle: params.taskTitle,
      priority: params.priority,
      priorityText,
      category: params.category,
      categoryText,
      dueDate: params.dueDate?.toISOString(),
      patientName: params.patientName,
    },
    userId: params.userId,
  });
}

/**
 * Log task update
 */
export async function logTaskUpdated(params: {
  doctorId: string;
  taskId: string;
  taskTitle: string;
  changedFields?: string[];
  userId?: string;
}) {
  let message = `Tarea actualizada: ${params.taskTitle}`;
  if (params.changedFields && params.changedFields.length > 0) {
    message += ` (${params.changedFields.join(", ")})`;
  }

  await logActivity({
    doctorId: params.doctorId,
    actionType: "TASK_UPDATED",
    entityType: "TASK",
    entityId: params.taskId,
    displayMessage: message,
    icon: "Edit",
    color: "blue",
    metadata: {
      taskTitle: params.taskTitle,
      changedFields: params.changedFields,
    },
    userId: params.userId,
  });
}

/**
 * Log task completion
 */
export async function logTaskCompleted(params: {
  doctorId: string;
  taskId: string;
  taskTitle: string;
  category?: string;
  patientName?: string;
  userId?: string;
}) {
  let message = `Tarea completada: ${params.taskTitle}`;
  if (params.patientName) {
    message += ` (Paciente: ${params.patientName})`;
  }

  await logActivity({
    doctorId: params.doctorId,
    actionType: "TASK_COMPLETED",
    entityType: "TASK",
    entityId: params.taskId,
    displayMessage: message,
    icon: "CheckCircle2",
    color: "green",
    metadata: {
      taskTitle: params.taskTitle,
      category: params.category,
      categoryText: params.category ? getCategoryDisplayName(params.category) : undefined,
      patientName: params.patientName,
    },
    userId: params.userId,
  });
}

/**
 * Log task deletion
 */
export async function logTaskDeleted(params: {
  doctorId: string;
  taskId: string;
  taskTitle: string;
  priority?: string;
  category?: string;
  dueDate?: Date;
  userId?: string;
}) {
  await logActivity({
    doctorId: params.doctorId,
    actionType: "TASK_DELETED",
    entityType: "TASK",
    entityId: params.taskId,
    displayMessage: `Tarea eliminada: ${params.taskTitle}`,
    icon: "Trash2",
    color: "red",
    metadata: {
      taskTitle: params.taskTitle,
      priority: params.priority,
      category: params.category,
      categoryText: params.category ? getCategoryDisplayName(params.category) : undefined,
      dueDate: params.dueDate?.toISOString(),
    },
    userId: params.userId,
  });
}

/**
 * Log bulk task deletion
 */
export async function logTaskBulkDeleted(params: {
  doctorId: string;
  count: number;
  userId?: string;
}) {
  await logActivity({
    doctorId: params.doctorId,
    actionType: "TASK_BULK_DELETED",
    entityType: "TASK",
    displayMessage: `Eliminadas ${params.count} tarea${params.count === 1 ? "" : "s"} en lote`,
    icon: "Trash2",
    color: "red",
    metadata: {
      count: params.count,
    },
    userId: params.userId,
  });
}

/**
 * Log task status change
 */
export async function logTaskStatusChanged(params: {
  doctorId: string;
  taskId: string;
  taskTitle: string;
  oldStatus: string;
  newStatus: string;
  userId?: string;
}) {
  const oldStatusText = getStatusDisplayName(params.oldStatus);
  const newStatusText = getStatusDisplayName(params.newStatus);

  await logActivity({
    doctorId: params.doctorId,
    actionType: "TASK_STATUS_CHANGED",
    entityType: "TASK",
    entityId: params.taskId,
    displayMessage: `Tarea "${params.taskTitle}": ${oldStatusText} → ${newStatusText}`,
    icon: "ArrowRightLeft",
    color: params.newStatus === "COMPLETADA" ? "green" : "blue",
    metadata: {
      taskTitle: params.taskTitle,
      oldStatus: params.oldStatus,
      newStatus: params.newStatus,
      oldStatusText,
      newStatusText,
    },
    userId: params.userId,
  });
}

/**
 * Helper function to get category display name
 */
function getCategoryDisplayName(category: string): string {
  const categoryMap: Record<string, string> = {
    SEGUIMIENTO: "Seguimiento",
    ADMINISTRATIVO: "Administrativo",
    LABORATORIO: "Laboratorio",
    RECETA: "Receta",
    REFERENCIA: "Referencia",
    PERSONAL: "Personal",
    OTRO: "Otro",
  };
  return categoryMap[category] || category;
}

/**
 * Helper function to get status display name
 */
function getStatusDisplayName(status: string): string {
  const statusMap: Record<string, string> = {
    PENDIENTE: "Pendiente",
    EN_PROGRESO: "En Progreso",
    COMPLETADA: "Completada",
    CANCELADA: "Cancelada",
  };
  return statusMap[status] || status;
}

// ─── Medical Records Logger Functions ────────────────────────────────

/**
 * Log patient creation
 */
export async function logPatientCreated(params: {
  doctorId: string;
  patientId: string;
  patientName: string;
  userId?: string;
}) {
  await logActivity({
    doctorId: params.doctorId,
    actionType: "PATIENT_CREATED",
    entityType: "PATIENT",
    entityId: params.patientId,
    displayMessage: `Nuevo paciente: ${params.patientName}`,
    icon: "UserPlus",
    color: "blue",
    metadata: {
      patientId: params.patientId,
      patientName: params.patientName,
    },
    userId: params.userId,
  });
}

/**
 * Log patient update
 */
export async function logPatientUpdated(params: {
  doctorId: string;
  patientId: string;
  patientName: string;
  changedFields?: string[];
  userId?: string;
}) {
  let message = `Paciente actualizado: ${params.patientName}`;
  if (params.changedFields && params.changedFields.length > 0) {
    message += ` (${params.changedFields.join(", ")})`;
  }

  await logActivity({
    doctorId: params.doctorId,
    actionType: "PATIENT_UPDATED",
    entityType: "PATIENT",
    entityId: params.patientId,
    displayMessage: message,
    icon: "UserCog",
    color: "blue",
    metadata: {
      patientId: params.patientId,
      patientName: params.patientName,
      changedFields: params.changedFields,
    },
    userId: params.userId,
  });
}

/**
 * Log patient archived (soft delete)
 */
export async function logPatientArchived(params: {
  doctorId: string;
  patientId: string;
  patientName: string;
  userId?: string;
}) {
  await logActivity({
    doctorId: params.doctorId,
    actionType: "PATIENT_ARCHIVED",
    entityType: "PATIENT",
    entityId: params.patientId,
    displayMessage: `Paciente archivado: ${params.patientName}`,
    icon: "UserX",
    color: "red",
    metadata: {
      patientId: params.patientId,
      patientName: params.patientName,
    },
    userId: params.userId,
  });
}

/**
 * Log encounter creation
 */
export async function logEncounterCreated(params: {
  doctorId: string;
  encounterId: string;
  patientName: string;
  encounterType: string;
  chiefComplaint: string;
  userId?: string;
}) {
  const typeMap: Record<string, string> = {
    consultation: "Consulta",
    "follow-up": "Seguimiento",
    emergency: "Emergencia",
    telemedicine: "Telemedicina",
  };
  const typeText = typeMap[params.encounterType] || params.encounterType;

  await logActivity({
    doctorId: params.doctorId,
    actionType: "ENCOUNTER_CREATED",
    entityType: "ENCOUNTER",
    entityId: params.encounterId,
    displayMessage: `Nueva consulta (${typeText}): ${params.patientName} - ${params.chiefComplaint}`,
    icon: "Stethoscope",
    color: "green",
    metadata: {
      encounterId: params.encounterId,
      patientName: params.patientName,
      encounterType: params.encounterType,
      chiefComplaint: params.chiefComplaint,
    },
    userId: params.userId,
  });
}

/**
 * Log encounter update
 */
export async function logEncounterUpdated(params: {
  doctorId: string;
  encounterId: string;
  patientName: string;
  userId?: string;
}) {
  await logActivity({
    doctorId: params.doctorId,
    actionType: "ENCOUNTER_UPDATED",
    entityType: "ENCOUNTER",
    entityId: params.encounterId,
    displayMessage: `Consulta actualizada: ${params.patientName}`,
    icon: "Edit",
    color: "blue",
    metadata: {
      encounterId: params.encounterId,
      patientName: params.patientName,
    },
    userId: params.userId,
  });
}

/**
 * Log encounter deletion
 */
export async function logEncounterDeleted(params: {
  doctorId: string;
  encounterId: string;
  patientName: string;
  userId?: string;
}) {
  await logActivity({
    doctorId: params.doctorId,
    actionType: "ENCOUNTER_DELETED",
    entityType: "ENCOUNTER",
    entityId: params.encounterId,
    displayMessage: `Consulta eliminada: ${params.patientName}`,
    icon: "Trash2",
    color: "red",
    metadata: {
      encounterId: params.encounterId,
      patientName: params.patientName,
    },
    userId: params.userId,
  });
}

/**
 * Log prescription creation
 */
export async function logPrescriptionCreated(params: {
  doctorId: string;
  prescriptionId: string;
  patientName: string;
  diagnosis?: string;
  userId?: string;
}) {
  let message = `Nueva receta: ${params.patientName}`;
  if (params.diagnosis) {
    message += ` - ${params.diagnosis}`;
  }

  await logActivity({
    doctorId: params.doctorId,
    actionType: "PRESCRIPTION_CREATED",
    entityType: "PRESCRIPTION",
    entityId: params.prescriptionId,
    displayMessage: message,
    icon: "FileText",
    color: "blue",
    metadata: {
      prescriptionId: params.prescriptionId,
      patientName: params.patientName,
      diagnosis: params.diagnosis,
    },
    userId: params.userId,
  });
}

/**
 * Log prescription issued (locked)
 */
export async function logPrescriptionIssued(params: {
  doctorId: string;
  prescriptionId: string;
  patientName: string;
  medicationCount: number;
  userId?: string;
}) {
  await logActivity({
    doctorId: params.doctorId,
    actionType: "PRESCRIPTION_ISSUED",
    entityType: "PRESCRIPTION",
    entityId: params.prescriptionId,
    displayMessage: `Receta emitida: ${params.patientName} (${params.medicationCount} medicamento${params.medicationCount === 1 ? "" : "s"})`,
    icon: "FileCheck",
    color: "green",
    metadata: {
      prescriptionId: params.prescriptionId,
      patientName: params.patientName,
      medicationCount: params.medicationCount,
    },
    userId: params.userId,
  });
}

/**
 * Log prescription cancelled
 */
export async function logPrescriptionCancelled(params: {
  doctorId: string;
  prescriptionId: string;
  patientName: string;
  reason: string;
  userId?: string;
}) {
  await logActivity({
    doctorId: params.doctorId,
    actionType: "PRESCRIPTION_CANCELLED",
    entityType: "PRESCRIPTION",
    entityId: params.prescriptionId,
    displayMessage: `Receta cancelada: ${params.patientName}`,
    icon: "FileX",
    color: "red",
    metadata: {
      prescriptionId: params.prescriptionId,
      patientName: params.patientName,
      cancellationReason: params.reason,
    },
    userId: params.userId,
  });
}
