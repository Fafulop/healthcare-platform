# Horarios de Cita (Slots)

## Qué es

Los horarios son los bloques de tiempo que el médico crea para ofrecer disponibilidad a sus pacientes. Cada horario tiene una fecha, hora de inicio, hora de fin, precio y capacidad de reservaciones. Los pacientes ven estos horarios en el perfil público del médico y pueden agendar desde ahí.

## Acceso

**Ruta:** Menú lateral > Citas
**URL:** `/appointments`

---

## Estados de un Horario

| Estado | Color | Condición | Significado |
|--------|-------|-----------|-------------|
| Disponible | Verde | `isOpen = true` y `currentBookings < maxBookings` | Acepta nuevas reservaciones |
| Lleno | Azul claro | `isOpen = true` y `currentBookings >= maxBookings` | Abierto pero sin cupo |
| Cerrado | Gris | `isOpen = false` | No acepta reservaciones |

> **Nota:** En el modal "Detalles del Día" existe un cuarto estado: **Reservado** (naranja) — se muestra cuando el horario tiene al menos una reservación pero aún no está lleno.

---

## Vistas disponibles

### Vista de Calendario
- Muestra el mes completo en cuadrícula
- Los días con horarios tienen un punto azul y fondo azul claro
- Clic en un día muestra los horarios de esa fecha en el panel lateral derecho
- Navegación: botones "Ant." / "Hoy" / "Sig." para cambiar de mes

### Vista de Lista
- Muestra horarios en tabla (escritorio) o tarjetas (móvil)
- Tiene navegador de días: flechas + selector de fecha + botón "Hoy"
- Toggle "Ver todos" / "Por día" para mostrar todos los meses o solo el día seleccionado
- Permite selección múltiple con checkboxes para acciones masivas

---

## Crear Horarios

### Opción 1 — Manual ("Crear Horarios")

Botón azul en la esquina superior derecha. Abre el modal de creación con dos modos:

#### Modo: Día Único
Crea horarios para una sola fecha.

| Campo | Tipo | Requerido | Regla |
|-------|------|-----------|-------|
| Fecha | date | Sí | No puede ser fecha pasada |
| Hora inicio | select | Sí | Opciones cada 30 min de 00:00 a 23:30. Default: 09:00 |
| Hora fin | select | Sí | Opciones cada 30 min. Default: 17:00 |
| Duración | toggle | Sí | 30 min o 60 min. Default: 60 min |
| Descanso | checkbox | No | Activa campos de hora inicio/fin de descanso |
| Hora inicio descanso | select | Condicional | Visible solo si descanso activado. Default: 12:00 |
| Hora fin descanso | select | Condicional | Visible solo si descanso activado. Default: 13:00 |
| Precio base | number | Sí | Mínimo 0, paso 0.01. Ej: 500.00 |
| Descuento | checkbox | No | Activa campos de descuento |
| Valor descuento | number | Condicional | Visible si descuento activado |
| Tipo descuento | toggle | Condicional | "Porcentaje" (%) o "Cantidad Fija". Default: Porcentaje |

#### Modo: Recurrente
Crea horarios para múltiples días en un rango de fechas.

| Campo adicional | Tipo | Requerido | Regla |
|-----------------|------|-----------|-------|
| Fecha inicio | date | Sí | No puede ser fecha pasada |
| Fecha fin | date | Sí | Debe ser >= fecha inicio |
| Días de la semana | toggles | Sí | Al menos 1 día. Botones: Lun Mar Mié Jue Vie Sáb Dom |

Los mismos campos de hora, duración, descanso y precio aplican.

#### Vista previa de horarios a crear
El modal calcula automáticamente cuántos horarios se crearán y lo muestra como badge:
> "Esto creará **N horarios** en el rango de fechas seleccionado"

El botón de confirmar muestra: **"Crear N Horario(s)"** y está deshabilitado si `previewSlots = 0`.

#### Errores de validación al crear
- `"Por favor ingresa un precio base valido"` — precio vacío o inválido
- `"Por favor selecciona una fecha"` — modo día único sin fecha
- `"Por favor selecciona fechas de inicio y fin"` — modo recurrente sin rango
- `"Por favor selecciona al menos un dia de la semana"` — ningún día marcado

#### Conflictos al crear (respuesta 409)
Si ya existen horarios en los mismos horarios el sistema muestra un diálogo con hasta 5 conflictos listados:
```
⚠️ No se pueden crear los horarios
[mensaje del servidor]

Horarios existentes:
• [fecha] [hora inicio]-[hora fin] (N reserva(s))
... y N más

Por favor, elimina primero los horarios existentes si deseas crear nuevos en estos tiempos.
```

#### Éxito al crear
```
"Se crearon N horarios de citas."
"Se crearon N horarios de citas. (N reemplazados)"  ← si hubo reemplazos
```

#### Cálculo del precio final con descuento
- Porcentaje: `precioFinal = precioBase - (precioBase × descuento / 100)`
- Cantidad fija: `precioFinal = max(0, precioBase - descuento)`
- Se muestra en verde: `"Precio Final: $XXX.XX"`

---

### Opción 2 — Asistente de Voz ("Asistente de Voz" / "Voz")

Botón morado en la esquina superior derecha.

**Flujo completo:**
1. Clic en "Asistente de Voz" → se abre el modal de grabación
2. El médico dicta los horarios que quiere crear (fecha, hora, precio, etc.)
3. El sistema transcribe y extrae los datos estructurados
4. Se abre la barra lateral de revisión (VoiceChatSidebar) con los datos extraídos
5. El médico revisa y ajusta si es necesario
6. Clic en confirmar → se pre-llena el modal "Crear Horarios" con los datos
7. El médico revisa el preview y confirma la creación

**Datos extraídos por voz:**

| Campo | Default si no se menciona |
|-------|--------------------------|
| Fecha inicio | — |
| Fecha fin | — |
| Días de la semana | Lunes a Viernes [1,2,3,4,5] |
| Hora inicio | 09:00 |
| Hora fin | 17:00 |
| Duración | 60 min |
| Hora inicio descanso | 12:00 |
| Hora fin descanso | 13:00 |
| Precio base | — |
| Descuento | — |
| Tipo descuento | PERCENTAGE |

**Ejemplo de dictado:**
> "Crea horarios para la próxima semana, lunes a viernes de 9 a 1 del mediodía, citas de 30 minutos, precio 500 pesos"

---

## Acciones sobre un Horario Existente

### Cerrar / Abrir (bloquear reservaciones)

**Cerrar un horario:**
- ✅ Permitido si: `currentBookings = 0`
- ❌ Bloqueado si: `currentBookings > 0`
- Mensaje de error exacto: *"No se puede cerrar este horario porque tiene N reserva(s) activa(s). Por favor cancela las reservas primero."*
- Solución: Ve a la tabla de "Citas Reservadas", cancela las reservaciones del horario, luego ciérralo

**Abrir un horario:** Siempre permitido.

### Eliminar

- ✅ Siempre permitido — incluso si tiene reservaciones activas
- Si `currentBookings = 0`: confirmación simple *"¿Estás seguro de que quieres eliminar este horario?"*
- Si `currentBookings > 0`: confirmación con advertencia *"Este horario tiene N cita(s) activa(s). ¿Cancelar las citas y eliminar el horario?"* — al confirmar, se cancelan todas las reservaciones automáticamente y luego se elimina el horario

---

## Acciones Masivas (Vista de Lista)

Selecciona horarios con los checkboxes para activar la barra de acciones masivas.

| Acción | Ícono | Condición |
|--------|-------|-----------|
| Cerrar seleccionados | Candado | ❌ Bloqueado si alguno tiene reservaciones activas |
| Abrir seleccionados | Candado abierto | ✅ Siempre |
| Eliminar seleccionados | Papelera | ✅ Siempre (con confirmación) |
| Limpiar selección | × | — |

**Error en cierre masivo:**
*"No se pueden cerrar N horario(s) porque tienen reservas activas. Por favor cancela las reservas primero o deselecciona esos horarios."*

**Confirmación de acción masiva:**
*"¿Estás seguro de que quieres [eliminar/cerrar/abrir] N horario(s)?"*

---

## Widget "Detalles del Día"

Botón flotante índigo con ícono de calendario (esquina inferior derecha del dashboard).

- Muestra un badge rojo con el número de citas con reservaciones hoy + pendientes programados para hoy
- Al hacer clic abre el modal "Detalles del Día"
- El modal combina en un timeline todos los pendientes con hora y las citas con reservaciones del día seleccionado
- Detecta y señala visualmente conflictos de horario:
  - ⚠️ Rojo: conflicto entre dos pendientes a la misma hora
  - ℹ️ Azul: un pendiente coincide con el horario de una cita reservada

---

## Preguntas Frecuentes

**¿Puedo crear horarios en el pasado?**
No. El campo de fecha tiene `min` = fecha de hoy.

**¿Cuántos horarios puede tener un slot? ¿Solo 1 reservación?**
Depende de `maxBookings`. Por defecto 1, pero el sistema soporta múltiples reservaciones por horario. El estado "Lleno" se activa cuando `currentBookings >= maxBookings`.

**¿Puedo editar un horario ya creado?**
No existe botón de editar en la UI. Para cambiar precio, hora o duración debes eliminar el horario y crear uno nuevo.

**¿Qué pasa si cierro un horario con reservaciones?**
No puedes cerrarlo. Primero cancela las reservaciones desde la tabla "Citas Reservadas", luego ciérralo.

**¿Los pacientes ven el precio final (con descuento)?**
Sí, en el perfil público del médico se muestra el `finalPrice`.

**¿Puedo tener precios diferentes por día?**
Sí, cada horario tiene su propio precio independiente.

**¿Cómo sé qué días tienen horarios en el calendario?**
Los días con horarios tienen un punto azul y fondo azul claro. Al seleccionar ese día aparecen los horarios en el panel lateral.
