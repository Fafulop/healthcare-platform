# Navegación en la Aplicación

## Descripción

Esta guía explica cómo navegar por el Portal Médico, incluyendo la estructura del menú, accesos directos y navegación en dispositivos móviles.

---

## Estructura del Menú Principal

El menú lateral (sidebar) contiene todas las secciones principales:

```
Portal Médico
│
├── 👤 Perfil y Público
│   ├── Mi Blog ────────────► /dashboard/blog
│   ├── Citas ──────────────► /appointments
│   └── Perfil Público ─────► (enlace externo)
│
├── 📋 Expedientes Médicos
│   ├── Expedientes de Pacientes ► /dashboard/medical-records
│   ├── Nueva Consulta ──────────► /dashboard/medical-records
│   └── Reportes ────────────────► /dashboard/medical-records
│
├── 🏥 Gestión de Consultorio
│   ├── Productos ───────────► /dashboard/practice/products
│   ├── Flujo de Dinero ─────► /dashboard/practice/flujo-de-dinero
│   ├── Ventas ──────────────► /dashboard/practice/ventas
│   └── Compras ─────────────► /dashboard/practice/compras
│
└── 🚪 Cerrar Sesión
```

---

## Páginas y URLs

### Dashboard Principal
| Página | URL |
|--------|-----|
| Inicio | `/dashboard` |

### Perfil y Público
| Página | URL |
|--------|-----|
| Mi Blog | `/dashboard/blog` |
| Nuevo Artículo | `/dashboard/blog/new` |
| Editar Artículo | `/dashboard/blog/[id]/edit` |
| Citas | `/appointments` |

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
| Recetas | `/dashboard/medical-records/patients/[id]/prescriptions` |
| Nueva Receta | `/dashboard/medical-records/patients/[id]/prescriptions/new` |
| Multimedia | `/dashboard/medical-records/patients/[id]/media` |
| Subir Archivo | `/dashboard/medical-records/patients/[id]/media/upload` |
| Línea de Tiempo | `/dashboard/medical-records/patients/[id]/timeline` |

### Gestión de Consultorio
| Página | URL |
|--------|-----|
| Productos | `/dashboard/practice/products` |
| Nuevo Producto | `/dashboard/practice/products/new` |
| Flujo de Dinero | `/dashboard/practice/flujo-de-dinero` |
| Nuevo Movimiento | `/dashboard/practice/flujo-de-dinero/new` |
| Áreas | `/dashboard/practice/areas` |
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
| Proveedores | `/dashboard/practice/proveedores` |
| Nuevo Proveedor | `/dashboard/practice/proveedores/new` |
| Cotizaciones | `/dashboard/practice/cotizaciones` |

---

## Accesos Directos (Quick Actions)

Desde el **Dashboard Principal** (`/dashboard`) tienes accesos rápidos a:

| Acción | Destino |
|--------|---------|
| Nuevo Paciente | `/dashboard/medical-records/patients/new` |
| Nueva Consulta | `/dashboard/medical-records` |
| Gestionar Citas | `/appointments` |

---

## Navegación Contextual

Dentro de ciertas secciones hay navegación adicional:

### Dentro del Perfil de Paciente
Tabs o enlaces para:
- Información General
- Consultas
- Recetas
- Multimedia
- Línea de Tiempo

### Dentro de Ventas
Botones rápidos para:
- Clientes
- Cotizaciones
- Nueva Venta

### Dentro de Flujo de Dinero
Tabs para:
- Movimientos
- Estado de Resultados
Botón para:
- Áreas

---

## Navegación Móvil

En dispositivos móviles:

### Menú
- El menú lateral se oculta automáticamente
- Se accede tocando el **ícono de hamburguesa** (☰) en la esquina superior
- Se abre como un drawer deslizable
- Toca fuera del menú para cerrarlo

### Vistas Adaptadas
- Las tablas se convierten en tarjetas apiladas
- Los botones de acción se agrupan
- Los filtros pueden colapsarse

### Navegación Inferior (Bottom Nav)
Algunas secciones pueden tener navegación en la parte inferior para acceso rápido a funciones principales.

---

## Breadcrumbs y Navegación "Atrás"

### Botón Volver
En páginas de detalle o formularios, hay un enlace **"Volver a..."** en la parte superior que te regresa a la lista anterior.

Ejemplos:
- En "Nuevo Paciente" → "Volver a Pacientes"
- En "Editar Venta" → "Volver a Ventas"
- En "Perfil de Paciente" → "Volver a Pacientes"

---

## Indicadores de Ubicación

### Menú Lateral
La sección actual se resalta en el menú (color diferente, fondo destacado).

### Título de Página
Cada página muestra su título en la parte superior.

---

## Sesión y Autenticación

### Cerrar Sesión
- Ubicación: Parte inferior del menú lateral
- Click en **"Cerrar Sesión"**
- Te redirige a la página de login

### Sesión Expirada
Si tu sesión expira:
- Serás redirigido automáticamente al login
- Inicia sesión nuevamente para continuar

---

## Consejos de Navegación

1. **Usa el menú lateral** para moverte entre secciones principales
2. **Usa los botones de acción** en cada página para tareas específicas
3. **Usa el botón "Volver"** para regresar a listas
4. **En móvil**, el menú está en el ícono de hamburguesa
5. **El dashboard** es un buen punto de inicio con accesos rápidos
