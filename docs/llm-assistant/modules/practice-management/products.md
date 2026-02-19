# Productos

## Qué es

El catálogo de Productos registra los artículos que el consultorio vende o compra. Los productos sirven como referencia al crear ventas y compras — facilitan el llenado de líneas sin tener que escribir el mismo producto cada vez.

## Acceso

**Ruta:** Menú lateral > Gestión de Consultorio > Productos
**URL:** `/dashboard/practice/products`

---

## Ver Lista de Productos

**Información visible por producto:**
| Campo | Descripción |
|-------|-------------|
| Nombre | Nombre del producto |
| Descripción | Descripción detallada (si se capturó) |
| Precio | Precio de venta en MXN |
| Unidad de medida | Pieza, caja, litro, etc. |
| Código/SKU | Código interno (si se capturó) |

**Acciones disponibles:**
- Buscar productos por nombre
- Editar producto
- Eliminar producto

---

## Crear Nuevo Producto

**URL:** `/dashboard/practice/products/new`

### Campos del Formulario

| Campo | Requerido | Descripción |
|-------|-----------|-------------|
| Nombre | Sí | Nombre del producto |
| Descripción | No | Descripción detallada |
| Precio | Sí | Precio de venta en MXN |
| Unidad de medida | No | Pieza, caja, litro, etc. |
| Código/SKU | No | Identificador interno del producto |

### Paso a Paso

1. Ir a **Productos** en el menú lateral
2. Clic en **"Nuevo Producto"**
3. Ingresar el nombre (obligatorio)
4. Establecer el precio (obligatorio)
5. Completar descripción y unidad (opcional)
6. Clic en **"Crear Producto"**

---

## Editar Producto

**URL:** `/dashboard/practice/products/[id]/edit`

1. En la lista, clic en **"Editar"** del producto
2. Modificar los campos necesarios
3. Clic en **"Guardar Cambios"**

---

## Eliminar Producto

1. En la lista, clic en el ícono de papelera
2. Confirmar la eliminación
3. La acción es **permanente**

---

## Uso en Ventas y Compras

Los productos del catálogo pueden seleccionarse al crear:
- **Ventas:** para agregar líneas de productos con precio ya configurado
- **Compras:** para registrar los ítems adquiridos

---

## Restricciones del Sistema

| Acción | Estado |
|--------|--------|
| Control de inventario automático | ❌ Sin tracking de stock |
| Alertas de bajo inventario | ❌ Sin notificaciones |
| Categorías de productos | ❌ Sin categorización |
| Importar desde Excel/CSV | ❌ Sin importación masiva |
| Escaneo de código de barras | ❌ No disponible |
| Múltiples precios (listas de precios) | ❌ Un solo precio por producto |

---

## Preguntas Frecuentes

**¿Puedo manejar inventario con este módulo?**
No. El sistema no tiene control de inventario automático. Debes llevar el control manualmente.

**¿Los productos aparecen al crear ventas?**
Sí, al crear una venta puedes seleccionar productos del catálogo en las líneas de pedido.

**¿Puedo tener el mismo producto en diferentes presentaciones?**
Sí, crea un producto separado por presentación. Ejemplo: "Paracetamol 500mg" y "Paracetamol 1g" como dos productos distintos.

**¿Hay límite de productos?**
No, puedes crear tantos productos como necesites.
