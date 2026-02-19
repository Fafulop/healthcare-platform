# Crear Horarios — Modal de Creación

## Qué es

El modal "Crear Horarios" es el formulario principal para que el médico configure su disponibilidad. Se abre desde el botón **"Crear Horarios"** (azul) o se pre-llena automáticamente cuando el médico usa el Asistente de Voz.

## Acceso

**Botón:** "Crear Horarios" en esquina superior derecha de `/appointments`
**También se abre desde:** botón "Crear horarios" en el estado vacío de la Vista de Lista

---

## Modos de Creación

### Día Único
Crea horarios solo para una fecha específica.

### Recurrente (default)
Crea horarios para múltiples días dentro de un rango de fechas, filtrando por días de la semana seleccionados.

**Ejemplo recurrente:**
- Fecha inicio: 2026-02-23 (lunes)
- Fecha fin: 2026-02-27 (viernes)
- Días: Lun, Mié, Vie
- Hora: 09:00 - 13:00, duración 30 min
- Resultado: 12 horarios (4 por día × 3 días)

---

## Campos del Formulario

### Configuración de Fechas

**Modo Día Único:**
| Campo | Tipo | Requerido | Restricción |
|-------|------|-----------|-------------|
| Fecha | date | Sí | No puede ser fecha pasada (min = hoy) |

**Modo Recurrente:**
| Campo | Tipo | Requerido | Restricción |
|-------|------|-----------|-------------|
| Fecha inicio | date | Sí | No puede ser fecha pasada |
| Fecha fin | date | Sí | Debe ser >= fecha inicio |
| Días de la semana | toggles | Sí | Al menos 1 día seleccionado |

Los días de la semana aparecen como botones toggles:
`Lun | Mar | Mié | Jue | Vie | Sáb | Dom`
- Seleccionado: `bg-blue-600 text-white`
- Deseleccionado: fondo gris

---

### Configuración de Horario

| Campo | Tipo | Requerido | Opciones | Default |
|-------|------|-----------|----------|---------|
| Hora inicio | select | Sí | 00:00 a 23:30 cada 30 min | 09:00 |
| Hora fin | select | Sí | 00:00 a 23:30 cada 30 min | 17:00 |
| Duración | toggle | Sí | 30 min / 60 min | 60 min |

---

### Descanso (Opcional)

Checkbox: **"Agregar descanso (opcional)"**

Cuando está activado:
| Campo | Tipo | Default |
|-------|------|---------|
| Hora inicio descanso | select | 12:00 |
| Hora fin descanso | select | 13:00 |

Los horarios que caen dentro del período de descanso se omiten automáticamente.

**Ejemplo:** 09:00-17:00, duración 60 min, descanso 12:00-13:00 → genera 7 horarios (se salta 12:00-13:00)

---

### Precio

| Campo | Tipo | Requerido | Restricción |
|-------|------|-----------|-------------|
| Precio base | number | Sí | ≥ 0, paso 0.01 |

**Con descuento** (checkbox: "Agregar descuento"):
| Campo | Tipo | Default |
|-------|------|---------|
| Valor del descuento | number | — |
| Tipo de descuento | toggle | Porcentaje (%) |

Tipos de descuento:
- **Porcentaje:** `precioFinal = precioBase - (precioBase × valor / 100)`
- **Cantidad Fija:** `precioFinal = max(0, precioBase - valor)`

El precio final con descuento se muestra en verde: `"Precio Final: $XXX.XX"`

---

## Vista Previa (Preview)

El modal calcula en tiempo real cuántos horarios se van a crear:

```
ℹ Esto creará 12 horarios en el rango de fechas seleccionado
```

El botón de confirmación muestra el conteo:
- Desktop: **"Crear 12 Horario(s)"**
- Móvil: **"Crear (12)"**

El botón está **deshabilitado** cuando `previewSlots = 0`.

---

## Errores de Validación

| Error | Cuándo aparece |
|-------|----------------|
| `"Por favor ingresa un precio base valido"` | Precio vacío o ≤ 0 |
| `"Por favor selecciona una fecha"` | Modo día único sin fecha |
| `"Por favor selecciona fechas de inicio y fin"` | Modo recurrente sin rango |
| `"Por favor selecciona al menos un dia de la semana"` | Modo recurrente sin día |

---

## Conflictos en la Creación (Error 409)

Si ya existen horarios en los mismos tiempos, el servidor devuelve un error 409 con la lista de conflictos:

```
⚠️ No se pueden crear los horarios

[descripción del conflicto]

Horarios existentes:
• lunes 23 de febrero de 2026 09:00-10:00 (1 reserva)
• lunes 23 de febrero de 2026 10:00-11:00
... y 3 más

Por favor, elimina primero los horarios existentes si deseas crear nuevos en estos tiempos.
```

Los conflictos muestran si el horario existente tiene reservaciones (no se puede reemplazar si tiene reservas).

---

## Confirmación de Éxito

```
"Se crearon N horarios de citas."
```

Si se reemplazaron conflictos:
```
"Se crearon N horarios de citas. (N reemplazados)"
```

Si hay pendientes en los mismos horarios, aparece un aviso informativo:
```
ℹ️ Hay N pendientes programados en estos horarios:
   • [título del pendiente] [hora]
   ... y N más
[botón: "Entendido"]
```

---

## Comportamiento Post-Creación

- El modal se cierra automáticamente
- Los datos del formulario se resetean a valores default
- La vista de citas se recarga mostrando los nuevos horarios

---

## Datos Default del Formulario

| Campo | Valor por defecto |
|-------|-------------------|
| Modo | Día Único |
| Días de semana | Lun a Vie |
| Hora inicio | 09:00 |
| Hora fin | 17:00 |
| Duración | 60 min |
| Descanso activado | No |
| Hora inicio descanso | 12:00 |
| Hora fin descanso | 13:00 |
| Tiene descuento | No |
| Tipo descuento | Porcentaje |
