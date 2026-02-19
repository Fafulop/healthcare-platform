# Recetas Médicas (Prescriptions)

## Qué es

Una receta médica registra los medicamentos que el médico prescribe a un paciente. Tiene un flujo de estados: comienza como borrador (editable), puede emitirse (finalizada), y puede cancelarse con motivo. Solo los **borradores** pueden eliminarse.

## Acceso

**Ruta:** Menú lateral > Expedientes Médicos > Pacientes > [Nombre] > Prescripciones
**URL:** `/dashboard/medical-records/patients/[id]/prescriptions`

---

## Ver Lista de Recetas

Filtros disponibles: **Todos / Borradores / Emitidas / Canceladas**

Cada receta en la lista muestra:
- Diagnóstico (o "Prescripción Médica" si no tiene)
- Fecha de prescripción
- Número de medicamentos
- Estado (badge de color)

---

## Estados de una Receta

| Estado | Badge | Qué puede hacer el médico |
|--------|-------|--------------------------|
| **draft** (Borrador) | Amarillo | Editar, Emitir, Eliminar |
| **issued** (Emitida) | Verde | Descargar PDF, Cancelar |
| **cancelled** (Cancelada) | Rojo | Solo lectura, ver motivo de cancelación |
| **expired** (Expirada) | Gris | Solo lectura |

---

## Crear Nueva Receta

**Botón:** "Nueva Prescripción"
**URL:** `/dashboard/medical-records/patients/[id]/prescriptions/new`

### Sección: Información General

| Campo | Requerido | Descripción |
|-------|-----------|-------------|
| Fecha de Prescripción | Sí | Fecha de emisión |
| Fecha de Expiración | No | Hasta cuándo es válida |
| Diagnóstico | No | Ej: "Infección respiratoria aguda" |
| Notas Clínicas | No | Instrucciones generales |
| Vincular a Consulta | No | Seleccionar consulta relacionada del paciente |

### Sección: Información del Doctor

| Campo | Requerido | Descripción |
|-------|-----------|-------------|
| Nombre Completo | Sí | Nombre del médico que aparecerá en la receta |
| Cédula Profesional | Sí | Número de cédula del médico |

### Sección: Medicamentos

Cada medicamento tiene:

| Campo | Requerido | Ejemplo |
|-------|-----------|---------|
| Nombre del Medicamento | **Sí** | "Paracetamol" |
| Presentación | No | "Tableta", "Jarabe", "Inyección" |
| Dosis | **Sí** | "500mg", "10ml" |
| Frecuencia | **Sí** | "Cada 8 horas", "2 veces al día" |
| Duración | No | "7 días", "1 mes" |
| Cantidad | No | "21 tabletas", "1 frasco" |
| Instrucciones | **Sí** | "Tomar con alimentos" |
| Advertencias | No | "No conducir", "No consumir alcohol" — se muestra en rojo |

**Botón "Agregar Medicamento":** agrega un nuevo medicamento vacío.
**Botón × por medicamento:** elimina ese medicamento de la lista.

### Validaciones

- Al menos un medicamento válido es requerido (con nombre, dosis, frecuencia e instrucciones)
- Error: *"Debe agregar al menos un medicamento válido"*
- Nombre del médico y cédula son requeridos
- Error: *"Debe completar la información del doctor"*

### Botones de Guardado

| Botón | Acción |
|-------|--------|
| **"Guardar como Borrador"** | Crea la receta en estado `draft` |
| **"Guardar y Emitir"** | Crea la receta y la emite inmediatamente |

---

## Crear Receta — Con Asistente de Voz

1. Ir al perfil del paciente > Prescripciones
2. Clic en **"Nueva Prescripción"**
3. Clic en **"Asistente de Voz"** (micrófono)
4. Dictar los medicamentos de forma natural:
   > *"Paracetamol 500 miligramos cada 8 horas por 5 días, Omeprazol 20 miligramos una vez al día en ayunas"*
5. El sistema extrae cada medicamento con sus campos
6. Revisar en el panel lateral — corregir si es necesario
7. Clic en **"Confirmar"** → pre-llena el formulario
8. Clic en **"Guardar como Borrador"** o **"Guardar y Emitir"**

**Ejemplos de dictado:**
- Múltiple: *"Metformina 850 una vez al día con desayuno, Losartán 50 miligramos una vez al día"*
- Con instrucciones: *"Ibuprofeno 400 miligramos cada 6 horas, tomar con alimentos, por 5 días"*

---

## Ver Detalle de Receta

**URL:** `/dashboard/medical-records/patients/[id]/prescriptions/[prescriptionId]`

Muestra: información general, datos del médico, datos del paciente, lista de medicamentos.

**Acciones disponibles según estado:**
- **Draft:** Editar | Emitir Prescripción | Eliminar
- **Issued:** Descargar PDF | Cancelar Prescripción
- **Cancelled:** muestra el motivo de cancelación (solo lectura)

---

## Emitir Prescripción (Draft → Issued)

Solo desde el detalle de una receta en borrador:

1. Clic en **"Emitir Prescripción"**
2. Confirmación: *"¿Está seguro de emitir esta prescripción? No podrá editarla después."*
3. Al confirmar → estado cambia a `issued`

**Emitir es irreversible desde "editar"** — solo se puede cancelar la prescripción emitida.

---

## Descargar PDF (Solo Issued)

Desde el detalle de una receta emitida:
- Botón "Descargar PDF" → abre el PDF en una nueva ventana

---

## Cancelar Prescripción (Solo Issued)

1. Clic en **"Cancelar Prescripción"**
2. Se abre un modal pidiendo el **Motivo de Cancelación** (campo obligatorio)
3. Error si se intenta cancelar sin motivo: *"Debe proporcionar un motivo de cancelación"*
4. Al confirmar → estado cambia a `cancelled`
5. El motivo queda visible en el detalle de la receta

---

## Editar Receta (Solo Draft)

**URL:** `/dashboard/medical-records/patients/[id]/prescriptions/[prescriptionId]/edit`

- Solo funciona si la receta está en estado `draft`
- Error si se intenta editar una receta emitida: *"Solo se pueden editar prescripciones en borrador"*
- No genera historial de versiones (a diferencia de las consultas)
- Los mismos campos del formulario de creación están disponibles

---

## Eliminar Receta (Solo Draft)

Desde el detalle de una receta en borrador:
1. Clic en **"Eliminar"**
2. Confirmación: *"¿Está seguro de eliminar esta prescripción? Esta acción no se puede deshacer."*
3. La eliminación es permanente

**No se puede eliminar una receta emitida o cancelada.**

---

## Restricciones del Sistema

| Acción | Estado | Detalle |
|--------|--------|---------|
| Eliminar receta emitida o cancelada | ❌ No permitido | Solo se pueden eliminar borradores |
| Editar receta emitida | ❌ No permitido | Error: "Solo se pueden editar prescripciones en borrador" |
| Cancelar sin motivo | ❌ No permitido | El campo de motivo es obligatorio |
| Enviar receta a farmacia | ❌ No disponible | Sin integración con farmacias |
| Buscar medicamentos en catálogo | ❌ No disponible | Se ingresan manualmente |
| Verificar interacciones medicamentosas | ❌ No disponible | Sin alertas de interacciones |
| Crear receta sin paciente | ❌ No permitido | Requiere expediente de paciente |

---

## Preguntas Frecuentes

**¿Puedo editar una receta ya emitida?**
No. Solo las recetas en borrador (draft) se pueden editar. Para corregir una emitida, debes cancelarla y crear una nueva.

**¿Puedo eliminar una receta?**
Solo si está en borrador. Las recetas emitidas y canceladas son permanentes — solo se puede cancelar una emitida, no eliminarla.

**¿Cómo descargo el PDF de la receta?**
Solo desde una receta en estado "Emitida" — aparece el botón "Descargar PDF" en el detalle.

**¿Qué campos son requeridos por medicamento?**
Nombre del medicamento, dosis, frecuencia e instrucciones. Presentación, duración, cantidad y advertencias son opcionales.

**¿Puedo crear múltiples recetas para el mismo paciente?**
Sí, no hay límite de recetas por paciente.

**¿El paciente puede ver sus recetas desde la app?**
No. Las recetas solo son visibles para el médico desde el portal.
