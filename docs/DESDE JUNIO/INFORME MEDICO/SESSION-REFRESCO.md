# 🔄 SESSION-REFRESCO — INFORME MÉDICO

> **Handoff canónico de esta carpeta.** Estado vivo. Se actualiza al cerrar cada sesión.
> Última actualización: **2026-08-09**.

## Estado en una línea

**La funcionalidad ya EXISTE de punta a punta y está EN PROD.** Desde una consulta se elige el
formato, se pre-llena del expediente, se corrige, se descarga borrador o final y se marca emitido.
El usuario la abrió en vivo y se ve bien; falta generar un informe completo y **mirar el PDF**.

| | |
|---|---|
| Tablas + columnas de póliza | ✅ **EN PROD** (`3bad4c32` + 2 deltas del review) |
| `pdf-lib` + `pdfjs-dist` declaradas | ✅ con `pnpm-lock.yaml` en el mismo commit |
| `src/lib/informe-medico/` (motor de PDF) | ✅ **EN PROD** (`df14d647`, build verde 2026-08-09) |
| **Paso 4 — pre-llenado determinista** | ✅ **EN PROD** (`10b62279`) |
| **Paso 5 — endpoints + pantalla** | ✅ **EN PROD** (`15764dce`) y abierto en vivo |
| Fila de AXA en `insurance_forms` | ✅ **EN PROD** (60 entradas de diccionario) |

### El push de `df14d647` — build verde (2026-08-09)

Era el primer commit que Railway sí iba a construir (dependencias nuevas + un endpoint vivo).
**Sólo se redesplegó `@healthcare/doctor`**, que es lo correcto: los otros tres servicios no
tocan nada de esto. `BUILDING` → `SUCCESS` en ~2 min, y la app responde.

⚠️ **Lo que el build verde NO prueba:** el `serverExternalPackages: ["pdfjs-dist"]` sólo importa
cuando algo llama a `add-fields.ts` en runtime, y **nada lo llama todavía** (no hay endpoints). Ese
riesgo está diferido, no descartado. Igual el 409 de borrar-consulta-con-informes: inalcanzable
mientras `medical_reports` tenga 0 filas.

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

## ✅ El motor ya vive EN EL REPO (2026-08-08)

`apps/doctor/src/lib/informe-medico/`, con `pdf-lib@^1.17.1` y `pdfjs-dist@^5.4.296` declaradas en
`apps/doctor/package.json` y `pnpm-lock.yaml` regenerado **en el mismo commit**.

> `pdfjs-dist` se fijó en la línea **5.x** —la que ya estaba en el store como transitiva de
> `pdf-parse`— y no en la 6.2.108 publicada: todo el código de medición está probado contra
> 5.4.296 y así no entra un segundo major al store.

| Módulo | Qué hace |
|---|---|
| `types.ts` | `AnswerOrigin` (conjunto CERRADO), `AnswerValue` con procedencia, `FieldDict` |
| `winansi.ts` | Qué caracteres NO puede imprimir el formato |
| `render-pdf.ts` | `renderFinal()` (llena + aplana) · `renderBorrador()` (dos capas + sólo lectura) |
| `add-fields.ts` | Ponerle campos a un formato PLANO (Allianz): reglas + etiqueta por vecindad |

`serverExternalPackages: ["pdfjs-dist"]` en `next.config.ts`: el "fake worker" hace un `import()`
dinámico de `pdf.worker.mjs` que el bundler no resuelve — funciona con `tsx` en local y truena con
`Cannot find module` en la ruta desplegada.

## 🔴 El `/code-review` del paso 1 — dos hallazgos CAROS y uno que venía mal

### 1. Cualquier `β`, `≥` o `→` tumbaba el informe ENTERO

`setText()` no falla; **falla `save()`**, y ahí se cae la generación completa, no un campo. Medido
contra el AXA oficial:

| Texto | |
|---|---|
| `Neumonía de Muñoz` · `dolor — intenso` · `dijo “me duele”` | ✅ pasa (los acentos SÍ son WinAnsi) |
| `HCG-β elevada` · `≥ 3 días` · `mejoría → alta` · `T ≈ 38°` | 🔴 **TRUENA** |

⇒ `winansi.ts` valida ANTES de escribir. **No se reescribe el texto del médico**: cambiar `β` por
"beta" en un documento firmado es peor que no imprimirlo. El campo se OMITE y se REPORTA con el
carácter culpable, para que la UI diga exactamente qué quitar:

```
omitido Tratamiento recibidoRow1 :: caracteres-no-imprimibles ["β","≥","→"]
```

### 2. 🔴 El `RESTRICT` que puse ROMPÍA borrar un paciente — y el arreglo del review tampoco servía

Probado contra prod dentro de una transacción con **rollback** (no quedó nada):

| `medical_reports.encounter_id` | Borrar CONSULTA con informe | Borrar PACIENTE |
|---|---|---|
| `RESTRICT` (lo que se shipeó) | ✅ bloquea | 🔴 **TRUENA** |
| `NO ACTION` (lo que sugirió el review) | ✅ bloquea | 🔴 **TRUENA IGUAL** |
| **`NO ACTION DEFERRABLE INITIALLY DEFERRED`** | ✅ bloquea (23503) | ✅ **funciona** |

Borrar un paciente dispara sus DOS cascades (a `clinical_encounters` y a `medical_reports`) en un
orden que no controlamos. Sin `DEFERRABLE`, la comprobación cae al final de la sentencia interna
del cascade y protesta aunque el informe se iba a borrar de todos modos. **Diferida se comprueba
hasta el COMMIT**, cuando ya no queda nada que apunte.

⚠️ Prisma no sabe expresar `DEFERRABLE` ⇒ es la **tercera** cosa que `db push` revertiría, junto con
la FK compuesta y el índice parcial. Las tres están comentadas en `schema.prisma`.

> 🔎 **Lección de método:** el review acertó el problema y falló el remedio. `NO ACTION` a secas
> no arregla nada aquí. Sin la prueba con rollback se habría "arreglado" y seguiría roto.
> Y mi PRIMERA corrida de esa prueba dijo "borrar la consulta PASÓ ❌" — era la prueba la que
> estaba rota (el parche no empató por un acento), no la restricción.

### Lo demás que salió del review

- Buffer de pdf.js **detached**: se transfiere al worker; ahora va una COPIA por llamada y se abre
  el PDF **una sola vez** con `destroy()` (antes: dos aperturas por página, todas sin cerrar).
- Widget sin `/P` ya no se pinta en la página 1 con coordenadas de OTRA página: se salta y se cuenta.
- "el campo no existe" ya no se confunde con "existe pero es una casilla".
- Un nombre de campo repetido ya no aborta el alta entera del formato.
- Borrar una consulta con informes devolvía **400 "referencia inválida"** — lo contrario de la
  verdad. Ahora es **409** con el número de informes que la bloquean.

## ✅ PASO 4 — el pre-llenado determinista (2026-08-09)

Tres módulos nuevos y una deuda vieja saldada. **Sin LLM y sin base de datos**: el pre-llenado es
una función pura, y por eso se pudo verificar campo por campo antes de que exista una pantalla.

| Archivo | Qué hace |
|---|---|
| `lib/edad.ts` | La edad, **UNA sola implementación** (antes 4, con 3 rotas — abajo) |
| `informe-medico/canonical.ts` | El canónico: **38** campos escalares + la lista de 10 medicamentos |
| `informe-medico/prefill.ts` | `construirPrefillDeterminista(entrada) → { answers, avisos }` |
| `informe-medico/dicts/axa.ts` | `campoCanónico → campo AcroForm` del AXA oficial |

### Verificado contra el PDF OFICIAL, no contra los docs

Los 27 nombres de campo del diccionario **se leyeron del PDF con pdf-lib**, no se copiaron de la
prosa de `04-MAPEO`. La corrida completa con un paciente realista:

| | |
|---|---|
| Campos canónicos con valor | **46** |
| Escritos en el AXA oficial | **27** · **0 omitidos** ⇒ los 27 nombres existen y son de texto |
| Tras `flatten()` | **0 campos vivos** |
| Acentos leídos de vuelta | ✅ `Muñoz` · `Peña` · `María de los Ángeles` · `Neumonía` |

Y el caso ESCASO (paciente con casi todo en NULL): **19 con valor, 59 en `empty`**, todos con
`value: ''` y `source: null`. Ningún fallo se disfrazó de vacío legítimo.

### 🔴 La edad estaba mal HOY, y el pre-llenado la habría copiado

`01-FUENTES` §2 decía que había 4 implementaciones y 3 con un bug de zona horaria. Se extrajo
`lib/edad.ts` y las cuatro apuntan ahí. Medido en esta máquina (UTC-6, 2026-08-09):

| Nacimiento | La vieja | La correcta |
|---|---|---|
| 1979-08-**10** (cumple MAÑANA) | **47** ❌ | **46** ✅ |
| 1979-08-09 · 1979-08-11 · 1980-05-15 | igual | igual |

⚠️ **Esto no era teórico: falla el día ANTERIOR al cumpleaños, y hoy es ese día para ese paciente.**
El arreglo también corrige la edad que ya se mostraba en el perfil del paciente, el timeline, las
tarjetas y el PDF de receta — las tres copias malas vivían ahí.

### Cuatro decisiones que quedaron tomadas en el código

1. **`Talla` sale en `cm`, no en `m`.** Todo el repo guarda `vitalsHeight` en centímetros
   (`VitalsInput`, el prompt de voz, el PDF de consulta). El `1.62 m` de la prueba del 2026-08-08
   era dato tecleado a mano, no del expediente: el pre-llenado escribe `162 cm`.
2. **`plan` NO va a `Tratamiento recibidoRow1`.** Ese renglón es tratamiento **pasado**; `plan` es
   el propuesto. Va a `Tratamiento propuesto quirúrgico no quirúrgico`.
3. **La cédula de especialidad se queda VACÍA si no se puede saber cuál rige.** Se descarta la
   entrada de "médico general" (ésa es la profesional, y repetirla haría que el informe declare la
   misma cédula dos veces) y, con varias especialidades, sólo se llena si una empata con
   `primarySpecialty`. "La primera" sería inventar cuál ejerce en este caso.
4. **Partir el apellido emite un AVISO**, siempre. Es una heurística (`de la Cruz`,
   `Ponce de León`) y el doctor tiene que verla. El `source` dice que viene de una heurística pero
   el `origin` sigue siendo `deterministic`: el conjunto está CERRADO en tres lugares ya shipeados.

Los `avisos` son un canal aparte de las respuestas — `medicamentos-truncados` (más de 10 recetados),
`apellido-heuristico`, `apellido-unico`, `sexo-desconocido`. Sin ellos el informe sale corto y se
ve completo.

### 🔴 El `/code-review` del paso 4 — la fecha estaba mal por la MISMA razón que la edad

Seis hallazgos reales, todos arreglados y verificados. El caro es el primero:

**1. `consulta.fecha` y la fecha de emisión salían en UTC.** `toISOString()` toma el día **UTC**, y
`ClinicalEncounter.encounterDate` **no es `@db.Date`: es un timestamp con hora.** Medido:

| Consulta | Lo que escribía | Correcto |
|---|---|---|
| 2026-08-09 **18:30** en CDMX (UTC-6) | **10/08/2026** ❌ | 09/08/2026 |
| 2026-08-09 09:00 | 09/08/2026 | 09/08/2026 |

Una consulta de las 6 de la tarde salía fechada **al día siguiente**, en el campo que la aseguradora
cruza contra la fecha del siniestro. Es **la misma clase de bug de zona horaria** que acabábamos de
extirpar de la edad, reintroducida en el mismo archivo el mismo día.

⇒ Ahora son **dos** helpers, y la diferencia es del esquema, no de gusto:
`fechaCalendario()` lee componentes **UTC** (para `@db.Date`, que Prisma devuelve a medianoche UTC)
y `fechaMomento()` lee componentes **locales** (para timestamps y para el "hoy" de la emisión).
Un `YYYY-MM-DD` pelón se trata como día calendario: `new Date('2026-08-05')` sería el día 4 en local.

**2–5. En el motor que ya está en prod** (`df14d647`), tres de ellos con el mismo patrón — algo
falla y se reporta como un vacío legítimo:

- **El borrador podía salir SIN PINTAR NADA.** `/P` es **opcional** en el spec del PDF y muchos
  generadores no lo ponen; sin él no se resolvía la página y el widget se saltaba. Un formato de
  277 campos habría dado un borrador "exitoso" con **cero recuadros** y un contador que ninguna UI
  lee. Ahora cae al `findPageForAnnotationRef()` — que es justo lo que hace `flatten()` por dentro,
  y por eso el FINAL sí funcionaba en esos PDFs.
- **Las 45 casillas de AXA se pintaban de AZUL** ("aquí se puede escribir") aunque estuvieran
  marcadas: sólo los campos de texto tienen `getText()`. Ahora cada tipo se pregunta por lo suyo
  (`isChecked()`, `getSelected()`).
- **El tracker de la matriz ignoraba los Form XObject.** pdf.js emite `paintFormXObjectBegin` con
  la `/Matrix` como operador **aparte**, no como `save` + `transform`. Un formato que envuelva su
  contenido en un XObject no sólo sacaba mal las reglas de dentro: dejaba la **pila desbalanceada**
  y corría el resto de la página. Allianz no lo trae y por eso no mordió.
- **`sinEtiqueta` contaba de más**: incluía las reglas cuyo `createTextField` reventó (que ya van
  en `noCreados`), inflando el número que la pantalla de revisión usa para decir cuánto hay que
  etiquetar a mano.

**6.** Este mismo doc decía "40 campos escalares" y son **38**.

**Regresión verificada tras los arreglos:** Allianz da **exactamente** los mismos números de antes
(61 reglas → 56 campos, 43 por la izquierda + 13 por arriba, 5 sin etiqueta, 0 no creados) y AXA
sigue en **0 omitidos** con `widgetsSinPagina: 0`.

> 🔎 **Lección:** `lib/edad.ts` se extrajo *para* matar un bug de zona horaria, y el pre-llenado
> que lo usaba metió otro igual tres funciones más abajo. Saber del bug no basta: lo que separa
> los dos casos es **si la columna es `@db.Date` o un timestamp**, y eso hay que mirarlo en el
> esquema cada vez.

### ⚠️ Lo que falta antes de creerle a esto

- **El CLIC.** Nadie ha abierto `Downloads/axa-PREFILL.pdf`. Que los 27 campos existan y se
  escriban **no prueba que sean los correctos**: `Nombre` (campo 217, entre `Tipo de participación`
  y `Especialidad`) se mapeó al médico por su posición en el bloque, y eso hay que verlo.
- **No hay fila en `insurance_forms`.** El diccionario de AXA vive en el repo porque todavía no
  existe la pantalla de alta; su lugar definitivo es `field_dict`.
- **Nada llama a esto.** Sigue sin haber endpoint ni pantalla (paso 5).

## ✅ PASO 5 — endpoint + pantalla (2026-08-09)

**Un doctor ya puede llegar.** Desde una consulta: botón *Informe* → elegir formato → pre-llenado →
corregir → descargar borrador/final → marcar emitido.

| | |
|---|---|
| `GET /api/medical-records/insurance-forms` | el dropdown |
| `GET·POST /patients/:id/reports` | crear corre el pre-llenado y lo GUARDA |
| `GET·PATCH /patients/:id/reports/:reportId` | leer · corregir · consentimiento · emitir |
| `GET …/pdf?tipo=borrador\|final` | render |
| `…/encounters/[encounterId]/informe` | la pantalla |

Todo cuelga de `/api/medical-records/*`, así que **hereda el permiso `expedientes`** sin tocar el
mapa de rutas — el `gate:routes` confirma 243/243 rutas cubiertas.

### Las decisiones del paso 5

1. **El PDF base vive en `public/formatos/`** (única carpeta que se despliega con garantía) y se lee
   con `fs`, nunca por HTTP. Es la hoja EN BLANCO que AXA ya publica: no es PHI.
2. **La fila de `insurance_forms` manda sobre el diccionario**; el del repo es la semilla y sólo se
   usa si la fila trae `{}`. Una sola regla: dos diccionarios "prefiriendo el que se vea mejor" es
   cómo divergen en silencio.
3. **Vaciar un campo guarda `empty`, no `""`.** "No hay dato" y "lo borré a propósito" siguen siendo
   cosas distintas de punta a punta.
4. **El cliente sólo puede escribir `origin: 'manual'` o `'empty'`.** Si pudiera declarar
   `deterministic`, se borraría la diferencia entre "lo copió el sistema" y "lo tecleó alguien".
5. **Un informe emitido no se edita** (409); se genera uno nuevo. La aseguradora ya tiene su copia.
6. **El FINAL no se genera sin consentimiento** registrado (LFPDPPP). El borrador sí: no sale del
   consultorio.
7. **Un formato que la BD conoce y este build no sabe generar no se ofrece** y se rechaza con 409.

### ✅ La fila de AXA, EN PROD

Corrida con `prisma db execute` vía `railway run --service pgvector`. El `.sql` está **generado**
desde `dicts/axa.ts`, no tecleado: 60 entradas y una errata silenciosa deja campos sin llenar en un
PDF que se ve bien.

Verificado **sin confiar en el "Script executed successfully"**: 1 fila, `is_active`, 60 entradas de
`field_dict`, acentos intactos (`Información general`, `GMM Informe Médico`), y el diccionario de
prod **idéntico byte a byte** al del repo (60/60 claves) — que importa porque el render prefiere el
de la BD.

### 🔴 El `/code-review` del paso 5 — DOS de mis arreglos anteriores eran FALSOS

Nueve hallazgos. Los dos primeros son la lección:

1. **El fallback de `/P` no hacía nada.** `findPageForAnnotationRef` devuelve una **`PDFPage`**, no
   una `PDFRef`; se asignó a `pageRef` y se comparó contra `p.ref` ⇒ **siempre falso**. TypeScript
   no lo vio porque la unión se traslapa. El arreglo que se reportó como hecho era decorativo.
2. **La matriz del Form XObject tampoco se aplicaba.** pdf.js la manda como **`Float32Array`**, así
   que `Array.isArray()` daba `false`. Se había arreglado el balanceo de la pila y dejado roto justo
   lo que se venía a arreglar.

> 🔎 **Lección:** *"lo arreglé, type-check y gates en verde"* no dice nada sobre si el arreglo
> **corre**. Los dos eran no-ops silenciosos. Un arreglo que no se puede observar ejecutándose —
> aunque sea con un `console.log` o un conteo— no está verificado.

**Y un hallazgo del review estaba MAL:** decía que el helper de pdf-lib devuelve la primera página
con `/Annots` porque `indexOf` da `-1`. **No:** el `PDFArray.indexOf` de pdf-lib devuelve
`undefined` cuando no está, así que la comprobación es correcta. Medido sobre los 277 campos de
AXA: **304/304 widgets a su página correcta.** Se delegó en el helper en vez de reescribirlo.

Los otros siete, todos arreglados:

- **Las recetas en `draft` se declaraban a la aseguradora** como el tratamiento del paciente
  (`status` viene por default en `draft`). Ahora sólo `issued` + `expired` — la vencida SÍ fue el
  tratamiento; que hoy esté vencida no la borra de la historia.
- **La pantalla se quedaba con `campos` viejos tras un PATCH:** el chip seguía diciendo "del
  expediente" sobre algo tecleado a mano, y teclear `A→B→A` **no mandaba el PATCH** de vuelta,
  dejando **`B`** en el servidor. Ahora relee y los inputs son controlados.
- **Callejón sin salida tras emitir:** 409 al editar y ningún camino a generar otro. Ahora lo hay.
- **Los avisos se perdían al recargar** — ahora se RECALCULAN en el GET.
- **Una fecha mal formada salía como `"NaN/NaN/NaN"` marcada `deterministic`.** Ahora cae a `empty`.
- **El campo de la FECHA del encabezado de AXA se llama `Información general`** (el generador le
  agarró la etiqueta equivocada). Confirmado por geometría: x=307,y=587, junto a `Lugar`
  (x=35,y=586). Sin esto **todo informe de AXA salía con la fecha del encabezado en blanco**.

Regresión tras los arreglos: AXA **0 omitidos** y `widgetsSinPagina: 0`; Allianz igual que siempre
(61 reglas → 56 campos, 5 sin etiqueta, 0 no creados).

### ✅ Desplegado y CLICKEADO (2026-08-09)

`15764dce` → **SUCCESS**, y **sólo se movió `@healthcare/doctor`** (los otros tres servicios no
tocan nada de esto). El usuario lo abrió en vivo: ***"apparently all gud"*.**

Verificado DENTRO del contenedor, que era el riesgo abierto del paso 5 (¿se despliega el PDF base?):

```
-rw-rw-r-- 330612  /app/apps/doctor/public/formatos/axa-gmm-informe-medico-2022-02.pdf
pid=29  cwd=/app/apps/doctor  next-server (v16.0.10)
```

El archivo está completo y `next-server` corre con cwd `/app/apps/doctor`, que es contra lo que
resuelve el `path.join(process.cwd(), 'public', 'formatos', …)` de `leerPdfBase`.

> ⚠️ **PID 1 es `pnpm` y su cwd es `/app`.** Si se hubiera mirado el proceso de arriba, la ruta
> habría parecido equivocada. Hay que mirar el proceso de `next-server`, no el de arranque.

🔎 **Corrección a lo que decía este doc:** el PDF en blanco **NO** queda públicamente descargable.
El middleware redirige `/formatos/*` a `/login` como todo lo demás.

### ⚠️ Lo que el clic NO cubre

*"Apparently all gud"* dice que la pantalla abre y se ve bien. **No** confirma, salvo que se haya
probado a propósito:

| | |
|---|---|
| Descargar el **borrador** y mirarlo | ⬜ por confirmar |
| Marcar consentimiento → descargar el **FINAL** | ⬜ por confirmar |
| Que el encabezado de AXA salga con `Lugar` **y** fecha (el arreglo de hoy) | ⬜ por confirmar |
| Corregir un campo y ver que el chip pase a "lo escribiste tú" | ⬜ por confirmar |
| El **409 de borrar una consulta con informes** | ⬜ sigue inalcanzable hasta que exista una fila |

⇒ Antes de considerarlo cerrado, generar UN informe completo de punta a punta y abrir el PDF.

## ✅ EL VISOR — el formato de AXA con las cajas encima (2026-08-09)

Pedido del usuario después de ver el paso 5: *"instead of just the fields opening in our format, I
was hoping the PDF like format from AXA opens with the fields already inputted… and that they were
have the colors there."*

Tenía razón: la lista de campos carga el mismo dato pero pierde lo que lo hace obvio — **ver la
hoja llenarse**. Y es justo lo que `02-PLAN` §4b anticipaba al decir *"se edita en la app, ahí el
color SÍ es vivo"*: la regla de "el borrador es de sólo lectura" era sobre el **archivo
descargado**, no sobre un editor dentro de la app.

### Cómo funciona

La página del PDF se pinta en un `<canvas>` con pdf.js y encima van `<input>`s absolutos, uno por
campo del diccionario. **Se teclea en HTML, nunca en el PDF**: el valor va al mismo JSON de
respuestas, así que el visor y la lista son dos caras del mismo dato. Los colores por fin están
vivos porque son CSS: escribir en una caja azul la pone azul-cielo al instante.

| | |
|---|---|
| 🟦 azul | vacío — puedes escribir |
| 🟩 verde | vino del expediente |
| 🟦 azul cielo | lo escribiste tú |
| 🟧 ámbar | lo redactó la IA (paso 6) |

Piezas nuevas: `GET /insurance-forms/:formId/pdf` (la hoja en blanco), `GET …/geometria` (dónde cae
cada campo), `InformeVisor.tsx`, y pestañas **Formato** / **Lista de campos** — la lista se queda de
red por si el render falla en algún navegador.

**El worker de pdf.js se copia a `public/pdfjs/` en `prebuild`** (`scripts/copy-pdf-worker.mjs`) en
vez de dejárselo al bundler: ese import dinámico es exactamente lo que ya tronó una vez en la ruta
desplegada. El archivo también va commiteado, por si el `prebuild` no corriera.

### La geometría, verificada antes de dibujar nada

```
páginas: 6 × 609×794 · cajas ubicadas: 60 · sin ubicar: 0 · fuera de la hoja: 0
informe.lugar  p1 pdf(35,586)  -> css(left=35,  top=195)
informe.fecha  p1 pdf(307,587) -> css(left=307, top=193)
```

Que esos dos queden lado a lado en el encabezado es LA prueba de que el volteo de coordenadas
(PDF mide desde abajo-izquierda, CSS desde arriba-izquierda) está bien: si estuviera invertido
caerían hasta abajo de la hoja.

⚠️ Las 60 cajas caen en las páginas 1, 2, 3 y 5. **Las páginas 4 y 6 se ven sin cajas** — es
correcto (se mapean 60 de los 277 campos de AXA), pero parece vacío.

### 🔴 El `/code-review` del visor — habrías abierto 6 hojas EN BLANCO

Cinco hallazgos, y el primero era un bloqueador garantizado en cada montaje:

**`cargando` tapaba los `<canvas>`.** El return temprano no los montaba, así que cuando corría el
efecto de render los 6 se saltaban por `if (!canvas) continue`; luego `cargando` pasaba a false, los
lienzos aparecían — y el efecto ya no volvía a correr. **Seis páginas blancas con las cajas flotando
encima, y tocar el zoom "arreglaba" la hoja.** Ahora la guarda es `!geo`.

> 🔎 **Tercera vez hoy con la misma forma:** el código correcto en sí mismo, equivocado sobre
> CUÁNDO corre. Type-check, los 5 gates y un `next build` verde pasaron por encima de los tres.

Los otros cuatro:

- **Un guardado fallido tiraba lo tecleado**: `guardarCampo` resolvía normal con `!r.ok`, así que la
  caja se revertía al valor viejo con el aviso hasta arriba de una hoja de 6 páginas. Ahora devuelve
  un booleano y el borrador sobrevive al fallo.
- **Las casillas se descartaban en silencio** — rompiendo justo la invariante que `sinUbicar`
  existe para sostener. Hoy es latente (AXA mapea 0), pero se dispara en cuanto se edite un
  `field_dict` en la BD, que es el camino de "corregir un mapeo sin desplegar" que el diseño ofrece.
- **El volteo asume MediaBox en el origen y sin rotación**, pero pdf.js arma su viewport con el
  **CropBox** y aplica `/Rotate`. Un formato rotado pondría TODAS las cajas mal, sin ningún error.
  Ahora se detecta y no se dibuja nada: mejor mandar a la lista que enseñar cajas convincentes en el
  renglón equivocado de un documento médico-legal. (AXA y Allianz: rot 0 en todas sus páginas.)
- **A 250% × dpr 2 las 6 páginas piden ~290MB de lienzo**; Safari tira el backing store y las
  páginas se ponen blancas — idéntico al síntoma del bloqueador. `escala × dpr` queda acotado.

## Lo siguiente

**Pasos 0 · 1 · 2 · 4 · 5: ✅** · **Allianz: ✅** · **Borrador: ✅** · **Motor: ✅ EN PROD**

- 🔴 **Abrir el VISOR y ver si las cajas caen en su raya.** La geometría cuadra en números
  (60/60, nada fuera de la hoja), pero que los números cuadren no es que se vea bien al 130% en un
  navegador. Es lo único que no se puede verificar desde aquí.
- 🔴 **Un informe COMPLETO de punta a punta**: corregir un campo, bajar el borrador, dar
  consentimiento, bajar el final y **mirar el PDF** (¿sale el encabezado con `Lugar` y fecha?).
- **Las casillas** de AXA (45) — hoy el visor las ubica pero no las dibuja.
- **El chat con el LLM** que pidió el usuario: propone valores, caen en el mismo JSON y se prenden
  en ÁMBAR sobre la hoja para que el doctor confirme. Es el paso 6, y encaja sin rediseñar nada.
- **Paso 3** — el diccionario de GNP (`P1_7`, cero semántica). ⚠️ Antes hay que resolver la
  pregunta abierta #0: **cuál formato de GNP rige**, el de Eleonor (3 pág) o el oficial (2 pág).
- **Paso 6** (LLM sobre `customData`) y **paso 7** (link con token al paciente).

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
