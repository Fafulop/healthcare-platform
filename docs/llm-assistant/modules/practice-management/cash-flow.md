# Flujo de Dinero

## Propósito

Permite registrar y dar seguimiento a todos los movimientos financieros del consultorio, categorizados como ingresos o egresos.

## Acceso

**Ruta:** Menú lateral > Gestión de Consultorio > Flujo de Dinero

**URL:** `/dashboard/practice/flujo-de-dinero`

---

## Funcionalidades

### 1. Ver Movimientos

**URL:** `/dashboard/practice/flujo-de-dinero`

#### Pestañas Disponibles

**Pestaña "Movimientos":**
Vista de lista de todos los movimientos financieros.

**Pestaña "Estado de Resultados":**
Resumen financiero agrupado por áreas y subáreas.

#### Panel de Resumen (Pestaña Movimientos)

| Tarjeta | Descripción |
|---------|-------------|
| Balance Actual | Ingresos - Egresos realizados |
| Total Ingresos | Suma de ingresos realizados |
| Total Egresos | Suma de egresos realizados |

#### Filtros Disponibles

| Filtro | Opciones |
|--------|----------|
| Buscar | Por concepto o ID |
| Tipo | Todos, Ingresos, Egresos |
| Estado | Todos, Realizados, Por Realizar |
| Fecha Inicio | Fecha desde |
| Fecha Fin | Fecha hasta |

#### Información por Movimiento

- Fecha de transacción
- Concepto
- Área y Subárea
- Tipo (Ingreso/Egreso)
- Tipo de Transacción (Venta/Compra/N/A)
- Cliente/Proveedor (si aplica)
- Estado de Pago
- Total
- Pagado
- Saldo
- Estado (Realizado/Por Realizar)

---

### 2. Crear Nuevo Movimiento

**URL:** `/dashboard/practice/flujo-de-dinero/new`

#### Campos del Formulario

| Campo | Requerido | Descripción |
|-------|-----------|-------------|
| Tipo de Movimiento | **Sí** | Ingreso o Egreso |
| Concepto | **Sí** | Descripción del movimiento |
| Monto | **Sí** | Cantidad en MXN |
| Fecha | **Sí** | Fecha de la transacción |
| Área | **Sí** | Categoría principal |
| Subárea | No | Subcategoría |
| Forma de Pago | No | Efectivo, Transferencia, Tarjeta, Cheque, Depósito |
| Cuenta Bancaria | No | Cuenta donde se registra |
| Por Realizar | No | Si es un movimiento futuro/pendiente |

#### Formas de Pago

| Opción | Descripción |
|--------|-------------|
| Efectivo | Pago en efectivo |
| Transferencia | Transferencia bancaria |
| Tarjeta | Pago con tarjeta |
| Cheque | Pago con cheque |
| Depósito | Depósito bancario |

#### Paso a Paso: Crear Movimiento Manualmente

1. Ir a **Flujo de Dinero** en el menú lateral
2. Click en **"Nuevo Movimiento"**
3. Seleccionar tipo (Ingreso o Egreso)
4. Ingresar el concepto
5. Establecer el monto
6. Seleccionar fecha
7. Elegir área y subárea
8. Opcionalmente completar forma de pago y cuenta
9. Click en **"Crear Movimiento"**

#### Paso a Paso: Crear Movimientos con Asistente de Voz

1. Ir a **Flujo de Dinero**
2. Click en **"Nuevo Movimiento"**
3. Click en el botón **"Asistente de Voz"**
4. Dictar los movimientos
   - Ejemplo: "Ingreso de 5000 pesos por consulta del día de hoy, área consultas médicas. Egreso de 800 pesos por material de oficina, área gastos administrativos"
5. El sistema puede crear **múltiples movimientos** de una sola dictada
6. Revisar los movimientos propuestos
7. Corregir si es necesario
8. Click en **"Confirmar"** para crear todos

---

### 3. Estado de Resultados

**Ubicación:** Pestaña "Estado de Resultados"

Muestra un resumen financiero profesional:

#### Sección Ingresos
- Agrupados por área
- Desglose por subárea
- Total por área
- Total general de ingresos
- Cuentas por Cobrar (montos pendientes de ventas)

#### Sección Egresos
- Agrupados por área
- Desglose por subárea
- Total por área
- Total general de egresos
- Cuentas por Pagar (montos pendientes de compras)

#### Balance General
- Total Ingresos Realizados
- Total Egresos Realizados
- Balance Neto (Ingresos - Egresos)
- Flujo Pendiente (Por Cobrar vs Por Pagar)

---

### 4. Editar Área de un Movimiento

Puedes cambiar el área y subárea de un movimiento directamente desde la lista.

#### Paso a Paso

1. En la lista, click en la celda de Área del movimiento
2. Seleccionar nueva área del dropdown
3. Seleccionar nueva subárea (si hay disponibles)
4. Click en **"Guardar"**

---

### 5. Gestionar Áreas

**URL:** `/dashboard/practice/areas`

Las áreas categorizan los movimientos. Puedes:
- Ver áreas existentes
- Crear nuevas áreas
- Crear subáreas dentro de áreas
- Definir si el área es para ingresos o egresos

---

### 6. Eliminar Movimiento

#### Paso a Paso

1. En la lista, localizar el movimiento
2. Click en el botón de eliminar (papelera)
3. Confirmar la eliminación

---

## Áreas Predefinidas (Ejemplos)

### Para Ingresos
- Consultas Médicas
  - Consulta General
  - Consulta Especializada
  - Procedimientos
- Ventas de Productos
- Otros Ingresos

### Para Egresos
- Gastos de Personal
  - Salarios
  - Prestaciones
- Gastos Administrativos
  - Renta
  - Servicios
  - Material de Oficina
- Compras de Insumos
- Impuestos

---

## Movimientos Automáticos

Cuando creas una **Venta** o **Compra**, el sistema automáticamente genera un movimiento en el flujo de dinero:

| Origen | Tipo | Vinculación |
|--------|------|-------------|
| Venta | Ingreso | Muestra cliente y número de venta |
| Compra | Egreso | Muestra proveedor y número de compra |

Estos movimientos muestran el estado de pago real (Pagado, Parcial, Pendiente).

---

## Lo que el Usuario PUEDE Hacer

- Crear movimientos manuales individuales
- Crear múltiples movimientos por voz (batch)
- Editar movimientos existentes
- Cambiar área/subárea directamente en la lista
- Eliminar movimientos
- Filtrar por tipo, estado, fechas
- Ver estado de resultados
- Gestionar áreas y subáreas

## Lo que el Usuario NO PUEDE Hacer

- **Exportar a Excel/PDF** - No hay función de exportación
- **Conciliar con banco** - No hay conciliación bancaria
- **Generar reportes automáticos** - Solo vista de estado de resultados
- **Programar movimientos recurrentes** - Debe crear cada uno
- **Adjuntar comprobantes** - No hay función de archivos
- **Integrar con sistema contable** - No hay integración externa

---

## Preguntas Frecuentes

### ¿Qué significa "Por Realizar"?
Es un movimiento futuro o programado que aún no se ha ejecutado. Por ejemplo, un pago que harás la próxima semana.

### ¿Las ventas y compras aparecen automáticamente?
Sí, cuando creas una venta o compra, se genera automáticamente un registro en el flujo de dinero.

### ¿Puedo editar movimientos automáticos de ventas/compras?
Sí, puedes editar el área y subárea, pero el monto se sincroniza con la venta/compra original.

### ¿Cómo creo múltiples movimientos rápidamente?
Usa el asistente de voz. Puedes dictar varios movimientos en una sola grabación y se crearán todos juntos.

### ¿Dónde configuro las áreas?
Click en el botón "Áreas" en la parte superior de la página para ir a la configuración de áreas y subáreas.

### ¿El estado de resultados se actualiza en tiempo real?
Sí, refleja los movimientos actuales según los filtros aplicados.
