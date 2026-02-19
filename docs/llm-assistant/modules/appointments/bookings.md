# Reservaciones (Bookings)

## Qué es

Una reservación es el registro de un paciente que agendó una cita en un horario disponible del médico. El médico no puede crear reservaciones directamente — solo los pacientes pueden agendar desde el perfil público del médico. El médico gestiona las reservaciones: las confirma, marca como completadas o las cancela.

## Acceso

**Ruta:** Menú lateral > Citas
**URL:** `/appointments`

Las reservaciones se muestran en la sección **"Citas Reservadas"** en la parte superior de la página.

---

## Estados de una Reservación

| Estado | Color | Significado | Acciones disponibles |
|--------|-------|-------------|---------------------|
| PENDING | Amarillo | El paciente agendó — el médico aún no confirma | Confirmar, Cancelar |
| CONFIRMED | Azul | El médico confirmó la asistencia | Marcar Completada, No Asistió, Cancelar |
| COMPLETED | Azul | El paciente asistió a la cita | — (sin acciones) |
| CANCELLED | Rojo | La cita fue cancelada | — (sin acciones) |
| NO_SHOW | Gris | El paciente no se presentó | — (sin acciones) |

---

## Transiciones de Estado

```
PENDING ──→ CONFIRMED   (botón "Confirmar")
        └─→ CANCELLED   (botón "Cancelar")

CONFIRMED ──→ COMPLETED  (botón "Completada")
          ├─→ NO_SHOW    (botón "No asistió")
          └─→ CANCELLED  (botón "Cancelar")

COMPLETED, CANCELLED, NO_SHOW → sin acciones disponibles (estado final)
```

---

## Ver Reservaciones

### Por día (modo default)
- Selector de fecha con flechas ◀ ▶ para navegar día a día
- Botón "Hoy" aparece cuando no se está viendo el día actual
- Contador: *"N cita(s)"*

### Ver todas
- Toggle "Ver todos" muestra todas las reservaciones de todos los meses
- Toggle "Por día" regresa a la vista filtrada por día

### Información mostrada por reservación

| Campo | Descripción |
|-------|-------------|
| Fecha y hora | Fecha de la cita + rango horario (inicio - fin) |
| Nombre del paciente | Nombre completo |
| Email | Email del paciente |
| Teléfono | Teléfono de contacto |
| WhatsApp | WhatsApp (puede ser nulo) |
| Estado | Badge con color y ícono |
| Precio | Precio final de la cita |
| Código de confirmación | Código alfanumérico único (`monospace`) |

---

## Acciones

### Confirmar (PENDING → CONFIRMED)
Solo disponible desde estado PENDING.

Pasos:
1. Localiza la reservación en la tabla/tarjetas
2. Clic en **"Confirmar"** (botón verde)
3. El estado cambia a CONFIRMED

### Cancelar (PENDING o CONFIRMED → CANCELLED)
Disponible desde PENDING o CONFIRMED.

Pasos:
1. Clic en **"Cancelar"** (botón rojo)
2. Confirmación: *"¿Estás seguro de que quieres cancelar esta cita?"*
3. Al confirmar → estado cambia a CANCELLED y el horario vuelve a estado Disponible

### Marcar como Completada (CONFIRMED → COMPLETED)
Solo disponible desde estado CONFIRMED.

Pasos:
1. Clic en **"Completada"** (botón azul)
2. Estado cambia a COMPLETED

### Marcar No Asistió (CONFIRMED → NO_SHOW)
Solo disponible desde estado CONFIRMED.

Pasos:
1. Clic en **"No asistió"** (botón gris)
2. Estado cambia a NO_SHOW

---

## Código de Confirmación

Cada reservación tiene un código alfanumérico único generado automáticamente.

- El paciente recibe este código al agendar
- Se muestra en la tabla en formato monospace
- Útil para verificar la reservación cuando el paciente llama por teléfono

---

## Contactar al Paciente

La app no tiene sistema de mensajería. Para contactar al paciente:
- Usa el email o teléfono visibles en la tabla
- El WhatsApp se muestra si el paciente lo proporcionó

---

## Relación con Expedientes Médicos

Las reservaciones **no se sincronizan automáticamente** con el módulo de expedientes médicos.

Flujo recomendado después de atender al paciente:
1. Marcar la reservación como **Completada** en Citas
2. Ir a **Expedientes Médicos > Pacientes**
3. Buscar el paciente y crear manualmente una nueva **Consulta**

---

## Lo que el Médico NO Puede Hacer

| Acción | Por qué no es posible |
|--------|----------------------|
| Crear una reservación directamente | Solo los pacientes pueden agendar desde el perfil público |
| Modificar los datos del paciente en la reservación | Los datos vienen del paciente y no son editables |
| Reprogramar automáticamente | Debe cancelar y el paciente vuelve a agendar |
| Enviar recordatorios desde la app | No hay sistema de mensajería integrado |
| Ver historial de cancelaciones antiguas | No hay registro histórico filtrable |
| Cobrar desde la app | El cobro es externo |

---

## Preguntas Frecuentes

**¿Cómo sé cuando llega una nueva reservación?**
El color del horario en el calendario cambia (muestra punto azul con reservaciones). Revisa la sección "Citas Reservadas" regularmente o consulta el widget flotante del dashboard que muestra un badge con el conteo del día.

**¿Qué pasa con el horario cuando cancelo una reservación?**
Al cancelar, `currentBookings` disminuye. Si el horario estaba en estado "Lleno", vuelve a "Disponible" y los pacientes pueden agendar de nuevo.

**¿Puedo tener varias reservaciones en el mismo horario?**
Sí, si el horario tiene `maxBookings > 1`. El estado "Lleno" se activa cuando se alcanza el máximo.

**¿El paciente recibe notificación si cancelo su cita?**
Depende de la configuración del sistema. La cancelación se registra en la app pero no hay confirmación de que se envíe notificación automática al paciente.

**¿Qué diferencia hay entre CANCELLED y NO_SHOW?**
CANCELLED: la cita se canceló (por médico o paciente) antes o después del horario. NO_SHOW: el paciente simplemente no llegó a la cita confirmada.
