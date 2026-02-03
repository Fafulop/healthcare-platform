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
  | "TASK_CANCELLED";

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
