# Gestión de Pacientes

## Qué es

Los pacientes son el eje central del módulo de Expedientes Médicos. Cada paciente tiene un expediente con datos personales, médicos, contacto de emergencia y sus registros clínicos (consultas, recetas, multimedia). Los pacientes **no se pueden eliminar**.

## Acceso

**Ruta:** Menú lateral > Expedientes Médicos > Expedientes de Pacientes
**URL:** `/dashboard/medical-records`

---

## Ver Lista de Pacientes

**URL:** `/dashboard/medical-records`

Muestra la lista de todos los pacientes del médico.

**Información visible por paciente:**
| Campo | Descripción |
|-------|-------------|
| Nombre completo | Nombres + Apellidos |
| ID Interno | Identificador único del expediente |
| Edad | Calculada desde fecha de nacimiento |
| Teléfono | Número de contacto principal |
| Estado | Activo o Inactivo |
| Etiquetas | Palabras clave del paciente (ej: diabético, hipertenso) |

**Búsqueda y filtros:**
- Buscar por nombre o apellido (barra de búsqueda)
- Filtrar por estado: Todos / Activos / Inactivos

---

## Crear Nuevo Paciente

**Botón:** "Nuevo Paciente" en la página principal de Expedientes Médicos
**URL:** `/dashboard/medical-records/patients/new`

### Campos del Formulario

#### Sección: Identificación

| Campo | Requerido | Notas |
|-------|-----------|-------|
| ID Interno | No | Se genera automáticamente si no se proporciona. **No editable** después de creación |
| Nombres | Sí | Nombres del paciente |
| Apellidos | Sí | Apellidos del paciente |
| Fecha de Nacimiento | Sí | Formato: DD/MM/AAAA |
| Sexo | Sí | Masculino \| Femenino \| Otro |
| Tipo de Sangre | No | A+, A-, B+, B-, AB+, AB-, O+, O- |

#### Sección: Información de Contacto

| Campo | Requerido | Descripción |
|-------|-----------|-------------|
| Teléfono | No | Número de teléfono principal |
| Email | No | Correo electrónico |
| Dirección | No | Calle y número |
| Ciudad | No | Ciudad de residencia |
| Estado/Provincia | No | Estado o provincia |
| Código Postal | No | Código postal de la dirección |

#### Sección: Contacto de Emergencia

| Campo | Requerido | Descripción |
|-------|-----------|-------------|
| Nombre | No | Nombre completo del contacto |
| Teléfono | No | Teléfono del contacto de emergencia |
| Relación | No | Madre, Padre, Hermano, Esposo, Amigo, etc. |

#### Sección: Información Médica

| Campo | Requerido | Descripción |
|-------|-----------|-------------|
| Alergias | No | Lista de alergias conocidas (texto libre) |
| Condiciones Crónicas | No | Enfermedades crónicas: Diabetes, Hipertensión, etc. |
| Medicamentos Actuales | No | Medicamentos que toma actualmente |
| Notas Generales | No | Cualquier nota adicional relevante |
| Etiquetas | No | Palabras clave separadas por comas. Ej: `diabético, hipertenso, embarazada` |

---

## Crear Paciente — Paso a Paso

### Manual

1. Ir a **Expedientes Médicos** en el menú lateral
2. Clic en **"Nuevo Paciente"**
3. Completar campos obligatorios: Nombres, Apellidos, Fecha de Nacimiento, Sexo
4. Completar información adicional según necesidad
5. Clic en **"Crear Paciente"**
6. El sistema redirige al perfil del nuevo paciente

### Con Asistente de Voz

1. Ir a **Expedientes Médicos**
2. Clic en **"Nuevo Paciente"**
3. Clic en el botón **"Asistente de Voz"** (ícono de micrófono)
4. Dictar la información del paciente en lenguaje natural:
   > *"Paciente María García López, 35 años, sexo femenino, tipo de sangre O positivo, teléfono 555-1234, alérgica a la penicilina, diabética tipo 2"*
5. El sistema extrae los datos automáticamente
6. Revisar en el panel lateral — corregir mediante chat si es necesario
7. Clic en **"Confirmar"** → se pre-llena el formulario
8. Verificar y completar campos faltantes
9. Clic en **"Crear Paciente"**

---

## Ver Perfil del Paciente

**URL:** `/dashboard/medical-records/patients/[id]`

El perfil del paciente tiene **pestañas de navegación**:

| Pestaña | Contenido |
|---------|-----------|
| Información | Datos personales, contacto, emergencia, médicos |
| Consultas | Lista de consultas + botón "Nueva Consulta" |
| Recetas | Lista de recetas + botón "Nueva Receta" |
| Multimedia | Galería de fotos y documentos |
| Línea de Tiempo | Vista cronológica de toda la actividad |

**Acciones rápidas desde el perfil:**
- Editar información del paciente
- Crear nueva consulta
- Crear nueva receta
- Subir archivos multimedia

---

## Editar Paciente

**URL:** `/dashboard/medical-records/patients/[id]/edit`

- Todos los campos son editables **excepto el ID Interno** (bloqueado permanentemente después de la creación)
- No hay historial de versiones en los datos del paciente

**Paso a paso:**
1. Desde el perfil del paciente, clic en **"Editar"**
2. Modificar los campos necesarios
3. Clic en **"Guardar Cambios"**

---

## Acceso Rápido desde Dashboard

El dashboard principal muestra un acceso rápido a "Nuevo Paciente" en la sección de acciones rápidas.

---

## Restricciones del Sistema

| Acción | Estado | Motivo |
|--------|--------|--------|
| Eliminar paciente | ❌ No disponible | Expedientes son permanentes |
| Cambiar ID Interno después de creación | ❌ Bloqueado | El ID es inmutable |
| Fusionar pacientes duplicados | ❌ No disponible | Sin función de merge |
| Importar desde Excel/CSV | ❌ No disponible | Creación manual o por voz |
| Exportar lista de pacientes | ❌ No disponible | Sin función de exportación |
| Ver pacientes de otro médico | ❌ No permitido | Cada médico ve solo sus pacientes |

---

## Etiquetas

Las etiquetas son palabras clave para categorizar pacientes:
- Se ingresan separadas por comas: `diabético, hipertenso, embarazada`
- Aparecen como badges en la lista de pacientes
- Útiles para búsqueda visual rápida
- No hay sistema de filtrado por etiquetas (solo búsqueda por nombre)

---

## Preguntas Frecuentes

**¿Cómo busco un paciente?**
Usa la barra de búsqueda en la lista de pacientes. Puedes buscar por nombre o apellido.

**¿Puedo filtrar pacientes por etiqueta?**
No hay filtro por etiqueta. Solo puedes filtrar por estado (Activo/Inactivo) o buscar por nombre.

**¿Qué pasa si creo un paciente duplicado?**
No hay detección automática de duplicados. Debes identificarlo manualmente y optar por uno de los dos expedientes.

**¿Puedo agregar fotos del paciente?**
No una foto de perfil, pero puedes subir imágenes clínicas en la sección "Multimedia" del perfil del paciente.

**¿El asistente de voz funciona para crear pacientes?**
Sí, puedes dictar toda la información y el sistema la extraerá y pre-llenará el formulario.

**¿Qué es la Línea de Tiempo?**
Es una vista cronológica que muestra todas las consultas y recetas del paciente en orden de fecha, útil para ver la historia clínica completa de un vistazo.
