# 01 — FUENTES: de dónde sale cada campo del informe

> Tipo **CONTRATO**. Esto es lo que hace o rompe la funcionalidad. Si el pre-llenado miente, el
> doctor deja de confiar y teclea todo a mano — y entonces no construimos nada.
> Escrito el **2026-08-08**. Nada de esto está implementado.

## 0. El problema en una frase

Un formato de aseguradora pide ~30 campos. Sacarlos de la ficha del paciente es trivial porque la
ficha tiene columnas fijas. Sacarlos de **la consulta** no lo es: **la consulta no tiene un
esquema fijo** — el doctor se inventa el suyo.

## 1. Las cuatro fuentes

| | Fuente | Determinista | Quién la escribe |
|---|---|---|---|
| **A** | Ficha del paciente | ✅ Sí — columnas fijas | Copia directa |
| **B** | La consulta que motiva el informe | ⚠️ **Parcial** — mitad columnas, mitad JSON libre | Copia directa + LLM |
| **C** | Voz → LLM | ❌ No | El doctor hablando |
| **D** | Manual | — | El doctor tecleando |

**D siempre gana.** A, B y C sólo proponen; lo que queda en el PDF es lo que el doctor dejó.

## 2. Fuente A — la ficha del paciente (`medical_records.patients`)

Columnas fijas, siempre ahí, cero interpretación. Verificado contra
`packages/database/prisma/schema.prisma`:

| Grupo | Columnas |
|---|---|
| Identidad | `firstName` · `lastName` · `internalId` · `dateOfBirth` · `sex` |
| Contacto | `email` · `phone` · `address` · `city` · `state` · `postalCode` |
| **Clínico de cabecera** | `bloodType` · `currentAllergies` · `currentChronicConditions` · `currentMedications` |
| Emergencia | `emergencyContactName` · `emergencyContactPhone` · `emergencyContactRelation` |
| Fiscal | `rfc` · `razonSocial` · `regimenFiscal` · `usoCfdi` · `codigoPostalFiscal` |
| Historia | `firstVisitDate` · `lastVisitDate` · `tags` · `generalNotes` |

Las cuatro **clínicas de cabecera** son oro para un informe de aseguradora: alergias, crónicos y
medicación habitual salen en casi todos los formatos y aquí están como texto plano, sin tocar el
esquema variable de la consulta.

### 🔴 La edad: hay CUATRO implementaciones y **tres están mal**

La edad no es una columna: se calcula de `dateOfBirth`. En el repo hay **cuatro**:

| Dónde | Veredicto |
|---|---|
| `lib/pdf/encounter-pdf.ts` → `calcAge` | ✅ **La correcta.** Parte el string en `y/m/d` y compara números |
| `lib/practice-utils.ts` → `calculateAge` | ❌ Bug de zona horaria (abajo) |
| `components/medical-records/patient-display.ts` → `calculateAge` | ❌ Misma copia |
| `lib/pdf/PrescriptionTemplate.tsx` → `calculateAge` | ❌ Misma copia |

**El bug, medido en `America/Mexico_City` con nacimiento `1980-05-15`:**

| Día | `calculateAge` | `calcAge` | Correcto |
|---|---|---|---|
| 13-may-2026 | 45 | 45 | 45 |
| **14-may-2026** | **46** ❌ | 45 | **45** |
| 15-may-2026 | 46 | 46 | 46 |

`new Date("1980-05-15")` se interpreta como medianoche **UTC**; al leerlo con `getDate()` **local**
en UTC-6 da **14**, no 15. Resultado: **cumple un día antes**.

⇒ **Usar `calcAge` de `encounter-pdf.ts`** (o extraer una sola y arreglar las otras tres). Una edad
equivocada en un informe médico-legal para una aseguradora no es un detalle cosmético.

## 3. Fuente B — la consulta. **Aquí está toda la dificultad.**

`ClinicalEncounter` **no es "SOAP o custom"**: es **híbrido**. Siempre trae columnas fijas, y
*además* puede traer un JSON libre. Son tres capas con confiabilidad distinta:

### B1 — Columnas fijas (SIEMPRE presentes, cualquier plantilla)

`encounterDate` · `encounterType` · `chiefComplaint` · `location` · `status` · `clinicalNotes` ·
`followUpDate` · `followUpNotes`

Y los signos vitales, que son columnas propias — no viven en el JSON:
`vitalsBloodPressure` · `vitalsHeartRate` · `vitalsTemperature` · `vitalsWeight` ·
`vitalsHeight` · `vitalsOxygenSat` · `vitalsOther`

> 💡 **Esto es más de lo que parece.** Fecha, motivo de consulta y signos vitales son campos de
> aseguradora, y están garantizados **sin importar qué plantilla usó el doctor**. B1 + A ya llena
> buena parte de un formato típico sin tocar una sola línea de LLM.

### B2 — SOAP (`subjective` · `objective` · `assessment` · `plan`)

Columnas reales, pero **nullable**: existen siempre en la tabla y están llenas sólo si el doctor
trabajó en modo SOAP (`EncounterTemplate.useSOAPMode`). Determinista cuando hay valor.

⚠️ **`assessment` no es un diagnóstico estructurado.** Es texto libre. No hay CIE-10 en el
expediente. Si un formato pide "clave CIE-10", **no tenemos de dónde sacarla** — se queda vacía y
la teclea el doctor. No pedirle al LLM que la deduzca del texto.

### B3 — `customData` (JSON) — **lo impredecible**

> 🔴 **SUPERSEDED el 2026-08-09 por [`05-VOZ`](05-VOZ-el-doctor-le-dicta-al-formato.md).** Mapear
> `customData` → campos del formato se abandonó por dos razones: no escala (80% de las consultas de
> prod usan plantilla propia, 40 plantillas con 11 doctores) y, sobre todo, **la plantilla no
> contiene lo que la aseguradora pide**. El hueco lo llena el doctor DICTANDO contra el formato.
> Lo de abajo se conserva porque la resolución clave→etiqueta **sí se reusa**: es como se le
> entrega al LLM una plantilla adjunta.


Cuando el doctor usó una plantilla propia (`EncounterTemplate.isCustom`), los valores caen en
`ClinicalEncounter.customData` como un objeto con **las claves que ese doctor inventó**.

No podemos escribir un mapeo estático contra un esquema que se define *después* de que shipeamos.
Una dermatóloga tendrá `tipoLesion`, `localizacion`, `dermatoscopia`; un traumatólogo tendrá
`mecanismoLesion`, `ladoAfectado`. Ninguna lista fija los cubre.

**Pero las claves no están solas.** La plantilla guarda `customFields` — un `FieldDefinition[]`
(`apps/doctor/src/types/custom-encounter.ts`) donde cada campo trae `label` y **`labelEs`**. O sea:
podemos entregarle al LLM *"Tipo de Lesión: nevo displásico"* en vez de *"tipoLesion: nevo"*.

> ✅ **Ya existe el precedente y hay que reusarlo, no reinventarlo:**
> `apps/doctor/src/lib/receta-custom-content.ts` (`resolveRecetaCustomContent`) hace exactamente
> esta resolución clave-cruda → etiqueta para las recetas, **incluyendo el fallback a la clave
> cruda cuando la plantilla ya no existe**. Ese fallback importa: una plantilla borrada
> (`onDelete: SetNull` en `templateId`) deja `customData` huérfano y sin etiquetas.

### El reparto, entonces

| Capa | Cómo se mapea |
|---|---|
| A, B1, B2 | **Mapeo estático.** Sin LLM. Código aburrido y verificable |
| B3 | **LLM, semántico.** Es el único lugar donde el modelo se gana el lugar |

🔴 **No mandar A/B1/B2 por el LLM "para simplificar".** Meter un dato determinista a un modelo lo
vuelve probabilístico gratis: `dateOfBirth` no se "interpreta", se copia.

## 4. Procedencia — cada campo dice de dónde salió

Cada valor propuesto se guarda con su origen, no suelto:

```ts
{ value: "42", source: "patient.dateOfBirth", origin: "deterministic" }
{ value: "Nevo displásico en espalda", source: "encounter.customData.tipoLesion", origin: "llm" }
{ value: "", source: null, origin: "empty" }   // ← no hay de dónde. Se queda así.
```

Para qué sirve:

1. **La UI pinta distinto lo determinista y lo interpretado.** El doctor revisa con los ojos donde
   hay riesgo, no los 30 campos por igual.
2. **`origin: "empty"` es un estado explícito**, no un string vacío ambiguo. Un hueco porque no hay
   dato y un hueco porque el doctor lo borró a propósito no son lo mismo.
3. **Auditoría.** Es un documento médico-legal firmado por el doctor.

> ⚠️ Lección ya pagada en este repo: si un fallo aterriza en el mismo `""`/`[]` que un vacío
> legítimo, la UI afirma con confianza un hecho falso sobre los datos del doctor. Hace falta el
> estado "no sé" explícito.

## 5. Fuente C — voz y LLM

> 📌 **El diseño completo vive en [`05-VOZ`](05-VOZ-el-doctor-le-dicta-al-formato.md)** (2026-08-09).
> ⚠️ Su §4 **corrige la regla 1 de abajo**: no hay card de confirmación. El LLM escribe directo en
> el BORRADOR (no en la BD), igual que el flujo de nueva consulta; la seguridad la dan el ámbar, el
> consentimiento y que emitir sea un acto aparte.


El doctor habla; el LLM **propone cambios sobre campos del informe**, no sobre el PDF.

Reglas, heredadas de las del agente y no negociables:

1. **Propuesta → el doctor ve qué cambia → confirma.** Nunca escribe directo en el documento final.
2. **El LLM sólo escribe campos del formato.** No inventa campos ni toca el expediente.
3. **Sin fuente, no hay valor.** Si el doctor no lo dictó y no está en el expediente, queda vacío.
4. El prompt **no dice "calcula", "deduce" ni "infiere"** sobre datos clínicos. Eso es deuda de
   regla 0: invisible hasta que bajas de modelo y entonces empieza a alucinar.

📌 Lo que sea del **agente** (prompt, módulo, evals) se documenta en
[`../AGENTES/`](../AGENTES) — aquí sólo queda el resumen y el cross-link.

## 6. Qué consulta se usa

El informe se llena **para una consulta específica**, elegida por el doctor — no "la última". Un
informe puede pedirse meses después del evento que la aseguradora va a cubrir.

⚠️ Y el informe **guarda de cuál consulta salió** (`encounterId`). Sin eso no se puede reconstruir
por qué el documento dice lo que dice, y el expediente pudo cambiar después.

⚠️ Consultas en `status: 'draft'` no deberían alimentar un informe que se manda a una aseguradora,
o al menos deben advertirse: el doctor todavía no la cerró.

## 7. Consentimiento

Mandar datos clínicos a una aseguradora es una **transferencia a un tercero** bajo la LFPDPPP. El
informe tiene que registrar la autorización del paciente como parte del documento. Es barato ahora
y caro de retrofitear después.

**Pendiente de confirmar con el usuario:** si basta con una casilla que el doctor marca declarando
que tiene el consentimiento, o si hace falta que el paciente firme (lo que abre un flujo de firma
en la página pública del token).

## 8. Abierto

| # | Pregunta |
|---|---|
| 1 | ¿Un informe puede juntar VARIAS consultas, o siempre una? (los formatos de "evolución" suelen pedir varias) |
| 2 | ¿El doctor edita un informe ya emitido, o se emite uno nuevo? (versiones vs. inmutabilidad) |
| 3 | ¿Consentimiento = casilla del doctor o firma del paciente? (§7) |
| 4 | ¿Los adjuntos (estudios, imágenes de `PatientMedia`) van con el informe? Varias aseguradoras los piden |
