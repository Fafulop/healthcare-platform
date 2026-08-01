# 🗂️ PACIENTE MIGRATION — traer los pacientes de otro sistema

> **Qué es.** Un doctor que ya trabaja (en papel, en Excel o en otro software) tiene que poder
> traerse sus pacientes y su historia clínica sin capturarlos uno por uno. Esto es el plan.
>
> 📋 **El inventario de campos, con tipos y validaciones**, está en
> [`01-CONTRATO-de-importacion.md`](01-CONTRATO-de-importacion.md). Este archivo es el plan y
> las decisiones.

## Estado (2026-08-01)

| Fase | Qué | Estado |
|---|---|---|
| **F1** | Plantilla `.xlsx` + contrato de columnas | ✅ Construida (`66485db8`) |
| **F2** | Validador puro | ✅ Construido (`4ae71b91`) |
| **F3** | Commit transaccional · auditoría · rutas · UI de admin | ✅ Construida — **sin probar contra la BD** |
| **F4** | La misma UI en el app del doctor | ⬜ Pendiente |

> 🔴 **F3 NO se ha corrido nunca contra una base de datos.** El commit se ejerció con un
> cliente de transacción simulado: se comprobó la FORMA de la escritura (3 operaciones
> masivas, 5 renglones de auditoría, `userRole: admin`, folios sin colisión), no que Prisma
> la acepte. **Antes de que un doctor real la use hay que correrla contra un doctor de
> prueba** — el método está en `TOOLING-acceso-railway-db.md`.

### Lo que quedó construido

| Pieza | Dónde |
|---|---|
| Contrato de columnas (29 + 18) | `packages/database/src/patient-import.ts` |
| Validador (puro, sin Prisma) | `packages/database/src/patient-import-validate.ts` |
| Escritura transaccional + auditoría | `packages/database/src/patient-import-commit.ts` |
| Parseo `.xlsx`/`.csv` | `apps/api/src/lib/patient-import-parse.ts` |
| `GET /api/patient-import/template` | descarga la plantilla |
| `POST /api/patient-import/validate` | vista previa, **no escribe nada** |
| `POST /api/patient-import/commit` | escribe, en transacción |
| UI de migración asistida | `apps/admin/src/app/patient-import/page.tsx` |

## Por qué importa

Es **la objeción más cara que hay sin contestar**. La pregunta *"¿puedo traerme mis
pacientes?"* es la primera que hace quien cambia de software, y hoy la respuesta es capturar a
mano. Está anotada como pendiente #3 en
[`../NEW STYLE/README.md`](../NEW%20STYLE/README.md): el FAQ de la home **no la contesta a
propósito**, porque inventar una respuesta tranquilizadora sale más caro después que dejarla
en blanco. **Cuando esto exista, ese FAQ se escribe.**

## La forma del producto

Al principio la migración es **asistida por una persona**: el doctor manda su tabla, alguien de
admin la modela a nuestro formato y la sube por él. Por eso se construye **en los dos apps**.

```
  ┌─ app del DOCTOR ────────┐        ┌─ app de ADMIN ──────────┐
  │ el doctor se importa    │        │ admin importa POR un    │
  │ a sí mismo              │        │ doctor (selector)       │
  └───────────┬─────────────┘        └───────────┬─────────────┘
              └──────────────┬───────────────────┘
                             ▼
                  NÚCLEO COMPARTIDO en packages/
        parsear · validar · deduplicar · commit transaccional · auditar
```

**Por qué el núcleo es compartido y no se escribe dos veces:** los dos apps **no comparten
API**. Los pacientes los sirve el app del doctor
(`apps/doctor/src/app/api/medical-records/patients/`); el admin habla con `apps/api`
(`/api/admin/*`). Escribirlo dos veces significa duplicar validación, deduplicación y
auditoría — y la copia de admin es justo la que se va a desincronizar, porque es la que nadie
usa a diario.

Las rutas de cada app solo cambian **quién actúa**:

| | app del doctor | app de admin |
|---|---|---|
| `doctorId` | de la sesión | elegido en un selector |
| `userRole` auditado | `doctor` / `member` | **`admin`** |
| Permiso | toggle `expedientes` | auth de admin |

## El flujo, de principio a fin

1. **Descargar la plantilla** — un `.xlsx` generado por nosotros, con las columnas ya puestas.
2. **Llenarla** — el doctor, o admin a partir del archivo que le mandó el doctor.
3. **Subirla** — se acepta `.xlsx` y `.csv`.
4. **Previsualizar** — qué va a entrar, y **qué renglón tiene qué error**.
5. **Confirmar** — y hasta entonces se escribe, dentro de una transacción.

**El paso 4 no es opcional.** Una inserción a ciegas de 300 pacientes que falla en el renglón
180 —habiendo escrito ya 179— es peor que no tener importación. Además es la misma forma que ya
usa conciliación bancaria (`StatementUploadModal` → `PdfReviewTable` → commit) y la misma regla
del agente: se propone, se confirma, y hasta entonces se ejecuta.

## Las tres decisiones de fondo

| Qué | A dónde | Por qué |
|---|---|---|
| Datos personales | Columnas reales de `Patient` | Son estables entre doctores |
| Historia clínica | **`ClinicalEncounter`**, con su fecha real | Conserva la cronología |
| Recetas viejas | Texto dentro del encuentro | **Nunca** filas de `Prescription` |

- **Nada de una columna por input de plantilla.** Cada doctor tiene plantillas distintas y las
  cambia con el tiempo: no existe un conjunto de columnas estable al cual migrar.
- **La historia clínica NO va a `PatientNote`**, que no tiene fecha del evento y además es la
  nota *privada* del doctor.
- **Las recetas viejas NO van a `Prescription`**, que sella firma y cédula "for legal
  integrity": crear esas filas fabrica una emisión que nunca ocurrió aquí.

El detalle de los tres puntos está en el contrato.

## Plan de entrega

| Fase | Qué | Deja utilizable |
|---|---|---|
| **F1** | Generador de la plantilla `.xlsx` (2 hojas, desplegables, columnas de texto y fecha con tipo real) | Se puede mandar la plantilla a un doctor **hoy**, aunque la carga sea a mano |
| **F2** | Núcleo en `packages/`: parseo, validación por renglón, deduplicación, reporte de errores | Se valida un archivo real y se ve qué tan sucio viene |
| **F3** | Commit transaccional + `PatientAuditLog` + ruta y UI en el **app de admin** | Migración asistida completa, que es el caso real de hoy |
| **F4** | La misma UI en el **app del doctor** (autoservicio) | El doctor se migra solo |

**F1 primero a propósito:** la plantilla es lo único que se puede poner en manos de un doctor
sin nada de backend, y el archivo que regrese enseña de verdad qué tan sucios son los datos —
que es lo que decide cuánto hay que invertir en F2.

## Riesgos que ya conocemos

Los seis están en el contrato con su mitigación. Los dos que más pesan:

- **`internalId` colisiona en lote.** `patients/route.ts:92` hace `` `P${Date.now()}` ``: en un
  bucle varios pacientes caen en el mismo milisegundo y chocan contra
  `@@unique([doctorId, internalId])`. El importador necesita su propia serie.
- **Admin importando al doctor equivocado es una fuga de datos entre doctores**, no un typo. La
  confirmación tiene que enseñar **el nombre** del doctor que recibe, no su id.

Y uno que no es de código: **la auditoría no es opcional.** Cada alta individual escribe hoy un
`PatientAuditLog`; la importación debe escribirlos también, o el rastro miente sobre cómo
entraron los datos. Cuando importa un admin se registra `userRole: 'admin'` y el admin real —
**nunca** suplantando al doctor. Un rastro falso es peor que uno ausente porque no se detecta.
Pesa más ahora que la home afirma en público que el expediente es *conforme a la NOM-004 y la
NOM-024*.

## Lo que NO cambia de esquema

Nada. `PatientAuditLog.changes` ya es `Json?` (carga `batchId`, `sourceFile`, `rowNumber`) y
`userRole` es `VarChar(50)` (cabe `admin`). Importa, porque aquí `prisma db push` **revierte**
objetos que viven en prod y las migraciones son SQL a mano.

## 🕳️ Huecos encontrados al revisar el plan (2026-08-01)

Diez. Los cuatro primeros son **agujeros de verdad** que el plan no contestaba.

| # | Hueco | Resolución |
|---|---|---|
| 1 | **Reimportar no estaba definido.** ¿Qué pasa si el mismo archivo se sube dos veces, o si se reintenta una importación que falló a la mitad? | Cotejo por `(doctorId, internalId)`. Existe ⇒ **se salta y se reporta**, nunca se pisa en silencio. Actualizar es otra función, no ésta |
| 2 | **Las consultas no tienen llave natural.** Los pacientes se deduplican por `internalId`; las consultas **se duplicarían enteras** en cada reintento | Llave sintética `(patientId, encounterDate, motivo)`. Sin esto, un reintento le duplica el historial al paciente — y nadie lo nota hasta que lo abre |
| 3 | **Si `id_paciente` viene vacío**, el importador genera folios nuevos ⇒ reimportar crea un **juego duplicado completo** | Cotejo secundario por `nombre + apellidos + fecha_nacimiento`, que **avisa** (no fusiona solo) |
| 4 | **Duplicados dentro del propio archivo** — dos renglones con el mismo `id_paciente` | Se detectan **antes** de tocar la BD, en la validación |
| 5 | ¿Dónde viven los renglones entre la vista previa y el commit? | **En ningún lado.** El navegador ya tiene el archivo: se manda dos veces, a `/validate` y a `/commit`, y el commit **vuelve a parsear y validar**. No es desconfianza del navegador — si el commit aceptara filas ya procesadas, se podría escribir en el expediente saltándose la validación entera. Sale gratis no tener almacenamiento temporal ni limpiarlo |
| 6 | **Sin límite de tamaño.** Un archivo grande en una sola transacción revienta el timeout de Railway | Tope declarado + commit por lotes con reanudación |
| 7 | **Zona horaria.** `dateOfBirth` es `@db.Date`; parsear la fecha de Excel como UTC **corre el cumpleaños un día** en horario de México | Fechas se anclan a mediodía local antes de convertir |
| 8 | ¿Una **cuenta de apoyo** puede importar en lote? | **No.** Solo el dueño de la cuenta y el admin |
| 9 | **No hay deshacer.** Si admin importa 400 pacientes al doctor equivocado, el audit log los identifica pero no hay cómo revertirlos | Pendiente real. Mitigación de hoy: la confirmación enseña el **nombre** del doctor |
| 10 | Las **unidades** vivían en la doc, no en el archivo | Resuelto: la unidad va **en el nombre de la columna** — `peso_kg`, `estatura_cm`, `temperatura_c` |

## Decisiones abiertas

| # | Pregunta | Estado |
|---|---|---|
| 1 | ~~`estatura` en cm o en m~~ | ✅ **Resuelto por el hueco #10**: la columna se llama `estatura_cm`. La unidad deja de ser una convención que alguien tiene que recordar |
| 2 | ¿El admin usa **la misma plantilla** o mapea columnas del archivo crudo? | 🟡 **Se asume la misma plantilla** (es lo que implica la migración asistida). Con eso **no hace falta UI de mapeo en ningún lado** — es la pieza más grande del proyecto y así no se construye |
| 3 | ¿Se importan también **archivos** (estudios, PDFs, fotos)? | 🔴 Abierto. Hoy fuera de alcance: son archivos, no celdas |
