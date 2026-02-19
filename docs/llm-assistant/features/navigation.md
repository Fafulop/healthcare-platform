# Navegación en la Aplicación

## Descripción

Esta guía explica cómo navegar por el Portal Médico, incluyendo la estructura del menú, accesos directos y navegación en dispositivos móviles.

---

## Estructura del Menú Principal

El menú lateral (sidebar) contiene todas las secciones principales:

```
Portal Médico
│
├── 📋 Expedientes Médicos
│   └── Expedientes de Pacientes ► /dashboard/medical-records
│
├── 📅 Citas ────────────────────► /appointments
│
├── 🏥 Gestión de Consultorio
│   ├── Flujo de Dinero ─────────► /dashboard/practice/flujo-de-dinero
│   ├── Ventas ──────────────────► /dashboard/practice/ventas
│   ├── Compras ─────────────────► /dashboard/practice/compras
│   ├── Clientes ────────────────► /dashboard/practice/clients
│   ├── Proveedores ─────────────► /dashboard/practice/proveedores
│   ├── Cotizaciones ────────────► /dashboard/practice/cotizaciones
│   ├── Productos ───────────────► /dashboard/practice/products
│   └── Áreas ───────────────────► /dashboard/practice/areas
│
├── ✅ Pendientes ───────────────► /dashboard/pendientes
│
├── 👤 Mi Perfil ────────────────► /dashboard/mi-perfil
│
├── ✍️ Mi Blog ──────────────────► /dashboard/blog
│
└── 🚪 Cerrar Sesión
```

---

## Páginas y URLs

### Dashboard Principal

| Página | URL |
|--------|-----|
| Inicio | `/dashboard` |

### Expedientes Médicos

| Página | URL |
|--------|-----|
| Lista de Pacientes | `/dashboard/medical-records` |
| Nuevo Paciente | `/dashboard/medical-records/patients/new` |
| Perfil de Paciente | `/dashboard/medical-records/patients/[id]` |
| Editar Paciente | `/dashboard/medical-records/patients/[id]/edit` |
| Nueva Consulta | `/dashboard/medical-records/patients/[id]/encounters/new` |
| Ver Consulta | `/dashboard/medical-records/patients/[id]/encounters/[encounterId]` |
| Editar Consulta | `/dashboard/medical-records/patients/[id]/encounters/[encounterId]/edit` |
| Versiones de Consulta | `/dashboard/medical-records/patients/[id]/encounters/[encounterId]/versions` |
| Recetas del Paciente | `/dashboard/medical-records/patients/[id]/prescriptions` |
| Nueva Receta | `/dashboard/medical-records/patients/[id]/prescriptions/new` |
| Editar Receta | `/dashboard/medical-records/patients/[id]/prescriptions/[prescriptionId]/edit` |
| Multimedia | `/dashboard/medical-records/patients/[id]/media` |
| Subir Archivo | `/dashboard/medical-records/patients/[id]/media/upload` |
| Línea de Tiempo | `/dashboard/medical-records/patients/[id]/timeline` |

### Citas

| Página | URL |
|--------|-----|
| Agenda (Citas) | `/appointments` |

### Gestión de Consultorio

| Página | URL |
|--------|-----|
| Flujo de Dinero | `/dashboard/practice/flujo-de-dinero` |
| Nuevo Movimiento | `/dashboard/practice/flujo-de-dinero/new` |
| Áreas y Subáreas | `/dashboard/practice/areas` |
| Ventas | `/dashboard/practice/ventas` |
| Nueva Venta | `/dashboard/practice/ventas/new` |
| Ver Venta | `/dashboard/practice/ventas/[id]` |
| Editar Venta | `/dashboard/practice/ventas/[id]/edit` |
| Compras | `/dashboard/practice/compras` |
| Nueva Compra | `/dashboard/practice/compras/new` |
| Ver Compra | `/dashboard/practice/compras/[id]` |
| Editar Compra | `/dashboard/practice/compras/[id]/edit` |
| Clientes | `/dashboard/practice/clients` |
| Nuevo Cliente | `/dashboard/practice/clients/new` |
| Editar Cliente | `/dashboard/practice/clients/[id]/edit` |
| Proveedores | `/dashboard/practice/proveedores` |
| Nuevo Proveedor | `/dashboard/practice/proveedores/new` |
| Editar Proveedor | `/dashboard/practice/proveedores/[id]/edit` |
| Cotizaciones | `/dashboard/practice/cotizaciones` |
| Nueva Cotización | `/dashboard/practice/cotizaciones/new` |
| Ver Cotización | `/dashboard/practice/cotizaciones/[id]` |
| Editar Cotización | `/dashboard/practice/cotizaciones/[id]/edit` |
| Productos | `/dashboard/practice/products` |
| Nuevo Producto | `/dashboard/practice/products/new` |
| Editar Producto | `/dashboard/practice/products/[id]/edit` |

### Pendientes

| Página | URL |
|--------|-----|
| Lista de Pendientes | `/dashboard/pendientes` |
| Nueva Tarea | `/dashboard/pendientes/new` |
| Editar Tarea | `/dashboard/pendientes/[id]/edit` |

### Mi Perfil

| Página | URL |
|--------|-----|
| Mi Perfil | `/dashboard/mi-perfil` |

### Blog

| Página | URL |
|--------|-----|
| Mi Blog | `/dashboard/blog` |
| Nuevo Artículo | `/dashboard/blog/new` |
| Editar Artículo | `/dashboard/blog/[id]/edit` |

---

## Accesos Directos (Quick Actions)

Desde el **Dashboard Principal** (`/dashboard`) tienes accesos rápidos a:

| Acción | Destino |
|--------|---------|
| Nuevo Paciente | `/dashboard/medical-records/patients/new` |
| Nueva Consulta | Desde el perfil del paciente |
| Gestionar Citas | `/appointments` |

El botón flotante índigo (esquina inferior derecha con ícono de calendario) en el dashboard muestra:
- Conteo de citas reservadas + pendientes programados para hoy
- Al hacer clic: abre el panel "Detalles del Día"

---

## Navegación Contextual

### Dentro del Perfil de Paciente

Pestañas disponibles:
- Información General
- Consultas (Encounters)
- Recetas
- Multimedia
- Línea de Tiempo

### Dentro de Gestión de Consultorio

- **Ventas** tiene botones rápidos para: Clientes, Cotizaciones, Nueva Venta
- **Flujo de Dinero** tiene dos pestañas: Movimientos y Estado de Resultados; botón de acceso rápido a Áreas

### Dentro de Citas

- Vista Calendario (mensual)
- Vista Lista

### Dentro de Pendientes

- Vista Lista (Por Día / Ver Todos)
- Vista Calendario

### Dentro de Mi Perfil

7 pestañas: Info General, Servicios, Clínica, Formación, Multimedia, FAQs y Social, Opiniones

---

## Navegación Móvil

### Menú

- El menú lateral se oculta automáticamente en pantallas pequeñas
- Se accede tocando el **ícono de hamburguesa** (☰) en la esquina superior
- Se abre como un drawer deslizable
- Toca fuera del menú para cerrarlo

### Vistas Adaptadas

- Las tablas se convierten en tarjetas apiladas
- Los botones de acción se agrupan
- Los filtros pueden colapsarse

---

## Breadcrumbs y Navegación "Atrás"

En páginas de detalle o formularios, hay un enlace **"Volver a..."** en la parte superior que regresa a la lista anterior.

Ejemplos:
- En "Nuevo Paciente" → "Volver a Pacientes"
- En "Editar Venta" → "Volver a Ventas"
- En "Perfil de Paciente" → "Volver a Pacientes"

---

## Indicadores de Ubicación

### Menú Lateral

La sección actual se resalta (color diferente, fondo destacado).

### Título de Página

Cada página muestra su título en la parte superior.

---

## Sesión y Autenticación

### Cerrar Sesión

- Ubicación: Parte inferior del menú lateral
- Click en **"Cerrar Sesión"** → redirige al login

### Sesión Expirada

Si la sesión expira, el sistema redirige automáticamente al login.
