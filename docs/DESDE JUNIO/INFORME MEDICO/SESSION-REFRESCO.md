# 🔄 SESSION-REFRESCO — INFORME MÉDICO

> **Handoff canónico de esta carpeta.** Estado vivo. Se actualiza al cerrar cada sesión.
> Última actualización: **2026-08-08**.

## Estado en una línea

**Las TABLAS están en prod y el motor de PDF está probado — pero la APLICACIÓN no existe:** cero
endpoints, cero pantallas, cero filas en `insurance_forms`, y `pdf-lib`/`pdfjs-dist` **no están
instalados en el repo**. Todo lo probado vive en scripts de scratchpad, fuera de la app.

⬜ **Nada commiteado.** Prod tiene las tablas; el repo no tiene el commit.

## Qué se hizo el 2026-08-08

1. Se exploró qué existe ya en el repo que sirva (resultado: **casi todo**).
2. Se le preguntó al usuario las tres decisiones que ramificaban el diseño. Respondió:
   - **Fidelidad:** las aseguradoras exigen **su formato exacto**. (Dijo que eran escaneos planos;
     al medirlos resultó que **no** — ver abajo. La exigencia de fidelidad sí se sostiene.)
   - **Entrega:** **descarga** + **link/correo al paciente**. NO correo directo a la aseguradora.
   - **Llenado:** los cuatro — manual, automático de la ficha, LLM sobre el expediente, y voz.
3. Se leyó el esquema real (`packages/database/prisma/schema.prisma`) para no inventar columnas.
4. Se escribieron `README.md`, `01-FUENTES` y `02-PLAN`.
5. **El usuario mandó 3 PDFs reales y se midieron** ⇒ la premisa de "escaneos planos" resultó
   **falsa**, y `02-PLAN` se reescribió el mismo día.

## 🎉 Lo más importante: NO son escaneos

Medido con `pdfjs-dist` sobre los 3 formatos que mandó el usuario:

| Formato | Págs | **Campos AcroForm** | Texto | Rot | Cifrado/XFA |
|---|---|---|---|---|---|
| **Allianz México** | 3 | **126** | ✅ | 0 | No |
| **AXA Seguros** (GMM) | 6 | **326** | ✅ | 0 | No |
| **GNP** | 3 | **132** | ✅ | 0 | No |

Los tres traen **campos rellenables**, capa de texto, tamaño carta, sin rotación, sin cifrado, sin
XFA y sin restricciones de permisos. Y el `Producer` de los tres es **`pdf-lib`** — ya pasaron por
la librería que íbamos a usar y sobrevivieron.

⇒ **Se cancela el calibrador de coordenadas** (era el paso más caro: ~30–60 min por formato).
⇒ Se llena **por nombre de campo**, y se aplana con `flatten()` antes de entregar.

> 🔴 **Trampa que costó un rato:** el `grep` crudo del PDF dice `/AcroForm 0` y **miente**. Son PDF
> 1.7 con object streams (`/ObjStm`): los objetos van comprimidos y grep no los ve. Sólo un parser
> real los encuentra. **No concluir "no tiene campos" desde un grep.**

### Lo que sí quedó de trabajo: los nombres de los campos

Existen, pero no todos dicen qué son. Tres niveles:

| Nivel | Formato | Ejemplo |
|---|---|---|
| 🟢 auto-descriptivo | AXA | `DiagnósticoRow1` · `Fecha de diagnóstico ddmmaaaaRow1` |
| 🟡 ambiguo | Allianz | `Congénito`, pero también `Si`, `No_2`, `Si_3` (¿a qué pregunta?) |
| 🔴 posicional | GNP | `P1_7`, `P2_15` — cero semántica |

Se resuelve derivando la etiqueta **por cercanía** (tenemos el `rect` del campo y las coordenadas
de cada texto de la página) + una pantalla chica de revisión. Mucho más barato que el calibrador
cancelado. Ver [`02-PLAN`](02-PLAN-el-formato-y-los-pasos.md) §3.

## El hallazgo que más cambia el diseño

El usuario avisó que **las consultas no tienen un esquema fijo** — no todas son SOAP, los doctores
crean el suyo. Al leer el esquema resultó **más manejable de lo que suena**:

`ClinicalEncounter` es **híbrido, no un either/or**. Siempre trae columnas fijas
(`encounterDate`, `chiefComplaint`, `encounterType`, los **7 signos vitales**, `followUp*`) y
*además* SOAP nullable, y *además* `customData` (JSON libre) cuando la plantilla era propia.

⇒ **Sólo `customData` es impredecible.** Todo lo demás se mapea con código estático y aburrido.
Y hasta `customData` es interpretable, porque `EncounterTemplate.customFields` guarda `label` y
`labelEs` de cada campo: se le puede dar al LLM *"Tipo de Lesión: nevo displásico"* en vez de
*"tipoLesion: nevo"*.

**Ya existe el precedente exacto de esa resolución** y hay que reusarlo, no reescribirlo:
`apps/doctor/src/lib/receta-custom-content.ts` (`resolveRecetaCustomContent`), con su fallback a la
clave cruda cuando la plantilla fue borrada.

## Las tres decisiones que no se re-litigan

1. **El PDF es una SALIDA, nunca la superficie de captura.** Se teclea contra un JSON en un
   formulario HTML; el PDF se genera y se aplana al final.
2. **Los formatos de aseguradora NO van en `encounter_templates`.** Esa tabla está scopeada por
   `doctorId`; los formatos oficiales son de plataforma y **versionados**.
3. **Un campo sin fuente se queda vacío y marcado.** Nunca se adivina, y cada valor propuesto carga
   su procedencia (determinista vs. interpretado por el LLM).

## 🔴 Y después: los PDFs eran de un TERCERO, y dos están mal

El usuario avisó que los PDFs se los dio **una empresa que no es la aseguradora**. Se compararon
contra el sitio oficial de cada una ⇒ [`03-FORMATOS`](03-FORMATOS-procedencia-y-versiones.md):

| | Del tercero | Oficial | Veredicto |
|---|---|---|---|
| **AXA** | 6p · 326 campos | 6p · **277 campos**, ya rellenable | ✅ Mismo doc — **usar el oficial** |
| **GNP** | 3p · 132 campos | **2p** · 62 campos | ⚠️ **Documentos distintos** — preguntar cuál rige |
| **Allianz** | 3p · creado **2016-12-29** | 3p · creado **2023-02-26** · **0 campos (plano)** | 🔴 El del tercero está **~7 años atrasado** |

**Los campos rellenables los puso el tercero con `pdf-lib` hace días** (`ModDate` 2026-08-05 /
2026-08-08). No son oficiales.

⚠️ **Esto corrige el hallazgo anterior:** el calibrador **no estaba cancelado, sólo reducido**. El
oficial de AXA ya trae campos, pero el de Allianz es plano y hay que ponérselos. Como sí tiene capa
de texto con coordenadas, las posiciones se pueden **auto-proponer** desde las etiquetas — el mismo
motor que deriva el diccionario (`02-PLAN` §3).

🔴 **Regla nueva:** el PDF base se baja del **dominio de la aseguradora**, y `insurance_forms`
guarda `sourceUrl` + `fetchedAt` además de la versión.

## ✅ Paso 2 VALIDADO el 2026-08-08 (en scratchpad, nada tocó el repo)

Se instaló `pdf-lib` **fuera del repo** y se llenó el **AXA OFICIAL**:

| Qué se probó | Resultado |
|---|---|
| Campos del oficial | **277** (255 de texto) |
| Llenado por nombre | **10/10** ✅ |
| `form.flatten()` | ✅ **0 campos vivos, 0 anotaciones** — el informe llega no editable |
| **Acentos y ñ** | ✅ `Muñoz` · `Peña` · `María de los Ángeles` · `Neumonía` · `Antibiótico` · `oxígeno` — **todos intactos** |

Salida verificada leyendo el PDF generado de vuelta:

```
Guadalajara, Jalisco  Muñoz  Peña  María de los Ángeles  47  1.62 m  68.4 kg
130/85 mmHg  Neumonía adquirida en la comunidad  Antibiótico IV · oxígeno suplementario
```

### ✅ Y el CLIC lo dio el usuario (2026-08-08)

> *"axa lleno looks good and cant be edited"*

Abrió el PDF generado: **se ve bien y no se puede editar.** Eso cubre lo único que no se podía
verificar desde aquí (no hay renderizador de PDF en este entorno): que los valores caigan dentro de
sus casillas, que los acentos y la ñ se rindan como letras, y que el `flatten()` de verdad deje el
documento muerto.

⇒ **El motor de salida está PROBADO de punta a punta, con el clic incluido.** No queda riesgo
conocido en la generación del PDF: nombres de campo, acentos, flatten y apariencia, los cuatro
verificados.

(Copias para inspección: `Downloads/axa-lleno.pdf` y `Downloads/axa-oficial-vacio.pdf`.)

## ✅ ALLIANZ resuelto el 2026-08-08 — el PDF plano ya tiene campos

Era el único hueco de v1: el oficial de Allianz trae **0 campos**. Se le pusieron
**automáticamente**, sin hacer un solo clic.

### Cómo (y es reutilizable para cualquier formato plano)

1. **Sacar las reglas dibujadas** — las rayitas sobre las que escribe el doctor. Salen del
   *operator list* del PDF (`OPS.constructPath`), filtrando lo ancho y delgado (`w≥25`, `h≤3`).
2. **Deducir la etiqueta de cada regla** por vecindad:
   - **(a) por la izquierda** — el texto que termina justo antes de donde arranca la regla, en el
     mismo renglón (±6 pt). Es el caso normal: `Edad ______`.
   - **(b) por arriba** — si no hay nada a la izquierda, el texto de encima que esté **más
     centrado** sobre la regla. Así `Apellido Paterno` (la leyenda de la columna) le gana a
     `Nombre del Paciente:` (el título de la sección, pegado al margen).
3. **Crear el campo** con `form.createTextField(nombre)` + `addToPage` sobre la regla.

### Resultado

| | |
|---|---|
| Reglas detectadas (3 páginas) | **61** |
| Campos creados | **56** |
| Sin etiqueta (quedan para revisión manual) | 5 |
| Etiquetados por la izquierda | 43 |
| Etiquetados por arriba | 13 |
| Llenado de prueba | **12/12** ✅ |
| `flatten()` | ✅ 0 campos vivos, 0 anotaciones |
| Acentos | ✅ `Muñoz` · `Peña` · `María de los Ángeles` · `Colecistectomía` · `Hernández` |

Salió `p1_Apellido_Paterno`, `p1_Apellido_Materno`, `p1_Nombres`, `p1_Edad`, `p1_Estado_Civil`,
`p1_FUM`, `p1_No_de_Embarazos`, `p1_Partos`, `p1_Mencione_cirugias_realizadas`… — **nombres
utilizables directamente**.

⚠️ **No todos salen bien, y eso es lo esperado.** `p1_AAAA` (una línea de fecha etiquetada con el
encabezado `AAAA`), `p1_y_cantidad` (la pregunta se partió en dos fragmentos de texto y agarró el
final), `p1_CAUSA` (la tabla de diagnósticos). **Ese es justo el trabajo de la pantalla de
revisión** (`02-PLAN` §3): el humano corrige un puñado, no teclea 56.

### Dos trampas que costaron un rato

- 🔴 **El `minMax` de `constructPath` está en coordenadas LOCALES del path, no de la página.** Hay
  que llevar la matriz de transformación (`OPS.transform` / `save` / `restore`) y aplicarla. Sin
  eso todas las reglas salen en `x=0, y=0` — y parece que el extractor "funciona".
- 🔴 **`setFontSize()` truena si el campo no está en una página todavía** (`No /DA entry found`).
  El orden correcto es `addToPage()` **y luego** `setFontSize()`.

### ✅ El CLIC lo dio el usuario (2026-08-08)

> *"the first one is the name, looks good. The last one is Antecedentes Perinatales, which also
> renders correctly."*

**La colocación automática es correcta.** Y la prueba es más fuerte de lo que parece: el nombre
está **arriba** de la página (y≈563) y Antecedentes Perinatales **abajo** (y≈196). Si la matriz de
transformación estuviera mal —origen invertido, escala equivocada, deriva acumulada— esos dos
**no** podrían caer bien los dos. Que ambos extremos queden en su raya valida el mapeo de
coordenadas en toda la altura de la hoja.

⇒ **El riesgo de colocación, que era EL riesgo de Allianz, está descartado.**

⚠️ **Lo que sigue sin verificarse: las páginas 2 y 3.** Los 12 valores de prueba eran todos de la
página 1. Las otras dos tienen campos creados pero nunca se les puso un valor ni se miraron.

## ✅ BORRADOR con dos capas de color — probado el 2026-08-08

Idea del usuario: al abrir el formato, el médico debe ver **dónde puede escribir** y **qué ya está
lleno**, en dos colores distintos.

Construido sobre el AXA oficial y **abierto por el usuario: "looks good in general"**.

| | |
|---|---|
| 🟦 Azul suave | se puede escribir (campo vacío) — **266** |
| 🟩 Verde suave | ya tiene contenido — **11** |
| Barra roja arriba | "BORRADOR — sólo lectura. NO enviar a la aseguradora" |
| Campos | **277/277 en sólo lectura** |

### El hallazgo del usuario al probarlo

> *"cuando escribo en uno azul, no se pone verde"*

**Correcto y no tiene arreglo en un PDF:** los colores se pintan en la página al generar, son una
foto. Un PDF no reacciona (el JavaScript de formulario de Acrobat lo ignoran Chrome, Edge, Firefox
y Preview).

⚠️ **Pero el síntoma destapó un problema mayor:** si el doctor puede teclear en el PDF, ese valor
vive **sólo en ese archivo**, fuera del JSON de respuestas — y al regenerar el borrador
**desaparece en silencio**.

⇒ **Decisión: el borrador es de SÓLO LECTURA.** Se edita en la app (ahí el color sí es vivo); el
PDF es una foto para revisar e imprimir. Regla completa en
[`02-PLAN`](02-PLAN-el-formato-y-los-pasos.md) §4b.

Archivo: `Downloads/axa-BORRADOR.pdf`.

## ✅ PASO 1 — las tablas EN PROD (2026-08-08)

Corrido con el método del TOOLING (`railway run --service pgvector` + `prisma db execute`), **no
con `prisma db push`**. Archivo: `packages/database/prisma/migrations/create-informe-medico.sql`.

### Pre-vuelo read-only ANTES de tocar nada

| | |
|---|---|
| Schemas | `medical_records`, `practice_management`, `public` ✅ |
| ¿Existían las tablas nuevas? | **NO** ✅ |
| ¿Existían las columnas de póliza? | **NO** ✅ |
| PK de `patients` / `clinical_encounters` / `doctors` | **todas `text`** ⇒ las FK son `text` |
| Pacientes en prod | **198** |

### Lo que quedó

- **`medical_records.insurance_forms`** — catálogo a nivel plataforma: aseguradora, nombre,
  **versión**, `source_url` + `fetched_at` (procedencia), `pdf_url`, `field_dict` (JSONB),
  `fields_added_by_us` (TRUE para Allianz), `is_active`. Unique `(insurer, name, version)`.
- **`medical_records.medical_reports`** — el informe: `doctor_id`, `patient_id`, `encounter_id`,
  `form_id`, `answers` (JSONB con procedencia), `status`, `consent_given`/`consent_at`,
  `issued_at`, `created_by`.
- **`patients.numero_poliza`** + **`patients.poliza_aseguradora`** — nullable, el hueco de GNP.

> ℹ️ Nombres de tabla en **inglés** (`insurance_forms`, `medical_reports`) por consistencia con el
> resto del schema (`patients`, `clinical_encounters`, `prescriptions`), aunque el dominio se
> llame "informe médico".

### Verificado contra prod, sin confiar en el "Script executed successfully"

| | |
|---|---|
| Columnas | las 12 + 13 ✅ |
| Índices | **8** ✅ |
| FKs | **4**, con `CASCADE` / `SET NULL` / **`RESTRICT`** en `form_id` ✅ |
| Columnas nuevas en `patients` | las 2, nullable ✅ |
| **Filas tocadas** | **0** — 198 pacientes, 0 con póliza ✅ |

### Y el smoke de las FORMAS DE QUERY nuevas, por el cliente Prisma

**9/9 ✅** — `findMany` con `isActive`, `findUnique` por la unique compuesta, `include: { form }`
(el JOIN de la UI), include anidado paciente+consulta, `count`, `select` de las columnas nuevas,
`count({ numeroPoliza: null })` → **198**, la relación inversa `patient.medicalReports`, y filtro
por **JSON path** dentro de `answers`.

⚠️ El primer intento del smoke falló con un error de conexión transitorio; la misma query pasó al
reintentar y en la corrida completa. **No era el schema.**

### `schema.prisma` actualizado en el MISMO commit

`InsuranceForm` + `MedicalReport` + las 2 columnas de `Patient` + las relaciones inversas en
`Doctor`, `Patient` y `ClinicalEncounter`. `prisma validate` ✅ y `prisma generate` corrido.
**Si la BD y el schema divergen, el siguiente `db push` "arregla" la diferencia borrando la tabla.**

### Drift: hay, y es del REPO, no de este cambio

`prisma migrate diff` pide 471 líneas. De lo nuevo pide dos cosas: quitar el `DEFAULT` de
`updated_at` y recrear las 4 FK por `ON UPDATE CASCADE`.

**Las dos son el patrón que YA tiene el repo entero:** el mismo `DROP DEFAULT` sale para
`cfdi_drafts`, `patient_notes`, `bank_statements`, `doctor_fiscal_profiles` y 2 más; y la recreación
de FKs sale para una docena de tablas. **Las tablas nuevas quedaron idénticas a sus hermanas a
propósito** — mismo criterio que tomó CONSULTORIOS.

**Rollback** (nada lo lee todavía): está escrito al pie del `.sql`.

### El `/code-review` del paso 1 — 15 hallazgos, 3 eran del ESQUEMA y se corrigieron en prod

Las tablas tenían **0 filas**, así que arreglarlas salió gratis. Aplicado y verificado el mismo día:

1. **🔴 Faltaba el aislamiento por doctor.** `medical_reports` tenía FKs sueltas a `doctor_id` y
   `patient_id`: nada a nivel BD impedía que un informe apuntara al paciente de **otro doctor** —
   y de ahí sale un PDF con PHI ajena. Ahora lleva la **FK compuesta**
   `(patient_id, doctor_id) → patients(id, doctor_id)`, el mismo patrón que
   `bookings_patient_id_doctor_id_fkey`, apoyada en el índice `patients_id_doctor_id_key` que ya
   estaba en prod.
2. **🔴 `encounter_id` era `SET NULL` y las consultas SÍ se borran de verdad**
   (`clinicalEncounter.delete` en `encounters/[encounterId]/route.ts`). Borrar una consulta dejaba
   un informe **ya emitido** sin saber de dónde salió — justo lo que `01-FUENTES` §6 declara
   obligatorio. Ahora es **`RESTRICT`**.
3. **🟡 Podía haber dos versiones ACTIVAS del mismo formato** — el dropdown ofrecería la vigente y
   la superseded a la vez, y elegir la vieja es el rechazo que `03-FORMATOS` existe para evitar.
   Ahora hay un **índice único parcial** `UNIQUE (insurer, name) WHERE is_active`.

⚠️ **Ni la FK compuesta ni el índice parcial los sabe modelar Prisma** ⇒ `prisma db push` los
revertiría, igual que ya pasa con la FK compuesta de `bookings`. Los dos están comentados en
`schema.prisma` y viven en el `.sql`.

Lo demás eran **afirmaciones desactualizadas en estos docs** (que ya se corrigieron): el encabezado
que decía "cero tablas", el nombre fantasma `informe_medico` (shipeó como `medical_reports`),
preguntas abiertas ya resueltas, y dos hallazgos de hechos verificados aparte:

- **`pdfjs-dist` NO está instalada.** Sólo existe bajo `node_modules/.pnpm` como transitiva de
  `pdf-parse`; `node_modules/pdfjs-dist` no existe. Hay que declarar **dos** dependencias, no una.
- **Hay CUATRO implementaciones de la edad y tres tienen un bug de zona horaria** que hace cumplir
  años **un día antes** en UTC-6. Medido. Detalle y tabla en `01-FUENTES` §2.

> 🔎 **Un hallazgo del review estaba al revés:** decía que el bug de edad daba `edad−1` **el día
> del cumpleaños**. Medido: el día del cumpleaños las dos funciones dan lo mismo; la mala falla
> **el día ANTERIOR**, dando `edad+1`. El bug es real, la descripción no lo era.

## Lo siguiente

**Paso 0: ✅** · **Paso 1 (tablas): ✅ EN PROD** · **Paso 2: ✅** · **Allianz: ✅** · **Borrador: ✅**

⬜ **Nada de esto está commiteado.** El `.sql`, el `schema.prisma` y los docs están en el working
tree esperando OK.

- **Paso 4** (pre-llenado determinista) ya tiene un mapeo obvio contra AXA:
  `Nombres`/`Apellido paterno`/`Apellido materno`/`Edad` ← `Patient`;
  `Talla`/`Peso`/`Tensión arterial` ← `vitalsHeight`/`vitalsWeight`/`vitalsBloodPressure`.

⚠️ Sólo se vieron **3** formatos, y son los 3 con los que arranca v1 por decisión del usuario.

### Los scripts de la medición

Viven en el scratchpad de la sesión (no en el repo): `inspect-pdf.mjs` (páginas, rotación, texto,
anotaciones), `fields.mjs` (nombres, tipos y `rect` de cada campo), `perms.mjs` (cifrado, XFA,
permisos, productor). Usan el `pdfjs-dist` **que ya está instalado** en `node_modules`. Si hacen
falta otra vez, se reescriben en 5 minutos.

## Preguntas abiertas para el usuario

| # | Pregunta | Dónde |
|---|---|---|
| 0 | ⚠️ **GNP: ¿cuál formato rige** — el de Eleonor (3 pág) o el que publica GNP (2 pág)? Se arranca con el oficial, pero conviene confirmarlo | [`03-FORMATOS`](03-FORMATOS-procedencia-y-versiones.md) §3 |
| ~~0b~~ | ~~¿Qué empresa dio estos PDFs?~~ **RESUELTO: Eleonor (`eleonor.mx`)**, de una cuenta de doctor real | [`03-FORMATOS`](03-FORMATOS-procedencia-y-versiones.md) §0 |
| 1 | ¿Cuántas aseguradoras/formatos son en total? v1 arranca con 3 por decisión del usuario | [`03-FORMATOS`](03-FORMATOS-procedencia-y-versiones.md) §0 |
| 2 | ¿Quién da de alta un formato — admin de la plataforma o cada doctor? | [`02-PLAN`](02-PLAN-el-formato-y-los-pasos.md) §4 |
| 3 | Consentimiento: ¿casilla del doctor o firma del paciente? | [`01-FUENTES`](01-FUENTES-de-donde-sale-cada-campo.md) §7 |
| 4 | ¿Un informe puede juntar VARIAS consultas? | [`01-FUENTES`](01-FUENTES-de-donde-sale-cada-campo.md) §8 |
| 5 | ¿Los adjuntos (estudios de `PatientMedia`) van con el informe? | [`01-FUENTES`](01-FUENTES-de-donde-sale-cada-campo.md) §8 |

## Trampas anotadas antes de pisarlas

- **`pdf-lib` es dependencia nueva** ⇒ regenerar `pnpm-lock.yaml` en el MISMO commit o Railway
  falla el build con frozen lockfile y el push no shipea.
- **`grep` sobre un PDF miente** con object streams (ver arriba). Usar un parser.
- **Acentos.** Los formatos son en español (`Diagnóstico`, `Programación`). Es el bug clásico de
  pdf-lib con caracteres fuera de WinAnsi — hay que verificarlo en el paso 2, con los ojos.
- **Aplanar antes de entregar** (`flatten()`), o el informe firmado llega editable. Los tres
  formatos advierten en su propio texto que no aceptan tachaduras ni enmendaduras.
- **AXA trae tablas repetidas** (`DiagnósticoRow1..RowN`): el modelo de respuestas necesita listas,
  no sólo pares campo→valor.
- **~16–18 campos por formato vienen sin tipo** (`type: ""`) — probablemente botones o firmas. No
  asumir que son texto.
- **No hay CIE-10 en el expediente.** `assessment` es texto libre. Si un formato pide clave, se
  teclea — no se le pide al LLM que la deduzca.
- **`gmail.ts` no sabe adjuntar** (`multipart/alternative`, sólo HTML). Irrelevante para v1 porque
  al paciente se le manda un link con token, no un adjunto.
- **`prisma db push` revierte** cosas que viven en prod ⇒ las tablas nuevas van por SQL manual +
  `prisma db execute`.
