# Consultas Médicas (Encounters)

## Qué es

Una consulta es el registro clínico de una visita o atención médica del paciente. Documenta síntomas, examen físico, diagnóstico y plan de tratamiento usando el formato SOAP estándar. Las consultas son **permanentes** — no se pueden eliminar por razones médico-legales.

## Acceso

**Ruta:** Menú lateral > Expedientes Médicos > Pacientes > [Nombre del paciente]
**URL:** `/dashboard/medical-records/patients/[id]`

Las consultas están en la sección **"Consultas"** dentro del perfil del paciente.

---

## Ver Lista de Consultas

En el perfil del paciente, la sección "Consultas" muestra:
- Fecha de la consulta
- Tipo de consulta
- Motivo de consulta (resumen)
- Diagnóstico principal

**Acciones por consulta:**
- Ver detalle completo → URL: `/dashboard/medical-records/patients/[id]/encounters/[encounterId]`
- Editar consulta
- Ver versiones anteriores

---

## Crear Nueva Consulta

**Botón:** "Nueva Consulta" dentro del perfil del paciente
**URL:** `/dashboard/medical-records/patients/[id]/encounters/new`

### Campos del Formulario

#### Información General

| Campo | Tipo | Requerido | Opciones / Notas |
|-------|------|-----------|-------------------|
| Fecha | date | Sí | Fecha de la consulta (puede ser pasada) |
| Tipo de Consulta | select | Sí | Consulta \| Seguimiento \| Emergencia \| Telemedicina |
| Motivo de Consulta | textarea | Sí | Razón principal de la visita |

#### Signos Vitales (todos opcionales)

| Campo | Unidad | Formato / Ejemplo |
|-------|--------|-------------------|
| Presión Arterial | mmHg | `120/80` |
| Frecuencia Cardíaca | lpm | `78` |
| Temperatura | °C | `36.5` |
| Peso | kg | `70.5` |
| Altura | cm | `175` |
| Saturación de Oxígeno (SpO2) | % | `98` |

#### Notas Clínicas — Formato SOAP

Todos los campos SOAP son opcionales pero recomendados.

| Sección | Significado | Qué captura |
|---------|-------------|-------------|
| **S — Subjetivo** | Lo que el paciente reporta | Síntomas, quejas, historia de la enfermedad actual |
| **O — Objetivo** | Lo que el médico observa | Hallazgos del examen físico, signos vitales, resultados |
| **A — Evaluación** | Impresión diagnóstica | Diagnóstico o diagnóstico diferencial |
| **P — Plan** | Tratamiento y seguimiento | Medicamentos, estudios, indicaciones, próxima cita |

**Ejemplo S:** *"Paciente refiere dolor de cabeza desde hace 3 días, localizado en la frente, intensidad 7/10, acompañado de náuseas."*

**Ejemplo O:** *"PA: 130/85 mmHg. FC: 78 lpm. Temperatura: 36.5°C. Paciente alerta, orientado en tiempo y espacio."*

**Ejemplo A:** *"Cefalea tensional. Hipertensión arterial estadio 1."*

**Ejemplo P:** *"1. Paracetamol 500mg c/8h PRN. 2. Reducir estrés y mejorar hábitos de sueño. 3. Cita de control en 2 semanas."*

#### Campos adicionales (visibilidad según plantilla)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| Ubicación | text | Ej: "Consultorio", "En línea" |
| Notas Clínicas | textarea | Notas libres en lugar de SOAP (modo simple) |
| Fecha de Seguimiento | date | Próxima cita de control |
| Instrucciones de Seguimiento | textarea | Qué debe hacer el paciente hasta el seguimiento |

**Toggle SOAP / Notas Simples:** El formulario permite cambiar entre modo SOAP (S/O/A/P) y modo de notas simples (un solo campo de "Notas Clínicas"). Ambas opciones capturan la misma consulta, solo cambia la estructura.

**Chat IA:** Botón "Chat IA" (ícono de estrella) abre un panel de chat lateral donde el médico puede describir la consulta y la IA llena los campos del formulario. Complementa al asistente de voz.

---

## Crear Consulta — Paso a Paso

### Manual

1. Ir al perfil del paciente
2. Clic en **"Nueva Consulta"**
3. Seleccionar fecha y tipo de consulta
4. Ingresar el motivo de consulta
5. Registrar signos vitales (opcional)
6. Documentar notas en formato SOAP
7. Agregar diagnósticos si aplica
8. Clic en **"Guardar Consulta"**

### Con Asistente de Voz

1. Ir al perfil del paciente
2. Clic en **"Nueva Consulta"**
3. Clic en el botón **"Asistente de Voz"** dentro del formulario
4. Dictar las notas de la consulta en lenguaje natural
5. El sistema transcribe y estructura automáticamente en formato SOAP
6. Se abre el panel lateral con los datos extraídos
7. Revisar y ajustar si es necesario
8. Clic en **"Confirmar"** → el formulario se pre-llena con los datos de voz
9. Completar campos adicionales si es necesario
10. Clic en **"Guardar Consulta"**

---

## Ver Detalle de Consulta

**URL:** `/dashboard/medical-records/patients/[id]/encounters/[encounterId]`

Muestra:
- Todos los datos de la consulta
- Signos vitales registrados
- Notas SOAP completas
- Diagnósticos

**Acciones disponibles desde el detalle:**
- **Editar** — abre el formulario de edición
- **Ver historial de versiones** — muestra todas las versiones guardadas

---

## Editar Consulta

**URL:** `/dashboard/medical-records/patients/[id]/encounters/[encounterId]/edit`

- Se puede editar en cualquier momento después de creada
- **Cada edición crea una nueva versión automáticamente** — el historial no se pierde
- Los mismos campos del formulario de creación están disponibles

**Paso a paso:**
1. Desde el detalle de la consulta, clic en **"Editar"**
2. Realizar las modificaciones
3. Clic en **"Guardar Cambios"**
4. Se crea una nueva versión — la consulta anterior queda en el historial

---

## Historial de Versiones

**URL:** `/dashboard/medical-records/patients/[id]/encounters/[encounterId]/versions`

Muestra:
- Lista de todas las versiones guardadas
- Fecha y hora de cada versión
- Quién realizó el cambio
- Diferencias entre versiones (comparación de cambios)

**Restricción:** No se pueden eliminar versiones. El historial es permanente.

---

## Tipos de Consulta

| Tipo | Cuándo usar |
|------|-------------|
| Consulta | Visita regular al consultorio |
| Seguimiento | Control posterior a tratamiento o procedimiento |
| Emergencia | Atención de urgencia o emergencia |
| Telemedicina | Consulta remota (video llamada o similar) |

---

## Restricciones del Sistema

| Acción | Estado | Motivo |
|--------|--------|--------|
| Eliminar consulta | ❌ No permitido | Las consultas son permanentes por razones médico-legales |
| Eliminar versiones | ❌ No permitido | El historial de versiones se conserva siempre |
| Crear consulta sin paciente | ❌ No permitido | Debe existir un expediente de paciente primero |
| Editar consulta | ✅ Siempre permitido | Con historial de versiones automático |
| Ver consultas de otros médicos | ❌ No permitido | Cada médico solo ve sus propios pacientes |

---

## Relación con Otros Módulos

**Citas (Appointments):** Las consultas **no se crean automáticamente** cuando el paciente asiste a una cita. El flujo manual es:
1. Marcar la cita como "Completada" en el módulo de Citas
2. Ir a Expedientes Médicos y crear la consulta manualmente

**Prescripciones:** Se crean por separado en el módulo de Prescripciones — no están vinculadas directamente al formulario de consulta.

**Multimedia:** Los archivos adjuntos (estudios, imágenes) se suben en la sección "Multimedia" del perfil del paciente, no dentro de la consulta.

---

## Preguntas Frecuentes

**¿Puedo editar una consulta después de guardarla?**
Sí, en cualquier momento. Cada edición crea una versión nueva para mantener el historial completo.

**¿Es obligatorio el formato SOAP?**
No es obligatorio, pero es el formato recomendado para notas organizadas y profesionales.

**¿Puedo adjuntar archivos a una consulta?**
No directamente a la consulta. Los archivos se suben en la sección "Multimedia" del perfil del paciente.

**¿El asistente de voz entiende terminología médica?**
Sí, el asistente procesa terminología médica en español y estructura las notas en formato SOAP automáticamente.

**¿Puedo ver las consultas de pacientes de otro médico?**
No. Solo tienes acceso a los expedientes y consultas de tus propios pacientes.

**¿Qué diferencia hay entre Motivo de Consulta y Subjetivo (S)?**
El motivo de consulta es un resumen breve de la razón de la visita. El Subjetivo (S) es la descripción detallada de lo que el paciente reporta, incluyendo historia de la enfermedad actual.
