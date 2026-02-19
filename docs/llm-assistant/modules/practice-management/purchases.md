# Compras

## Qué es

El módulo de Compras permite registrar las adquisiciones realizadas a proveedores — insumos, materiales, equipos o servicios para el consultorio. Cada compra tiene un folio, proveedor, productos/servicios, estado de recepción y estado de pago.

## Acceso

**Ruta:** Menú lateral > Gestión de Consultorio > Compras
**URL:** `/dashboard/practice/compras`

---

## Panel de Resumen

En la parte superior de la lista de compras:

| Tarjeta | Descripción |
|---------|-------------|
| Total Compras | Suma de todas las compras |
| Pagado | Total ya pagado a proveedores |
| Pendiente | Monto por pagar |

---

## Ver Lista de Compras

**Vistas:** Tabla (desktop) / Tarjetas (móvil)

**Información por compra:**
| Campo | Descripción |
|-------|-------------|
| Folio | Número de compra generado automáticamente |
| Proveedor | Nombre del proveedor |
| Fecha de compra | Fecha de la transacción |
| Fecha de recepción | Fecha estimada de recepción (si aplica) |
| Total | Monto total de la compra |
| Estado de pago | PENDIENTE / PARCIAL / PAGADA |
| Estado de compra | Ver estados abajo |

**Filtros disponibles:**
- Búsqueda por folio o nombre de proveedor
- Filtro por estado de compra
- Filtro por estado de pago

---

## Crear Nueva Compra

**URL:** `/dashboard/practice/compras/new`

### Campos del Formulario

#### Información General

| Campo | Requerido | Descripción |
|-------|-----------|-------------|
| Proveedor | Sí | Seleccionar de la lista de proveedores existentes |
| Fecha de Compra | Sí | Fecha de la transacción |
| Fecha de Recepción | No | Fecha estimada de recepción del pedido |

#### Líneas de Productos/Servicios

Para cada línea:

| Campo | Requerido | Descripción |
|-------|-----------|-------------|
| Producto/Servicio | Sí | Descripción del ítem comprado |
| Cantidad | Sí | Número de unidades |
| Precio Unitario | Sí | Precio por unidad |
| Subtotal | Calculado | Cantidad × Precio Unitario |

#### Totales

| Campo | Descripción |
|-------|-------------|
| Subtotal | Suma de todas las líneas |
| Impuesto (IVA) | Porcentaje de impuesto (opcional) |
| Total | Subtotal + Impuesto |

#### Pago

| Campo | Descripción |
|-------|-------------|
| Monto Pagado | Cantidad ya pagada al proveedor (puede ser anticipo o pago total) |
| Estado de Pago | Calculado automáticamente |

---

## Crear Compra — Paso a Paso

### Manual

1. Ir a **Compras** en el menú lateral
2. Clic en **"Nueva Compra"**
3. Seleccionar el proveedor
4. Establecer la fecha de compra
5. Agregar productos/servicios con cantidades y precios
6. Verificar totales
7. Registrar monto pagado si aplica
8. Clic en **"Crear Compra"**

### Con Asistente de Voz

1. Ir a **Compras** > **"Nueva Compra"**
2. Clic en **"Asistente de Voz"**
3. Dictar la información:
   > *"Compra a Distribuidora Médica del Norte, 20 cajas de jeringas a 200 pesos, 10 litros de alcohol a 50 pesos, pagué 2000 pesos de anticipo"*
4. Revisar los datos extraídos y corregir si es necesario
5. Clic en **"Confirmar"** → se pre-llena el formulario
6. Completar información faltante
7. Clic en **"Crear Compra"**

---

## Estados de la Compra

Los estados siguen un flujo secuencial **estricto** — no se pueden saltar estados.

| Estado | Descripción | Transiciones válidas |
|--------|-------------|----------------------|
| PENDIENTE | Compra registrada, sin confirmar | → CONFIRMADA, CANCELADA |
| CONFIRMADA | Compra confirmada con el proveedor | → EN PROCESO, CANCELADA |
| EN PROCESO | Proveedor preparando el pedido | → ENVIADA, CANCELADA |
| ENVIADA | Pedido en tránsito | → RECIBIDA |
| RECIBIDA | Pedido recibido en el consultorio | Estado final — sin acciones |
| CANCELADA | Compra cancelada | Estado final — sin acciones |

**Cambiar estado:** Desde la lista de compras usando el selector de estado por fila.

---

## Estados de Pago

| Estado | Condición |
|--------|-----------|
| PENDIENTE | Monto pagado = 0 |
| PARCIAL | 0 < Monto pagado < Total |
| PAGADA | Monto pagado = Total |

---

## Relación con Flujo de Dinero

Al crear una compra, el sistema genera **automáticamente** un registro en el módulo de Flujo de Dinero como egreso. El estado de pago se refleja en ese registro.

---

## Restricciones del Sistema

| Acción | Estado |
|--------|--------|
| Adjuntar factura del proveedor | ❌ Sin función de archivos adjuntos |
| Enviar órdenes de compra al proveedor | ❌ No disponible |
| Exportar lista de compras | ❌ Sin exportación |
| Duplicar compras | ❌ Debe crear cada una individualmente |
| Saltar estados de compra | ❌ Flujo secuencial obligatorio |
| Cancelar compra RECIBIDA | ❌ Estado final, sin acciones |

---

## Preguntas Frecuentes

**¿Puedo crear una compra sin proveedor?**
No. Debes seleccionar un proveedor existente. Si es nuevo, primero créalo en el módulo de Proveedores.

**¿Cómo registro un anticipo o pago parcial?**
Al editar la compra, actualiza el campo "Monto Pagado" con la cantidad pagada hasta el momento.

**¿Las compras se reflejan en el flujo de dinero?**
Sí, automáticamente al crear la compra.

**¿Puedo agregar gastos de envío?**
Sí, agrega una línea adicional con "Gastos de envío" como producto/servicio.
