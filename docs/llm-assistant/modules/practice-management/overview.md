# Gestión de Consultorio - Visión General

## Propósito

El módulo de **Gestión de Consultorio** permite al médico administrar las operaciones financieras y comerciales de su práctica médica, incluyendo ventas, compras y flujo de dinero.

## Acceso

**Ruta:** Menú lateral > Gestión de Consultorio

---

## Módulos Incluidos

### 1. Flujo de Dinero
Registro de ingresos y egresos del consultorio.
- **URL:** `/dashboard/practice/flujo-de-dinero`
- Movimientos bancarios
- Categorización por áreas
- Estado de resultados

### 2. Ventas
Gestión de ventas a clientes.
- **URL:** `/dashboard/practice/ventas`
- Registro de transacciones
- Seguimiento de pagos
- Estados de venta

### 3. Compras
Gestión de compras a proveedores.
- **URL:** `/dashboard/practice/compras`
- Registro de adquisiciones
- Control de pagos
- Estados de compra

### 4. Productos
Catálogo de productos.
- **URL:** `/dashboard/practice/products`
- Inventario
- Precios

### 5. Clientes
Base de datos de clientes comerciales.
- **URL:** `/dashboard/practice/clients`
- Datos de contacto
- Historial de transacciones

### 6. Proveedores
Base de datos de proveedores.
- **URL:** `/dashboard/practice/proveedores`
- Datos de contacto
- Historial de compras

### 7. Cotizaciones
Propuestas comerciales formales con conversión directa a venta.
- **URL:** `/dashboard/practice/cotizaciones`
- Estados: Borrador → Enviada → Aprobada / Rechazada / Vencida / Cancelada
- Convertir a venta con un clic
- Exportar a PDF

### 8. Áreas y Subáreas
Categorías para clasificar los movimientos de flujo de dinero.
- **URL:** `/dashboard/practice/areas`
- Tipo INGRESO o EGRESO (inmutable tras creación)
- Cada área puede tener múltiples subáreas

---

## Conceptos Clave

### Áreas y Subáreas
Los movimientos de dinero se categorizan en **áreas** (categorías principales) y **subáreas** (subcategorías).

**Ejemplo:**
- Área: "Ingresos por Consultas"
  - Subárea: "Consultas Generales"
  - Subárea: "Procedimientos"

### Estados de Venta
Las ventas siguen un flujo de estados:
```
PENDIENTE → CONFIRMADA → EN PROCESO → ENVIADA → ENTREGADA
                                              ↘ CANCELADA
```

### Estados de Compra
Las compras siguen un flujo similar:
```
PENDIENTE → CONFIRMADA → EN PROCESO → ENVIADA → RECIBIDA
                                              ↘ CANCELADA
```

### Estados de Pago
Tanto ventas como compras tienen estado de pago:
- **PENDIENTE:** Sin pago recibido
- **PARCIAL:** Pago parcial recibido
- **PAGADA:** Totalmente pagada

---

## Resumen de Funcionalidades

| Módulo | Crear | Editar | Eliminar | Voz |
|--------|-------|--------|----------|-----|
| Flujo de Dinero | Sí | Sí | Sí | Sí |
| Ventas | Sí | Sí | Sí | Sí |
| Compras | Sí | Sí | Sí | Sí |
| Productos | Sí | Sí | Sí | No |
| Clientes | Sí | Sí | Sí | No |
| Proveedores | Sí | Sí | Sí | No |
| Cotizaciones | Sí | Sí | Sí | No |
| Áreas | Sí | Sí | Sí (cascada) | No |

---

## Asistente de Voz Disponible

El asistente de voz está disponible para:
- **Flujo de Dinero:** Crear movimientos (ingresos/egresos)
- **Ventas:** Crear registros de venta
- **Compras:** Crear registros de compra

Ver documentación específica de cada módulo para detalles.
