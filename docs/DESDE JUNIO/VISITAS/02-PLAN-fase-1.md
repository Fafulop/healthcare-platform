# 02 — PLAN: Fase 1 (Visita)

> **Tipo: PLAN.** Escrito el 2026-09-25. Nada ejecutado todavía. Cada paso se detiene para el OK
> del usuario antes de tocar prod. El *qué* y el *por qué* viven en
> [`01-DISENO-visitas-y-tratamientos.md`](01-DISENO-visitas-y-tratamientos.md); aquí sólo el
> *cómo*.
>
> **Fase 1 = la tabla `visitas` y sus ligas.** `tratamientos` y `tratamiento_sesiones` son de la
> fase 2 y **no se crean aquí**: el diseño ya garantiza que la fase 2 no toca `visitas`.

---

## 0. Las condiciones del entorno (no negociables)

- **No hay BD local ni staging** (desde 2026-09-20). Prod es el único entorno.
- **El schema llega a la BD ANTES que el código**, y todo cambio es **aditivo**: tablas nuevas y
  columnas *nullable*. El código desplegado ignora columnas que no conoce, así que el paso A no
  cambia nada de lo que corre.
- **SQL manual + `prisma db execute`. Nunca `prisma db push`** (revierte las FKs compuestas y
  borra tablas — `docs/NEW.MD-GUIDES/database-architecture.md`).
- **Todo DDL se prueba primero dentro de una transacción que siempre revienta** (write probe).
- **Consultas contra prod:** método canónico de
  `flujo de dinero permutaciones/TOOLING-acceso-railway-db.md` (`railway run --service pgvector`).
- **Un commit que sólo toca `packages/**` no despliega ningún servicio.** Ayuda en el paso A; en el
  paso D obliga a verificar el `commitHash` de cada servicio.

---

## 1. Lo verificado en prod antes de escribir este plan (2026-09-25, read-only)

| Hecho | Consecuencia |
|---|---|
| `clinical_encounters.encounter_date` es `timestamp without time zone`; 275 de 293 a medianoche y **0** entre 00:00:01 y 06:00 | El backfill puede usar `encounter_date::date` sin corrimiento de día. |
| **0** fotos, recetas o informes cuyo `encounter_id` apunte a una consulta de OTRO paciente | La FK compuesta "mismo paciente" (§2.2) se puede crear sin violar filas existentes. |
| `medical_records.patients_id_doctor_id_key` (único `(id, doctor_id)`) ya existe | La FK compuesta visita→paciente reutiliza el patrón de `bookings` y `medical_reports`. |
| `LedgerEntry.booking_id` es `@unique` (107 movimientos ligados a cita) | Una cita tiene a lo sumo un movimiento → corrigió §5 del DISEÑO (cargo extra). |
| Tres caminos concluyen citas, todos por `PATCH bookings/[id]` | Un solo enganche en `apps/api` cubre agenda, agente y chat de citas. |

---

## 2. Paso A — Migración SQL (sólo agrega)

Archivo: `packages/database/prisma/migrations/create-visitas.sql`. Idempotente
(`IF NOT EXISTS` y bloques `DO $$`), como el resto de la carpeta.

### 2.1 La tabla

```sql
CREATE TABLE IF NOT EXISTS medical_records.visitas (
  id          TEXT PRIMARY KEY,
  patient_id  TEXT NOT NULL,
  doctor_id   TEXT NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,
  -- Día de la visita. RESPALDO: si hay cita, manda la de la cita (DISEÑO §3).
  -- DATE, no timestamp: es un día, y se formatea en UTC (lección @db.Date).
  fecha       DATE NOT NULL,
  comentario  TEXT,
  booking_id  TEXT,                               -- FK abajo (SET NULL)
  origen      VARCHAR(20) NOT NULL,               -- 'manual' | 'cita' | 'backfill'
  created_at  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT visitas_origen_check CHECK (origen IN ('manual', 'cita', 'backfill'))
);

-- Una cita tiene a lo sumo UNA visita: esto es lo que hace idempotente la visita automática.
-- COMPLETO, no parcial (corregido en el review): un índice parcial rompe el upsert de Prisma
-- (ON CONFLICT (booking_id) → 42P10). Postgres no compara NULLs: las visitas sin cita conviven.
CREATE UNIQUE INDEX IF NOT EXISTS visitas_booking_id_key
  ON medical_records.visitas(booking_id);

CREATE INDEX IF NOT EXISTS visitas_patient_fecha_idx ON medical_records.visitas(patient_id, fecha);
CREATE INDEX IF NOT EXISTS visitas_doctor_fecha_idx  ON medical_records.visitas(doctor_id, fecha);

-- Destino de las FKs compuestas "mismo paciente" de los hijos (§2.2).
CREATE UNIQUE INDEX IF NOT EXISTS visitas_id_patient_id_key
  ON medical_records.visitas(id, patient_id);
```

`origen` existe para que **deshacer el backfill sea una consulta que sólo toca lo que él creó**
(§4.3), y para distinguir en la UI lo automático de lo manual.

### 2.2 Las FKs

| FK | Tipo | Por qué |
|---|---|---|
| `visitas(patient_id, doctor_id) → patients(id, doctor_id)` | `ON DELETE CASCADE` | Tenencia a nivel BD: una visita no puede colgar del paciente de otro doctor. Mismo patrón que `bookings` y `medical_reports`. |
| `visitas(booking_id, doctor_id) → bookings(id, doctor_id)` | `ON DELETE SET NULL (booking_id)` | La cita es del **mismo doctor** (review, hueco de tenencia). Por doctor y no por paciente: el paciente de una cita se re-liga y una FK por paciente bloquearía ese UPDATE; el mismo PACIENTE lo revisa el servidor (D1b). Borrar un slot borra sus citas (`Booking.slot` en `CASCADE`); la visita sobrevive con su `fecha`. Destino: índice nuevo `bookings_id_doctor_id_key`. |
| `<hijo>(visita_id, patient_id) → visitas(id, patient_id)` en `clinical_encounters`, `patient_media`, `prescriptions`, `patient_notes`, `medical_reports` | `ON DELETE SET NULL (visita_id)` | **Hueco #13 a nivel BD:** un elemento no puede ligarse a la visita de otro paciente, por ningún camino presente o futuro. `SET NULL` con lista de columnas requiere PG15+ (prod es pg17, y ya se usa en `bookings`). |

Las columnas en los hijos:

```sql
ALTER TABLE medical_records.clinical_encounters ADD COLUMN IF NOT EXISTS visita_id TEXT;
ALTER TABLE medical_records.patient_media       ADD COLUMN IF NOT EXISTS visita_id TEXT;
ALTER TABLE medical_records.prescriptions       ADD COLUMN IF NOT EXISTS visita_id TEXT;
ALTER TABLE medical_records.patient_notes       ADD COLUMN IF NOT EXISTS visita_id TEXT;
ALTER TABLE medical_records.medical_reports     ADD COLUMN IF NOT EXISTS visita_id TEXT;
-- + un índice por visita_id en cada una, y las FKs en bloques DO $$ … IF NOT EXISTS.
```

> ⚠️ **Las FKs compuestas y el índice único parcial NO se pueden modelar en Prisma** ⇒ `prisma db
> push` los revierte. En el MISMO commit: comentario ⚠️ en `schema.prisma` y una entrada nueva en
> la lista "DB-only constraints" de `database-architecture.md`.

El archivo arranca con `SET lock_timeout = '5s'` y `statement_timeout = '60s'` (review): los `ADD
COLUMN` toman ACCESS EXCLUSIVE sobre cinco tablas del expediente; sin límite, una transacción larga
abierta dejaría a todo prod en cola detrás del ALTER.

### 2.3 `schema.prisma`

Modelo `Visita` (`@@map("visitas")`, `@@schema("medical_records")`) y `visitaId String?` en los
cinco modelos. Las relaciones se declaran simples (como `bookings` hoy); la versión compuesta vive
sólo en el SQL; las relaciones nuevas llevan `onUpdate: NoAction` para que Prisma no reporte
deriva falsa. **No correr `prisma format`**: realinea las 2,600 líneas del archivo. `pnpm db:generate` y type-check de los cuatro apps: **ningún código usa todavía los
modelos nuevos**, así que no debe cambiar nada.

---

## 3. Paso B — Probar la migración en prod SIN dejar nada

Script en el scratchpad: abre transacción, corre `create-visitas.sql`, hace las comprobaciones y
**siempre lanza un error al final** (rollback). Cada comprobación debe dar el resultado esperado;
"corrió sin error" no cuenta.

| # | Comprobación | Esperado |
|---|---|---|
| B1 | Insertar dos visitas con el mismo `booking_id` | La 2ª **rebota** (índice único parcial) |
| B2 | Insertar una visita con `patient_id` de otro doctor | **Rebota** (FK compuesta) |
| B3 | Ligar una foto del paciente X a una visita del paciente Y | **Rebota** (FK compuesta del hijo) |
| B4 | Crear paciente de prueba + visita + consulta + foto + receta + nota ligadas; **borrar el paciente** | **No truena** y no queda nada. (Lección del informe médico: sin la FK correcta, el orden de los cascades hacía abortar el borrado.) Si truena → la FK del hijo pasa a `DEFERRABLE INITIALLY DEFERRED` y se repite. |
| B5 | Visita ligada a una cita; **borrar la cita** | La visita sigue, con `booking_id = NULL` y su `fecha` intacta |
| B6 | Correr el SQL **dos veces** dentro de la misma transacción | La 2ª no falla (idempotente) |
| B8 | Visita ligada a una cita de **otro doctor** | **Rebota** (`visitas_booking_id_doctor_id_fkey`) |
| B9 | `INSERT … ON CONFLICT (booking_id) DO UPDATE` (lo que genera el `upsert` de Prisma) | **Funciona** y actualiza la visita existente |
| B10 | Re-ligar el paciente de una cita que tiene visita | **No** se bloquea |
| B11 | Doctor nuevo con paciente + visita + los cinco hijos; **borrar el doctor** | No truena y no queda nada |

**v2 tras el code review:** cada rechazo exige **su** código SQLSTATE **y su** constraint (no
"cualquier error"); B3 cubre los **cinco** hijos; B4 incluye un informe ligado a la consulta **y** a
la visita (el caso que ya tumbó el borrado de pacientes una vez); la estructura compara la
**definición exacta** de cada FK (`pg_get_constraintdef`), que los tres índices sean únicos y **no
parciales**, y que no queden FKs de una columna sueltas.

Si las seis pasan: se corre el SQL de verdad y se verifica con `information_schema` /
`pg_constraint` que existen las columnas, los índices y las FKs **con su `ON DELETE`**.

**Commit del paso A** (sólo `packages/database/**` + la entrada en el doc): no despliega nada, a
propósito.

---

## 4. Paso C — Backfill de las consultas existentes

Script `scripts/visitas/backfill-visitas.cjs` (se versiona: es parte del registro de qué se le
hizo a prod).

### 4.1 Qué hace

1. Por cada `clinical_encounters` **sin** `visita_id`: crea una visita con
   `id = 'vbf_' || encounter.id` (**determinista** → re-correrlo no duplica),
   `fecha = encounter_date::date`, mismo `patient_id`/`doctor_id`, `origen = 'backfill'`,
   `booking_id = NULL` (hoy no existe liga consulta↔cita que heredar).
2. `clinical_encounters.visita_id` ← esa visita.
3. `patient_media`, `prescriptions`, `medical_reports` con `encounter_id` ← la visita de su
   consulta (regla del hueco #4: la visita sale de la consulta).
4. Notas: no se tocan (no tienen liga a consulta) → «Sin visita».

### 4.2 Cómo se corre

1. **Ensayo** (`--dry-run`, dentro de transacción que revienta): imprime conteos esperados.
   Referencia de hoy: **293 visitas, 150 fotos/documentos, 12 recetas, 29 informes**. Si no
   cuadran con una consulta read-only hecha ese mismo día, se para.
2. **De verdad:** una sola transacción.
3. **Leer de vuelta:** `COUNT` independiente de cada tabla; cada número debe ser igual al del
   ensayo, y **0** consultas sin visita. (Lección: un contador de éxito cuenta lo que se
   INTENTÓ; lo que cuenta es lo que quedó en la base.)

### 4.2b Estado y CUÁNDO se corre de verdad (2026-09-25)

- **Script:** `scripts/visitas/backfill-visitas.cjs` (`--dry-run` · sin flag · `--undo`).
- **Ensayo corrido el 2026-09-25, read-only:** 293 consultas · 150 fotos/documentos · 12 recetas ·
  29 informes · **0** hijos ligados a la consulta de otro paciente — exactamente lo esperado.
- 🔴 **La corrida de verdad va JUSTO ANTES de lanzar la UI (D4/D5), no antes.** Hasta que D1 esté
  en prod, las consultas nuevas NO reciben visita: correrlo hoy dejaría huérfanas todas las que se
  creen de aquí al lanzamiento. Es re-corrible (sólo toma lo que siga sin visita), así que si se
  corre antes, se repite al lanzar.
- ☐ **Code review del script ANTES de la corrida de verdad**, con su versión final: para entonces
  ya habrá visitas `cita`/`manual` en la base, y replica la regla "la visita del hijo = la de su
  consulta" que D3 implementa en código — las dos tienen que decir lo mismo.

### 4.3 Cómo se deshace

```sql
-- En una transacción; sólo toca lo que creó el backfill.
UPDATE medical_records.<cada hijo> SET visita_id = NULL WHERE visita_id LIKE 'vbf\_%';
DELETE FROM medical_records.visitas WHERE origen = 'backfill';
```

Mientras ningún código lea `visita_id`, el backfill es **invisible** para los doctores.

---

## 5. Paso D — Código, en despliegues chicos

Cada sub-paso: type-check, review (con la heurística de `05-METODO-code-review.md`), OK del
usuario, push, y **verificar el `commitHash` por servicio**.

| # | Qué | Dónde | Notas |
|---|---|---|---|
| D1 | **Visita automática al concluir** | `apps/api/.../bookings/[id]/route.ts`, junto a `createCitaLedgerEntry` | Idempotente (índice único), **falla abierto** con `visitaWarning` (patrón `ledgerWarning`). Cita sin `patientId` → no se crea (DISEÑO §6). Si ya hay visita manual ligada a esa cita → se refresca su `fecha`, no se duplica. |
| D1b | **Visita al ligar el expediente** a una cita ya concluida | Rutas que ligan paciente a cita (`+ Crear expediente`, ligar existente) | El MISMO helper de D1, para que no haya dos implementaciones. |
| D2 | **API de visitas** | `apps/doctor/src/app/api/medical-records/patients/[id]/visitas/**` | Listar, ver (con cada bloque revisando SU permiso — DISEÑO §3), crear, editar comentario, borrar **sólo si está vacía**. Toda ruta con query shape nuevo se smoke-testea read-only contra prod antes del push. |
| D3 | **`visitaId` en las rutas existentes** | media, prescriptions, encounters, notes (POST/PATCH) | El servidor **deriva** `visitaId` de `encounterId` cuando lo hay y **rechaza** uno que no coincida; mover entre visitas se audita `from → to`. |
| D4 | **UI: «Nueva Visita»** | página del paciente + pantalla de la visita | Reemplaza «Nueva Consulta»; varias plantillas (incluida la «plantilla SOAP»), fotos, nota, receta, liga a cita, estado de pago leído de la cita. |
| D5 | **UI: libros mayores** | Docs y Galería, Recetas, Notas, Historial | Etiqueta «Visita del 12 sep», filtro por visita, «Sin visita», y el «¿A qué visita pertenece?» en sus "+". |
| D6 | **Manual de Ayuda + guías** | `manual-del-doctor.md`, `ExpedientesGuide.tsx` | En el MISMO commit que la UI que describe (D4/D5), no después. |

### 5.1 D1 + D1b — cómo quedaron (2026-09-25)

- **Van juntos, en un solo despliegue.** D1 solo habría creado visitas en el expediente EQUIVOCADO
  desde el día uno: al re-ligar la cita, la visita se quedaba con el paciente anterior (code review).
- **Una sola función:** `syncVisitaForBooking` (`packages/database/src/visitas.ts`). **Re-lee la cita**
  y reconcilia; no confía en lo que le pase el llamador. Los dos llamadores la corren en
  `$transaction` y **fallan abierto**.
- **Re-ligar:** la visita del paciente anterior, si está vacía (sin hijos ni comentario) y es
  automática, **se borra**; si tiene contenido o es manual, **se suelta** (sin cita) y se queda en su
  expediente. **Desligar** (cita sin paciente) **no toca** la visita: si se vuelve a ligar al mismo
  paciente, sigue ahí. (Un re-enganche "por paciente y día" se probó y se QUITÓ en review: no
  distingue la visita que soltamos de la de una cita borrada o de otra cita del mismo día.)
  Caso borde aceptado: A→B→A con contenido deja la visita de A sin cita, en su expediente, y A
  recibe una nueva vacía — nada se pierde ni se mueve.
- **Sin candado de fila** a propósito (concluir y re-ligar la misma cita en el mismo milisegundo no
  lo hace una persona); lo cubre el barrido de abajo.
- **Smoke contra prod (en transacción revertida): 21/21.** Slot y freeform, idempotencia, re-ligar
  vacía/con contenido/sólo comentario, desligar, desligar y re-ligar (slot y freeform), A→B→A, SQL
  completo.
  Se revisó el SQL: el `_count` de Prisma armaba `GROUP BY` sobre las 5 tablas hijas COMPLETAS en cada
  cita concluida; se cambió por `count()` por hijo, y sólo en la rama de re-ligar.
- ☐ **Barrido de reparación, junto con el backfill (§4.2b), antes de lanzar:** citas `COMPLETED` con
  paciente y sin visita (un fallo que falló abierto), y visitas `cita` cuyo paciente ≠ el de su cita
  (la carrera sin candado). Corre la MISMA `syncVisitaForBooking` sobre cada una.
- ⚠️ **Hueco conocido, de CITAS, no de visitas:** concluir (o cancelar / no-show) una cita en un slot
  PRIVADO borra el slot, y la cita — que no tiene `date` propia — **se queda sin día**. Lo mismo al
  borrar slots (bulk, purge, `slots/[id]`, `slots/route.ts`). Al concluir no afecta a la visita
  (`fechaHint` lee el día antes); pero si el expediente se liga DESPUÉS, no hay día → `no_fecha` y no
  nace visita. En prod el 2026-09-25: **3 citas concluidas** así de 572. Arreglo de raíz: estampar
  `date` en la cita donde se anula `slotId` (5 caminos) — fuera de D1; el barrido las reporta.

**Toggle de miembros para "Visitas": NO lleva (decidido 2026-09-25, DISEÑO §9).** Las rutas heredan
`expedientes` por prefijo; `citas` y `flujo` sólo recortan el bloque de la cita.

### 5.2 D2 — la API (2026-09-25)

- `GET|POST /api/medical-records/patients/[id]/visitas` — lista (la más reciente primero, con
  conteo de hijos y bloque de cita) · alta MANUAL (`fecha` requerida SIN cita; con `bookingId`, el
  día de la cita manda; una `fecha` mal formada es 400 siempre).
- `GET|PATCH|DELETE …/visitas/[visitaId]` — detalle con sus hijos · editar comentario, fecha (sólo
  SIN cita, si no 409) y ligar/desligar cita · borrar **sólo si está vacía** (409 con el conteo).
  Re-enviar la MISMA cita o la fecha que ya se muestra (un formulario que manda todo) no cuenta como
  cambio: no se valida ni rebota.
- **Con cita, la fecha que se devuelve (y por la que se ordena) es la de la CITA**, leída; la
  guardada es respaldo (una cita re-agendada después de ligarse la dejaría vieja).
- **Ligar una cita:** exige el permiso `citas` (403 `PERMISSION_BLOCKED`); cita de otro doctor o
  inexistente → 404; de otro paciente, CANCELLED/NO_SHOW o que ya tiene visita → 409.
- **La visita AUTOMÁTICA (`origen='cita'`) no cambia de cita** (409): es la de esa cita, y soltarla a
  mano la duplicaba en cuanto la sincronización de `apps/api` la re-creara. Borrarla vacía sí se puede
  (si se re-crea, vuelve vacía).
- Body que no sea objeto JSON → 400. Lo común vive en `apps/doctor/src/lib/visitas.ts`. Conteos con
  `groupBy` filtrado por paciente y visita, nunca `_count`.
- Las escrituras se auditan en `patient_audit_logs` (`create_visita` · `update_visita` con
  `from → to` · `delete_visita`) — best-effort, como todo `logAudit`: si el log falla, la escritura
  no se revierte.
- Carreras aceptadas: un hijo que se cuelgue entre el conteo y el borrado queda «Sin visita» (FK
  `SET NULL`, no se pierde); re-ligar el paciente de la cita mientras se liga la visita lo detecta el
  barrido de §5.1.
- Nadie la llama todavía: la UI es D4/D5.
- ✅ **Fuga PREVIA hallada en el review de D2, ARREGLADA 2026-09-25:** `GET …/patients/[id]/bookings`
  daba a cualquier member con `expedientes` citas, cobros, links de pago y la factura. Ahora recorta
  por campo (`lib/booking-permisos.ts`). Quedan otras del mismo tipo fuera de visitas — lista y estado
  en `NUEVOS USUARIOS/05-COBERTURA-19-toggles.md` §"Fugas por CAMPO".
- `puedeVer` **no aplica el techo del plan**: dueño y admin ven todo (un dueño FREE seguía viendo sus
  facturas); el plan ya recorta las FUNCIONES por ruta.

**El agente:** fuera de la fase 1, pero D1 lo afecta (concluye citas). Antes de D1, confirmar en
`docs/DESDE JUNIO/AGENTES/` (leer `GENERAL AGENTES/08-EMPIEZA-AQUI.md`) que nada de lo que el agente
lee o afirma cambia; si su respuesta al concluir cambia de forma (`visitaWarning`), correr los
gates.

---

## 6. Prueba a mano (después de D4/D5, en dr-prueba)

1. Concluir una cita de un paciente con expediente → aparece su visita «Vacía», con la fecha y el
   pago de la cita.
2. Concluirla otra vez / desde el agente → **no** se duplica.
3. Concluir una cita **sin** expediente → no hay visita; crear el expediente desde la cita → aparece.
4. «Nueva Visita» con dos plantillas + foto + nota + receta → todo aparece dentro, y cada cosa en
   su libro mayor con la etiqueta de la visita.
5. Un miembro sin permiso de flujo abre la visita → **no** ve el pago.
6. Borrar una visita con contenido → no se puede; vacía → sí.
7. Abrir una consulta vieja (del backfill) → vive en su propia visita, con sus fotos.

(Type-check + gates + smoke test de BD **no** es "probado": falta el clic.)

---

## 7. Orden y puntos de parada

```
A (SQL + schema) ──► B (probe con rollback) ──► correr SQL de verdad ──► commit A
      └─ OK usuario        └─ OK usuario            └─ OK usuario
C (ensayo) ──► C (de verdad) ──► leer de vuelta
   └─ OK         └─ OK
D1 ──► D1b ──► D2 ──► D3 ──► D4+D6 ──► D5+D6 ──► prueba a mano (§6)
 (cada uno: review → OK → push → commitHash por servicio)
```
