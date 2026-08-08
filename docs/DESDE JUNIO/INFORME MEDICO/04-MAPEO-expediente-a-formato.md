# 04 — MAPEO: del expediente a los campos del formato

> Tipo **CONTRATO**. Escrito el **2026-08-08** leyendo los campos REALES de los 3 formatos
> oficiales y el esquema REAL de la base. Nada implementado todavía.
> De dónde sale cada dato: [`01-FUENTES`](01-FUENTES-de-donde-sale-cada-campo.md).

## 1. 🔴 No se mapea expediente → formato. Se mapea con un CANÓNICO en medio

La tentación es escribir "para AXA, `Apellido paterno` sale de `patient.lastName`". Con 3 formatos
son 3 mapeos; con 20 son 20, cada uno tocando el esquema de la base. Y cuando cambie una columna
del expediente hay que corregir los 20.

**Los tres formatos preguntan casi lo mismo con nombres distintos:**

| Concepto | AXA | GNP | Allianz (campos que le pusimos) |
|---|---|---|---|
| Apellido paterno | `Apellido paterno` | `Apellido paterno` | `p1_Apellido_Paterno` |
| Apellido materno | `Apellido materno` | `Apellido materno` | `p1_Apellido_Materno` |
| Nombre(s) | `Nombres` | `Nombre` | `p1_Nombres` |
| Edad | `Edad` | `Edad` | `p1_Edad` |
| Talla | `Talla` | — | `p2_Talla` |
| Peso | `Peso` | — | `p2_Peso` |
| Tensión arterial | `Tensión arterial` | — | `p2_TA` |
| Antecedentes gineco-obstétricos | (sección) | `Antecedentes gineco-obstétricos` | `p1_FUM`, `p1_No_de_Embarazos`, `p1_Partos`, `p1_Cesareas`, `p1_Abortos` |
| Antecedentes perinatales | `Antecedentes perinatales…Row1` | `Antecedentes perinatales` | `p1_Antecedentes_Perinatales` |
| Exploración física | `Señale los datos relevantes de exploración física` | — | `p2_Senale_los_datos_relevantes_de_la_exploracio` |
| Complicaciones | `Se presentaron complicaciones…` | `Descripción de complicaciones` | `p2_Descripcion_de_las_complicaciones` |
| Hospital | `En caso de haber seleccionado Hospital indique el nombre` | `Hospital` | `p2_Nombre_del_Hospital` |
| Ciudad | — | `Ciudad` | `p2_Ciudad` |
| Especialidad del médico | — | `Especialidad` | `p2_Especialidad` |
| Cédula profesional | — | `Cédula profesional` | `p2_Cedula_Profesional` |
| Teléfono del médico | — | `Teléfono Médico` | `p2_Telefono` |
| Correo del médico | — | `Correo del Médico` | `p2_E-mail` |

⇒ **Un esquema canónico en medio**, y dos mapeos chicos:

```
expediente ──(1 mapeo, con lógica)──▶ CANÓNICO ──(1 diccionario tonto por formato)──▶ PDF
```

El primero es código y se escribe **una vez**. El segundo es una tabla de
`campoCanonico → nombreDeCampoDelPDF`, sin lógica, y vive en `insurance_forms.field_dict` junto al
PDF. Agregar una aseguradora nueva = escribir un diccionario, **no tocar código**.

### ⚠️ Pero el canónico NO cubre todo: el modelo es HÍBRIDO

Meter *todos* los campos al canónico tiene dos problemas reales:

1. **🔴 Equivalencias falsas.** Medido en los formatos:
   - **AXA** pide `DiagnósticoRow1..Row10` — una **lista** de 10 diagnósticos, cada uno con su
     fecha y su tratamiento.
   - **GNP** pide `Diagnóstico Definitivo` — **uno solo**, y aparte `Padecimiento relacionado` y
     `Resultado del estudio`.

   Un `clinico.diagnostico` canónico obliga a truncar la lista de AXA o a inflar el escalar de
   GNP. **No son el mismo concepto clínico**, y afirmar que sí lo son en un documento que firma un
   médico es la clase de error silencioso que no se detecta hasta que lo rechazan.
2. **El canónico se infla.** Cada aseguradora aporta campos que nadie más pide (TNM, CPT,
   presupuesto, radio localizador). A 20 aseguradoras queda un objeto-Dios donde casi todo es null.

**Decisión (2026-08-08): híbrido.**

| Capa | Qué vive ahí | Por qué |
|---|---|---|
| **Núcleo canónico** | Identidad, demografía, signos vitales, datos del médico, hospital | `Talla` es `Talla` en todos lados. Cero ambigüedad, y es **el grueso del auto-llenado** |
| **Campos propios del formato** | Estructuras de diagnóstico, preguntas específicas, casillas | Viven **sólo** en el diccionario de ese formato. Se llenan a mano o con LLM contra la redacción de ESE formato |

💡 **El corte cae casi exactamente sobre la línea de
[`01-FUENTES`](01-FUENTES-de-donde-sale-cada-campo.md):** el núcleo canónico es lo
**determinista** y los campos propios son lo **interpretado**. Que los dos criterios —uno de
arquitectura, otro de confiabilidad del dato— den la misma frontera es señal de que la costura es
real y no inventada.

## 2. El canónico ← el expediente (fuentes deterministas)

Todo esto es copia directa. **Sin LLM** ([`01-FUENTES`](01-FUENTES-de-donde-sale-cada-campo.md) §3).

| Campo canónico | Sale de | Nota |
|---|---|---|
| `paciente.apellidoPaterno` / `apellidoMaterno` | `Patient.lastName` | ⚠️ **Está en UNA sola columna.** Ver §4 |
| `paciente.nombres` | `Patient.firstName` | |
| `paciente.fechaNacimiento` | `Patient.dateOfBirth` | |
| `paciente.edad` | calculada de `dateOfBirth` | 🔴 **Usar `calcAge` de `encounter-pdf.ts`.** Las otras 3 copias tienen un bug de zona horaria — [`01-FUENTES`](01-FUENTES-de-donde-sale-cada-campo.md) §2 |
| `paciente.sexo` | `Patient.sex` | `male/female/other` → `Masculino/Femenino` |
| `paciente.telefono` / `email` / `domicilio` | `Patient.phone` / `email` / `address`+`city`+`state` | |
| `paciente.rfc` | `Patient.rfc` | |
| `antecedentes.patologicos` | `Patient.currentChronicConditions` | |
| `antecedentes.alergias` | `Patient.currentAllergies` | |
| `antecedentes.medicacionHabitual` | `Patient.currentMedications` | |
| `paciente.tipoSangre` | `Patient.bloodType` | |
| `consulta.fecha` | `ClinicalEncounter.encounterDate` | |
| `consulta.motivo` | `ClinicalEncounter.chiefComplaint` | |
| `vitales.talla` | `ClinicalEncounter.vitalsHeight` | |
| `vitales.peso` | `ClinicalEncounter.vitalsWeight` | |
| `vitales.tensionArterial` | `ClinicalEncounter.vitalsBloodPressure` | |
| `clinico.padecimientoActual` | `ClinicalEncounter.subjective` | SOAP, nullable |
| `clinico.exploracionFisica` | `ClinicalEncounter.objective` | SOAP, nullable |
| `clinico.diagnostico` | `ClinicalEncounter.assessment` | SOAP, nullable. **Texto libre, no CIE-10** |
| `clinico.tratamiento` | `ClinicalEncounter.plan` | SOAP, nullable |
| `medicamentos[]` | `Prescription.medications` | Alimenta la tabla de 10 renglones de AXA |
| `medico.nombre` | `Doctor.doctorFullName` | |
| `medico.especialidad` | `Doctor.primarySpecialty` | |
| `medico.cedulaProfesional` | `Doctor.cedulaProfesional` | |
| `medico.cedulaEspecialidad` | `Doctor.prescriptionCredentials` (JSON `[{titulo, cedula}]`) | GNP pide las dos por separado |
| `medico.telefono` | `Doctor.clinicPhone` | |
| `medico.email` | `Doctor.user.email` | |
| ~~`hospital.nombre` / `ciudad`~~ | — | 🔴 **NO es determinista: no hay camino.** Ver §3 |

## 3. 🔴 Lo que NO podemos llenar — y hay que decirlo antes de construir

| Campo que piden | Quién | Estado |
|---|---|---|
| ~~**`No de Póliza`**~~ | **GNP** | ✅ **RESUELTO 2026-08-08** — `patients.numero_poliza` + `poliza_aseguradora` **ya están en prod** |
| `Código ICD` (CIE-10) | GNP, AXA | 🔴 No existe. `assessment` es texto libre |
| `CPT` | GNP | 🔴 No existe |
| `Estadificación TNM` | AXA | 🔴 No existe (oncología) |
| `Presupuesto` | GNP | 🔴 No existe |
| `Cédula Especialidad` | GNP | 🟡 Quizá, si `prescriptionCredentials` está lleno |
| Nombre del hospital / ciudad | los 3 | 🔴 **No alcanzable.** Ver abajo |

### 🔴 El hospital no es alcanzable desde el informe

La tabla de §2 decía que `hospital.nombre`/`ciudad` salían del `ClinicLocation` de la cita.
**Es falso, por tres razones encadenadas** (verificado en el schema):

1. `MedicalReport` sólo enlaza `patientId` y `encounterId`. **No hay `bookingId`.**
2. `ClinicalEncounter` **no tiene `locationId` ni `bookingId`** — sólo `location String? VarChar(100)`,
   texto libre ("clinic name or online").
3. `ClinicLocation` tiene `name` y `address`, pero **no tiene columna `city`**: la ciudad habría que
   sacarla parseando `address`.

Y aunque existiera el camino: `bookings.location_id` se agregó apenas el 2026-08-06 y **el backfill
se descartó**, así que está NULL en las citas viejas.

⇒ **El hospital se teclea en el informe** (o se agrega al modelo más adelante). Además, hospital y
consultorio **no son lo mismo**: la cirugía se hace en un hospital que puede no ser ninguna de las
sedes del doctor.

### ✅ La póliza — resuelto el 2026-08-08

GNP exige el número de póliza y **no existía en ninguna tabla**. Sin él el informe se rechaza: es
el dato con el que la aseguradora encuentra al asegurado.

No es dato del doctor: **lo trae el paciente**. Se eligió la opción 1 de tres:

1. ✅ **Columna en `Patient`** — se captura **una vez** y sirve para todos los informes futuros de
   ese paciente. Es como opera un consultorio real.
2. ❌ Campo del informe, se teclea cada vez. Barato pero se re-teclea siempre.
3. ❌ Pedírsela al paciente por el link con token. Lo más correcto, lo más lento.

**En prod desde el 2026-08-08:** `patients.numero_poliza VARCHAR(60)` y
`patients.poliza_aseguradora VARCHAR(100)`, las dos **nullable** (`NULL` = no registrado). Las 198
filas existentes quedaron intactas. Falta la UI que las capture.

⚠️ **Los campos de §3 se quedan VACÍOS y marcados**, nunca adivinados
([`01-FUENTES`](01-FUENTES-de-donde-sale-cada-campo.md) §4). Un CIE-10 inventado por un LLM en un
documento médico-legal es exactamente el peor caso posible.

## 4. Cuatro problemas de forma que hay que resolver en el canónico

### a) El apellido viene junto y los formatos lo piden partido

`Patient` guarda `firstName` + `lastName`. **Los tres formatos piden apellido paterno y materno por
separado.** Partir `lastName` por el espacio es una heurística que falla con `de la Cruz`,
`Ponce de León`, apellidos compuestos, y con pacientes extranjeros con un solo apellido.

**Propuesta:** el canónico parte por el último espacio como *propuesta* y el doctor la ve y la
corrige. **No** partirlo en silencio.

⚠️ **Se marca `origin: "deterministic"` con un `source` que dice que viene de una heurística** —
NO se inventa un `origin: "derived"`. El conjunto de `origin` está cerrado en tres lugares que ya
shipearon (01-FUENTES §4, el comentario del `.sql` y el de `MedicalReport.answers`):
`deterministic | llm | voice | manual | empty`. Agregar un sexto valor aquí rompería cualquier
`switch` de la UI en silencio.

> 💡 A futuro conviene columnas separadas en `Patient`, pero eso es una migración con backfill de
> pacientes existentes — fuera de v1.

### b) Fechas partidas en DD / MM / AAAA

AXA y Allianz tienen casillas separadas (`Día`, y en Allianz reglas bajo `DD`, `MM`, `AAAA`). El
canónico guarda **una fecha**; el diccionario del formato dice cómo se parte.

### c) Tablas que se repiten

- **AXA:** `DiagnósticoRow1..Row10` + `Fecha de diagnóstico…Row1..10` + `Tratamiento recibidoRow1..10`,
  y una tabla de **10 medicamentos** (`Nombre y presentación…1..10`, `Cantidad…`, `Cada cuánto…`,
  `Durante cuánto tiempo…`).
- **GNP:** **3 bloques de médico** (`…del médico`, `_2`, `_3`).

⇒ El canónico necesita **listas**, y el diccionario un patrón tipo `Diagnóstico{Row:1-10}`.
La tabla de medicamentos de AXA mapea muy bien contra `Prescription.medications`.

### d) Casillas (checkbox)

Los 3 formatos las tienen y muchas son parejas `Sí`/`No` con nombres inservibles (`Si_3`, `No_4`).

⚠️ **Los conteos que había aquí (Allianz 33 · AXA 45 · GNP 43) estaban medidos sobre los PDFs de
ELEONOR, que [`03-FORMATOS`](03-FORMATOS-procedencia-y-versiones.md) descarta.** Sobre los
OFICIALES: AXA trae 45 casillas de 277 campos, y el Allianz oficial **no trae ninguna** (es plano;
los 56 campos que le pusimos son todos de texto). Falta medirlas en los oficiales antes de
dimensionar este trabajo. **Se dejan para después de los campos de texto**: son las que más
trabajo de diccionario piden y las menos automatizables.

## 5. Por dónde empezar

Con lo determinista de §2 sobre **AXA** ya se llena una parte útil sin una línea de LLM:
`Apellido paterno`, `Apellido materno`, `Nombres`, `Edad`, `Talla`, `Peso`, `Tensión arterial`,
`Lugar`, y la primera fila de diagnóstico.

Ese es el paso 4 de [`02-PLAN`](02-PLAN-el-formato-y-los-pasos.md) §6, y **no depende de la BD**:
se puede escribir y probar contra el PDF antes de crear una sola tabla.

## 6. Abierto

| # | Pregunta |
|---|---|
| ~~1~~ | ~~¿Dónde va el número de póliza?~~ **RESUELTO 2026-08-08: columnas en `patients`, ya en prod** (§3) |
| 2 | ¿Se agrega CIE-10 al expediente algún día, o siempre se teclea en el informe? |
| 3 | Hospital ≠ consultorio: ¿se captura en el informe o se agrega al modelo? |
| 4 | ¿Partimos `lastName` en dos columnas de `Patient` (migración + backfill) o vivimos con la heurística? |
