# 02 — El plan: una columna y tres saltos

> Tipo **DECISIÓN / REFERENCIA**. Escrito el **2026-08-06**. El paso 1 tiene el SQL listo y
> **nada corrido**.

## 1. El orden, y por qué no es negociable

```
1. columna  →  2. endpoints  →  3. UI  →  4. agente
```

Cada paso sólo tiene sentido si el anterior existe:

- Sin **columna**, el endpoint no tiene dónde escribir.
- Sin **endpoint**, la UI manda un campo que se ignora.
- Sin **UI**, el agente sería la única superficie que lo registra ⇒ se viola **CIT-6** (*el agente
  no tiene capacidades que la UI no tiene*).
- Y preguntar antes de todo eso es lo peor de todo: **el doctor cree que quedó registrado** y la
  respuesta se descarta en silencio. Preguntar algo cuya respuesta se tira es peor que no
  preguntar.

## 2. Paso 1 — la columna

**Archivo:** `packages/database/prisma/migrations/add-booking-location.sql`

```sql
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS location_id TEXT;
-- + FK a public.clinic_locations(id) ON DELETE SET NULL  (en DO block, idempotente)
-- + CREATE INDEX IF NOT EXISTS bookings_location_id_idx
```

Tres decisiones que ya están tomadas en ese archivo:

1. **`NULL` = el consultorio por defecto del doctor.** Es la convención que ya usan
   `appointment_slots.location_id` y `availability_ranges.location_id` — está escrita en el
   `schema.prisma` de las dos. No se inventa un significado nuevo.
2. **`ON DELETE SET NULL`**, que es lo que Prisma genera para la relación opcional de
   `availability_ranges`. Borrar un consultorio **nunca** puede borrar citas; sólo deja de decir
   dónde eran.
3. **Índice sobre `location_id`**, porque filtrar citas por consultorio es justo la capacidad que
   hoy el agente declina por falta de dato.

⚠️ **`prisma db push` NO** — revierte el composite FK de `bookings` y los índices parciales de
`doctor_members` que viven sólo en prod. Migración = SQL manual + `prisma db execute`. Método:
[`../../NEW.MD-GUIDES/database-architecture.md`](../../NEW.MD-GUIDES/database-architecture.md) §6.

⚠️ **Y `schema.prisma` se actualiza en el MISMO commit**, con su `locationId String? @map("location_id")`
y la relación inversa en `ClinicLocation`. Si la BD y el schema divergen, el siguiente que corra
`db push` "arregla" la diferencia borrando la columna.

## 3. Pre-vuelo obligatorio (solo lectura)

Antes de correr nada, el script `scratchpad/check-booking-location.cjs` contesta cinco cosas
contra prod, **sólo con SELECT**:

1. ¿`bookings.location_id` ya existe? (¿alguien lo corrió antes?)
2. ¿Existen ya la constraint y el índice?
3. ¿Cuántos doctores tienen 2+ consultorios? — **se re-mide, no se copia del doc**
4. ¿Cuántas citas caen dentro de un rango que SÍ tiene consultorio? — tamaño del backfill posible
5. ¿`clinic_locations.id` es `TEXT`? — si no, la FK truena

```bash
railway run --service pgvector node <scratchpad>/check-booking-location.cjs
```

Método canónico:
[`../flujo de dinero permutaciones/TOOLING-acceso-railway-db.md`](../flujo%20de%20dinero%20permutaciones/TOOLING-acceso-railway-db.md)
· tablas y gotchas de agenda en
[`../AGENTES/AGENTE AGENDA/TOOLING-acceso-railway-db-agenda.md`](../AGENTES/AGENTE%20AGENDA/TOOLING-acceso-railway-db-agenda.md).

🔴 **El script ABORTA si no hay `DATABASE_PUBLIC_URL`, y no cae a `DATABASE_URL`.** Esa variable
del repo apunta a una **BD local vacía** (lo dice el TOOLING de agenda), así que el fallback
habría contestado *"la columna no existe · 0 doctores con 2+ consultorios · 0 citas"*: tres
respuestas plausibles, las tres falsas, e indistinguibles de las verdaderas. Es la misma clase de
bug que *"una lista vacía no es una respuesta"* — y aquí decidiría si se corre un `ALTER TABLE`
contra prod. Además imprime el **host** al conectarse, para poder afirmar contra qué se midió.

## 4. Pasos 2–4, en corto

| Paso | Qué |
|---|---|
| **2. Endpoints** | `range-bookings/instant` acepta `locationId` y lo guarda. `range-bookings` **hereda** el del rango que ya tiene en la mano (`01-ESTADO` §3) — una línea. |
| **3. UI** | El picker manda el consultorio; una cita que nace dentro de un rango lo hereda sin preguntar. Sólo hay algo que elegir cuando el doctor tiene 2+ **y** la cita es freeform. |
| **4. Agente** | `get_locations` ya existe. Preguntar **sólo** si el doctor tiene 2+ y la cita no hereda de un rango; mandar `locationId` en `propose_create_booking`. Toca prosa del módulo agenda ⇒ `gate:prosa` + `gate:prompt` + **DOS corridas de evals**. |

Y al cerrar: **revisar `02-CAPACIDADES`**, que hoy dice que el agente no puede filtrar por
consultorio *"porque el dato no existe"*. Esa frase deja de ser cierta con el paso 2.

## 5. Decisiones ABIERTAS (del usuario, no del código)

1. **¿Se rellenan las citas VIEJAS? → SÍ, y son SEIS.** *(Resuelto con datos el 2026-08-06.)*

   La respuesta cambió al medir. El razonamiento inicial era *"no rellenar: `NULL` ya significa
   el de por defecto, que es lo que cualquiera asume hoy"*. **Eso se rompe justo para la única
   doctora que necesita la feature.**

   Para un doctor de una sede, `NULL` → por defecto es inofensivo: sólo hay una respuesta. Para
   `dra-adriana-michelle`, `NULL` resuelve al hospital marcado como default, así que en cuanto el
   paso 3 lo muestre, **la mitad de sus citas afirmarían el hospital EQUIVOCADO**. No es un dato
   ausente que se ve ausente; es un dato ausente que se rinde como una afirmación falsa — la
   misma clase que *"una lista vacía no es una respuesta"*.

   **Alcance real, medido:** de 268 citas heredables en toda la BD, sólo **6** tienen una
   respuesta no obvia, y son todas suyas (`01-ESTADO` §4). Cada una cae dentro de **exactamente
   un** rango — el API prohíbe que dos rangos se solapen — así que no hay inferencia ni empate:
   el rango nombra su hospital y ya.

   **Cómo se hace, entonces:** paso aparte del `ALTER TABLE`, con las 6 filas impresas ANTES y
   DESPUÉS. A esa escala se revisan a ojo, que es lo que vuelve seguro un backfill que a escala
   de miles no lo sería.
2. **En freeform, ¿se pregunta o se asume el de por defecto?** Preguntar cuesta un turno en el
   agente y un control en el picker; asumir puede mandar al paciente a la dirección equivocada
   para 3 de 11 doctores.
3. **¿Se muestra el consultorio en la tabla y en el modal de la cita?** Guardar sin mostrar deja
   el dato correcto e invisible — que es la mitad del problema que este trabajo viene a resolver.
