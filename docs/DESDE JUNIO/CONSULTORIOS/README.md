# 🏥 CONSULTORIOS — que la CITA sepa en cuál consultorio es

> **Índice de la carpeta.** Tipo **ESTADO / BITÁCORA**: se actualiza al cerrar cada sesión.
> Abierta el **2026-08-06** a pedido del usuario.

## En una frase

**Ya está: la cita sabe en cuál consultorio es** — la hereda del rango que la contiene, y cuando
no hay de dónde heredarla se pregunta (sólo si el doctor tiene 2+), tanto en el modal como en el
agente. **Los 4 pasos están en producción desde el 2026-08-06.**

## Los documentos

| | |
|---|---|
| 👉 [`SESSION-REFRESCO.md`](SESSION-REFRESCO.md) | **EMPIEZA AQUÍ** — estado vivo, qué falta MIRAR en prod, y lo que costó caro |
| [`02-PLAN-columna-y-los-tres-saltos.md`](02-PLAN-columna-y-los-tres-saltos.md) | Los 4 pasos, el porqué del orden, y cómo quedó cada uno (§4.1 endpoints · §4.2 modal · §4.3 agente + evals) |
| [`01-ESTADO-que-ya-funciona.md`](01-ESTADO-que-ya-funciona.md) | El diagnóstico ORIGINAL (§§2-3 ya no describen el presente, están marcadas) |

## Estado (2026-08-06)

| Paso | Estado |
|---|---|
| 0. Pre-vuelo read-only contra prod | ✅ **HECHO** — `clinic_locations.id` es `text` (la FK empata), y **una sola doctora opera de verdad en dos sedes** (`01-ESTADO` §4) |
| 1. Columna `location_id` en `bookings` | ✅ **EN PROD** (`e2d10151`) |
| 1b. Backfill de las citas viejas | ❌ **DESCARTADO por el usuario.** Las 269 se quedan sin consultorio (`02-PLAN` §5.1) |
| 2. Los endpoints la aceptan y la guardan | ✅ **EN PROD** (`75fdcbd2`) — único paso **probado con un clic real** |
| 3. La UI la manda / la hereda del rango | ✅ **EN PROD** (`06aad405`) — modal. ⬜ Falta MOSTRARLA en la tabla de citas |
| 4. El agente pregunta (sólo si hay 2+) | ✅ **EN PROD** (`ea2b62f7`) — y ya LEE el consultorio de las citas |

⚠️ **Extra que salió de aquí:** borrar un rango con citas dentro **ya se puede** (`b32fde2f`,
pedido del usuario); las citas quedan intactas porque nunca dependieron del rango.

🔴 **El orden no es negociable.** Preguntar el consultorio antes de tener dónde guardarlo es peor
que no preguntarlo: el doctor cree que quedó registrado y se descarta en silencio.

## De dónde viene este pedido

Del usuario, el 2026-08-05, al cerrar la sesión de AGENDAR SIN FRICCIÓN:

> *"A veces los doctores tienen uno o dos consultorios, y no estamos preguntando en cuál es la
> cita cuando tienen más de uno."*

Vive anotado —con el orden obligatorio— en
[`../AGENTES/AGENDAR SIN FRICCION/SESSION-REFRESCO.md`](../AGENTES/AGENDAR%20SIN%20FRICCION/SESSION-REFRESCO.md)
§5b B y en [`../CITAS/SESSION-REFRESCO.md`](../CITAS/SESSION-REFRESCO.md) §8. Esta carpeta es
donde se ejecuta.

## Paso 1 — cómo se corrió y cómo se verificó (2026-08-06)

```bash
railway run --service pgvector bash -c \
  '"…/packages/database/node_modules/.bin/prisma" db execute \
     --file "…/prisma/migrations/add-booking-location.sql" --url "$DATABASE_PUBLIC_URL"'
```

`$DATABASE_PUBLIC_URL` se expande **dentro** del hijo que lanza `railway run` (comillas simples),
así que el password nunca aparece en la línea de comandos ni en la salida.

⚠️ **El primer intento falló con `dns error: No such host is known` contra la API de Railway.**
No corrió nada — falla ANTES de conectarse a la BD. Al reintentar: `Script executed successfully`.
Si vuelve a pasar, no es la migración: es la red.

**Verificado contra prod (`yamanote.proxy.rlwy.net`), no confiando en el mensaje de éxito:**

| | |
|---|---|
| Columna | `location_id` · `text` · `is_nullable: YES` ✅ |
| Constraint | `bookings_location_id_fkey` ✅ |
| Índice | `bookings_location_id_idx` ✅ |
| Filas tocadas | **0** — las 411 citas siguen con `location_id` null |

**Y el smoke de la FORMA DE QUERY nueva, por el cliente Prisma** (no por SQL crudo — es el camino
que van a usar los endpoints, y una vez un `$queryRaw` sobre una función `void` tumbó la creación
de citas en prod con el SQL perfectamente bien):

1. `select: { locationId }` ✅
2. `include: { location }` — el JOIN que hará la UI ✅
3. `count({ where: { locationId: null } })` → **411** ✅
4. La relación inversa `location.bookings` ✅

**`schema.prisma` se actualizó en el MISMO commit** (`Booking.locationId` + la relación con
`onDelete: SetNull` + `ClinicLocation.bookings`), y se corrió `prisma generate`. Si la BD y el
schema divergen, el siguiente `db push` "arregla" la diferencia **borrando la columna**.

**Rollback:** `ALTER TABLE public.bookings DROP COLUMN location_id;` — nada la lee todavía.

### El `/code-review` del paso 1 — 5 hallazgos

Dos eran reales y míos, uno estaba invertido, y uno no era un bug:

1. **Faltaba `@@index([locationId])` en el modelo.** El SQL creaba el índice y el schema no lo
   declaraba ⇒ drift, y un `db push` habría borrado **justo el índice que le da sentido a la
   columna**. Corregido. Prisma lo nombra `bookings_location_id_idx`, idéntico al del SQL.
2. **El encabezado del `.sql` afirmaba `NULL = consultorio por defecto`** — la invariante que
   §5.1 acababa de descartar con datos. **El archivo de migración sobrevive al doc y es lo que
   lee el siguiente**, así que ahora dice `NULL = NO REGISTRADO` y qué debe hacer la UI.
   Corregido también en el comentario de `schema.prisma`.
3. **"Commitea el `.sql` junto al schema o prod truena con `column does not exist`"** — el
   consejo es correcto, el escenario está **al revés**: la columna YA está en prod (se corrió y
   se verificó antes). El riesgo vivo es el inverso — prod la tiene y el repo no la declara, así
   que un `db push` desde un checkout sin este commit la borraría. Se commitea todo junto.
4. **El formulario "nuevo horario" seguía en 24 h** (select de inicio + "Hora de fin") mientras
   el encabezado y el éxito del MISMO modal ya hablaban en 12 h. Sólo vive en la ruta muerta
   `v1` —y sobre slots, que están obsoletos— pero medio archivo localizado es peor que ninguno.
   Corregido: la etiqueta se localiza, el `value` sigue en 24 h porque es lo que viaja al server.
5. **`"24:00"` NO es un bug.** El hallazgo decía que se rinde como "12:00 AM" y eso es
   "fin de día mostrado como inicio de día". Medido: en notación de 12 h la medianoche **es**
   "12:00 AM" — no hay otra forma de escribirla, y como hora de FIN es correcta. Validar
   `h > 23` haría caer al passthrough y rendiría `"24:00"` crudo junto a horas en 12 h: la mezcla
   que la función existe para quitar. **No se cambió**, se documentó el porqué.

**Verificación extra que salió de esto:** `prisma migrate diff --from-url <prod> --to-schema-datamodel`
**no** pide `ADD COLUMN` ni `CREATE INDEX` para `location` ⇒ prod y el schema coinciden.
⚠️ Sí pide recrear FKs por `ON UPDATE`, **pero para las TRES tablas** (`appointment_slots`,
`availability_ranges`, `bookings`): es drift preexistente de todo el repo, no de este cambio. La
FK nueva quedó idéntica a sus dos hermanas a propósito.
