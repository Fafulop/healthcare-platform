# Mi Blog

## Qué es

El blog permite al médico publicar artículos en su perfil público. Los artículos son visibles para pacientes y visitantes en el perfil público del médico, y sirven para posicionamiento, educación del paciente o comunicación de novedades.

## Acceso

**Ruta:** Menú lateral > Perfil y Público > Mi Blog
**URL:** `/dashboard/blog`

---

## Panel de Estadísticas

En la parte superior de la lista de artículos:

| Tarjeta | Descripción |
|---------|-------------|
| Total de artículos | Todos los artículos creados |
| Artículos publicados | Los visibles en el perfil público |
| Borradores | Artículos guardados pero no publicados |
| Total de vistas | Suma de todas las visitas a artículos publicados |

---

## Ver Lista de Artículos

**Información visible por artículo:**
| Campo | Descripción |
|-------|-------------|
| Título | Título del artículo |
| Fecha | Fecha de publicación o creación |
| Estado | Publicado / Borrador |
| Vistas | Número de visitas |
| Miniatura | Imagen destacada (si tiene) |

**Filtros:**
- Todos los artículos
- Solo publicados
- Solo borradores

---

## Crear Nuevo Artículo

**URL:** `/dashboard/blog/new`

### Campos del Formulario

| Campo | Requerido | Descripción |
|-------|-----------|-------------|
| Título | Sí | Título del artículo |
| Contenido | Sí | Cuerpo del artículo — editor de texto enriquecido |
| Extracto | No | Resumen corto para mostrar en la lista |
| Imagen destacada | No | Imagen miniatura del artículo |
| Estado | Sí | **Publicado** (visible) o **Borrador** (solo visible para el médico) |

### Editor de Contenido

El editor permite formato enriquecido:
- Negritas y cursivas
- Encabezados (H1, H2, H3)
- Listas numeradas y con viñetas
- Links / hipervínculos
- Citas

### Paso a Paso

1. Ir a **Mi Blog** en el menú lateral
2. Clic en **"Nuevo Artículo"**
3. Escribir el título
4. Redactar el contenido usando el editor
5. Agregar extracto e imagen si se desea
6. Seleccionar estado:
   - **Borrador:** Solo visible en tu dashboard
   - **Publicado:** Visible en tu perfil público para todos
7. Clic en **"Crear Artículo"**

---

## Editar Artículo

**URL:** `/dashboard/blog/[id]/edit`

1. En la lista, clic en el artículo
2. Clic en **"Editar"**
3. Modificar contenido, título, imagen o estado
4. Clic en **"Guardar Cambios"**

---

## Publicar y Despublicar

### Publicar un borrador
1. Editar el artículo
2. Cambiar estado a **"Publicado"**
3. Guardar — el artículo aparece inmediatamente en el perfil público

### Despublicar un artículo publicado
1. Editar el artículo
2. Cambiar estado a **"Borrador"**
3. Guardar — el artículo se oculta del perfil público (no se elimina)

---

## Visibilidad

| Estado | Quién puede verlo |
|--------|-------------------|
| Borrador | Solo el médico desde su dashboard |
| Publicado | Cualquier visitante del perfil público del médico |

---

## Restricciones del Sistema

| Acción | Estado |
|--------|--------|
| Programar publicación futura | ❌ No disponible |
| Categorías o etiquetas de artículos | ❌ Sin categorización |
| Sistema de comentarios | ❌ No disponible |
| Compartir en redes sociales directamente | ❌ Sin integración |
| Configuración SEO (metadatos, meta description) | ❌ Sin opciones SEO avanzadas |
| Múltiples autores | ❌ Solo el médico puede publicar |
| Exportar artículos | ❌ Sin exportación |

---

## Preguntas Frecuentes

**¿Dónde ven los pacientes mi blog?**
En tu perfil público del médico. El enlace al perfil público está en el menú lateral.

**¿Puedo guardar un artículo sin publicarlo?**
Sí, guárdalo como "Borrador". Solo tú podrás verlo hasta que lo publiques.

**¿Las vistas se cuentan en tiempo real?**
Las estadísticas de vistas se actualizan periódicamente — muestran las visitas totales acumuladas.

**¿Puedo agregar videos a los artículos?**
Depende del editor disponible. Puedes incrustar videos mediante enlaces en el contenido.

**¿Hay límite de artículos?**
No hay límite en la cantidad de artículos que puedes crear.

**¿Puedo ver cuántas personas leyeron cada artículo?**
Sí, cada artículo en la lista muestra su contador de vistas.
