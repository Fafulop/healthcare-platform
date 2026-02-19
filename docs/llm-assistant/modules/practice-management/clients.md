# Clientes

## Qué es

El módulo de Clientes gestiona la base de datos de clientes comerciales del consultorio — empresas o personas a quienes el médico vende productos o servicios. Son distintos de los **pacientes** (expedientes médicos).

## Acceso

**Ruta:** Menú lateral > Gestión de Consultorio > Ventas > botón "Clientes"
**URL:** `/dashboard/practice/clients`

---

## Ver Lista de Clientes

**Información visible por cliente:**
| Campo | Descripción |
|-------|-------------|
| Razón Social | Nombre del negocio o persona |
| Nombre de Contacto | Persona de contacto en el cliente |
| Email | Correo electrónico |
| Teléfono | Número de contacto |
| RFC | Registro Federal de Contribuyentes (si se capturó) |

**Acciones disponibles:**
- Buscar clientes por nombre
- Editar cliente
- Eliminar cliente

---

## Crear Nuevo Cliente

**URL:** `/dashboard/practice/clients/new`

### Campos del Formulario

| Campo | Requerido | Descripción |
|-------|-----------|-------------|
| Razón Social | Sí | Nombre del negocio o persona física |
| Nombre de Contacto | No | Persona de contacto dentro del cliente |
| Email | No | Correo electrónico de contacto |
| Teléfono | No | Número de teléfono |
| RFC | No | Para datos fiscales y facturación externa |
| Dirección | No | Calle y número |
| Ciudad | No | Ciudad |
| Estado/Provincia | No | Estado o provincia |
| Código Postal | No | Código postal |
| Notas | No | Notas adicionales sobre el cliente |

### Paso a Paso

1. Ir a **Clientes** (desde Ventas en el menú lateral)
2. Clic en **"Nuevo Cliente"**
3. Ingresar la razón social (obligatorio)
4. Completar datos de contacto
5. Opcionalmente agregar datos fiscales (RFC, dirección)
6. Clic en **"Crear Cliente"**

---

## Editar Cliente

**URL:** `/dashboard/practice/clients/[id]/edit`

1. En la lista, clic en **"Editar"** del cliente
2. Modificar los campos necesarios
3. Clic en **"Guardar Cambios"**

---

## Eliminar Cliente

1. En la lista, clic en el ícono de papelera
2. Confirmar la eliminación
3. **Precaución:** Si el cliente tiene ventas asociadas, puede afectar el historial de esas ventas

---

## Uso de Clientes

Los clientes se seleccionan al:
- Crear una nueva venta (campo "Cliente" — obligatorio)
- Crear una cotización (campo "Cliente" — obligatorio)

---

## Diferencia: Clientes vs Pacientes

| Aspecto | Clientes | Pacientes |
|---------|----------|-----------|
| Propósito | Transacciones comerciales | Atención médica clínica |
| Módulo | Gestión de Consultorio | Expedientes Médicos |
| Datos capturados | Fiscales, comerciales | Médicos, personales |
| Uso en | Ventas, Cotizaciones | Consultas, Recetas |

Un paciente puede también ser cliente si le vendes productos o servicios. Son registros **separados** — no están vinculados automáticamente.

---

## Restricciones del Sistema

| Acción | Estado |
|--------|--------|
| Ver historial completo de ventas de un cliente | ❌ Sin vista consolidada (filtrar en Ventas) |
| Enviar comunicaciones al cliente desde la app | ❌ Sin función de mensajería |
| Importar clientes desde Excel/CSV | ❌ Sin importación masiva |
| Control de límites de crédito | ❌ No disponible |
| Múltiples contactos por cliente | ❌ Solo un contacto (usar campo Notas para más) |

---

## Preguntas Frecuentes

**¿Puedo crear una venta sin cliente?**
No. Toda venta requiere un cliente existente. Si es nuevo, créalo primero.

**¿Los clientes son los mismos que los pacientes?**
No. Son registros completamente separados en módulos distintos.

**¿Puedo ver todas las ventas de un cliente?**
No hay una vista consolidada por cliente. Puedes filtrar la lista de Ventas por nombre del cliente.

**¿Necesito el RFC del cliente?**
No es obligatorio, pero es útil si necesitas datos fiscales para facturación externa.
