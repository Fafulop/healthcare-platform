# Proveedores

## Propósito

Permite gestionar la base de datos de proveedores del consultorio, para uso en compras y control de gastos.

## Acceso

**Ruta:** Menú lateral > Gestión de Consultorio > (desde Compras o configuración)

**URL:** `/dashboard/practice/proveedores`

---

## Funcionalidades

### 1. Ver Lista de Proveedores

**URL:** `/dashboard/practice/proveedores`

**Información por proveedor:**
- Razón Social / Nombre del negocio
- Nombre de contacto
- Email
- Teléfono
- RFC (si aplica)

**Acciones disponibles:**
- Buscar proveedores
- Editar proveedor
- Eliminar proveedor

---

### 2. Crear Nuevo Proveedor

**URL:** `/dashboard/practice/proveedores/new`

#### Campos del Formulario

| Campo | Requerido | Descripción |
|-------|-----------|-------------|
| Razón Social | **Sí** | Nombre del negocio o persona |
| Nombre de Contacto | No | Persona de contacto |
| Email | No | Correo electrónico |
| Teléfono | No | Número de contacto |
| RFC | No | Registro Federal de Contribuyentes |
| Dirección | No | Dirección del proveedor |
| Ciudad | No | Ciudad |
| Estado | No | Estado/Provincia |
| Código Postal | No | CP |
| Notas | No | Notas adicionales |

#### Paso a Paso

1. Ir a **Proveedores**
2. Click en **"Nuevo Proveedor"**
3. Ingresar la razón social
4. Completar datos de contacto
5. Opcionalmente agregar datos fiscales
6. Click en **"Crear Proveedor"**

---

### 3. Editar Proveedor

**URL:** `/dashboard/practice/proveedores/[id]/edit`

#### Paso a Paso

1. En la lista de proveedores, click en **"Editar"**
2. Modificar los campos necesarios
3. Click en **"Guardar Cambios"**

---

### 4. Eliminar Proveedor

#### Paso a Paso

1. En la lista de proveedores, localizar el proveedor
2. Click en el botón de eliminar (papelera)
3. Confirmar la eliminación

**Precaución:** Si el proveedor tiene compras asociadas, podría afectar el historial.

---

## Uso de Proveedores

Los proveedores registrados se utilizan al:
- Crear compras (seleccionar proveedor)
- Ver historial de adquisiciones

---

## Lo que el Usuario PUEDE Hacer

- Crear proveedores ilimitados
- Editar información de proveedores
- Eliminar proveedores
- Usar proveedores en compras

## Lo que el Usuario NO PUEDE Hacer

- **Ver historial de compras al proveedor** - No hay vista consolidada
- **Enviar órdenes de compra** - No hay función de envío
- **Importar proveedores** - No hay importación masiva
- **Evaluar proveedores** - No hay sistema de calificación
- **Comparar precios** - No hay comparador de proveedores

---

## Preguntas Frecuentes

### ¿Puedo crear una compra sin proveedor?
No, toda compra requiere un proveedor. Primero crea el proveedor y luego la compra.

### ¿Puedo ver todas las compras a un proveedor?
No directamente, pero puedes filtrar las compras por nombre del proveedor en la lista de compras.

### ¿Necesito el RFC del proveedor?
No es obligatorio, pero es útil si necesitas datos fiscales para deducción de gastos.

### ¿Puedo tener varios contactos por proveedor?
No, solo hay un campo de contacto. Puedes usar el campo de notas para agregar contactos adicionales.
