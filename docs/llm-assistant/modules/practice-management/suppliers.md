# Proveedores

## Qué es

El módulo de Proveedores gestiona la base de datos de proveedores del consultorio — empresas o personas de quienes el médico adquiere productos o servicios. Se usan al registrar compras.

## Acceso

**Ruta:** Menú lateral > Gestión de Consultorio > (desde Compras o acceso directo)
**URL:** `/dashboard/practice/proveedores`

---

## Ver Lista de Proveedores

**Información visible por proveedor:**
| Campo | Descripción |
|-------|-------------|
| Razón Social | Nombre del negocio o persona |
| Nombre de Contacto | Persona de contacto en el proveedor |
| Email | Correo electrónico |
| Teléfono | Número de contacto |
| RFC | Registro Federal de Contribuyentes (si se capturó) |

**Acciones disponibles:**
- Buscar proveedores por nombre
- Editar proveedor
- Eliminar proveedor

---

## Crear Nuevo Proveedor

**URL:** `/dashboard/practice/proveedores/new`

### Campos del Formulario

| Campo | Requerido | Descripción |
|-------|-----------|-------------|
| Razón Social | Sí | Nombre del negocio o persona física |
| Nombre de Contacto | No | Persona de contacto dentro del proveedor |
| Email | No | Correo electrónico del proveedor |
| Teléfono | No | Número de teléfono |
| RFC | No | Para datos fiscales y deducción de gastos |
| Dirección | No | Calle y número |
| Ciudad | No | Ciudad |
| Estado/Provincia | No | Estado o provincia |
| Código Postal | No | Código postal |
| Notas | No | Notas adicionales sobre el proveedor |

### Paso a Paso

1. Ir a **Proveedores**
2. Clic en **"Nuevo Proveedor"**
3. Ingresar la razón social (obligatorio)
4. Completar datos de contacto
5. Opcionalmente agregar datos fiscales (RFC, dirección)
6. Clic en **"Crear Proveedor"**

---

## Editar Proveedor

**URL:** `/dashboard/practice/proveedores/[id]/edit`

1. En la lista, clic en **"Editar"** del proveedor
2. Modificar los campos necesarios
3. Clic en **"Guardar Cambios"**

---

## Eliminar Proveedor

1. En la lista, clic en el ícono de papelera
2. Confirmar la eliminación
3. **Precaución:** Si el proveedor tiene compras asociadas, puede afectar el historial de esas compras

---

## Uso de Proveedores

Los proveedores se seleccionan al:
- Crear una nueva compra (campo "Proveedor" — obligatorio)

---

## Restricciones del Sistema

| Acción | Estado |
|--------|--------|
| Ver historial completo de compras a un proveedor | ❌ Sin vista consolidada (filtrar en Compras) |
| Enviar órdenes de compra al proveedor | ❌ Sin función de envío |
| Importar proveedores desde Excel/CSV | ❌ Sin importación masiva |
| Sistema de evaluación/calificación | ❌ No disponible |
| Comparar precios entre proveedores | ❌ No disponible |
| Múltiples contactos por proveedor | ❌ Solo un contacto (usar campo Notas para más) |

---

## Preguntas Frecuentes

**¿Puedo crear una compra sin proveedor?**
No. Toda compra requiere un proveedor existente. Si es nuevo, créalo primero.

**¿Puedo ver todas las compras a un proveedor?**
No hay una vista consolidada. Puedes filtrar la lista de Compras por nombre del proveedor.

**¿Necesito el RFC del proveedor?**
No es obligatorio, pero es útil para deducción de gastos e impuestos.

**¿Puedo tener varios contactos por proveedor?**
No, solo hay un campo de contacto principal. Usa el campo "Notas" para registrar contactos adicionales.
