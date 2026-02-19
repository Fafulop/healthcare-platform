# Pendientes (Tareas y Seguimientos)

## Qué es

El módulo de Pendientes permite al médico gestionar tareas, recordatorios y seguimientos clínicos o administrativos. Las tareas pueden tener fechas, horarios, prioridad, categoría y vincularse a un paciente específico. Se integra visualmente con el calendario de citas.

## Acceso

**Ruta:** Menú lateral > Pendientes
**URL:** `/dashboard/pendientes`

---

## Panel de Estadísticas

En la parte superior de la página:

| Tarjeta | Color | Descripción |
|---------|-------|-------------|
| Pendientes | Azul | Tareas en estado PENDIENTE o EN_PROGRESO |
| Vencidas | Rojo | Tareas con fecha de vencimiento pasada y no completadas |
| Para Hoy | Amarillo | Tareas cuya fecha es hoy |
| Completadas (Semana) | Verde | Tareas completadas en la semana actual |

---

## Vistas Disponibles

### Vista Lista

- Muestra tareas en tabla (desktop) / tarjetas (móvil)
- Navegador de días: flechas ◀ ▶ + selector de fecha + botón "Hoy"
- Toggle **"Ver todos"** / **"Por día"** para mostrar todas las tareas o solo las del día seleccionado
- Clic en una fila abre el modal de detalles de la tarea

### Vista Calendario

- Muestra el mes completo en cuadrícula
- Los días con tareas o citas (reservadas) tienen fondo amarillo y punto indicador
- El día de hoy tiene fondo amarillo más claro
- Clic en un día muestra el panel lateral "Detalles del Día" — timeline cronológico de pendientes y citas para ese día

---

## Crear Nueva Tarea

**Botón:** "Nueva Tarea" (azul, esquina superior derecha)
**URL:** `/dashboard/pendientes/new`

### Campos del Formulario

| Campo | Requerido | Tipo | Opciones / Notas |
|-------|-----------|------|------------------|
| Título | Sí | text | Máx 200 caracteres |
| Descripción | No | textarea | Detalle adicional |
| Fecha de vencimiento | **Sí** | date | Fecha límite de la tarea |
| Hora de inicio | No | select | Dropdown 00:00–23:30 en intervalos de 30 min. Si se ingresa, la hora de fin es obligatoria |
| Hora de fin | No | select | Dropdown 00:00–23:30 en intervalos de 30 min. Si se ingresa, la hora de inicio es obligatoria |
| Prioridad | Sí | select | ALTA / MEDIA / BAJA — default: MEDIA |
| Categoría | Sí | select | Ver categorías abajo — default: OTRO |
| Paciente vinculado | No | select | Vincular a un paciente del expediente |

### Validaciones del Formulario

| Error | Condición |
|-------|-----------|
| *"El título es obligatorio"* | Título vacío |
| *"La fecha es obligatoria"* | Fecha de vencimiento no ingresada |
| *"Si se proporciona hora de inicio, la hora de fin es obligatoria"* | Hora de inicio sin hora de fin |
| *"Si se proporciona hora de fin, la hora de inicio es obligatoria"* | Hora de fin sin hora de inicio |

### Conflicto de Horario (HTTP 409)

Si otra tarea ya existe en ese horario, el servidor responde con `409` y se muestra el diálogo:

> **⚠️ Conflicto de Horario**
> *"Ya tienes un pendiente a esta hora"*
> Lista las tareas en conflicto con título, fecha y horario.
> *"Por favor, ajusta el horario de tu tarea o cancela el pendiente existente."*

### Categorías Disponibles

| Categoría | Color | Cuándo usar |
|-----------|-------|-------------|
| SEGUIMIENTO | Azul | Llamar al paciente, revisar evolución |
| ADMINISTRATIVO | Morado | Trámites, documentación, facturación |
| LABORATORIO | Cian | Pedir o revisar resultados de laboratorio |
| RECETA | Rosa | Renovar o crear receta |
| REFERENCIA | Índigo | Referir paciente a especialista |
| PERSONAL | Naranja | Tareas personales del médico |
| OTRO | Gris | Cualquier otra tarea |

### Prioridades

| Prioridad | Color |
|-----------|-------|
| ALTA | Rojo |
| MEDIA | Amarillo |
| BAJA | Verde |

---

## Estados de una Tarea

| Estado | Color | Descripción |
|--------|-------|-------------|
| PENDIENTE | Amarillo | Tarea por hacer |
| EN_PROGRESO | Azul | Tarea en proceso |
| COMPLETADA | Verde | Tarea terminada (título con tachado en la lista) |
| CANCELADA | Gris | Tarea cancelada |

**Cambiar estado:** Desde la tabla, clic en el badge de estado de la fila para abrir el selector inline.

---

## Acciones por Tarea

| Acción | Cómo |
|--------|------|
| Ver detalle | Clic en la fila → abre modal de detalles |
| Editar | Clic en ícono de lápiz → URL: `/dashboard/pendientes/[id]/edit` |
| Eliminar | Clic en ícono de papelera → confirmación: *"¿Eliminar 'Título'?"* |
| Cambiar estado | Clic en el badge de estado en la fila |

---

## Acciones Masivas

Selecciona tareas con checkboxes:
- Aparece barra de acciones masivas: *"N tarea(s) seleccionada(s)"*
- **Botón Eliminar** (rojo): *"¿Eliminar N tarea(s) seleccionada(s)?"*
- **Botón Cancelar**: deselecciona todo

---

## Filtros (Vista Lista)

| Filtro | Opciones |
|--------|----------|
| Estado | Todos / Pendiente / En Progreso / Completada / Cancelada |
| Prioridad | Todas / Alta / Media / Baja |
| Categoría | Todas / Seguimiento / Administrativo / Laboratorio / Receta / Referencia / Personal / Otro |

---

## Integración con Citas (Vista Calendario — Detalles del Día)

Al seleccionar un día en el calendario, el panel "Detalles del Día" muestra un **timeline combinado** de pendientes y citas con reservaciones:

**Tipos de conflictos detectados:**

| Tipo | Indicador | Significado |
|------|-----------|-------------|
| Conflicto entre pendientes | Borde rojo + *"⚠️ Conflicto con otro pendiente"* | Dos tareas con hora solapada |
| Pendiente coincide con cita reservada | Borde azul + *"ℹ️ Cita reservada a esta hora"* | Tarea programada en horario de cita con paciente |
| Cita con pendiente coincidente | Borde azul + *"ℹ️ Pendiente a esta hora"* | Cita reservada durante una tarea programada |

**En el timeline de citas** se muestran:
- Estado del horario (Disponible, Reservado, Lleno, Cerrado)
- Nombre del paciente con reservación
- Email y teléfono del paciente

---

## Widget de Detalles del Día (Dashboard)

Desde el dashboard principal, el botón flotante índigo (esquina inferior derecha) con ícono de calendario muestra:
- Badge rojo con el conteo de citas con reservaciones + pendientes programados para hoy
- Al hacer clic: abre el mismo modal "Detalles del Día" con el timeline combinado

---

## Tarea Vencida

Una tarea está vencida cuando:
- Tiene fecha de vencimiento
- La fecha ya pasó
- No está en estado COMPLETADA ni CANCELADA

Las tareas vencidas muestran la fecha en **rojo** en la tabla y en el modal de detalles.

---

## Restricciones del Sistema

| Acción | Estado |
|--------|--------|
| Asignar tarea a otro médico | ❌ Solo el médico puede ver sus propias tareas |
| Tareas recurrentes | ❌ Cada tarea es individual |
| Notificaciones automáticas por vencimiento | ❌ Sin recordatorios automáticos |
| Exportar lista de tareas | ❌ Sin exportación |

---

## Preguntas Frecuentes

**¿Para qué sirve vincular un paciente a una tarea?**
Para recordar que la tarea está relacionada con ese paciente — ej: "Llamar a Juan García para resultado de laboratorio". El nombre del paciente se muestra en la tabla.

**¿Qué pasa si creo una tarea sin hora?**
Aparece en el calendario en la sección "Sin hora específica" al seleccionar el día, sin participar en la detección de conflictos.

**¿Puedo tener múltiples tareas el mismo día y hora?**
Sí, pero el sistema mostrará una advertencia de conflicto (borde rojo) si dos tareas tienen horarios solapados.

**¿Las tareas se sincronizan con Google Calendar?**
No. Solo se muestran en el calendario interno de la app.

**¿Dónde veo los pendientes del día?**
En el dashboard, el widget flotante muestra el conteo. En la página de Pendientes, usa la vista lista "Por día" o el calendario.
