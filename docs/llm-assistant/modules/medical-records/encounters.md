# Consultas Médicas (Encounters)

## Propósito

Permite documentar cada visita o consulta médica del paciente, incluyendo notas clínicas, signos vitales y diagnósticos.

## Acceso

**Ruta:** Perfil del Paciente > Consultas > Nueva Consulta

**URL:** `/dashboard/medical-records/patients/[id]/encounters/new`

---

## Funcionalidades

### 1. Ver Lista de Consultas

**Ubicación:** Perfil del paciente > Sección de Consultas

**Información mostrada por consulta:**
- Fecha de la consulta
- Tipo de consulta
- Motivo de consulta (resumen)
- Diagnóstico principal

**Acciones disponibles:**
- Click para ver detalle completo
- Editar consulta
- Ver versiones anteriores

---

### 2. Crear Nueva Consulta

**URL:** `/dashboard/medical-records/patients/[id]/encounters/new`

#### Campos del Formulario

##### Información General
| Campo | Requerido | Descripción |
|-------|-----------|-------------|
| Fecha | **Sí** | Fecha de la consulta |
| Tipo de Consulta | **Sí** | Consulta, Seguimiento, Emergencia, Telemedicina |
| Motivo de Consulta | **Sí** | Razón principal de la visita |

##### Signos Vitales
| Campo | Requerido | Descripción |
|-------|-----------|-------------|
| Presión Arterial | No | Formato: 120/80 mmHg |
| Frecuencia Cardíaca | No | Latidos por minuto |
| Temperatura | No | En grados Celsius |
| Peso | No | En kilogramos |
| Altura | No | En centímetros |
| Saturación de Oxígeno | No | Porcentaje (SpO2) |

##### Notas Clínicas (Formato SOAP)
| Campo | Requerido | Descripción |
|-------|-----------|-------------|
| **S** - Subjetivo | No | Lo que el paciente reporta (síntomas, historia) |
| **O** - Objetivo | No | Hallazgos del examen físico |
| **A** - Evaluación | No | Diagnóstico o impresión clínica |
| **P** - Plan | No | Plan de tratamiento, estudios, seguimiento |

##### Diagnósticos
| Campo | Requerido | Descripción |
|-------|-----------|-------------|
| Diagnóstico Principal | No | Diagnóstico CIE-10 principal |
| Diagnósticos Secundarios | No | Otros diagnósticos relevantes |

#### Paso a Paso: Crear Consulta Manualmente

1. Ir al perfil del paciente
2. Click en **"Nueva Consulta"**
3. Seleccionar la fecha y tipo de consulta
4. Ingresar el motivo de consulta
5. Registrar signos vitales (opcional)
6. Documentar usando formato SOAP
7. Agregar diagnósticos si aplica
8. Click en **"Guardar Consulta"**

#### Paso a Paso: Crear Consulta con Asistente de Voz

1. Ir al perfil del paciente
2. Click en **"Nueva Consulta"**
3. Click en el botón **"Asistente de Voz"**
4. Dictar las notas de la consulta de forma natural
5. El sistema estructura la información en formato SOAP
6. Revisar y ajustar en el panel lateral
7. Click en **"Confirmar"** para llenar el formulario
8. Completar campos adicionales si es necesario
9. Click en **"Guardar Consulta"**

---

### 3. Ver Detalle de Consulta

**URL:** `/dashboard/medical-records/patients/[id]/encounters/[encounterId]`

**Información mostrada:**
- Todos los datos de la consulta
- Signos vitales registrados
- Notas SOAP completas
- Diagnósticos

**Acciones disponibles:**
- Editar consulta
- Ver historial de versiones

---

### 4. Editar Consulta

**URL:** `/dashboard/medical-records/patients/[id]/encounters/[encounterId]/edit`

**Importante:** Cada vez que se edita una consulta, se crea una nueva versión. El historial de versiones se conserva.

#### Paso a Paso

1. Ir al detalle de la consulta
2. Click en **"Editar"**
3. Realizar las modificaciones necesarias
4. Click en **"Guardar Cambios"**
5. Se crea automáticamente una nueva versión

---

### 5. Ver Historial de Versiones

**URL:** `/dashboard/medical-records/patients/[id]/encounters/[encounterId]/versions`

**Información mostrada:**
- Lista de todas las versiones
- Fecha de cada versión
- Quién hizo el cambio
- Comparación de cambios

---

## Tipos de Consulta

| Tipo | Descripción |
|------|-------------|
| Consulta | Visita regular al consultorio |
| Seguimiento | Control posterior a tratamiento |
| Emergencia | Atención de urgencia |
| Telemedicina | Consulta remota por video |

---

## Formato SOAP Explicado

El formato **SOAP** es un método estándar para documentar notas clínicas:

- **S (Subjetivo):** Lo que el paciente dice. Síntomas, quejas, historia de la enfermedad actual.
  - Ejemplo: "El paciente refiere dolor de cabeza desde hace 3 días, localizado en la frente, intensidad 7/10."

- **O (Objetivo):** Lo que el médico observa. Signos vitales, examen físico.
  - Ejemplo: "PA: 130/85 mmHg. FC: 78 lpm. Temperatura: 36.5°C. Paciente alerta, orientado."

- **A (Evaluación/Assessment):** Diagnóstico o impresión diagnóstica.
  - Ejemplo: "Cefalea tensional. Hipertensión arterial estadio 1."

- **P (Plan):** Tratamiento, estudios, indicaciones, seguimiento.
  - Ejemplo: "1. Paracetamol 500mg c/8h PRN. 2. Reducir estrés. 3. Cita de control en 2 semanas."

---

## Lo que el Usuario NO PUEDE Hacer

- **Eliminar consultas** - Las consultas son permanentes por razones médico-legales
- **Eliminar versiones** - El historial de versiones se conserva
- **Antedatar consultas** - La fecha debe ser actual o pasada reciente
- **Crear consultas sin paciente** - Debe existir un expediente de paciente primero

---

## Preguntas Frecuentes

### ¿Puedo editar una consulta después de guardarla?
Sí, puedes editar en cualquier momento. Cada edición crea una nueva versión para mantener el historial.

### ¿Es obligatorio usar el formato SOAP?
No es obligatorio, pero es recomendado para mantener notas organizadas y profesionales.

### ¿Puedo adjuntar archivos a una consulta?
No directamente a la consulta, pero puedes subir archivos en la sección de Multimedia del paciente.

### ¿El asistente de voz entiende terminología médica?
Sí, el asistente está entrenado para reconocer terminología médica común en español.
