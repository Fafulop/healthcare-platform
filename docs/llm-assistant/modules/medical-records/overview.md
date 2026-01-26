# Expedientes Médicos - Visión General

## Propósito

El módulo de **Expedientes Médicos** permite al médico gestionar toda la información clínica de sus pacientes de manera organizada y segura.

## Acceso

**Ruta:** Menú lateral > Expedientes Médicos > Expedientes de Pacientes

**URL:** `/dashboard/medical-records`

---

## Funcionalidades Incluidas

### 1. Gestión de Pacientes
- Crear nuevos pacientes
- Editar información de pacientes existentes
- Buscar pacientes por nombre
- Filtrar pacientes por estado (activo/inactivo)
- Ver lista de todos los pacientes

### 2. Consultas (Encounters)
- Documentar cada visita médica
- Usar formato SOAP para notas clínicas
- Registrar signos vitales
- Ver historial de versiones de la consulta

### 3. Recetas Médicas
- Crear prescripciones con medicamentos
- Especificar dosis, frecuencia e instrucciones
- Ver historial de recetas del paciente

### 4. Multimedia
- Subir fotos clínicas
- Almacenar documentos del paciente
- Ver galería de archivos

### 5. Línea de Tiempo
- Ver cronología de todas las interacciones
- Filtrar por tipo de evento

---

## Lo que el Usuario PUEDE Hacer

| Acción | Disponible | Notas |
|--------|------------|-------|
| Crear paciente | Sí | Con o sin asistente de voz |
| Editar paciente | Sí | Solo información básica y médica |
| Eliminar paciente | No | No disponible en la interfaz |
| Crear consulta | Sí | Requiere paciente existente |
| Editar consulta | Sí | Se guarda historial de versiones |
| Eliminar consulta | No | No disponible en la interfaz |
| Crear receta | Sí | Requiere paciente existente |
| Subir archivos | Sí | Imágenes y documentos |

---

## Lo que el Usuario NO PUEDE Hacer

- **Eliminar pacientes** - No hay opción de borrado, solo desactivación
- **Eliminar consultas** - Las consultas son permanentes
- **Compartir expedientes** - No hay función de compartir con otros médicos
- **Exportar datos** - No hay exportación a PDF o Excel
- **Importar pacientes** - No hay importación masiva

---

## Asistente de Voz Disponible

Este módulo soporta el **asistente de voz** para:
- Crear nuevos pacientes por dictado
- Documentar consultas por voz
- Crear recetas por dictado

Ver [Asistente de Voz](../../features/voice-assistant.md) para más detalles.
