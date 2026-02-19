# Cotizaciones

## Qué es

El módulo de Cotizaciones permite crear propuestas comerciales formales para clientes — con productos/servicios, precios, fecha de emisión y fecha de vigencia. Las cotizaciones se pueden convertir en ventas con un solo clic.

## Acceso

**Ruta:** Menú lateral > Gestión de Consultorio > Cotizaciones
**URL:** `/dashboard/practice/cotizaciones`

---

## Ver Lista de Cotizaciones

**Vistas:** Tabla (desktop) / Tarjetas (móvil)

**Información por cotización:**
| Campo | Descripción |
|-------|-------------|
| Folio | Número de cotización generado automáticamente |
| Cliente | Nombre del cliente |
| Fecha de emisión | Cuándo se emitió |
| Válida hasta | Fecha de vencimiento de la cotización |
| Total | Monto total |
| Estado | Estado actual de la cotización |
| Ítems | Número de líneas de productos |

**Alertas visuales:**
- **Borde amarillo / fondo amarillo:** Cotización por vencer (menos de 7 días)
- **Borde rojo / fondo rojo:** Cotización vencida (fecha de validez pasada)

**Filtros disponibles:**
- Búsqueda por folio o nombre de cliente
- Filtro por estado: Todos / Borrador / Enviada / Aprobada / Rechazada / Vencida / Cancelada

---

## Crear Nueva Cotización

**URL:** `/dashboard/practice/cotizaciones/new`

### Campos del Formulario

#### Información General

| Campo | Requerido | Descripción |
|-------|-----------|-------------|
| Cliente | Sí | Seleccionar de la lista de clientes |
| Fecha de Emisión | Sí | Fecha de la cotización |
| Válida Hasta | Sí | Fecha de vencimiento de la oferta |

#### Líneas de Productos/Servicios

Para cada línea:

| Campo | Requerido | Descripción |
|-------|-----------|-------------|
| Descripción | Sí | Producto o servicio cotizado |
| Cantidad | Sí | Número de unidades |
| Precio Unitario | Sí | Precio por unidad |
| Subtotal | Calculado | Cantidad × Precio Unitario |

#### Totales

| Campo | Descripción |
|-------|-------------|
| Subtotal | Suma de todas las líneas |
| Impuesto (IVA) | Porcentaje de impuesto (opcional) |
| Total | Subtotal + Impuesto |

### Paso a Paso

1. Ir a **Cotizaciones** en el menú lateral
2. Clic en **"Nueva"**
3. Seleccionar el cliente
4. Establecer fechas de emisión y vigencia
5. Agregar líneas de productos/servicios
6. Verificar totales
7. Guardar como borrador o enviar

---

## Estados de la Cotización

| Estado | Badge | Descripción | Transiciones válidas |
|--------|-------|-------------|----------------------|
| DRAFT (Borrador) | Gris | Cotización en preparación | → SENT, CANCELLED |
| SENT (Enviada) | Azul | Enviada al cliente | → APPROVED, REJECTED, CANCELLED |
| APPROVED (Aprobada) | Verde | Cliente aprobó | → (Convertir a venta) |
| REJECTED (Rechazada) | Rojo | Cliente rechazó | Estado final |
| EXPIRED (Vencida) | Naranja | Fecha de validez pasada | Estado final |
| CANCELLED (Cancelada) | Gris | Cancelada | Estado final |

**Cambiar estado:** Selector de estado inline desde la lista de cotizaciones.

El sistema valida que las transiciones sean válidas — no puedes saltar a cualquier estado.

---

## Acciones por Cotización

| Acción | Ícono | Descripción |
|--------|-------|-------------|
| Ver | Ojo | Ver detalle completo de la cotización |
| Editar | Lápiz | Editar todos los campos |
| Convertir a Venta | Carrito | Crea una venta automáticamente desde la cotización |
| Eliminar | Papelera | Elimina la cotización (confirmación requerida) |

---

## Convertir Cotización a Venta

Cuando el cliente aprueba la cotización, puedes convertirla en venta directamente:

1. Desde la lista de cotizaciones, clic en el ícono de carrito (Convertir a Venta)
2. Confirmación: *"¿Convertir la cotización 'COT-XXX' en una venta?"*
3. Al confirmar → se crea la venta automáticamente
4. Mensaje: *"¡Venta creada exitosamente! Folio: VTA-XXX"*
5. Redirige al detalle de la nueva venta

La venta creada hereda todos los productos, precios y cliente de la cotización.

---

## Exportar Cotizaciones a PDF

Puedes exportar una o varias cotizaciones seleccionadas a PDF:

1. Seleccionar cotizaciones con los checkboxes
2. Aparece la barra de acciones batch con "Exportar PDF"
3. Clic en **"Exportar PDF"**
4. Se descarga automáticamente el archivo PDF

El PDF incluye: folio, cliente, fecha, fecha de vigencia, total y estado de cada cotización seleccionada, más un resumen con el total.

---

## Ver Detalle de Cotización

**URL:** `/dashboard/practice/cotizaciones/[id]`

Muestra:
- Datos del cliente
- Folio y fechas
- Todas las líneas de productos con cantidades y precios
- Totales desglosados
- Estado actual

---

## Editar Cotización

**URL:** `/dashboard/practice/cotizaciones/[id]/edit`

Todos los campos son editables.

---

## Eliminar Cotización

1. Clic en el ícono de papelera
2. Confirmación: *"¿Eliminar la cotización 'COT-XXX'?"*
3. La eliminación es **permanente**

---

## Restricciones del Sistema

| Acción | Estado |
|--------|--------|
| Crear cotización sin cliente | ❌ Requiere cliente existente |
| Enviar cotización por email desde la app | ❌ Sin función de envío integrado |
| Firmar digitalmente | ❌ Sin firma digital |
| Duplicar cotización | ❌ Sin función de duplicar |

---

## Preguntas Frecuentes

**¿Puedo crear una cotización sin cliente?**
No. Toda cotización requiere un cliente existente.

**¿Cuándo se marca automáticamente como "Vencida"?**
Cuando la fecha "Válida Hasta" ya pasó — se muestra con fondo rojo en la lista.

**¿La cotización "Por vencer" tiene alguna acción automática?**
No, es solo una alerta visual. Debes tomar la acción manualmente (seguimiento con el cliente, actualizar fecha, etc.).

**¿Convertir a venta elimina la cotización?**
No. La cotización permanece y se puede ver en la lista. Solo se crea la venta adicional.

**¿Puedo exportar una sola cotización a PDF?**
Sí, selecciona solo esa cotización con el checkbox y exporta.
