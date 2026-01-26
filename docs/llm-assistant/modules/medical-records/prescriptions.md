# Recetas Médicas (Prescriptions)

## Propósito

Permite crear y gestionar recetas médicas con medicamentos, dosis e instrucciones para los pacientes.

## Acceso

**Ruta:** Perfil del Paciente > Recetas > Nueva Receta

**URL:** `/dashboard/medical-records/patients/[id]/prescriptions`

---

## Funcionalidades

### 1. Ver Lista de Recetas

**URL:** `/dashboard/medical-records/patients/[id]/prescriptions`

**Información mostrada por receta:**
- Fecha de emisión
- Número de medicamentos
- Estado (vigente/vencida)
- Médico que prescribió

**Acciones disponibles:**
- Ver detalle de la receta
- Editar receta
- Imprimir receta (si disponible)

---

### 2. Crear Nueva Receta

**URL:** `/dashboard/medical-records/patients/[id]/prescriptions/new`

#### Campos del Formulario

##### Información General
| Campo | Requerido | Descripción |
|-------|-----------|-------------|
| Fecha | **Sí** | Fecha de emisión de la receta |
| Fecha de Vigencia | No | Hasta cuándo es válida la receta |
| Notas | No | Instrucciones generales |

##### Lista de Medicamentos
Para cada medicamento:

| Campo | Requerido | Descripción |
|-------|-----------|-------------|
| Nombre del Medicamento | **Sí** | Nombre genérico o comercial |
| Dosis | **Sí** | Cantidad por toma. Ej: "500mg", "1 tableta" |
| Frecuencia | **Sí** | Cada cuánto. Ej: "Cada 8 horas", "2 veces al día" |
| Duración | No | Por cuánto tiempo. Ej: "7 días", "1 mes" |
| Vía de Administración | No | Oral, tópica, intramuscular, etc. |
| Instrucciones | No | Indicaciones especiales. Ej: "Tomar con alimentos" |

#### Paso a Paso: Crear Receta Manualmente

1. Ir al perfil del paciente
2. Click en **"Recetas"** en la navegación del paciente
3. Click en **"Nueva Receta"**
4. Establecer la fecha de la receta
5. Click en **"Agregar Medicamento"**
6. Completar los datos del medicamento
7. Repetir para cada medicamento adicional
8. Agregar notas generales si es necesario
9. Click en **"Guardar Receta"**

#### Paso a Paso: Crear Receta con Asistente de Voz

1. Ir al perfil del paciente
2. Click en **"Recetas"**
3. Click en **"Nueva Receta"**
4. Click en el botón **"Asistente de Voz"**
5. Dictar los medicamentos de forma natural
   - Ejemplo: "Paracetamol 500 miligramos cada 8 horas por 5 días, Omeprazol 20 miligramos una vez al día en ayunas"
6. Revisar los medicamentos extraídos
7. Corregir si es necesario en el panel lateral
8. Click en **"Confirmar"**
9. Verificar y completar información faltante
10. Click en **"Guardar Receta"**

---

### 3. Ver Detalle de Receta

**URL:** `/dashboard/medical-records/patients/[id]/prescriptions/[prescriptionId]`

**Información mostrada:**
- Fecha de emisión
- Fecha de vigencia
- Lista completa de medicamentos con todos los detalles
- Notas del médico
- Datos del médico prescriptor

---

### 4. Editar Receta

**URL:** `/dashboard/medical-records/patients/[id]/prescriptions/[prescriptionId]/edit`

**Campos editables:** Todos los campos de la receta

#### Paso a Paso

1. Ir al detalle de la receta
2. Click en **"Editar"**
3. Modificar medicamentos o información
4. Click en **"Guardar Cambios"**

---

## Ejemplos de Prescripción por Voz

El asistente de voz puede entender diferentes formas de dictar medicamentos:

### Forma completa:
> "Amoxicilina 500 miligramos, tomar una cápsula cada 8 horas por 7 días, vía oral"

### Forma abreviada:
> "Ibuprofeno 400 cada 6 horas por dolor"

### Múltiples medicamentos:
> "Receta para Juan Pérez: Metformina 850 una vez al día con el desayuno, Losartán 50 miligramos una vez al día por la mañana, y Aspirina 100 miligramos una vez al día"

---

## Lo que el Usuario PUEDE Hacer

- Crear múltiples recetas para el mismo paciente
- Agregar cualquier cantidad de medicamentos a una receta
- Editar recetas existentes
- Ver historial de todas las recetas del paciente

## Lo que el Usuario NO PUEDE Hacer

- **Eliminar recetas** - Las recetas son permanentes por razones médico-legales
- **Enviar receta electrónica** - No hay integración con farmacias
- **Imprimir directamente** - Depende de la configuración del sistema
- **Buscar en catálogo de medicamentos** - Los nombres se ingresan manualmente
- **Verificar interacciones medicamentosas** - No hay sistema de alertas

---

## Preguntas Frecuentes

### ¿Puedo crear recetas para cualquier medicamento?
Sí, el sistema no tiene restricciones sobre qué medicamentos puedes prescribir.

### ¿Las recetas tienen fecha de vencimiento?
Puedes establecer una fecha de vigencia opcional. El sistema mostrará si la receta está vencida.

### ¿Puedo duplicar una receta anterior?
No hay función de duplicar, pero puedes ver recetas anteriores como referencia.

### ¿El paciente puede ver sus recetas?
En esta versión, las recetas solo son visibles para el médico desde el portal.

### ¿Puedo agregar instrucciones especiales?
Sí, cada medicamento tiene un campo de instrucciones, y la receta tiene un campo de notas generales.
