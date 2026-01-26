# Mi Blog

## Propósito

Permite al médico crear y publicar artículos en su blog personal, visible en su perfil público para pacientes y visitantes.

## Acceso

**Ruta:** Menú lateral > Perfil y Público > Mi Blog

**URL:** `/dashboard/blog`

---

## Funcionalidades

### 1. Ver Lista de Artículos

**URL:** `/dashboard/blog`

**Panel de Estadísticas:**
- Total de artículos
- Artículos publicados
- Borradores
- Total de vistas

**Información por artículo:**
- Título
- Fecha de publicación/creación
- Estado (Publicado/Borrador)
- Número de vistas
- Imagen miniatura (si tiene)

**Filtros disponibles:**
- Todos los artículos
- Solo publicados
- Solo borradores

---

### 2. Crear Nuevo Artículo

**URL:** `/dashboard/blog/new`

#### Campos del Formulario

| Campo | Requerido | Descripción |
|-------|-----------|-------------|
| Título | **Sí** | Título del artículo |
| Contenido | **Sí** | Cuerpo del artículo (editor de texto) |
| Extracto | No | Resumen corto para la lista |
| Imagen | No | Imagen destacada/miniatura |
| Estado | **Sí** | Publicado o Borrador |

#### Paso a Paso

1. Ir a **Mi Blog** en el menú lateral
2. Click en **"Nuevo Artículo"**
3. Escribir el título
4. Redactar el contenido usando el editor
5. Opcionalmente agregar extracto e imagen
6. Seleccionar estado:
   - **Borrador:** Solo visible para ti
   - **Publicado:** Visible en tu perfil público
7. Click en **"Crear Artículo"**

---

### 3. Editar Artículo

**URL:** `/dashboard/blog/[id]/edit`

#### Paso a Paso

1. En la lista de artículos, click en el artículo
2. Click en **"Editar"**
3. Modificar contenido, título o estado
4. Click en **"Guardar Cambios"**

---

### 4. Publicar/Despublicar Artículo

Puedes cambiar el estado de un artículo entre Borrador y Publicado.

#### Para Publicar

1. Editar el artículo
2. Cambiar estado a **"Publicado"**
3. Guardar cambios
4. El artículo aparece en tu perfil público

#### Para Despublicar

1. Editar el artículo
2. Cambiar estado a **"Borrador"**
3. Guardar cambios
4. El artículo se oculta del perfil público (pero no se elimina)

---

### 5. Eliminar Artículo

**Nota:** Verifica si esta función está disponible en la interfaz.

---

## Editor de Contenido

El editor permite dar formato al contenido:
- **Negritas** y *cursivas*
- Encabezados (H1, H2, H3)
- Listas numeradas y con viñetas
- Links
- Citas

---

## Visibilidad del Blog

| Estado | Dónde se ve |
|--------|-------------|
| Borrador | Solo en tu dashboard |
| Publicado | Perfil público + dashboard |

Los artículos publicados aparecen en tu **Perfil Público**, donde los pacientes pueden verlos.

---

## Lo que el Usuario PUEDE Hacer

- Crear artículos ilimitados
- Editar artículos existentes
- Publicar y despublicar artículos
- Ver estadísticas de vistas
- Agregar imágenes destacadas

## Lo que el Usuario NO PUEDE Hacer

- **Programar publicaciones** - No hay función de programación
- **Categorizar artículos** - No hay categorías o tags
- **Comentarios** - No hay sistema de comentarios
- **Compartir en redes** - No hay integración con redes sociales
- **SEO avanzado** - No hay configuración de metadatos
- **Múltiples autores** - Solo el médico puede publicar

---

## Preguntas Frecuentes

### ¿Dónde ven los pacientes mi blog?
En tu perfil público. El link se encuentra en el menú lateral como "Perfil Público".

### ¿Puedo guardar un artículo sin publicarlo?
Sí, guárdalo como "Borrador". Solo tú podrás verlo hasta que lo publiques.

### ¿Las vistas se cuentan en tiempo real?
Las estadísticas se actualizan periódicamente y muestran las vistas totales de tus artículos publicados.

### ¿Puedo agregar videos a mis artículos?
Depende del editor disponible. Generalmente puedes incrustar videos usando enlaces.

### ¿Hay límite de artículos?
No hay límite en la cantidad de artículos que puedes crear.
