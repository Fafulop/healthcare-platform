# Pendientes Section - UI Actions Mapping

**Purpose:** This document maps all possible user interactions in the Pendientes section to determine which actions should be logged in the "Actividad Reciente" (Recent Activity) table on the main dashboard.

**Date Created:** February 2, 2026
**Section Analyzed:** `/dashboard/pendientes` and all subpages

---

## Table of Contents
1. [List View Actions](#list-view-actions)
2. [Calendar View Actions](#calendar-view-actions)
3. [Task Creation Actions](#task-creation-actions)
4. [Task Viewing Actions](#task-viewing-actions)
5. [Task Editing Actions](#task-editing-actions)
6. [Recommended Actions for Activity Log](#recommended-actions-for-activity-log)

---

## List View Actions

### Navigation & View Controls
| Action | User Interaction | API Call | Log Priority | Notes |
|--------|------------------|----------|--------------|-------|
| Switch to Calendar View | Click "Calendario" tab button | None | ❌ Low | UI preference, not business action |
| Switch to List View | Click "Lista" tab button | None | ❌ Low | UI preference, not business action |

### Filtering Actions
| Action | User Interaction | API Call | Log Priority | Notes |
|--------|------------------|----------|--------------|-------|
| Filter by Status | Select from "Estado" dropdown | GET `/api/medical-records/tasks?status={value}` | ❌ Low | Query/view action only |
| Filter by Priority | Select from "Prioridad" dropdown | GET `/api/medical-records/tasks?priority={value}` | ❌ Low | Query/view action only |
| Filter by Category | Select from "Categoría" dropdown | GET `/api/medical-records/tasks?category={value}` | ❌ Low | Query/view action only |
| Clear Filters | Select "Todos..." options | GET `/api/medical-records/tasks` | ❌ Low | Query/view action only |

### Task Selection Actions
| Action | User Interaction | API Call | Log Priority | Notes |
|--------|------------------|----------|--------------|-------|
| Select Individual Task | Click checkbox on task row | None | ❌ Low | Preparation for bulk action |
| Select All Tasks | Click "select all" checkbox | None | ❌ Low | Preparation for bulk action |
| Deselect Tasks | Click checkbox again or "Cancelar" | None | ❌ Low | Cancel selection |

### Bulk Actions
| Action | User Interaction | API Call | Log Priority | Notes |
|--------|------------------|----------|--------------|-------|
| **Bulk Delete Tasks** | Select tasks → Click "Delete" button in bulk bar → Confirm | DELETE `/api/medical-records/tasks/[id]` (multiple calls) | ✅ **HIGH** | **SHOULD LOG:** "{X} tareas eliminadas en lote" |

### Individual Task Actions (Table View)
| Action | User Interaction | API Call | Log Priority | Notes |
|--------|------------------|----------|--------------|-------|
| View Task Details (Modal) | Click anywhere on task row | None | ❌ Low | View only |
| **Inline Status Change** | Click status badge → Select new status from dropdown | PUT `/api/medical-records/tasks/[id]` | ✅ **HIGH** | **SHOULD LOG:** "Tarea '{title}' cambió de {old_status} a {new_status}" |
| Navigate to Edit Page | Click Edit button (blue pencil) | None | ❌ Low | Navigation only |
| **Delete Task** | Click Delete button (red trash) → Confirm | DELETE `/api/medical-records/tasks/[id]` | ✅ **HIGH** | **SHOULD LOG:** "Tarea '{title}' eliminada" |

### Task Details Modal Actions
| Action | User Interaction | API Call | Log Priority | Notes |
|--------|------------------|----------|--------------|-------|
| View Task Details | Modal opens with task info | None | ❌ Low | View only |
| Close Modal | Click X or "Cerrar" button | None | ❌ Low | UI action |
| Navigate to Edit | Click "Editar" button in modal | None | ❌ Low | Navigation only |

---

## Calendar View Actions

### Calendar Navigation
| Action | User Interaction | API Call | Log Priority | Notes |
|--------|------------------|----------|--------------|-------|
| Previous Month | Click "Anterior" button | GET `/api/medical-records/tasks/calendar?startDate={...}&endDate={...}` | ❌ Low | Navigation/view only |
| Next Month | Click "Siguiente" button | GET `/api/medical-records/tasks/calendar?startDate={...}&endDate={...}` | ❌ Low | Navigation/view only |
| Go to Today | Click "Hoy" button | GET `/api/medical-records/tasks/calendar?startDate={...}&endDate={...}` | ❌ Low | Navigation/view only |

### Day Selection & Viewing
| Action | User Interaction | API Call | Log Priority | Notes |
|--------|------------------|----------|--------------|-------|
| Select Date | Click on calendar day | None | ❌ Low | View only - shows day details panel |
| View Day Timeline | Automatically shown when date selected | None | ❌ Low | View only |
| View Appointment Slots | Displayed in day details | GET from appointments API | ❌ Low | View only |
| View Conflict Indicators | Visual warnings for overlaps | None | ❌ Low | View only |

### Day Details Panel Actions
| Action | User Interaction | API Call | Log Priority | Notes |
|--------|------------------|----------|--------------|-------|
| Click Task Title | Click blue link to task | Navigates to task detail page | ❌ Low | Navigation only |
| View Patient Info | Read patient details on booked appointments | None | ❌ Low | View only |

---

## Task Creation Actions

**Page:** `/dashboard/pendientes/new`

### Form Entry Actions
| Action | User Interaction | API Call | Log Priority | Notes |
|--------|------------------|----------|--------------|-------|
| Open New Task Page | Click "Nueva Pendiente" quick action or navigate | None | ❌ Low | Navigation only |
| **Open Voice Assistant** | Click "Asistente de Voz" button | None | 🟡 **MEDIUM** | Optional: "Asistente de voz usado para crear tarea" |
| Fill Title | Type in "Título" input | None | ❌ Low | Form input |
| Fill Description | Type in "Descripción" textarea | None | ❌ Low | Form input |
| Select Date | Select from date picker | None | ❌ Low | Form input |
| Select Start Time | Choose from "Hora de inicio" dropdown | None | ❌ Low | Form input |
| Select End Time | Choose from "Hora de fin" dropdown | None | ❌ Low | Form input |
| Select Priority | Choose from "Prioridad" dropdown | None | ❌ Low | Form input |
| Select Category | Choose from "Categoría" dropdown | None | ❌ Low | Form input |
| Search Patient | Type in patient search field | None | ❌ Low | Form input |
| Select Patient | Choose from filtered patient list | None | ❌ Low | Form input |

### Voice Assistant Actions
| Action | User Interaction | API Call | Log Priority | Notes |
|--------|------------------|----------|--------------|-------|
| Record Voice | Speak into microphone in modal | Voice processing API | ❌ Low | Input method |
| Edit Voice Draft | Multi-turn conversation in sidebar | Voice assistant API | ❌ Low | Input method |
| Confirm Voice Data | Click confirm to populate form | None | ❌ Low | Input method |
| **Batch Create Tasks** | Create multiple tasks from voice | POST `/api/medical-records/tasks` (multiple) | ✅ **HIGH** | **SHOULD LOG:** "{X} tareas creadas desde asistente de voz" |
| Dismiss AI Banner | Close the draft banner | None | ❌ Low | UI action |

### Form Submission Actions
| Action | User Interaction | API Call | Log Priority | Notes |
|--------|------------------|----------|--------------|-------|
| Cancel Creation | Click "Cancelar" button | None | ❌ Low | Navigation back |
| **Create Task** | Click "Guardar Tarea" button | POST `/api/medical-records/tasks` | ✅ **HIGH** | **SHOULD LOG:** "Nueva tarea creada: '{title}' - Prioridad: {priority}, Categoría: {category}" |

### Conflict Handling Actions
| Action | User Interaction | API Call | Log Priority | Notes |
|--------|------------------|----------|--------------|-------|
| View Conflict Dialog | Automatically shown on 409 response | None | ❌ Low | Error feedback |
| Close Conflict Dialog | Click "Cerrar" button | None | ❌ Low | UI action |
| Adjust Task After Conflict | Modify time and resubmit | POST `/api/medical-records/tasks` | ✅ **HIGH** | Logged as new creation attempt |

---

## Task Viewing Actions

**Page:** `/dashboard/pendientes/[id]`

### View Actions
| Action | User Interaction | API Call | Log Priority | Notes |
|--------|------------------|----------|--------------|-------|
| Open Task Detail Page | Navigate from list or calendar | GET `/api/medical-records/tasks/[id]` | ❌ Low | View only |
| View Description | Read task description | None | ❌ Low | View only |
| View Date/Time | Read scheduling info | None | ❌ Low | View only |
| View Patient Info | Read linked patient | None | ❌ Low | View only |
| View Completion Info | Read completion timestamp | None | ❌ Low | View only |
| View Metadata | Read created/updated timestamps | None | ❌ Low | View only |
| Back to List | Click "Volver a Pendientes" | None | ❌ Low | Navigation |

### Action Buttons
| Action | User Interaction | API Call | Log Priority | Notes |
|--------|------------------|----------|--------------|-------|
| **Mark as Complete** | Click "Completar" button | PUT `/api/medical-records/tasks/[id]` (status=COMPLETADA) | ✅ **HIGH** | **SHOULD LOG:** "Tarea '{title}' marcada como completada" |
| Navigate to Edit | Click "Editar" button | None | ❌ Low | Navigation |
| **Delete Task** | Click "Eliminar" button → Confirm | DELETE `/api/medical-records/tasks/[id]` | ✅ **HIGH** | **SHOULD LOG:** "Tarea '{title}' eliminada" |

---

## Task Editing Actions

**Page:** `/dashboard/pendientes/[id]/edit`

### Navigation
| Action | User Interaction | API Call | Log Priority | Notes |
|--------|------------------|----------|--------------|-------|
| Open Edit Page | Navigate from view or list | GET `/api/medical-records/tasks/[id]` | ❌ Low | Navigation |
| Back to List | Click "Volver a Pendientes" | None | ❌ Low | Navigation |

### Form Editing Actions
| Action | User Interaction | API Call | Log Priority | Notes |
|--------|------------------|----------|--------------|-------|
| Edit Title | Modify text in "Título" input | None | ❌ Low | Form input (not saved yet) |
| Edit Description | Modify text in "Descripción" textarea | None | ❌ Low | Form input (not saved yet) |
| View Date (Read-only) | See disabled date field | None | ❌ Low | View only |
| View Time (Read-only) | See disabled time fields | None | ❌ Low | View only |
| Change Priority | Select from "Prioridad" dropdown | None | ❌ Low | Form input (not saved yet) |
| Change Category | Select from "Categoría" dropdown | None | ❌ Low | Form input (not saved yet) |
| Change Status | Select from "Estado" dropdown | None | ❌ Low | Form input (not saved yet) |
| Change Patient | Search and select patient | None | ❌ Low | Form input (not saved yet) |

### Form Actions
| Action | User Interaction | API Call | Log Priority | Notes |
|--------|------------------|----------|--------------|-------|
| **Mark as Complete (Header)** | Click "Marcar como Completada" button | PUT `/api/medical-records/tasks/[id]` (status=COMPLETADA) | ✅ **HIGH** | **SHOULD LOG:** "Tarea '{title}' marcada como completada" |
| Cancel Editing | Click "Cancelar" button | None | ❌ Low | Navigation back |
| **Save Changes** | Click "Guardar Cambios" button | PUT `/api/medical-records/tasks/[id]` | ✅ **HIGH** | **SHOULD LOG:** "Tarea '{title}' actualizada" (optionally include changed fields) |

---

## Recommended Actions for Activity Log

Based on the analysis above, here are the actions that **SHOULD be logged** in the "Actividad Reciente" table:

### Priority: HIGH (Critical Business Actions)

| # | Action | Description for Activity Log | Details to Include |
|---|--------|-------------------------------|-------------------|
| 1 | **Create Task** | "Nueva tarea: {title}" | Priority, Category, Patient (if linked), Due Date |
| 2 | **Update Task** | "Tarea actualizada: {title}" | Changed fields (priority, category, status, patient, etc.) |
| 3 | **Complete Task** | "Tarea completada: {title}" | Category, Patient (if linked), Completion timestamp |
| 4 | **Delete Task** | "Tarea eliminada: {title}" | Priority, Category, Due Date |
| 5 | **Bulk Delete Tasks** | "Eliminadas {count} tareas en lote" | Count of deleted tasks |
| 6 | **Inline Status Change** | "Tarea '{title}': {old_status} → {new_status}" | Old status, New status |

### Priority: MEDIUM (Optional/Enhanced Tracking)

| # | Action | Description for Activity Log | Details to Include |
|---|--------|-------------------------------|-------------------|
| 7 | **Voice Assistant Usage** | "Creadas {count} tareas con asistente de voz" | Number of tasks created via voice |
| 8 | **Cancel Task Status** | "Tarea cancelada: {title}" | Category, Cancellation reason (if added later) |

### Priority: LOW (Not Recommended for Activity Log)

All view-only, navigation, filtering, and UI preference actions should NOT be logged as they don't represent meaningful business actions.

---

## Activity Log Data Model Suggestion

Based on the recommended actions, here's a suggested structure for the activity log entries:

```typescript
interface ActivityLog {
  id: string;
  timestamp: Date;
  actionType: 'TASK_CREATED' | 'TASK_UPDATED' | 'TASK_COMPLETED' | 'TASK_DELETED' | 'TASK_BULK_DELETED' | 'TASK_STATUS_CHANGED';
  userId: string; // Doctor who performed the action

  // Action-specific data
  taskId?: string | null; // Null for bulk operations
  taskTitle?: string;

  // Task details
  priority?: 'ALTA' | 'MEDIA' | 'BAJA';
  category?: 'SEGUIMIENTO' | 'ADMINISTRATIVO' | 'LABORATORIO' | 'RECETA' | 'REFERENCIA' | 'PERSONAL' | 'OTRO';
  patientId?: string | null;
  patientName?: string | null;
  dueDate?: Date;

  // Change tracking (for updates)
  oldStatus?: string;
  newStatus?: string;
  changedFields?: string[]; // Array of field names that changed

  // Bulk operations
  bulkCount?: number; // For bulk delete

  // Voice assistant
  viaVoiceAssistant?: boolean;

  // Display
  displayMessage: string; // Pre-formatted message for display
  icon?: string; // Icon to show (e.g., 'CheckCircle2', 'Trash2', 'Edit')
  color?: string; // Color theme for the activity (e.g., 'green', 'red', 'blue')
}
```

---

## Next Steps

1. **Expand to Other Sections:** Continue mapping UI actions for:
   - `/dashboard/medical-records` (Consultas & Patients)
   - `/dashboard/appointments` (Citas/Agenda)
   - `/dashboard/billing` (Facturación)
   - Any other dashboard sections

2. **Implement Activity Logging:**
   - Create database table for activity logs
   - Add logging to API endpoints
   - Build backend service to record activities
   - Update dashboard to fetch and display recent activities

3. **Define Display Rules:**
   - How many activities to show (limit to 10-20?)
   - Time range filter (last 7 days? 30 days?)
   - Grouping similar actions (e.g., "3 tareas completadas hoy")
   - Real-time updates vs. polling

4. **User Controls:**
   - Filter activity by type
   - Filter by date range
   - Search activities
   - Export activity log

---

## Document Metadata

- **Author:** AI Assistant
- **Created:** February 2, 2026
- **Section:** Pendientes (/dashboard/pendientes)
- **Status:** Complete
- **Next Section to Analyze:** Medical Records (/dashboard/medical-records)
