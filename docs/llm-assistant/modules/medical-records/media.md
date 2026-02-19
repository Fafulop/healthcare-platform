# Multimedia del Paciente

## Qué es

La sección Multimedia del perfil del paciente permite subir, almacenar y ver fotos clínicas y documentos relacionados con ese paciente específico. Los archivos se organizan por fecha de subida.

## Acceso

**Ruta:** Menú lateral > Expedientes Médicos > Pacientes > [Nombre del paciente] > Multimedia
**URL:** `/dashboard/medical-records/patients/[id]/media`

---

## Ver Galería

La galería muestra todos los archivos del paciente:

| Elemento | Descripción |
|----------|-------------|
| Miniaturas | Vista previa de imágenes |
| Íconos de documento | Para archivos PDF |
| Fecha de subida | Cuándo se subió el archivo |
| Nombre del archivo | Nombre original del archivo |

**Orden:** Del más reciente al más antiguo.

**Acciones por archivo:**
- Ver imagen en tamaño completo (clic en la miniatura)
- Descargar archivo
- Eliminar archivo (papelera) → confirmación requerida → **permanente, no reversible**

---

## Subir Archivos

**URL:** `/dashboard/medical-records/patients/[id]/media/upload`

### Tipos de Archivos Permitidos

| Tipo | Extensiones |
|------|-------------|
| Imágenes | JPG, JPEG, PNG, GIF |
| Documentos | PDF |

> El tamaño máximo por archivo depende de la configuración del servidor.

### Paso a Paso

1. Desde el perfil del paciente, clic en la pestaña **"Multimedia"**
2. Clic en **"Subir Archivo"**
3. Seleccionar archivo(s) desde la computadora
4. Esperar a que se complete la carga
5. El archivo aparece en la galería

---

## Ver Imagen en Tamaño Completo

- Clic en cualquier imagen en la galería
- Se abre en vista ampliada
- Permite descargar desde la vista ampliada
- Navegación entre imágenes si hay varias

---

## Eliminar Archivo

1. En la galería, localizar el archivo
2. Clic en el ícono de papelera
3. Confirmar la eliminación
4. El archivo se borra **permanentemente** — no se puede deshacer

---

## Casos de Uso Típicos

**Fotos clínicas:**
- Documentar heridas o lesiones
- Seguimiento de evolución de condiciones de piel
- Fotos antes/después de procedimientos
- Dermatología, cirugía, ortopedia

**Documentos:**
- Resultados de laboratorio externos
- Reportes de estudios de imagen
- Consentimientos informados firmados
- Referencias de otros médicos

---

## Restricciones del Sistema

| Acción | Estado |
|--------|--------|
| Editar archivos | ❌ No hay editor integrado |
| Organizar en carpetas | ❌ Solo orden por fecha |
| Agregar descripciones a archivos | ❌ Sin campo de descripción |
| Etiquetar archivos | ❌ Sin sistema de etiquetas |
| Vincular archivos a una consulta específica | ❌ No vinculado a consultas |
| Compartir archivos externamente | ❌ Sin función de compartir |
| Subir videos | ❌ Solo imágenes y PDF |
| Subir Word/Excel | ❌ Solo JPG, PNG, GIF, PDF |

---

## Preguntas Frecuentes

**¿Cuántos archivos puedo subir?**
No hay límite de cantidad, pero hay límite de tamaño por archivo según la configuración del servidor.

**¿Puedo subir múltiples archivos a la vez?**
Sí, puedes seleccionar varios archivos al mismo tiempo al subir.

**¿Qué pasa si elimino un archivo por error?**
La eliminación es permanente e irreversible. No hay papelera de reciclaje. Confirma bien antes de eliminar.

**¿Los archivos están seguros?**
Sí, los archivos están asociados al expediente del paciente y solo son accesibles para el médico autenticado.

**¿Puedo ver las imágenes del paciente desde el teléfono?**
Sí, la galería funciona en dispositivos móviles.

**¿Los archivos multimedia están vinculados a las consultas?**
No. Los archivos se almacenan a nivel del paciente, no de la consulta. Para asociar un estudio a una consulta, el médico debe hacerlo manualmente en las notas de la consulta.
