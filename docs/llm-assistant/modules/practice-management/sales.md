# Ventas

## Qué es

El módulo de Ventas permite registrar transacciones comerciales con clientes — venta de productos o servicios del consultorio. Cada venta tiene un folio, productos/servicios con precios, estado de entrega y estado de pago.

## Acceso

**Ruta:** Menú lateral > Gestión de Consultorio > Ventas
**URL:** `/dashboard/practice/ventas`

---

## Panel de Resumen

En la parte superior de la lista de ventas:

| Tarjeta | Descripción |
|---------|-------------|
| Total Ventas | Suma de todas las ventas |
| Cobrado | Total de pagos ya recibidos |
| Pendiente | Monto por cobrar |

---

## Ver Lista de Ventas

**Vistas:** Tabla (desktop) / Tarjetas (móvil)

**Información por venta:**
| Campo | Descripción |
|-------|-------------|
| Folio | Número de venta generado automáticamente |
| Cliente | Nombre del cliente |
| Fecha de venta | Fecha de la transacción |
| Fecha de entrega | Fecha estimada de entrega (si aplica) |
| Total | Monto total de la venta |
| Estado de pago | PENDIENTE / PARCIAL / PAGADA |
| Estado de venta | Ver estados de venta abajo |

**Filtros disponibles:**
- Búsqueda por folio o nombre de cliente
- Filtro por estado de venta
- Filtro por estado de pago

---

## Crear Nueva Venta

**URL:** `/dashboard/practice/ventas/new`

### Campos del Formulario

#### Información General

| Campo | Requerido | Descripción |
|-------|-----------|-------------|
| Cliente | Sí | Seleccionar de la lista de clientes existentes |
| Fecha de Venta | Sí | Fecha de la transacción |
| Fecha de Entrega | No | Fecha estimada de entrega al cliente |
| Cotización | No | Vincular a una cotización existente |

#### Líneas de Productos/Servicios

Para cada línea (una o más):

| Campo | Requerido | Descripción |
|-------|-----------|-------------|
| Producto/Servicio | Sí | Descripción del ítem vendido |
| Cantidad | Sí | Número de unidades |
| Precio Unitario | Sí | Precio por unidad |
| Subtotal | Calculado | Cantidad × Precio Unitario |

**Botón "Agregar Línea":** añade una línea nueva al pedido.

#### Totales

| Campo | Descripción |
|-------|-------------|
| Subtotal | Suma de todas las líneas |
| Impuesto (IVA) | Porcentaje de impuesto (opcional) |
| Total | Subtotal + Impuesto |

#### Pago

| Campo | Descripción |
|-------|-------------|
| Monto Pagado | Cantidad ya recibida (puede ser parcial o total) |
| Estado de Pago | Calculado automáticamente según monto pagado |

---

## Crear Venta — Paso a Paso

### Manual

1. Ir a **Ventas** en el menú lateral
2. Clic en **"Nueva Venta"**
3. Seleccionar el cliente
4. Establecer la fecha de venta
5. Agregar productos/servicios con cantidades y precios
6. Verificar totales
7. Registrar monto pagado si aplica
8. Clic en **"Crear Venta"**

### Con Asistente de Voz

1. Ir a **Ventas** > **"Nueva Venta"**
2. Clic en **"Asistente de Voz"**
3. Dictar la información:
   > *"Venta para Farmacia López, 10 cajas de guantes a 150 pesos, 5 paquetes de gasas a 80 pesos, total con IVA"*
4. Revisar los datos extraídos y corregir si es necesario
5. Clic en **"Confirmar"** → se pre-llena el formulario
6. Completar información faltante
7. Clic en **"Crear Venta"**

---

## Estados de la Venta

Los estados siguen un flujo secuencial **estricto** — no se pueden saltar estados.

| Estado | Descripción | Transiciones válidas |
|--------|-------------|----------------------|
| PENDIENTE | Venta registrada, sin confirmar | → CONFIRMADA, CANCELADA |
| CONFIRMADA | Venta confirmada | → EN PROCESO, CANCELADA |
| EN PROCESO | Preparando el pedido | → ENVIADA, CANCELADA |
| ENVIADA | Pedido en camino al cliente | → ENTREGADA |
| ENTREGADA | Pedido recibido por el cliente | Estado final — sin acciones |
| CANCELADA | Venta cancelada | Estado final — sin acciones |

**Cambiar estado:** Desde la lista de ventas usando el selector de estado por fila.

**Restricción:** No puedes ir de PENDIENTE directamente a ENVIADA — el sistema valida las transiciones.

---

## Estados de Pago

Se calculan automáticamente según el monto pagado vs. el total:

| Estado | Condición |
|--------|-----------|
| PENDIENTE | Monto pagado = 0 |
| PARCIAL | 0 < Monto pagado < Total |
| PAGADA | Monto pagado = Total |

Para registrar un pago adicional: editar la venta y actualizar el campo "Monto Pagado".

---

## Ver Detalle de Venta

**URL:** `/dashboard/practice/ventas/[id]`

Muestra:
- Datos del cliente
- Folio de venta
- Todas las líneas de productos con cantidades y precios
- Totales desglosados (subtotal, IVA, total)
- Historial de pagos
- Estado actual de venta y pago

---

## Eliminar Venta

1. En la lista de ventas, clic en el ícono de papelera
2. Confirmar la eliminación
3. La acción es **permanente**

---

## Relación con Flujo de Dinero

Al crear una venta, el sistema genera **automáticamente** un registro en el módulo de Flujo de Dinero como ingreso. El estado de pago se refleja en ese registro.

---

## Restricciones del Sistema

| Acción | Estado |
|--------|--------|
| Facturar electrónicamente (CFDI) | ❌ No disponible |
| Enviar factura al cliente por email | ❌ No disponible |
| Procesar pagos online | ❌ Solo registro manual |
| Exportar lista de ventas | ❌ Sin exportación |
| Duplicar ventas | ❌ Debe crear cada una individualmente |
| Saltar estados de venta | ❌ Flujo secuencial obligatorio |
| Cancelar venta ENTREGADA | ❌ Estado final, sin acciones |

---

## Preguntas Frecuentes

**¿Puedo crear una venta sin cliente?**
No. Debes seleccionar un cliente existente. Si es cliente nuevo, primero créalo en el módulo de Clientes.

**¿Cómo registro un pago parcial?**
Al editar la venta, actualiza el campo "Monto Pagado" con el monto recibido hasta el momento.

**¿Las ventas se reflejan en el flujo de dinero?**
Sí, automáticamente al crear la venta.

**¿Puedo vincular una venta a una cotización previa?**
Sí, al crear la venta puedes seleccionar una cotización existente para vincularla.
