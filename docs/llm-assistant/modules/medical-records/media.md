# Multimedia del Paciente

## Propósito

Permite subir, almacenar y organizar fotos clínicas y documentos relacionados con el paciente.

## Acceso

**Ruta:** Perfil del Paciente > Multimedia

**URL:** `/dashboard/medical-records/patients/[id]/media`

---

## Funcionalidades

### 1. Ver Galería de Archivos

**URL:** `/dashboard/medical-records/patients/[id]/media`

**Vista de galería:**
- Miniaturas de imágenes
- Íconos para documentos
- Fecha de subida
- Nombre del archivo

**Acciones disponibles:**
- Ver imagen en tamaño completo
- Descargar archivo
- Eliminar archivo

---

### 2. Subir Archivos

**URL:** `/dashboard/medical-records/patients/[id]/media/upload`

#### Tipos de Archivos Permitidos

| Tipo | Extensiones | Tamaño Máximo |
|------|-------------|---------------|
| Imágenes | JPG, JPEG, PNG, GIF | Según configuración del servidor |
| Documentos | PDF | Según configuración del servidor |

#### Paso a Paso: Subir Archivos

1. Ir al perfil del paciente
2. Click en **"Multimedia"** en la navegación
3. Click en **"Subir Archivo"**
4. Seleccionar archivo(s) desde tu computadora
5. Esperar a que se complete la carga
6. El archivo aparece en la galería

---

### 3. Ver Imagen

**Funcionalidad:** Click en cualquier imagen para verla en tamaño completo

**Características:**
- Vista ampliada
- Opción de descargar
- Navegación entre imágenes (si hay varias)

---

### 4. Eliminar Archivo

**Precaución:** Esta acción es permanente

#### Paso a Paso

1. En la galería, localizar el archivo
2. Click en el botón de eliminar (ícono de papelera)
3. Confirmar la eliminación
4. El archivo se borra permanentemente

---

## Casos de Uso Comunes

### Fotos Clínicas
- Documentar heridas o lesiones
- Seguimiento de evolución de condiciones de piel
- Antes/después de procedimientos

### Documentos
- Resultados de laboratorio externos
- Estudios de imagen (reportes)
- Consentimientos informados firmados
- Referencia de otros médicos

---

## Lo que el Usuario PUEDE Hacer

- Subir múltiples archivos a la vez
- Ver archivos en galería
- Descargar archivos
- Eliminar archivos

## Lo que el Usuario NO PUEDE Hacer

- **Editar archivos** - No hay editor integrado
- **Organizar en carpetas** - Los archivos se ordenan por fecha
- **Agregar descripciones** - No hay campo de descripción por archivo
- **Etiquetar archivos** - No hay sistema de etiquetas para multimedia
- **Vincular a consultas** - Los archivos no se asocian a consultas específicas
- **Compartir archivos** - No hay función de compartir

---

## Preguntas Frecuentes

### ¿Cuántos archivos puedo subir?
No hay límite de cantidad, pero hay límites de tamaño por archivo según la configuración del servidor.

### ¿Los archivos están seguros?
Sí, los archivos se almacenan de forma segura y solo son accesibles por el médico autenticado.

### ¿Puedo subir videos?
En esta versión, solo se soportan imágenes y documentos PDF.

### ¿Puedo organizar los archivos por fecha o tipo?
Los archivos se muestran ordenados por fecha de subida, del más reciente al más antiguo.

### ¿Qué pasa si elimino un archivo por error?
La eliminación es permanente y no se puede deshacer. Asegúrate antes de confirmar.
