# Citas - Visión General

## Propósito

El módulo de **Citas** permite al médico gestionar su disponibilidad y ver las reservaciones que los pacientes realizan a través del perfil público.

## Acceso

**Ruta:** Menú lateral > Perfil y Público > Citas

**URL:** `/appointments`

---

## Conceptos Clave

### Espacios de Cita (Slots)
Son los horarios que el médico pone a disposición de los pacientes. El médico define:
- Fecha y hora
- Duración
- Precio
- Si acepta reservaciones online

### Reservaciones (Bookings)
Son las citas que los pacientes agendan en los espacios disponibles. Contienen:
- Datos del paciente
- Código de confirmación
- Estado de pago
- Motivo de consulta

---

## Funcionalidades Incluidas

### 1. Gestión de Espacios
- Crear espacios de cita individuales
- Crear espacios recurrentes (semanales)
- Bloquear horarios
- Definir precios y descuentos

### 2. Gestión de Reservaciones
- Ver citas agendadas
- Ver detalles del paciente
- Confirmar asistencia
- Cancelar citas

### 3. Vistas Disponibles
- Vista de Calendario (mensual/semanal)
- Vista de Lista

---

## Lo que el Usuario PUEDE Hacer

| Acción | Disponible | Notas |
|--------|------------|-------|
| Crear espacios de cita | Sí | Manual o por voz |
| Crear espacios recurrentes | Sí | Repetición semanal |
| Bloquear horarios | Sí | Marcar como no disponible |
| Ver reservaciones | Sí | Lista y calendario |
| Cancelar reservaciones | Sí | Con notificación al paciente |
| Definir precios | Sí | Precio base y descuento |

## Lo que el Usuario NO PUEDE Hacer

- **Agendar citas directamente** - Los pacientes agendan desde el perfil público
- **Enviar recordatorios manuales** - No hay función de mensajería
- **Sincronizar con Google Calendar** - No hay integración externa
- **Cobrar desde la app** - Solo se muestra estado de pago
- **Reprogramar citas automáticamente** - Debe cancelar y crear nuevo espacio

---

## Asistente de Voz

El asistente de voz permite crear múltiples espacios de cita dictando:
- Fechas y horarios
- Duración de las citas
- Precios

Ver [Espacios de Cita](./slots.md) para detalles.
