# Ventas

## Propósito

Permite registrar y dar seguimiento a las ventas realizadas a clientes, incluyendo estado de entrega y pagos.

## Acceso

**Ruta:** Menú lateral > Gestión de Consultorio > Ventas

**URL:** `/dashboard/practice/ventas`

---

## Funcionalidades

### 1. Ver Lista de Ventas

**URL:** `/dashboard/practice/ventas`

**Panel de Resumen (parte superior):**
- Total Ventas: Suma de todas las ventas
- Cobrado: Total de pagos recibidos
- Pendiente: Monto por cobrar

**Información por venta:**
- Folio (número de venta)
- Cliente
- Fecha de venta
- Fecha de entrega
- Total
- Estado de pago
- Estado de venta

**Filtros disponibles:**
- Búsqueda por folio o cliente
- Filtro por estado de venta
- Filtro por estado de pago

**Vistas:**
- Desktop: Tabla completa
- Móvil: Tarjetas

---

### 2. Crear Nueva Venta

**URL:** `/dashboard/practice/ventas/new`

#### Campos del Formulario

##### Información General
| Campo | Requerido | Descripción |
|-------|-----------|-------------|
| Cliente | **Sí** | Seleccionar de lista de clientes |
| Fecha de Venta | **Sí** | Fecha de la transacción |
| Fecha de Entrega | No | Fecha estimada de entrega |
| Cotización | No | Vincular a cotización existente |

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
| Monto Pagado | No | Cantidad recibida |
| Estado de Pago | Auto | Calculado según monto pagado |

#### Paso a Paso: Crear Venta Manualmente

1. Ir a **Ventas** en el menú lateral
2. Click en **"Nueva Venta"**
3. Seleccionar el cliente
4. Establecer la fecha de venta
5. Agregar productos/servicios con cantidades y precios
6. Verificar totales
7. Registrar monto pagado si aplica
8. Click en **"Crear Venta"**

#### Paso a Paso: Crear Venta con Asistente de Voz

1. Ir a **Ventas**
2. Click en **"Nueva Venta"**
3. Click en el botón **"Asistente de Voz"**
4. Dictar la información de la venta
   - Ejemplo: "Venta para cliente Farmacia López, 10 cajas de guantes a 150 pesos cada una, 5 paquetes de gasas a 80 pesos, total con IVA"
5. Revisar los datos extraídos
6. Corregir si es necesario
7. Click en **"Confirmar"**
8. Completar información faltante
9. Click en **"Crear Venta"**

---

### 3. Ver Detalle de Venta

**URL:** `/dashboard/practice/ventas/[id]`

**Información mostrada:**
- Datos del cliente
- Folio de venta
- Todas las líneas de productos
- Totales desglosados
- Historial de pagos
- Estado actual

---

### 4. Editar Venta

**URL:** `/dashboard/practice/ventas/[id]/edit`

**Campos editables:** Todos los campos de la venta

---

### 5. Cambiar Estado de Venta

Puedes cambiar el estado directamente desde la lista usando el selector de estado.

#### Estados Disponibles

| Estado | Descripción | Siguiente Estado Válido |
|--------|-------------|------------------------|
| PENDIENTE | Venta registrada, sin confirmar | CONFIRMADA, CANCELADA |
| CONFIRMADA | Venta confirmada | EN PROCESO, CANCELADA |
| EN PROCESO | Preparando pedido | ENVIADA, CANCELADA |
| ENVIADA | Pedido en camino | ENTREGADA |
| ENTREGADA | Pedido recibido por cliente | (Final) |
| CANCELADA | Venta cancelada | (Final) |

**Importante:** El sistema valida las transiciones. No puedes saltar estados (ej: de PENDIENTE directo a ENVIADA).

---

### 6. Eliminar Venta

#### Paso a Paso

1. En la lista de ventas, localizar la venta
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

## Accesos Rápidos

Desde la página de ventas puedes acceder rápidamente a:
- **Clientes:** Para gestionar base de clientes
- **Cotizaciones:** Para ver cotizaciones y convertirlas en ventas

---

## Lo que el Usuario PUEDE Hacer

- Crear ventas manuales o por voz
- Editar ventas existentes
- Cambiar estado de venta
- Registrar pagos parciales o totales
- Eliminar ventas
- Filtrar y buscar ventas
- Vincular ventas a cotizaciones

## Lo que el Usuario NO PUEDE Hacer

- **Facturar desde la app** - No hay generación de CFDI
- **Enviar factura al cliente** - No hay función de envío
- **Procesar pagos online** - Solo registro manual
- **Generar reportes de ventas** - No hay exportación
- **Duplicar ventas** - Debe crear cada una individualmente
- **Saltar estados** - Debe seguir el flujo definido

---

## Preguntas Frecuentes

### ¿Puedo crear una venta sin cliente?
No, debes seleccionar un cliente existente. Si es nuevo, primero créalo en el módulo de Clientes.

### ¿Cómo registro un pago parcial?
Al editar la venta, actualiza el campo "Monto Pagado" con la cantidad recibida. El estado de pago se actualizará automáticamente.

### ¿Puedo cancelar una venta entregada?
No, una vez que la venta está en estado ENTREGADA es final y no se puede cancelar.

### ¿Las ventas se reflejan en el flujo de dinero?
Sí, al crear una venta se genera automáticamente un registro en el flujo de dinero como ingreso.

### ¿Puedo cambiar el cliente de una venta?
Sí, mientras editas la venta puedes cambiar el cliente seleccionado.
