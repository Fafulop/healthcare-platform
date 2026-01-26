# Reservaciones (Bookings)

## Propósito

Permite al médico ver y gestionar las citas que los pacientes han agendado en sus espacios disponibles.

## Acceso

**Ruta:** Menú lateral > Citas > Click en espacio reservado

**URL:** `/appointments` (vista integrada)

---

## Funcionalidades

### 1. Ver Reservaciones

Las reservaciones se muestran en los espacios de cita que tienen pacientes agendados.

**Información de cada reservación:**
- Nombre del paciente
- Teléfono de contacto
- Email
- Código de confirmación
- Estado de pago
- Motivo de la consulta
- Fecha y hora de la cita
- Notas del paciente

---

### 2. Ver Detalle de Reservación

#### Paso a Paso

1. En el calendario o lista, click en un espacio con reservación (color azul)
2. Se abre el panel de detalles
3. Ver toda la información del paciente y la cita

**Información mostrada:**
- Datos completos del paciente
- Código de confirmación único
- Estado de pago (Pendiente, Pagado)
- Motivo de consulta ingresado por el paciente
- Fecha de creación de la reservación

---

### 3. Confirmar Asistencia

Cuando el paciente llega a la consulta, puedes marcar la cita como atendida.

#### Paso a Paso

1. Abrir detalle de la reservación
2. Click en **"Confirmar Asistencia"**
3. El estado cambia a "Atendido"

---

### 4. Cancelar Reservación

Si necesitas cancelar una cita agendada por un paciente.

#### Paso a Paso

1. Abrir detalle de la reservación
2. Click en **"Cancelar Reservación"**
3. Confirmar la cancelación
4. El espacio vuelve a estar disponible
5. (El paciente debería ser notificado - según configuración del sistema)

**Importante:** Considera contactar al paciente antes de cancelar para reagendar.

---

## Estados de Pago

| Estado | Descripción |
|--------|-------------|
| Pendiente | El paciente no ha pagado |
| Pagado | El pago fue procesado |

**Nota:** El sistema muestra el estado de pago pero el cobro se maneja externamente a la aplicación.

---

## Código de Confirmación

Cada reservación genera un código único de confirmación.

**Uso del código:**
- El paciente lo recibe al agendar
- Sirve para identificar la cita
- Se puede usar para verificar la reservación

**Formato:** Alfanumérico (ejemplo: ABC123)

---

## Lo que el Usuario PUEDE Hacer

| Acción | Disponible | Notas |
|--------|------------|-------|
| Ver reservaciones | Sí | En calendario y lista |
| Ver detalles del paciente | Sí | Datos de contacto completos |
| Confirmar asistencia | Sí | Marcar como atendido |
| Cancelar reservación | Sí | Libera el espacio |
| Ver código de confirmación | Sí | Para verificar con el paciente |

## Lo que el Usuario NO PUEDE Hacer

- **Crear reservaciones directamente** - Solo los pacientes pueden agendar
- **Modificar datos del paciente** - La información viene del paciente
- **Procesar pagos** - El cobro es externo a la app
- **Enviar recordatorios** - No hay sistema de mensajería integrado
- **Reprogramar automáticamente** - Debe cancelar y el paciente reagenda
- **Ver historial de cancelaciones** - No hay registro histórico

---

## Flujo de una Reservación

```
1. Médico crea espacio disponible
         ↓
2. Paciente ve disponibilidad en perfil público
         ↓
3. Paciente selecciona horario y agenda
         ↓
4. Se genera código de confirmación
         ↓
5. Médico ve la reservación en su calendario
         ↓
6. Día de la cita: paciente asiste
         ↓
7. Médico confirma asistencia
         ↓
8. Médico documenta consulta en expedientes
```

---

## Preguntas Frecuentes

### ¿Cómo sé si tengo nuevas reservaciones?
Revisa tu calendario regularmente. Los espacios reservados aparecen en color diferente (azul).

### ¿El paciente recibe confirmación automática?
Sí, al agendar el paciente recibe un código de confirmación.

### ¿Puedo bloquear a un paciente problemático?
No hay función de bloqueo de pacientes específicos.

### ¿Qué pasa si el paciente no llega?
Puedes dejar la cita sin confirmar o cancelarla para liberar tu historial.

### ¿Puedo contactar al paciente desde la app?
No directamente, pero puedes ver su teléfono y email para contactarlo externamente.

### ¿Las reservaciones se sincronizan con el módulo de expedientes?
No automáticamente. Debes crear la consulta manualmente en el expediente del paciente después de atenderlo.
