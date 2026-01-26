# Productos

## Propósito

Permite gestionar el catálogo de productos del consultorio, para uso en ventas y control de inventario.

## Acceso

**Ruta:** Menú lateral > Gestión de Consultorio > Productos

**URL:** `/dashboard/practice/products`

---

## Funcionalidades

### 1. Ver Lista de Productos

**URL:** `/dashboard/practice/products`

**Información por producto:**
- Nombre del producto
- Descripción
- Precio
- Unidad de medida
- Stock disponible (si se maneja)

**Acciones disponibles:**
- Buscar productos
- Editar producto
- Eliminar producto

---

### 2. Crear Nuevo Producto

**URL:** `/dashboard/practice/products/new`

#### Campos del Formulario

| Campo | Requerido | Descripción |
|-------|-----------|-------------|
| Nombre | **Sí** | Nombre del producto |
| Descripción | No | Descripción detallada |
| Precio | **Sí** | Precio de venta en MXN |
| Unidad | No | Pieza, caja, litro, etc. |
| Código/SKU | No | Código interno del producto |

#### Paso a Paso

1. Ir a **Productos** en el menú lateral
2. Click en **"Nuevo Producto"**
3. Ingresar el nombre del producto
4. Establecer el precio
5. Opcionalmente agregar descripción y unidad
6. Click en **"Crear Producto"**

---

### 3. Editar Producto

**URL:** `/dashboard/practice/products/[id]/edit`

#### Paso a Paso

1. En la lista de productos, click en **"Editar"**
2. Modificar los campos necesarios
3. Click en **"Guardar Cambios"**

---

### 4. Eliminar Producto

#### Paso a Paso

1. En la lista de productos, localizar el producto
2. Click en el botón de eliminar (papelera)
3. Confirmar la eliminación

**Nota:** Esta acción es permanente.

---

## Uso de Productos

Los productos registrados pueden usarse al:
- Crear ventas (seleccionar productos del catálogo)
- Crear compras (registrar productos adquiridos)

---

## Lo que el Usuario PUEDE Hacer

- Crear productos ilimitados
- Editar información de productos
- Eliminar productos
- Usar productos en ventas y compras

## Lo que el Usuario NO PUEDE Hacer

- **Control de inventario automático** - No hay tracking de stock
- **Alertas de bajo inventario** - No hay notificaciones
- **Categorizar productos** - No hay categorías
- **Importar productos** - No hay importación masiva
- **Código de barras** - No hay escaneo
- **Precios variables** - Un solo precio por producto

---

## Preguntas Frecuentes

### ¿Puedo manejar inventario?
El sistema no tiene control de inventario automático. Debes llevar el control manualmente.

### ¿Los productos se usan en las ventas?
Sí, al crear una venta puedes seleccionar productos del catálogo para agregar a la transacción.

### ¿Puedo tener productos con diferentes presentaciones?
Debes crear cada presentación como un producto separado (ej: "Paracetamol 500mg" y "Paracetamol 1g").

### ¿Hay función de búsqueda?
Sí, puedes buscar productos por nombre en la lista.
