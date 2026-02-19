# Flujo de Dinero

## Qué es

El módulo de Flujo de Dinero registra todos los movimientos financieros del consultorio — ingresos y egresos. Incluye un Estado de Resultados que agrupa los movimientos por áreas y muestra el balance neto.

## Acceso

**Ruta:** Menú lateral > Gestión de Consultorio > Flujo de Dinero
**URL:** `/dashboard/practice/flujo-de-dinero`

---

## Pestañas Principales

### Pestaña "Movimientos"

Lista de todos los movimientos financieros con filtros y panel de resumen.

**Panel de Resumen:**
| Tarjeta | Descripción |
|---------|-------------|
| Balance Actual | Ingresos realizados − Egresos realizados |
| Total Ingresos | Suma de todos los ingresos realizados |
| Total Egresos | Suma de todos los egresos realizados |

**Filtros disponibles:**
| Filtro | Opciones |
|--------|----------|
| Buscar | Por concepto o ID del movimiento |
| Tipo | Todos \| Ingresos \| Egresos |
| Estado | Todos \| Realizados \| Por Realizar |
| Fecha Inicio | Desde esta fecha |
| Fecha Fin | Hasta esta fecha |

**Información por movimiento:**
| Campo | Descripción |
|-------|-------------|
| Fecha | Fecha de la transacción |
| Concepto | Descripción del movimiento |
| Área | Categoría principal (ej: Consultas Médicas) |
| Subárea | Subcategoría (ej: Consulta General) |
| Tipo | Ingreso o Egreso |
| Tipo de Transacción | Venta / Compra / N/A |
| Cliente/Proveedor | Si aplica (movimientos de ventas/compras) |
| Estado de Pago | Pagado / Parcial / Pendiente |
| Total | Monto total |
| Pagado | Monto ya cobrado/pagado |
| Saldo | Total − Pagado |
| Estado | Realizado / Por Realizar |

### Pestaña "Estado de Resultados"

Resumen financiero agrupado por áreas:

**Sección Ingresos:**
- Agrupados por área
- Desglose por subárea
- Total por área
- Total general de ingresos
- Cuentas por Cobrar (montos pendientes de ventas)

**Sección Egresos:**
- Agrupados por área
- Desglose por subárea
- Total por área
- Total general de egresos
- Cuentas por Pagar (montos pendientes de compras)

**Balance General:**
- Total Ingresos Realizados
- Total Egresos Realizados
- Balance Neto (Ingresos − Egresos)
- Flujo Pendiente (Por Cobrar vs Por Pagar)

---

## Crear Nuevo Movimiento

**URL:** `/dashboard/practice/flujo-de-dinero/new`

### Campos del Formulario

| Campo | Requerido | Descripción |
|-------|-----------|-------------|
| Tipo de Movimiento | Sí | Ingreso o Egreso |
| Concepto | Sí | Descripción del movimiento |
| Monto | Sí | Cantidad en MXN |
| Fecha | Sí | Fecha de la transacción |
| Área | Sí | Categoría principal del movimiento |
| Subárea | No | Subcategoría dentro del área |
| Forma de Pago | No | Efectivo \| Transferencia \| Tarjeta \| Cheque \| Depósito |
| Cuenta Bancaria | No | Cuenta donde se registra el movimiento |
| Por Realizar | No | Checkbox: marcar si es movimiento futuro/pendiente |

---

## Crear Movimiento — Paso a Paso

### Manual

1. Ir a **Flujo de Dinero** en el menú lateral
2. Clic en **"Nuevo Movimiento"**
3. Seleccionar tipo: Ingreso o Egreso
4. Ingresar el concepto
5. Establecer el monto y fecha
6. Elegir área (y subárea si aplica)
7. Seleccionar forma de pago si se conoce
8. Clic en **"Crear Movimiento"**

### Con Asistente de Voz — Múltiples Movimientos

El asistente de voz puede crear **varios movimientos en una sola dictada**:

1. Ir a **Flujo de Dinero** > **"Nuevo Movimiento"**
2. Clic en **"Asistente de Voz"**
3. Dictar todos los movimientos:
   > *"Ingreso de 5000 pesos por consulta del día de hoy, área consultas médicas. Egreso de 800 pesos por material de oficina, área gastos administrativos. Ingreso de 2500 pesos por procedimiento, área procedimientos"*
4. El sistema detecta múltiples movimientos y los lista
5. Revisar cada movimiento propuesto
6. Corregir si es necesario
7. Clic en **"Confirmar"** → se crean todos juntos

---

## Cambiar Área de un Movimiento

Desde la lista, sin ir a editar:

1. Clic en la celda de Área del movimiento en la tabla
2. Seleccionar nueva área del dropdown
3. Seleccionar nueva subárea (si hay disponibles)
4. Clic en **"Guardar"**

---

## Movimientos Automáticos

Cuando creas una Venta o Compra, el sistema genera automáticamente un movimiento:

| Origen | Tipo generado | Datos incluidos |
|--------|---------------|-----------------|
| Venta nueva | Ingreso | Cliente, número de venta, monto |
| Compra nueva | Egreso | Proveedor, número de compra, monto |

El estado de pago de estos movimientos se sincroniza con el estado de pago de la venta/compra.

---

## Movimiento "Por Realizar"

Un movimiento "Por Realizar" es uno futuro o pendiente de ejecutarse. Ejemplos:
- Un pago al proveedor programado para la próxima semana
- Un ingreso esperado que aún no se ha recibido

Los movimientos "Por Realizar" **no se incluyen** en el Balance Actual — solo los "Realizados" cuentan.

---

## Restricciones del Sistema

| Acción | Estado |
|--------|--------|
| Exportar a Excel/PDF | ❌ Sin función de exportación |
| Conciliar con estado de cuenta bancario | ❌ Sin conciliación bancaria |
| Programar movimientos recurrentes | ❌ Debe crear cada uno manualmente |
| Adjuntar comprobantes/facturas | ❌ Sin archivos adjuntos |
| Integrar con sistema contable externo | ❌ Sin integración |

---

## Áreas y Subáreas

Las áreas categorizan los movimientos en el Estado de Resultados. Se configuran en `/dashboard/practice/areas`.

**Áreas típicas de ingreso:**
- Consultas Médicas (subáreas: Consulta General, Especializada, Procedimientos)
- Ventas de Productos
- Otros Ingresos

**Áreas típicas de egreso:**
- Gastos de Personal (subáreas: Salarios, Prestaciones)
- Gastos Administrativos (subáreas: Renta, Servicios, Material de Oficina)
- Compras de Insumos
- Impuestos

---

## Preguntas Frecuentes

**¿Qué significa "Por Realizar"?**
Es un movimiento futuro o programado que aún no se ha ejecutado. No afecta el Balance Actual hasta que se marque como realizado.

**¿Las ventas y compras aparecen automáticamente en el flujo?**
Sí, al crear una venta o compra se genera automáticamente el movimiento correspondiente.

**¿Puedo crear múltiples movimientos de una sola vez?**
Sí, usando el asistente de voz puedes dictar varios movimientos en una sola grabación.

**¿Cómo configuro las áreas?**
Desde la página de Flujo de Dinero, clic en el botón "Áreas" para ir a la configuración.

**¿El Estado de Resultados se actualiza en tiempo real?**
Sí, refleja los movimientos actuales según los filtros de fecha aplicados.

**¿Puedo editar el área de un movimiento automático (de venta/compra)?**
Sí, puedes cambiar el área y subárea desde la lista. El monto se sincroniza con la venta/compra original.
