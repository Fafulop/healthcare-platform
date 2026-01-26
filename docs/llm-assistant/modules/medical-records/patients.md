# Gestión de Pacientes

## Propósito

Permite crear y mantener los expedientes de pacientes con toda su información personal, de contacto y médica.

## Acceso

**Ruta:** Menú lateral > Expedientes Médicos > Expedientes de Pacientes

**URL:** `/dashboard/medical-records`

---

## Funcionalidades

### 1. Ver Lista de Pacientes

**Ubicación:** Página principal de expedientes médicos

**Información mostrada:**
- Nombre completo del paciente
- ID interno
- Edad
- Teléfono
- Estado (activo/inactivo)
- Etiquetas asignadas

**Acciones disponibles:**
- Buscar por nombre
- Filtrar por estado
- Click en paciente para ver detalle

---

### 2. Crear Nuevo Paciente

**Ruta:** Botón "Nuevo Paciente" o Acceso Rápido en Dashboard

**URL:** `/dashboard/medical-records/patients/new`

#### Campos del Formulario

##### Sección: Identificación
| Campo | Requerido | Descripción |
|-------|-----------|-------------|
| ID Interno | No | Se genera automáticamente si no se proporciona |
| Nombres | **Sí** | Nombres del paciente |
| Apellidos | **Sí** | Apellidos del paciente |
| Fecha de Nacimiento | **Sí** | Formato: DD/MM/AAAA |
| Sexo | **Sí** | Opciones: Masculino, Femenino, Otro |
| Tipo de Sangre | No | Ejemplo: A+, O-, AB+ |

##### Sección: Información de Contacto
| Campo | Requerido | Descripción |
|-------|-----------|-------------|
| Teléfono | No | Número de teléfono |
| Email | No | Correo electrónico |
| Dirección | No | Calle y número |
| Ciudad | No | Ciudad de residencia |
| Estado | No | Estado/Provincia |
| Código Postal | No | CP de la dirección |

##### Sección: Contacto de Emergencia
| Campo | Requerido | Descripción |
|-------|-----------|-------------|
| Nombre | No | Nombre del contacto de emergencia |
| Teléfono | No | Teléfono del contacto |
| Relación | No | Ej: Madre, Padre, Hermano, Esposo |

##### Sección: Información Médica
| Campo | Requerido | Descripción |
|-------|-----------|-------------|
| Alergias | No | Lista de alergias conocidas |
| Condiciones Crónicas | No | Ej: Diabetes, hipertensión |
| Medicamentos Actuales | No | Medicamentos que toma actualmente |
| Notas Generales | No | Cualquier nota adicional |
| Etiquetas | No | Separadas por comas. Ej: diabético, hipertenso |

#### Paso a Paso: Crear Paciente Manualmente

1. Ir a **Expedientes Médicos** en el menú lateral
2. Click en el botón **"Nuevo Paciente"**
3. Completar los campos obligatorios (marcados con *)
4. Opcionalmente completar información adicional
5. Click en **"Crear Paciente"**
6. El sistema redirige al perfil del nuevo paciente

#### Paso a Paso: Crear Paciente con Asistente de Voz

1. Ir a **Expedientes Médicos** en el menú lateral
2. Click en el botón **"Nuevo Paciente"**
3. Click en el botón **"Asistente de Voz"** (ícono de micrófono)
4. Dictar la información del paciente de forma natural
5. El sistema transcribe y extrae los datos automáticamente
6. Revisar los datos extraídos en el panel lateral
7. Hacer correcciones si es necesario mediante chat
8. Click en **"Confirmar"** para llenar el formulario
9. Verificar y completar campos faltantes
10. Click en **"Crear Paciente"**

---

### 3. Ver Perfil de Paciente

**URL:** `/dashboard/medical-records/patients/[id]`

**Información mostrada:**
- Datos personales completos
- Información de contacto
- Contacto de emergencia
- Información médica base
- Etiquetas asignadas

**Acciones disponibles desde el perfil:**
- Editar información del paciente
- Ver consultas del paciente
- Ver recetas del paciente
- Ver multimedia (fotos/documentos)
- Ver línea de tiempo
- Crear nueva consulta
- Crear nueva receta

---

### 4. Editar Paciente

**URL:** `/dashboard/medical-records/patients/[id]/edit`

**Campos editables:** Todos excepto el ID Interno (bloqueado después de creación)

#### Paso a Paso

1. Ir al perfil del paciente
2. Click en **"Editar"**
3. Modificar los campos necesarios
4. Click en **"Guardar Cambios"**

---

## Lo que el Usuario NO PUEDE Hacer

- **Eliminar pacientes** - No existe esta función
- **Cambiar el ID Interno** después de creado
- **Fusionar pacientes duplicados** - No hay función de merge
- **Importar pacientes desde Excel/CSV** - No disponible
- **Exportar lista de pacientes** - No disponible

---

## Preguntas Frecuentes

### ¿Cómo busco un paciente?
Usa la barra de búsqueda en la parte superior de la lista de pacientes. Puedes buscar por nombre o apellido.

### ¿Puedo filtrar pacientes?
Sí, puedes filtrar por estado (Todos, Activos, Inactivos).

### ¿Qué son las etiquetas?
Las etiquetas son palabras clave que ayudan a categorizar pacientes. Por ejemplo: "diabético", "embarazada", "post-operatorio". Se separan por comas al ingresarlas.

### ¿Puedo agregar fotos del paciente?
Sí, desde el perfil del paciente puedes ir a la sección de Multimedia y subir fotos o documentos.

### ¿El asistente de voz funciona para crear pacientes?
Sí, puedes dictar toda la información del paciente y el sistema la extraerá automáticamente.
