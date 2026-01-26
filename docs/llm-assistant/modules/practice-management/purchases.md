# Compras

## Propósito

Permite registrar y dar seguimiento a las compras realizadas a proveedores, incluyendo estado de recepción y pagos.

## Acceso

**Ruta:** Menú lateral > Gestión de Consultorio > Compras

**URL:** `/dashboard/practice/compras`

---

## Funcionalidades

### 1. Ver Lista de Compras

**URL:** `/dashboard/practice/compras`

**Panel de Resumen (parte superior):**
- Total Compras: Suma de todas las compras
- Pagado: Total de pagos realizados
- Pendiente: Monto por pagar

**Información por compra:**
- Folio (número de compra)
- Proveedor
- Fecha de compra
- Fecha de recepción
- Total
- Estado de pago
- Estado de compra

**Filtros disponibles:**
- Búsqueda por folio o proveedor
- Filtro por estado de compra
- Filtro por estado de pago

**Vistas:**
- Desktop: Tabla completa
- Móvil: Tarjetas

---

### 2. Crear Nueva Compra

**URL:** `/dashboard/practice/compras/new`

#### Campos del Formulario

##### Información General
| Campo | Requerido | Descripción |
|-------|-----------|-------------|
| Proveedor | **Sí** | Seleccionar de lista de proveedores |
| Fecha de Compra | **Sí** | Fecha de la transacción |
| Fecha de Recepción | No | Fecha estimada de recepción |

##### Productos/Servicios
Para cada línea:
| Campo | Requerido | Descripción |
|-------|-----------|-------------|
| Producto/Servicio | **Sí** | Descripción del ítem |
| Cantidad | **Sí** | Número de unidades |
| Precio Unitario | **Sí** | Precio por unidad |
| Subtotal | Auto | Cantidad × Precio |

##### Totales
| Campo | Requerido | Descripción |
|-------|-----------|-------------|
| Subtotal | Auto | Suma de líneas |
| Impuesto (IVA) | No | Porcentaje de impuesto |
| Total | Auto | Subtotal + Impuesto |

##### Pago
| Campo | Requerido | Descripción |
|-------|-----------|-------------|
| Monto Pagado | No | Cantidad pagada al proveedor |
| Estado de Pago | Auto | Calculado según monto pagado |

#### Paso a Paso: Crear Compra Manualmente

1. Ir a **Compras** en el menú lateral
2. Click en **"Nueva Compra"**
3. Seleccionar el proveedor
4. Establecer la fecha de compra
5. Agregar productos/servicios con cantidades y precios
6. Verificar totales
7. Registrar monto pagado si aplica
8. Click en **"Crear Compra"**

#### Paso a Paso: Crear Compra con Asistente de Voz

1. Ir a **Compras**
2. Click en **"Nueva Compra"**
3. Click en el botón **"Asistente de Voz"**
4. Dictar la información de la compra
   - Ejemplo: "Compra a Distribuidora Médica del Norte, 20 cajas de jeringas a 200 pesos, 10 litros de alcohol a 50 pesos, pagué 2000 pesos de anticipo"
5. Revisar los datos extraídos
6. Corregir si es necesario
7. Click en **"Confirmar"**
8. Completar información faltante
9. Click en **"Crear Compra"**

---

### 3. Ver Detalle de Compra

**URL:** `/dashboard/practice/compras/[id]`

**Información mostrada:**
- Datos del proveedor
- Folio de compra
- Todas las líneas de productos
- Totales desglosados
- Historial de pagos
- Estado actual

---

### 4. Editar Compra

**URL:** `/dashboard/practice/compras/[id]/edit`

**Campos editables:** Todos los campos de la compra

---

### 5. Cambiar Estado de Compra

Puedes cambiar el estado directamente desde la lista usando el selector de estado.

#### Estados Disponibles

| Estado | Descripción | Siguiente Estado Válido |
|--------|-------------|------------------------|
| PENDIENTE | Compra registrada, sin confirmar | CONFIRMADA, CANCELADA |
| CONFIRMADA | Compra confirmada con proveedor | EN PROCESO, CANCELADA |
| EN PROCESO | Proveedor preparando pedido | ENVIADA, CANCELADA |
| ENVIADA | Pedido en tránsito | RECIBIDA |
| RECIBIDA | Pedido recibido en consultorio | (Final) |
| CANCELADA | Compra cancelada | (Final) |

**Importante:** El sistema valida las transiciones. No puedes saltar estados.

---

### 6. Eliminar Compra

#### Paso a Paso

1. En la lista de compras, localizar la compra
2. Click en el botón de eliminar (papelera)
3. Confirmar la eliminación

**Nota:** Esta acción es permanente.

---

## Estados de Pago

| Estado | Condición |
|--------|-----------|
| PENDIENTE | Monto pagado = 0 |
| PARCIAL | 0 < Monto pagado < Total |
| PAGADA | Monto pagado = Total |

---

## Lo que el Usuario PUEDE Hacer

- Crear compras manuales o por voz
- Editar compras existentes
- Cambiar estado de compra
- Registrar pagos parciales o totales
- Eliminar compras
- Filtrar y buscar compras

## Lo que el Usuario NO PUEDE Hacer

- **Solicitar factura al proveedor** - Gestión externa
- **Adjuntar factura recibida** - No hay función de archivos adjuntos
- **Generar reportes de compras** - No hay exportación
- **Duplicar compras** - Debe crear cada una individualmente
- **Saltar estados** - Debe seguir el flujo definido
- **Crear órdenes de compra** - Solo registro de compras realizadas

---

## Preguntas Frecuentes

### ¿Puedo crear una compra sin proveedor?
No, debes seleccionar un proveedor existente. Si es nuevo, primero créalo en el módulo de Proveedores.

### ¿Cómo registro un pago parcial?
Al editar la compra, actualiza el campo "Monto Pagado" con la cantidad pagada. El estado de pago se actualizará automáticamente.

### ¿Puedo cancelar una compra recibida?
No, una vez que la compra está en estado RECIBIDA es final y no se puede cancelar.

### ¿Las compras se reflejan en el flujo de dinero?
Sí, al crear una compra se genera automáticamente un registro en el flujo de dinero como egreso.

### ¿Puedo agregar gastos de envío?
Puedes agregarlo como una línea adicional en los productos/servicios de la compra.
