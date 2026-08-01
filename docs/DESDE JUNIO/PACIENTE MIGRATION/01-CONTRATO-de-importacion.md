# 00 — Contrato de importación de pacientes

> **Qué es.** El inventario COMPLETO de lo que se puede importar, con su tipo, su límite y su
> validación. Es la referencia para generar la plantilla que descarga el doctor (o el admin) y
> para escribir el validador. Estado: **diseño, nada construido.**

## La decisión de fondo

Tres destinos, no dos:

| Qué | A dónde | Por qué |
|---|---|---|
| Datos personales | Columnas reales de `Patient` | Son estables entre doctores |
| Historia clínica | **`ClinicalEncounter`** con su fecha real | Conserva la CRONOLOGÍA |
| Recetas del sistema viejo | Texto dentro del encuentro | **Nunca** filas de `Prescription` |

**Por qué la historia clínica NO va a `PatientNote`:** `PatientNote` es `content` + `createdAt`
y nada más — **no tiene fecha del evento**. Toda la historia migrada colapsaría a "hoy" y la
línea de tiempo (que la home anuncia como *"exportable a PDF"*) no mostraría nada anterior al
día de la migración. Además `PatientNote` es la nota **privada** del doctor, "separada de lo
que ve el paciente": el expediente del paciente no es una nota privada.

**Por qué las recetas NO van a `Prescription`:** ese modelo copia `doctorFullName`,
`doctorLicense`, `doctorSignature` y `doctorCredentials` *"at time of issuance **for legal
integrity**"*. Crear esas filas para recetas emitidas en papel en otro lado **fabrica un acto
de emisión que nunca ocurrió aquí**, con una firma adjunta. Van como texto histórico.

**Por qué NO una columna por input de plantilla:** cada doctor tiene plantillas distintas, y
las cambia con el tiempo — las consultas del año pasado tienen campos distintos a las de este
año. **No existe un conjunto de columnas estable al cual migrar, nunca.**

---

## ⚠️ Hallazgo que cambia el diseño (verificado en el código)

La idea de marcar los registros migrados con `customData = { _imported: true, batchId, … }`
**no funciona.** Poner *cualquier cosa* en `customData` tiene dos efectos colaterales:

| Archivo | Línea | Efecto |
|---|---|---|
| `EncounterCard.tsx` | `isCustom = !!(templateId \|\| customData)` | La descripción de la tarjeta pasa a salir del **primer valor string de `customData`** |
| `encounters/[encounterId]/page.tsx` | `!(templateId \|\| customData) && chiefComplaint` | **Deja de mostrarse el Motivo de Consulta** |

Es decir: con ese marcador, **cada consulta migrada se listaría con el nombre del archivo de
importación como descripción**, y se ocultaría el motivo. 

**Lo que sí es seguro:**

- `clinicalNotes` se renderiza **sin condición** — es el destino seguro del texto.
- `customData` **sí** tiene fallback sin plantilla: `Object.entries()` pinta la clave como
  etiqueta. O sea, claves arbitrarias se ven bien **si están en español y ordenadas**.

**Regla que sale de esto:**

1. Si no hay campos estructurados que preservar → **no se toca `customData`**. Así el motivo se
   ve y la tarjeta se describe sola.
2. Si sí los hay → la **primera** clave del objeto debe ser la más descriptiva de la visita,
   porque es la que se convierte en el título de la tarjeta.
3. La **procedencia no va en `customData`**: va como encabezado dentro de `clinicalNotes` y,
   como registro autoritativo, en `PatientAuditLog.changes`.

---

## Hoja 1 — `PACIENTES`

Una fila por paciente. **`id_paciente` es la llave** que une esta hoja con la de consultas.

### Obligatorias (4)

| Columna | Tipo en la hoja | Tipo en BD | Límite | Validación |
|---|---|---|---|---|
| `nombre` | Texto | `VarChar(100)` | 100 | No vacío |
| `apellidos` | Texto | `VarChar(100)` | 100 | No vacío |
| `fecha_nacimiento` | **Fecha** | `Date` | — | Fecha real, no futura |
| `sexo` | **Lista** | `VarChar(20)` | — | `masculino` · `femenino` · `otro` → `male` · `female` · `other` |

> 🔴 **`sexo` va como desplegable en el `.xlsx`.** En texto libre un doctor mexicano escribe
> `M`, que es **ambiguo** entre *Masculino* y *Mujer*. El desplegable elimina el problema en vez
> de validarlo después.
>
> 🔴 **`fecha_nacimiento` va como celda de fecha real**, no texto. Es la razón principal de
> repartir `.xlsx` y no `.csv`: Excel reescribe las fechas de un CSV al guardarlo.

### Identificación

| Columna | Tipo | Tipo en BD | Notas |
|---|---|---|---|
| `id_paciente` | Texto | `VarChar(50)` | El folio del doctor. **Único por doctor** (`@@unique([doctorId, internalId])`). Si viene vacío lo genera el importador — ver §Trampas |

### Contacto

| Columna | Tipo | Tipo en BD |
|---|---|---|
| `email` | Texto | `VarChar(255)` — formato válido si viene |
| `telefono` | **Texto** | `VarChar(50)` — texto, para no perder el `0` inicial |
| `direccion` | Texto largo | `Text` |
| `ciudad` | Texto | `VarChar(100)` |
| `estado` | Texto | `VarChar(100)` |
| `codigo_postal` | **Texto** | `VarChar(20)` |

### Contacto de emergencia

| Columna | Tipo | Tipo en BD |
|---|---|---|
| `emergencia_nombre` | Texto | `VarChar(200)` |
| `emergencia_telefono` | **Texto** | `VarChar(50)` |
| `emergencia_parentesco` | Texto | `VarChar(100)` |

### Clínico basal

| Columna | Tipo | Tipo en BD |
|---|---|---|
| `alergias` | Texto largo | `Text` |
| `enfermedades_cronicas` | Texto largo | `Text` |
| `medicamentos_actuales` | Texto largo | `Text` |
| `tipo_sangre` | Texto | `VarChar(10)` |
| `notas_generales` | Texto largo | `Text` |

### Administrativo

| Columna | Tipo | Tipo en BD | Notas |
|---|---|---|---|
| `primera_visita` | Fecha | `Date` | Si falta, la calcula el importador de la consulta más vieja |
| `ultima_visita` | Fecha | `Date` | Igual, de la más reciente |
| `estatus` | Lista | `VarChar(20)` | `activo`·`inactivo`·`archivado` → `active`·`inactive`·`archived`. Default `active` |
| `etiquetas` | Texto | `String[]` | Separadas por `;` — el importador parte la cadena |

### Fiscal (solo si el doctor factura)

| Columna | Tipo | Tipo en BD | Notas |
|---|---|---|---|
| `requiere_factura` | Lista `sí`/`no` | `Boolean` | Default `false` |
| `rfc` | **Texto** | `VarChar(13)` | 12 (moral) o 13 (física) |
| `razon_social` | Texto | `VarChar(300)` | |
| `regimen_fiscal` | **Texto** | `VarChar(10)` | Clave SAT, p. ej. `612` |
| `uso_cfdi` | **Texto** | `VarChar(10)` | Clave SAT, p. ej. `D01` |
| `cp_fiscal` | **Texto** | `VarChar(10)` | |

**No se importan por archivo:** `photoUrl`, `constanciaFiscalUrl`, `constanciaFiscalName` — son
archivos, no celdas. Se suben después desde el expediente.

---

## Hoja 2 — `CONSULTAS`

Una fila por visita histórica. Se une a la hoja 1 por `id_paciente`.

### Obligatorias (3)

| Columna | Tipo | Tipo en BD | Validación |
|---|---|---|---|
| `id_paciente` | Texto | — | **Debe existir** en la hoja `PACIENTES` |
| `fecha` | **Fecha** | `DateTime` | Fecha real, no futura → `encounterDate` |
| `motivo` | Texto | `Text` | `chiefComplaint` es **NOT NULL**. Si el archivo no lo trae, el importador escribe `"Consulta migrada"` |

### Contenido clínico — aquí va TODO el texto libre

| Columna | Tipo | Tipo en BD | Notas |
|---|---|---|---|
| `notas` | **Texto largo** | `Text` → `clinicalNotes` | **El destino principal.** Aquí cae lo que en el sistema viejo eran plantillas, recetas y notas: todo en texto plano |
| `diagnostico` | Texto largo | `Text` → `assessment` | |
| `tratamiento` | Texto largo | `Text` → `plan` | |
| `exploracion` | Texto largo | `Text` → `objective` | |
| `padecimiento_actual` | Texto largo | `Text` → `subjective` | |

### Metadatos de la visita

| Columna | Tipo | Tipo en BD | Notas |
|---|---|---|---|
| `tipo` | Lista | `VarChar(50)` | `consulta`·`seguimiento`·`urgencia`·`telemedicina` → `consultation`·`follow-up`·`emergency`·`telemedicine`. Default `consultation` |
| `consultorio` | Texto | `VarChar(100)` → `location` | |
| `proxima_cita` | Fecha | `Date` → `followUpDate` | |

### Signos vitales (opcionales, tipos estrictos)

| Columna | Tipo en la hoja | Tipo en BD | Ojo |
|---|---|---|---|
| `presion_arterial` | Texto | `VarChar(20)` | Texto, es `120/80` |
| `frecuencia_cardiaca` | **Entero** | `Int` | |
| `temperatura` | **Decimal** | `Decimal(4,1)` | Máx. 1 decimal, 3 enteros |
| `peso` | **Decimal** | `Decimal(5,2)` | Máx. 2 decimales, 3 enteros |
| `estatura` | **Decimal** | `Decimal(5,2)` | Definir **cm o m** en la plantilla y no dejarlo a criterio |
| `saturacion_oxigeno` | **Entero** | `Int` | |
| `otros_signos` | Texto largo | `Text` | |

> ⚠️ Los `Decimal(p,s)` **truncan o revientan** si el archivo trae más precisión. Un peso
> `78.456` no cabe en `Decimal(5,2)`. El validador redondea y lo reporta, no falla en silencio.

---

## Estatus de lo migrado

`ClinicalEncounter.status` es `draft`·`completed`·`amended`. Lo importado entra como
**`completed`**: son visitas que ya ocurrieron. Dejarlas en `draft` las haría aparecer como
trabajo pendiente del doctor.

## Procedencia (dónde se marca que algo es migrado)

Por el hallazgo de arriba, **no** en `customData`. En dos lugares:

1. **Visible para el doctor** — encabezado dentro de `clinicalNotes`:
   `— Migrado del sistema anterior · archivo: <nombre> · <fecha> —`
2. **Autoritativo** — `PatientAuditLog`, con `changes` cargando `{ batchId, sourceFile, rowNumber }`.

Ninguno de los dos pide cambio de esquema: `changes` ya es `Json?` y `userRole` es `VarChar(50)`.

---

## Trampas conocidas

| # | Trampa | Qué hacer |
|---|---|---|
| 1 | **`internalId` colisiona en lote.** `patients/route.ts:92` hace `` `P${Date.now()}` ``; en un bucle varios pacientes caen en el mismo milisegundo y chocan contra `@@unique([doctorId, internalId])` | El importador genera su propia serie, no reusa esa línea |
| 2 | **Excel destroza el CSV.** Fechas relocalizadas, ceros iniciales perdidos, RFC coercionado | Repartir `.xlsx`; aceptar `.csv` al subir |
| 3 | **`M` ambiguo** entre *Masculino* y *Mujer* | Desplegable, no texto libre |
| 4 | **`chiefComplaint` es NOT NULL** | Rellenar `"Consulta migrada"` |
| 5 | **Fallo a media importación** deja pacientes escritos | Todo dentro de una transacción, o commit por lotes con reanudación |
| 6 | **Admin importa al doctor equivocado** = fuga de datos entre doctores | La confirmación muestra **el nombre del doctor** que recibe, no su id |

## Auditoría (no es opcional)

Cada alta individual escribe hoy un `PatientAuditLog` con `action: 'create_patient'`. La
importación **debe escribirlos también**, o el rastro miente sobre cómo entraron los datos.
Pesa más ahora que la home afirma en público que el expediente es *conforme a la NOM-004 y la
NOM-024*.

Cuando importa un **admin**, el log registra `userRole: 'admin'` y el usuario admin real —
**nunca** suplantando al doctor. Un rastro falso es peor que uno ausente: no se detecta después.

## Dónde vive el código

Los dos apps **no comparten API**: los pacientes los sirve el app del doctor
(`apps/doctor/src/app/api/medical-records/patients/`) y el admin habla con `apps/api`
(`/api/admin/*`). El núcleo —parsear · validar · deduplicar · commit transaccional · auditar—
va en `packages/`, y cada app expone una ruta delgada que solo cambia **quién actúa**:

| | app del doctor | app de admin |
|---|---|---|
| `doctorId` | de la sesión | elegido en un selector |
| `userRole` auditado | `doctor` / `member` | **`admin`** |
| Permiso | toggle `expedientes` | auth de admin |
