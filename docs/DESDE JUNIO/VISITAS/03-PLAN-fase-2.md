# 03 — PLAN fase 2: Tratamientos

> **Estado (2026-09-29): APROBADO — P1, P3–P5 como se recomendaron, P2 REVISADO en el code review
> de T1 (ver abajo), G10 = todos los planes. ✅ T1 APLICADO EN PROD** (tablas vacías; nadie las usa
> aún). **2026-10-01: T2 (la API) ESCRITO, smoke 26/26 en prod, review en 3 pasadas — ver §3.1.** Siguiente:
> T3. El diseño es
> `01-DISENO-visitas-y-tratamientos.md` (§3 modelo, §4 fecha, §5 precio, §6 concluir, §7 flujos,
> §8 fases); este doc dice **cómo** se construye, en qué orden y cómo se prueba cada paso. Mismas
> reglas que la fase 1 (`02-PLAN-fase-1.md` §0): SQL manual + `prisma db execute`, **nunca**
> `prisma db push`; smoke contra prod antes de cada push; plan → OK → código → type-check + gates →
> review → OK → push → `commitHash` por servicio.

## 0. Qué es la fase 2, en una línea

Un **tratamiento** es un plan de varias visitas para un paciente (injerto capilar en 6 sesiones,
fisioterapia en 10, un seguimiento de 2 consultas…). Tiene **sesiones**; cada sesión apunta a su
**cita** (la agenda es dueña de la fecha y del cobro) y a su **visita** (el expediente es dueño de
lo que pasó). El tratamiento es dueño del *plan* y de lo *acordado*.

**Orden decidido (usuario, 2026-09-29): primero T1–T4 (tratamientos útiles SIN dinero); el dinero
(T5–T6) después**, cuando lo básico ya se use.

---

## 1. Decisiones (APROBADAS por el usuario el 2026-09-29, tal cual la recomendación)

| # | Pregunta | Recomendación | Por qué |
|---|---|---|---|
| **P1** | ¿La sesión **guarda** su estado (por agendar · agendada · hecha · cancelada) o se **deriva**? | **Derivar** de su cita/visita; sólo se guarda `cancelada` (decisión del doctor). | El DISEÑO §3 lo guarda y §4 lo sincroniza con la agenda. Pero TODO cambio de estado de una cita pasa por `PATCH apps/api/.../bookings/[id]` **y** borrar un slot BORRA sus citas (cascade) sin pasar por ahí: un estado guardado quedaría mintiendo tras un borrado. Derivado no se desincroniza nunca y **T4 casi desaparece**. Mismo principio que el resto: nadie copia el dato de otro. |
| **P2** ✏️ *revisado* | Con cita, ¿la sesión guarda `visita_id` o lo lee de la visita de su cita? | ~~Sólo sin cita~~ → **La sesión SIEMPRE guarda su visita** cuando la conoce: al nacer la visita de su cita (`syncVisitaForBooking`, el ÚNICO lugar que crea visitas automáticas — D1 y D1b) se escribe también `tratamiento_sesiones.visita_id`. | **Code review de T1:** sólo leerla por la cita hacía que una sesión HECHA volviera a «por agendar» si su cita se borraba (cascada de slots) o pasaba a otro paciente (G1): `booking_id` y `visitas.booking_id` quedan en NULL y la visita que sí ocurrió se pierde del tratamiento. Guardarla la conserva. Sin CHECK de «cita XOR visita» (con P2 revisado ambos pueden estar). La coherencia (la visita de una sesión con cita = la de esa cita) la mantiene el servidor. |
| **P3** | ¿Se puede **renumerar** / reordenar sesiones? | No en T1–T4: `numero` único por tratamiento; agregar = siguiente número; borrar deja el hueco. | Simple; reordenar es un deseo que aún nadie pidió. |
| **P4** | ¿Columna `precio_paquete` ya en T1 aunque el dinero sea T6? | **Sí**, nullable y sin usar hasta T6. | Evita una segunda migración de la misma tabla; no afirma nada mientras nadie la escriba (la UI no la pinta hasta T6). |
| **P5** | «Es seguimiento de…» (DISEÑO §7) | **Fuera de T1–T4** (va en T7). | Es un atajo de UI sobre lo mismo; primero que el modelo se use. |

**Estado derivado de una sesión (si se aprueba P1):**

| Condición (en este orden) | Estado |
|---|---|
| `cancelada = true` | **Cancelada** |
| Tiene visita (propia o la de su cita) | **Hecha** |
| Su cita está `COMPLETED` (sin visita: la visita automática falló, p. ej. `no_fecha`) | **Hecha** (con aviso «su visita no se abrió»). *(Corregido en la revisión: «cita sin expediente» no puede pasar — ligar exige que la cita sea del mismo paciente.)* |
| Su cita está `PENDING` / `CONFIRMED` | **Agendada** (con fecha y hora de la cita) |
| Sin cita, o cita `CANCELLED` / `NO_SHOW`, o cita borrada (`booking_id` NULL), o cita que ya es de **otro paciente** (G1) | **Por agendar** (y se dice por qué) |

Se calcula en **un solo lugar** del servidor (`lib/tratamientos.ts`, `estadoDeSesion()`), y la UI y
la exportación lo leen de ahí (Regla 0).

---

## 2. T1 — Migración SQL (sólo agrega)

Archivo: `packages/database/prisma/migrations/create-tratamientos.sql`. Idempotente, con
`SET lock_timeout = '5s'` y `statement_timeout = '60s'` al inicio, como `create-visitas.sql`.
**No toca tablas existentes** (sólo crea dos nuevas): no hay `ALTER` con ACCESS EXCLUSIVE sobre
tablas vivas.

```sql
CREATE TABLE IF NOT EXISTS medical_records.tratamientos (
  id                     TEXT PRIMARY KEY,
  patient_id             TEXT NOT NULL,
  doctor_id              TEXT NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,
  nombre                 TEXT NOT NULL,
  sesiones_planeadas     INTEGER,                 -- NULL = abierto (sin número fijo)
  intervalo_dias         INTEGER,                 -- sugerencia para agendar (T5)
  precio_paquete         NUMERIC(12,2),           -- P4: sin usar hasta T6
  estado                 VARCHAR(20) NOT NULL DEFAULT 'activo',
  plantilla_sugerida_id  TEXT,                    -- FK abajo (SET NULL)
  notas                  TEXT,
  created_at             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT tratamientos_estado_check CHECK (estado IN ('activo', 'terminado', 'cancelado')),
  CONSTRAINT tratamientos_sesiones_check CHECK (sesiones_planeadas IS NULL OR sesiones_planeadas > 0),
  CONSTRAINT tratamientos_intervalo_check CHECK (intervalo_dias IS NULL OR intervalo_dias > 0),
  CONSTRAINT tratamientos_precio_check CHECK (precio_paquete IS NULL OR precio_paquete >= 0)
);
-- ⚠️ Los NOMBRES reales (constraints e índices) son los de `create-tratamientos.sql`, que siguen
-- el estilo de Prisma — este bloque es el borrador; manda el .sql (corregido en el review de T1).
CREATE INDEX IF NOT EXISTS tratamientos_patient_idx ON medical_records.tratamientos(patient_id, estado);
CREATE INDEX IF NOT EXISTS tratamientos_doctor_idx  ON medical_records.tratamientos(doctor_id, estado);
-- Destino de la FK compuesta "mismo paciente" de las sesiones.
CREATE UNIQUE INDEX IF NOT EXISTS tratamientos_id_patient_id_key
  ON medical_records.tratamientos(id, patient_id);

CREATE TABLE IF NOT EXISTS medical_records.tratamiento_sesiones (
  id              TEXT PRIMARY KEY,
  tratamiento_id  TEXT NOT NULL,
  patient_id      TEXT NOT NULL,     -- redundante A PROPÓSITO: es lo que permite las FKs compuestas
  doctor_id       TEXT NOT NULL,     -- idem (cita del mismo doctor)
  numero          INTEGER NOT NULL,
  cancelada       BOOLEAN NOT NULL DEFAULT false,   -- P1: lo único de estado que se guarda
  booking_id      TEXT,              -- FK abajo (SET NULL): la cita de esta sesión
  visita_id       TEXT,              -- FK abajo (SET NULL): P2, sólo si NO tiene cita
  notas           TEXT,
  created_at      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT tratamiento_sesiones_numero_check CHECK (numero > 0)
);
CREATE UNIQUE INDEX IF NOT EXISTS tratamiento_sesiones_tratamiento_numero_key
  ON medical_records.tratamiento_sesiones(tratamiento_id, numero);
-- Una cita / una visita pertenece a lo sumo a UNA sesión (COMPLETOS, no parciales: lección de
-- visitas — un índice parcial rompe el upsert de Prisma, 42P10).
CREATE UNIQUE INDEX IF NOT EXISTS tratamiento_sesiones_booking_id_key
  ON medical_records.tratamiento_sesiones(booking_id);
CREATE UNIQUE INDEX IF NOT EXISTS tratamiento_sesiones_visita_id_key
  ON medical_records.tratamiento_sesiones(visita_id);
```

### 2.1 Las FKs (en bloques `DO $$ … IF NOT EXISTS`)

| FK | Tipo | Por qué |
|---|---|---|
| `tratamientos(patient_id, doctor_id) → patients(id, doctor_id)` | `CASCADE` | Tenencia (igual que `visitas`). Destino: `patients_id_doctor_id_key`, ya existe. |
| `tratamientos(plantilla_sugerida_id) → encounter_templates(id)` | `SET NULL` | Borrar una plantilla no borra el tratamiento. (Que sea del mismo doctor lo revisa el servidor.) |
| `tratamiento_sesiones(tratamiento_id, patient_id) → tratamientos(id, patient_id)` | `CASCADE` | Una sesión no puede colgar del tratamiento de otro paciente; borrar el tratamiento borra sus sesiones (no borra citas ni visitas). |
| `tratamiento_sesiones(booking_id, doctor_id) → bookings(id, doctor_id)` | `SET NULL (booking_id)` | Cita del mismo doctor (destino `bookings_id_doctor_id_key`, ya existe). Borrar un slot borra sus citas: la sesión sobrevive «por agendar». Que sea del mismo PACIENTE lo revisa el servidor (el paciente de una cita se re-liga; misma razón que en visitas). |
| `tratamiento_sesiones(visita_id, patient_id) → visitas(id, patient_id)` | `SET NULL (visita_id)` | Visita del mismo paciente (destino `visitas_id_patient_id_key`, ya existe). |

> ⚠️ Las FKs compuestas y los `SET NULL (col)` **no se modelan en Prisma** ⇒ `prisma db push` los
> revertiría. En el MISMO commit: comentario ⚠️ en `schema.prisma` y entrada nueva en "DB-only
> constraints" de `docs/NEW.MD-GUIDES/database-architecture.md`.

### 2.2 `schema.prisma`

Modelos `Tratamiento` y `TratamientoSesion` (`@@schema("medical_records")`); back-relations en
`Patient`, `Doctor`, `Booking`, `Visita`, `EncounterTemplate`. Relaciones simples +
`onUpdate: NoAction`. **No correr `prisma format`.** `pnpm db:generate` + type-check de los cuatro
apps: ningún código los usa todavía.

### 2.3 Probar en prod SIN dejar nada (transacción que siempre revierte)

Cada rechazo exige **su** SQLSTATE y **su** constraint, no "cualquier error".

| # | Comprobación | Esperado |
|---|---|---|
| T1-1 | Tratamiento con `patient_id` de otro doctor | Rebota (FK compuesta) |
| T1-2 | Sesión de un tratamiento con `patient_id` de otro paciente | Rebota |
| T1-3 | Dos sesiones con el mismo `booking_id` / mismo `visita_id` / mismo `numero` | La 2ª rebota (cada índice único) |
| T1-4 | Sesión ligada a cita de **otro doctor** | Rebota |
| T1-5 | Sesión ligada a visita de **otro paciente** | Rebota |
| T1-6 | Borrar la cita de una sesión | La sesión sigue, `booking_id` NULL |
| T1-7 | Borrar la visita de una sesión | La sesión sigue, `visita_id` NULL |
| T1-8 | Borrar el tratamiento | Sus sesiones se van; citas y visitas intactas |
| T1-9 | Borrar el **paciente** (con tratamiento + sesión + cita + visita) | No truena y no queda nada suyo |
| T1-10 | Borrar el **doctor** (ídem) | No truena |
| T1-11 | Re-ligar el paciente de una cita que es sesión | **No** se bloquea |
| T1-12 | Borrar una plantilla sugerida | `plantilla_sugerida_id` NULL |
| T1-13 | Correr el SQL dos veces | La 2ª no falla (idempotente) |
| T1-14 | Estructura: `pg_get_constraintdef` exacta de cada FK; índices únicos **no** parciales | Coincide |

Si todo pasa: se corre de verdad y se verifica con `pg_constraint`. **Commit de T1**: sólo
`packages/database/**` + el doc ⇒ no despliega nada (a propósito).

**✅ Hecho (2026-09-29).** Code review (alto) antes de correrlo, 10 hallazgos; arreglados en el
`.sql`: índice `tratamientos_id_doctor_id_key` (destino de la FK de tenencia de T6), índice sobre
`plantilla_sugerida_id` (si no, borrar una plantilla recorre todos los tratamientos), FK de
tenencia de la sesión `(patient_id, doctor_id)`, y **todos los locks al principio en orden fijo**
(`LOCK TABLE … IN SHARE ROW EXCLUSIVE MODE`) para no trabarse con una cita que se concluye. El
probe se reforzó (T1-8 con una visita DE VERDAD ligada, T1-10 contando lo que queda, los 5 CHECKs
ejercitados y comparados, los 11 índices por definición completa): **25/25**. Se aplicó con un
script que corre el `.sql` en UNA transacción y compara las 7 FKs, 5 CHECKs y 11 índices ANTES del
commit (si algo no cuadra, rollback): todo OK, 0 filas. ⚠️ El probe toma SHARE ROW EXCLUSIVE sobre
doctors/patients/bookings/visitas/encounter_templates durante toda su corrida (bloquea
ESCRITURAS): si se vuelve a correr, en horario de poco tráfico.

---

## 3. T2 — La API (apps/doctor)

Rutas nuevas bajo `medical-records/patients/[id]/…` ⇒ **heredan el permiso `expedientes`** (como
visitas: sin toggle propio). Lo que viene de la cita se recorta con `citas` (hora/servicio), igual
que el bloque de cita de una visita (`lib/booking-permisos.ts`).

| Ruta | Qué |
|---|---|
| `GET  …/tratamientos` | Lista del paciente (activos primero), cada uno con conteo por estado de sus sesiones |
| `POST …/tratamientos` | Crear (nombre obligatorio; sesiones planeadas, intervalo, plantilla sugerida, notas opcionales). Con `sesionesPlaneadas = N` crea las N sesiones «por agendar» (1..N) en la misma transacción |
| `GET  …/tratamientos/[tid]` | Detalle con sus sesiones y el **estado derivado** de cada una (+ fecha/hora de su cita si se puede ver) |
| `PATCH …/tratamientos/[tid]` | Editar nombre, notas, estado (activo · terminado · cancelado), plantilla sugerida, sesiones planeadas |
| `DELETE …/tratamientos/[tid]` | Sólo si **ninguna** sesión tiene cita ni visita (409 con el conteo); si no, se marca «cancelado» |
| `POST …/tratamientos/[tid]/sesiones` | Agregar una sesión (siguiente número) |
| `PATCH …/tratamientos/[tid]/sesiones/[sid]` | Ligar/desligar **cita** (del mismo paciente y doctor, no CANCELLED/NO_SHOW, que no sea ya de otra sesión) · ligar/desligar **visita** (sólo sin cita, P2) · `cancelada` · notas |
| `DELETE …/tratamientos/[tid]/sesiones/[sid]` | Sólo si no tiene cita ni visita (si no: se marca cancelada). **Nunca cancela la cita en silencio** (DISEÑO §4): eso es de la agenda |

- Todo en `apps/doctor/src/lib/tratamientos.ts` (validación, `estadoDeSesion()`, conteos con
  `groupBy`, nunca `_count` — lección de visitas).
- Auditoría en `patient_audit_logs`: `create_tratamiento`, `update_tratamiento` (from → to),
  `link_sesion_cita` / `link_sesion_visita` (from → to) — NOM-024.
- **Smoke contra prod** (tx revertida) de cada query nueva antes del push.

### 3.1 ✅ Cómo quedó (2026-10-01)

**Archivos:** `apps/doctor/src/lib/tratamientos.ts` (toda la lógica) + 4 rutas bajo
`medical-records/patients/[id]/tratamientos/` (`route.ts` · `[tratamientoId]/route.ts` ·
`[tratamientoId]/sesiones/route.ts` · `[tratamientoId]/sesiones/[sesionId]/route.ts`) + G3 en las
rutas de visitas (`visitas/route.ts` POST y `visitas/[visitaId]/route.ts` PATCH). Las reglas comunes
de «¿se puede ligar esta cita?» viven UNA vez en `lib/visitas.ts` → `cargarCitaLigable()` (la usan
la visita y la sesión).

**Tres desviaciones de §3/§8, aprobadas por el usuario el 2026-10-01** (P2 revisado manda sobre lo
que se escribió antes de revisarlo):

| Dónde | Decía | Quedó | Por qué |
|---|---|---|---|
| G2 · G3 | al ligar la cita, «`visita_id` se limpia» | **se conserva** | P2 revisado: la sesión SIEMPRE guarda su visita; limpiarla trae de vuelta el bug que P2 vino a quitar (cita borrada ⇒ sesión hecha vuelve a «por agendar»). |
| `DELETE` tratamiento / sesión | «si no, se marca cancelado/a» | **409 con el conteo**; el cliente cancela con `PATCH` | Un DELETE que en silencio hace OTRA cosa sorprende a quien lo llama. |
| `PATCH` sesión, `visitaId` | «ligar visita sólo sin cita» | igual, y además: con cita sólo se acepta **re-enviar la visita que la sesión muestra** | Soltar/cambiar la visita de una sesión con cita borraba la protección de P2 mientras la respuesta seguía mostrando la misma visita. |

**Reglas que el review (tres pasadas: 10 + 10 + 2 hallazgos, todos reales) obligó a poner y que el plan no decía:**

- **Mismo día:** ligar una cita a una visita que YA tiene plantillas exige que la cita sea del MISMO
  día (`exigirMismoDiaSiTienePlantillas`, `lib/visitas.ts`), en los DOS caminos que lo hacen: mover
  la visita manual de una sesión a su cita (G2) y el `PATCH` de la visita. ⚠️ **Cambio de
  comportamiento de la fase 1:** hasta hoy sólo lo cuidaba la pantalla (`ligables`); la regla ya
  estaba confirmada por el usuario (2026-09-29), así que la UI no cambia — sólo deja de poder
  saltársela una llamada directa. El resto del pendiente de la fase 1 (el PUT de consultas, «Traer
  aquí» / «Mover a…») sigue abierto.
- **Una cita «vieja» no cuenta** (`citaEfectiva()`): la de una sesión cuya cita se re-ligó a otro
  paciente o a ninguno no se muestra, así que tampoco bloquea ligar una visita, borrar la sesión,
  borrar el tratamiento ni que la sesión de una visita tome una cita nueva.
- **Formularios que mandan todo:** re-enviar la cita o la visita que la sesión MUESTRA no es
  cambiarlas (`{ bookingId: null, visitaId: <la mostrada> }` sólo desliga la cita).
- **Desligar la cita de una visita** que con esa cita forma una sesión → **409** («desliga desde el
  tratamiento»). Si no, al concluirse la cita nacería una 2ª visita para la misma sesión.
- **Desligar o CAMBIAR la cita de una sesión** (a propósito) suelta también la visita guardada
  **si es la de esa cita** (si no, cambiar B→Y en un paso chocaba con «una visita no puede ser de
  dos citas»): P2 protege de lo que pasa SIN que el doctor lo pida (cascada, re-ligar), no de que
  diga «esta cita no era de la sesión».
- **G1 al ligar:** si la cita sigue en la sesión del paciente ANTERIOR (se re-ligó y T4 aún no la
  suelta), se suelta de ahí en la misma transacción y se audita **en el expediente de ESE paciente**.
- **Motivos de «por agendar»:** `sin_cita` · `cita_cancelada` · `cita_no_asistio` ·
  `cita_de_otro_paciente` · `cita_sin_expediente` (la cita se desligó de todo expediente). Aviso
  `visita_no_abierta` en «hecha» por cita COMPLETED sin visita.
- **Borrar un tratamiento** cuenta y borra en UNA transacción con candados `FOR UPDATE`: primero
  el tratamiento (una sesión nueva lo necesita por la FK y espera) y luego sus sesiones (un ligado en
  curso termina antes o espera): sin ellos, la cascada podía llevarse una sesión recién ligada. Borrar una sesión es un `deleteMany` condicionado a que siga sin cita ni visita.
- **Tope de 100 sesiones** cuenta las que EXISTEN, no el número más alto (P3 deja huecos).
- **`precioPaquete` en el body → 400** (no se ignora): una pantalla que lo mandara creería que se guardó.

**Auditoría:** `create/update/delete/view_tratamiento`, `create/update/delete_sesion`,
`link_sesion_cita`, `link_sesion_visita`, y `update_visita` cuando G2 mueve una visita a una cita.
La SESIÓN tiene su propia fila aunque el cambio venga de las rutas de visitas (G3 al crear/ligar, y
al BORRAR una visita que una sesión guardaba — la FK la suelta en silencio).

**Probado:** type-check de `apps/doctor` limpio · `pnpm gates` en verde ·
`scripts/visitas/tratamientos-probe-t2.cjs` contra prod en tx revertida **26/26** (dr-prueba; tablas
siguen en 0 filas después) · `estadoDeSesion()` corrido con tsx contra la tabla de §1 (11/11). **NO
probado:** las rutas por HTTP con una sesión real — eso llega con T3 (la UI) o con un `curl`
autenticado. Hasta T3 nadie las llama.

**Aceptado, sin arreglo:** el `PATCH` de la sesión lee el plan de ligado fuera de su transacción; una
carrera la detiene el índice único y sale como 409 legible (`unicaDeSesion`), no como dato mal ligado.

## 4. T3 — La UI (apps/doctor)

- **Perfil del paciente:** tarjeta **«Tratamientos»** debajo de «Visitas» (sólo si hay; botón
  «Nuevo tratamiento»). Cada uno: nombre, «3 de 6 hechas · 1 agendada», estado. `ListaColapsable`.
- **Pantalla del tratamiento** `patients/[id]/tratamientos/[tid]`: las sesiones en orden, cada una
  con su estado derivado, la fecha de su cita, y enlace a su visita. Acciones por sesión: «Ligar una
  cita…» (citas del paciente sin sesión) · «Abrir su visita» · «Cancelar sesión». «+ Agregar
  sesión». Editar datos del tratamiento.
- **Visita que es sesión:** la pantalla de la visita dice «Sesión 3 de 6 — Injerto capilar» con
  enlace al tratamiento.
- **Precio del paquete: NO se pinta** hasta T6 (P4).
- El manual (`manual-del-doctor.md`), la guía y el widget cambian **en el MISMO commit** que la UI.

### 4.1 Cómo se está construyendo (2026-10-01) — detrás de la lista de dr-prueba

**Tres decisiones del usuario (2026-10-01), cambian lo de arriba:**

| # | Decía | Quedó | Por qué |
|---|---|---|---|
| 1 | «El manual, la guía y el widget cambian en el MISMO commit que la UI» | **Cambian en el commit de LANZAMIENTO** (como la fase 1, `42ed7f01`) | Mientras sólo dr-prueba lo ve, el widget le describiría a los demás algo que no tienen. G6 (exportar) también entra antes de lanzar. |
| 2 | G8: «la UI pregunta ¿cancelar también la cita?» | Diálogo con **tres** salidas: cancelar sesión **y** cita · **sólo** la sesión · nada. La cita va **primero**, por la ruta de la agenda (`PATCH apps/api …/bookings/[id]` CANCELLED, con sus mismos avisos); si falla, se detiene y la sesión NO se cancela | Un confirm de sí/no no distingue «sólo la sesión» de «nada»: su «Cancelar» y el Esc cancelaban la sesión (review). |
| 3 | — | **Sin intervalo (T5), sin precio (T6) y sin plantilla sugerida (T4)** en pantalla | Un campo que todavía no hace nada promete algo falso. La plantilla sugerida sólo sirve para pre-elegirse en «Agregar plantilla», que es T4. La API los sigue aceptando. |

**Archivos:** `lib/tratamientos-ui.ts` (candado `tratamientosUiActiva()` = sólo dr-prueba, tipos y
textos) · `components/medical-records/tratamientos/` (`TratamientosCard`, `NuevoTratamientoModal`,
`useTratamientosDelPaciente`) · pantalla `patients/[id]/tratamientos/[tratamientoId]/` (+ su hook) ·
renglón «Sesión 3 de 6 — X» en la pantalla de la visita.

**Dos agregados a la API** (smoke contra prod en el mismo probe, **30/30**):
`GET …/tratamientos/[tid]` devuelve también `ocupadas { citas, visitas }` (lo que ya es de alguna
sesión del paciente, para que los selectores no ofrezcan lo que daría 409) y
`GET …/visitas/[visitaId]` devuelve `sesion` (`sesionDeVisita()`: la sesión que GUARDA la visita
y, si ninguna, la de su cita — sólo si la cita sigue siendo de este paciente).

**Lo que la pantalla filtra para no ofrecer un 409:** citas de otra sesión; citas con su PROPIA
visita si la sesión guarda otra (G2); citas de otro día si la visita de la sesión tiene plantillas.
Una sesión cuya cita se canceló o no asistió («Por agendar») **sí** ofrece ligar otra.

## 5. T4 — Sincronía con la agenda

**Con P1, queda poco:** el estado se deriva al leer, así que concluir, cancelar, no-show y borrar
citas **no necesitan enganche**. Queda:

- **P2 revisado:** `syncVisitaForBooking` (packages/database), al crear o ligar la visita de una
  cita que es sesión, escribe también `tratamiento_sesiones.visita_id` — en la misma transacción.
  Así la sesión conserva su visita aunque después la cita se borre o se re-ligue.

- **G1 (b):** al re-ligar el paciente de una cita (`apps/api/.../bookings/[id]`, donde ya corre D1b),
  soltar la cita de la sesión del paciente anterior en la misma transacción.

- **Plantilla sugerida:** al abrir «Agregar plantilla» en una visita que es sesión, viene elegida
  la plantilla sugerida del tratamiento.
- **Aviso de la agenda:** en la tarjeta de la cita, «Sesión 3 de 6 — Injerto capilar» (lectura).

(Si P1 se rechaza, T4 es un enganche en `apps/api/.../bookings/[id]` para cada transición + un
barrido para las citas que se borran por cascada. Por eso se recomienda P1.)

---

## 6. Después (T5–T7), en esbozo — se detallan cuando toque

- **T5 — Agendar N sesiones de una vez** (DISEÑO §4): cada cita por la MISMA ruta de la agenda (no
  un quinto camino; lección CONSULTORIOS), falla parcial = se crea lo que cabe y el resto queda «por
  agendar» con su motivo, **un** correo resumen al paciente. Toca `apps/api` (correo) — riesgo medio.
- **T6 — Dinero** (DISEÑO §5): `precio_paquete` visible; `tratamientoId` opcional en `LedgerEntry`
  (migración aparte); pagos del paquete; al concluir una sesión de un tratamiento CON paquete, el
  **servidor** registra el cobro de $0 «cubierta por paquete» (hoy `createCitaLedgerEntry` sólo
  corre con precio > 0); cargo extra = el cobro de esa cita (no dos movimientos: `bookingId` es
  `@unique`); saldo calculado. **Toca el modelo de dinero:** leer primero
  `docs/DESDE JUNIO/flujo de dinero permutaciones/SESSION-REFRESCO.md`; review completo + pruebas
  de permutaciones. El riesgo más alto de la fase.
- **T7 — Cierre:** exportar cuenta incluye tratamientos y sesiones (LFPDPPP; `apps/api`);
  «Es seguimiento de…» en «Nueva Visita» (P5); filtro por tratamiento donde aplique.

## 7. Orden y puntos de parada

```
Decisiones P1–P5 (usuario) ──► T1 SQL + probe (tx revertida) ──► correr de verdad ──► commit T1
                                  └─ OK usuario                  └─ OK usuario
T2 API (smoke + review) ──► T3 UI + manual (review) ──► T4 ──► prueba a mano en dr-prueba
 (cada uno: OK → push → commitHash por servicio)
T5 · T6 · T7 — cada uno con su propio plan detallado aquí, antes de tocar código.
```

¿Detrás de una lista (sólo dr-prueba) como la fase 1? **Propuesta: sí para T3** (la UI), hasta la
prueba a mano; no hay backfill que obligue, así que se puede abrir en cuanto se pruebe.

---

## 8. Huecos encontrados al revisar este plan (2026-09-29) y su arreglo

Revisión contra el código y las lecciones de la fase 1. Cada arreglo ya dice en qué paso va.

| # | Hueco | Arreglo | Paso |
|---|---|---|---|
| **G1** | **Cita re-ligada a OTRO paciente.** La FK de la cita es por doctor (el paciente se re-liga, B10/T1-11), así que la sesión del paciente A seguiría apuntando a una cita que ya es de B — y mostraría la hora y el estado de otra persona. | (a) `estadoDeSesion()` ignora una cita cuyo `patient_id` ≠ el de la sesión («por agendar — la cita pasó a otro expediente»); (b) en `apps/api/.../bookings/[id]`, donde ya corre D1b al re-ligar, en la MISMA transacción se suelta `booking_id` de la sesión. ⇒ **T4 no queda vacío**: este enganche. | T2 (a) · T4 (b) |
| **G2** | **Ligar una cita a una sesión que ya tiene visita manual** (P2): quedarían dos visitas para la misma sesión (la manual + la automática de la cita). | Si la cita **no** tiene visita: la visita manual se liga a esa cita (misma regla que «Ligar una cita…» en la pantalla de la visita, incluido el mismo día si tiene plantillas) y `visita_id` se limpia. Si la cita **ya** tiene visita: 409 con el porqué («esta cita ya tiene su visita; mueve lo de la visita del 12 sep o desliga una»). | T2 |
| **G3** | **Una visita en dos sesiones por dos caminos:** la visita V es la de la sesión S1 (`visita_id`) y desde la pantalla de la visita se le liga la cita C, que es de la sesión S2. Los índices únicos no lo ven (columnas distintas). | La ruta EXISTENTE que liga cita a visita (`PATCH …/visitas/[id]`, `lib/visitas.ts`) revisa sesiones: si C es de otra sesión → 409; si C no es de ninguna → S1 pasa a `booking_id = C`, `visita_id = NULL` (la forma normal de P2). **Toca código de la fase 1** ⇒ va con review completo. | T2 |
| **G4** | Ligar una cita a una sesión **no decía** que exige el permiso `citas` (en visitas sí: 403 `PERMISSION_BLOCKED`). | Mismo recorte que D2: ligar/desligar cita exige `citas`; leer la hora/servicio también. | T2 |
| **G5** | **Precio del paquete a quien no debe verlo:** `GET …/tratamientos` devolvería `precio_paquete` a un ayudante sin `flujo`. | Hasta T6 **no se devuelve** (nadie lo usa); desde T6, sólo con `flujo` (como el cobro en la visita). | T2 · T6 |
| **G6** | **Exportar cuenta (LFPDPPP) quedaba al final (T7)**, pero los tratamientos son información del doctor desde el primer uso real. | La exportación de tratamientos y sesiones entra **antes de abrir T3 a todos** (mientras sólo dr-prueba lo use, puede esperar). | antes de abrir T3 |
| **G7** | **Qué hace editar `sesionesPlaneadas`** no estaba definido (el POST crea N sesiones; ¿y el PATCH?). | El PATCH sólo cambia el número del plan: **nunca crea ni borra sesiones solo**. La pantalla dice «4 creadas de 6 planeadas» con «+ Agregar sesión». | T2 · T3 |
| **G8** | **Cancelar una sesión con cita activa** dejaba la cita en la agenda (y el paciente llegaría a una sesión «cancelada»). | La UI pregunta «¿Cancelar también la cita del 3 oct?» y, si sí, usa la ruta de la agenda (`PATCH bookings/[id]` CANCELLED) — nunca en silencio, nunca un segundo camino. `cancelada` manda en el estado derivado. | T3 |
| **G9** | Dos «+ Agregar sesión» a la vez chocan en el índice único de `numero`. | El servidor reintenta una vez con el siguiente número; si vuelve a chocar, 409 legible. | T2 |
| **G10** ✅ *todos los planes* | **¿Tratamientos es de algún plan?** Hoy heredaría `expedientes` (todos los planes) por el prefijo `medical-records` en `ROUTE_PERMISSION_MAP` — el gate de rutas ya lo cubre sin tocar nada. | **Decisión de producto pendiente.** Recomendación: para todos (es parte del expediente). Si se quiere como palanca de PRO: entrada con `feature` en `route-permissions.ts` + `TIER_EXCLUDED_KEYS` + `gate:catalogo` + el reparto duplicado a propósito del sitio público. | antes de T2 |
| **G11** | El DISEÑO se contradiría con P1 (§3 guarda `estado`; §4 lo sincroniza) y su §8 lista «informes médicos dentro de la visita» como fase 2, pero ya se hizo en la fase 1 (D3). | Al aprobar P1: actualizar `01-DISENO` §3, §4 y §8 en el commit de T1 (el doc congelado no debe mentir sobre lo que se construye). | T1 |

**Aceptado, sin arreglo:** borrar un slot borra su cita (cascade) y la sesión pasa a «por agendar»
sin guardar que *tuvo* cita ese día — la agenda ya perdió ese dato; el tratamiento no lo inventa.
