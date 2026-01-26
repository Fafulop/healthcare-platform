# Clientes

## Propósito

Permite gestionar la base de datos de clientes comerciales del consultorio, para uso en ventas y cotizaciones.

## Acceso

**Ruta:** Menú lateral > Gestión de Consultorio > Ventas > Botón "Clientes"

**URL:** `/dashboard/practice/clients`

---

## Funcionalidades

### 1. Ver Lista de Clientes

**URL:** `/dashboard/practice/clients`

**Información por cliente:**
- Razón Social / Nombre del negocio
- Nombre de contacto
- Email
- Teléfono
- RFC (si aplica)

**Acciones disponibles:**
- Buscar clientes
- Editar cliente
- Eliminar cliente

---

### 2. Crear Nuevo Cliente

**URL:** `/dashboard/practice/clients/new`

#### Campos del Formulario

| Campo | Requerido | Descripción |
|-------|-----------|-------------|
| Razón Social | **Sí** | Nombre del negocio o persona |
| Nombre de Contacto | No | Persona de contacto |
| Email | No | Correo electrónico |
| Teléfono | No | Número de contacto |
| RFC | No | Registro Federal de Contribuyentes |
| Dirección | No | Dirección fiscal |
| Ciudad | No | Ciudad |
| Estado | No | Estado/Provincia |
| Código Postal | No | CP |
| Notas | No | Notas adicionales |

#### Paso a Paso

1. Ir a **Clientes** (desde el módulo de Ventas)
2. Click en **"Nuevo Cliente"**
3. Ingresar la razón social
4. Completar datos de contacto
5. Opcionalmente agregar datos fiscales
6. Click en **"Crear Cliente"**

---

### 3. Editar Cliente

**URL:** `/dashboard/practice/clients/[id]/edit`

#### Paso a Paso

1. En la lista de clientes, click en **"Editar"**
2. Modificar los campos necesarios
3. Click en **"Guardar Cambios"**

---

### 4. Eliminar Cliente

#### Paso a Paso

1. En la lista de clientes, localizar el cliente
2. Click en el botón de eliminar (papelera)
3. Confirmar la eliminación

**Precaución:** Si el cliente tiene ventas asociadas, podría afectar el historial.

---

## Uso de Clientes

Los clientes registrados se utilizan al:
- Crear ventas (seleccionar cliente)
- Crear cotizaciones (seleccionar cliente)
- Ver historial de transacciones

---

## Diferencia: Clientes vs Pacientes

| Aspecto | Clientes | Pacientes |
|---------|----------|-----------|
| Propósito | Transacciones comerciales | Atención médica |
| Ubicación | Gestión de Consultorio | Expedientes Médicos |
| Datos | Fiscales y comerciales | Médicos y personales |
| Uso | Ventas, Compras | Consultas, Recetas |

Un **paciente** puede también ser **cliente** si le vendes productos o servicios facturables. Son registros separados.

---

## Lo que el Usuario PUEDE Hacer

- Crear clientes ilimitados
- Editar información de clientes
- Eliminar clientes
- Usar clientes en ventas y cotizaciones

## Lo que el Usuario NO PUEDE Hacer

- **Ver historial de compras del cliente** - No hay vista consolidada
- **Enviar comunicaciones** - No hay función de email/mensaje
- **Importar clientes** - No hay importación masiva
- **Asignar vendedor** - No hay gestión de vendedores
- **Límites de crédito** - No hay control de crédito

---

## Preguntas Frecuentes

### ¿Puedo crear una venta sin cliente?
No, toda venta requiere un cliente. Primero crea el cliente y luego la venta.

### ¿Los clientes son los mismos que los pacientes?
No, son registros separados. Los clientes están en Gestión de Consultorio (para ventas) y los pacientes en Expedientes Médicos (para atención clínica).

### ¿Puedo ver todas las ventas de un cliente?
No directamente, pero puedes filtrar las ventas por nombre del cliente en la lista de ventas.

### ¿Necesito el RFC del cliente?
No es obligatorio, pero es útil si necesitas datos fiscales para facturación externa.
