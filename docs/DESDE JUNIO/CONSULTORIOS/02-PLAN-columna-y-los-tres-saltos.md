# 02 — El plan: una columna y tres saltos

> Tipo **DECISIÓN / REFERENCIA**. Escrito el **2026-08-06**.
>
> **Estado:** paso 1 ✅ corrido en prod (`e2d10151`) · paso 2 ✅ los dos endpoints de rangos ·
> pasos 3 y 4 pendientes. El backfill de §5.1 **NO se ha corrido**.

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

1. 🔴 **`NULL` = NO REGISTRADO.** *(Corregido al implementar. Este punto decía antes lo
   contrario: "`NULL` = el consultorio por defecto", por seguir la convención de
   `appointment_slots.location_id` y `availability_ranges.location_id`.)*

   **Se invierte a propósito, y es la decisión central de toda la feature.** Heredar esa
   convención convertiría un dato ausente en una afirmación concreta y falsa: para
   `dra-adriana-michelle`, resolver `NULL` al default manda al paciente al hospital equivocado
   (§5.1 — medido: **2 citas** de las suyas caen en el que NO es el default). Un `NULL` que
   se ve `NULL` se puede arreglar; un `NULL` que se rinde como "Hospital Ángeles" no.

   ⚠️ Por eso **ningún lector puede resolver `bookings.location_id` al default**, y por eso el
   paso 2 hereda sólo de rangos que **sí** tienen consultorio (`locationId: { not: null }`).
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
| **2. Endpoints** ✅ | `range-bookings/instant` acepta `locationId` y lo guarda. `range-bookings` **hereda** el del rango que ya tiene en la mano (`01-ESTADO` §3) — una línea. Ver §4.1. |
| **3. UI** ✅ (modal) | El picker manda el consultorio; una cita que nace dentro de un rango lo hereda sin preguntar. Sólo hay algo que elegir cuando el doctor tiene 2+ **y** la cita es freeform. Ver §4.2. |
| **4. Agente** | `get_locations` ya existe. Preguntar **sólo** si el doctor tiene 2+ y la cita no hereda de un rango; mandar `locationId` en `propose_create_booking`. Toca prosa del módulo agenda ⇒ `gate:prosa` + `gate:prompt` + **DOS corridas de evals**. |

Y al cerrar: **revisar `02-CAPACIDADES`**, que hoy dice que el agente no puede filtrar por
consultorio *"porque el dato no existe"*. Esa frase deja de ser cierta con el paso 2.

### 4.1 — Paso 2, como quedó

La regla es la misma en los dos endpoints de rangos:

```
1. explícito  →  se valida que el consultorio sea DE ESE DOCTOR  →  gana
2. si no      →  se HEREDA del rango que contiene la cita (sólo si el rango tiene uno)
3. si no      →  NULL = no registrado   (NUNCA el default — §2.1)
```

**`apps/api/src/lib/booking-location.ts`** la parte en dos funciones, y **dónde corre cada una
es la decisión de diseño**, no un detalle:

| Función | Dónde corre | Por qué ahí |
|---|---|---|
| `validateRequestedLocation` | **FUERA** de la transacción, junto a `serviceId` y `patientId` | Es una lectura que no necesita el lock del día. Adentro, una petición condenada a 400 tomaba primero el advisory lock de doctor+fecha y corría los checks de traslape — gastando presupuesto de transacción interactiva en una ruta que ya trata el timeout `P2028` como modo de fallo conocido. |
| `inheritLocationFromRange` | **DENTRO** de la transacción | Para leer el mismo estado que los checks de traslape: si alguien borra el rango a medio camino, no se hereda de un rango fantasma. |

| Endpoint | Qué hace |
|---|---|
| `range-bookings/instant` | Usa las dos: acepta `locationId` del cliente, valida antes de abrir la transacción, hereda adentro si no vino ninguno. |
| `range-bookings` | Sólo hereda, y **no importa el helper**: el rango ya está en la mano por el check de `NO_RANGE`, así que volver a pedirlo sería una query de más en el camino público. |

Cuatro cosas que no son obvias y por eso están así:

- **El check de pertenencia no es decorativo.** La FK apunta a `clinic_locations`, no a "los
  consultorios de este doctor": sin validar, cualquiera con sesión podría colgarle a su cita el
  consultorio de otro doctor y la BD lo aceptaría. Es el mismo check que ya tenía `serviceId`.
- **Un `locationId` presente pero malformado (un número, un objeto) da 400, NO se cae a la
  herencia.** Tratarlo como "no dijo nada" guardaría la cita en un consultorio **distinto** al
  pedido y contestaría `201`: la petición atendida mal, y nadie se entera. Para un campo cuyo
  propósito es no rendir una suposición como un hecho, un explícito roto tiene que fallar fuerte.
  (Cadena vacía sí cuenta como "ninguno" — es como los formularios mandan el vacío.)
- **Un consultorio inválido contesta 400 antes de abrir la transacción**, y eso además **quita el
  orden de las ramas de en medio**. Mientras la validación vivió dentro, el 400 dependía de que
  su rama estuviera antes que la de `bookingError`, y el ternario de errores manda a la frase de
  traslape todo lo que no sea `TIME_BLOCKED`: reordenar las ramas habría convertido "consultorio
  inválido" en *"este horario se traslapa con una cita existente (undefined–undefined)"* — un
  hecho falso sobre la agenda, pidiéndole al doctor que cambie de **hora** cuando lo que está mal
  es el **consultorio**.
- **Las dos rutas coinciden porque el API prohíbe rangos solapados.** El helper filtra
  `locationId: { not: null }` y la query de `range-bookings` no; como a lo sumo UN rango contiene
  la ventana, los dos predicados eligen el mismo. Si algún día se permiten rangos solapados esa
  equivalencia se rompe y `range-bookings` tiene que pasar a llamar al helper. Está anotado en
  los dos archivos.

**Lo que NO toca el paso 2:** los endpoints de slots (`bookings`, `bookings/instant`). El
mecanismo de slots está obsoleto y la UI viva no lo alcanza — `/dashboard/appointments` pasa
`rangeMode` sin condición, así que las ramas de slot del modal (`BookPatientModal/index.tsx:407`
y `:455`) no se ejecutan; sólo las alcanza `/dashboard/appointments/v1`, a la que no enlaza nada.
Ver `01-ESTADO` §5.

🔸 **Pendiente anotado, no arreglado — son TRES sitios**, no uno *(los otros dos los encontró el
`/code-review high` del 2026-08-06)*:

| Archivo | Línea |
|---|---|
| `appointments/bookings/instant/route.ts` | `:104` — `resolvedLocationId = locationId \|\| null` |
| `appointments/slots/route.ts` | `:303` — `locationId ?? null` |
| `appointments/slots/[id]/route.ts` | `:96` — `locationId ?? null` |

Los tres aceptan el `locationId` del cliente **sin validar pertenencia** y lo escriben en el slot,
así que un doctor puede colgarle a su horario el consultorio de otro y la disponibilidad
renderiza la dirección ajena. Rutas muertas en la UI, endpoints vivos en la API. Es verbatim la
regla que `validateRequestedLocation` aplica del lado de rangos, y `ranges/route.ts:206` ya lo
hace bien. **No se tocan aquí** porque son el camino de slots (§`01-ESTADO` §5) y arreglarlos es
una decisión aparte, no parte del paso 2.

**Verificado:** `type-check` de `apps/api` limpio · los 5 gates en verde · las dos formas de query
nuevas probadas read-only contra prod (`yamanote.proxy.rlwy.net`, 2026-08-06): el check de
pertenencia acepta el par propio y devuelve `null` en el cruzado, y la herencia devuelve el
consultorio correcto del rango contenedor · `/code-review high`, cuyos hallazgos #2 #3 #4 y #5
están aplicados arriba (#1 es el pendiente de slots).

✅ **Y el clic real, hecho en prod el 2026-08-06** (deploy `536f83e0`): cita creada desde
`/dashboard/appointments` dentro de un rango publicado, `2026-08-07 11:15-12:15`, y la columna
quedó en **Consultorio Polanco** — el consultorio del rango que la contiene. Es la primera cita
de la BD que sabe dónde es (413 citas, 1 con consultorio). Lo importante que prueba: **crear
citas sigue funcionando** — el riesgo real de este push, porque este repo ya se tumbó una vez
por un cambio de esta forma.

⚠️ **Lo que ese clic NO probó:** hoy **ningún cliente manda `locationId`**
(`BookPatientModal/index.tsx:363-389` no lo incluye), así que la rama del **explícito** —
validación de pertenencia incluida — sigue sin ejercitarse por nadie hasta el paso 3. Lo único
vivo en producción es la **herencia**.

### 4.2 — Paso 3, el MODAL (el agente sigue pendiente)

Decidido por el usuario el 2026-08-06: **dentro de un rango no se pregunta** (ya se sabe) y
**fuera de todo rango se elige**, con un selector debajo de *Modalidad*, prellenado con el
consultorio **de arriba en Editar Perfil**.

| Caso | Qué ve el doctor |
|---|---|
| 1 consultorio | Nada. No hay pregunta — pero la cita **sí** registra ese consultorio (§hallazgo 2) |
| 2+, hora DENTRO de un rango | Una línea gris: *"Consultorio: X — Se toma del rango que contiene esta hora"* |
| 2+, hora FUERA de todo rango | El selector, prellenado con `clinicLocations[0]` |

🎯 **El hallazgo que hizo falta para que esto funcionara.** El modal pide sus horas en modo
`freeform=1`, y ese modo **descarta los rangos reales** y los sustituye por un rango sintético de
día completo con `locationId: null`. O sea: toda hora ESCRITA salía sin consultorio, incluidas
las que caen dentro de un rango real. El servidor sí heredaba bien al crear la cita, así que el
picker no podía distinguir *"no hay consultorio"* de *"hay uno y no te lo dije"*.

Arreglado en `range-availability`: en freeform ahora también se consultan los rangos reales —no
como ventana, sólo para **anotar** cada hora con el consultorio que heredaría— usando
`rangeContains`, **importado** de `booking-location.ts`. Es el mismo predicado que corre al crear
la cita: si el picker dedujera la contención por su cuenta, podría enseñar un consultorio y
guardar otro.

*"El de arriba de Editar Perfil"* está **verificado, no supuesto**: el perfil y
`/api/doctors/[slug]/locations` ordenan los dos por `displayOrder`, que se asigna por posición al
guardar (`doctors/[slug]/route.ts:287`).

**Del `/code-review`, cinco arreglos** (el sexto se rebatió con evidencia: el selector queda
ARRIBA de los campos de contacto obligatorios, así que no se puede enviar sin haberlo visto):

1. Con **UN** consultorio y hora fuera de rango, la cita quedaba en `NULL`. La guarda era
   `length > 1`; ahora se manda siempre que se sepa cuál es. Una sola sede = una sola respuesta
   posible: no hay que preguntarla, pero tampoco hay por qué tirarla.
2. 🔑 Si `/locations` fallaba, `clinicLocations` quedaba en `[]` — **idéntico a "no tiene
   consultorios"**: sin selector, sin `locationId`, y un doctor con DOS sedes reales agendaba y
   la cita quedaba sin consultorio en silencio. Ahora se distingue el error y se dice.
   Otra vez *"una lista vacía no es una respuesta"*.
3. La UI decidía con `locationName` y el envío con `locationId`. Un solo predicado
   (`consultorioHeredadoId`), o un rango con id y sin nombre enseñaría el selector y tiraría la
   elección al enviar.
4. `reset()` no limpiaba el consultorio: agendar en el segundo dejaba ese elegido para el
   paciente siguiente.
5. Anotada la invariante de la que ahora depende el modo freeform (`freeformDateKeys` tiene que
   cubrir toda fecha con rangos, o esa fecha calcularía desde los rangos publicados diciendo
   `freeform: true`).

🔴 **Falta el agente** (paso 4): `propose_create_booking` todavía no manda consultorio, así que
una cita agendada por el asistente fuera de un rango sigue quedando sin él.

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

   **Alcance real, medido:** de 269 citas heredables en toda la BD, sólo **6** tienen una
   respuesta no obvia, y son todas suyas (`01-ESTADO` §4). Cada una cae dentro de **exactamente
   un** rango — el API prohíbe que dos rangos se solapen — así que no hay inferencia ni empate:
   el rango nombra su hospital y ya.

   🔴 **Y hay una ventana que se puede CERRAR SOLA — y desde 2026-08-06 se cierra MÁS FÁCIL.**
   El borrado **masivo** de rangos (`ranges/bulk/route.ts:119`) siempre eliminó los rangos
   **aunque tuvieran citas activas** — sólo advierte; el campo `protectedRanges` de la respuesta
   tiene nombre engañoso y el propio código lo dice en la línea 65.

   ⚠️ **Y el borrado de UN rango ya tampoco bloquea.** Antes contestaba 409 *"Cancela las citas
   primero"*; se levantó a propósito (pedido del usuario: *"que se puedan borrar rangos aunque
   tengan citas dentro, y que las citas queden intactas"*). O sea que el dato ya no sólo se
   pierde con una operación masiva y deliberada: **se pierde un clic a la vez desde el calendario
   y desde una tarjeta del agente.**

   Para las citas **nuevas** da igual: el consultorio se **copia** al crearlas, no se apunta al
   rango, así que borrar el rango después no les borra nada. Pero las **269 viejas** tienen su
   `location_id` en `NULL`, y el único lugar donde sobrevive el dato es el rango que las
   contiene: **si esos rangos se borran, el backfill deja de ser posible para siempre.**

   📌 **Decisión del usuario (2026-08-06): el backfill NO se hace.** Se registra aquí con su
   consecuencia aceptada — esas 269 citas se quedan sin consultorio, y las 2 de CHRISTUS
   Muguerza no van a poder distinguirse nunca de las del hospital por defecto.

   🎯 **Y de esas 6, las que hoy mentirían son DOS** *(re-medido contra prod el 2026-08-06 al
   cerrar el paso 2)*: 4 caen en Hospital Ángeles Valle Oriente, que **es** su default, y 2 en
   CHRISTUS Muguerza Cumbres, que **no**. Ése es el tamaño verdadero del daño que evita esta
   feature: dos citas que, resueltas al default, mandarían al paciente a otro hospital de
   Monterrey. Las otras 267 heredables coinciden con el default de su doctor, así que el
   backfill es mayormente confirmatorio — pero sigue siendo lo que convierte un `NULL`
   ambiguo en un dato afirmado.

   **Cómo se hace, entonces:** paso aparte del `ALTER TABLE`, con las 6 filas impresas ANTES y
   DESPUÉS. A esa escala se revisan a ojo, que es lo que vuelve seguro un backfill que a escala
   de miles no lo sería.
2. **En freeform, ¿se pregunta o se asume el de por defecto?** Preguntar cuesta un turno en el
   agente y un control en el picker; asumir puede mandar al paciente a la dirección equivocada
   para 3 de 11 doctores.
3. **¿Se muestra el consultorio en la tabla y en el modal de la cita?** Guardar sin mostrar deja
   el dato correcto e invisible — que es la mitad del problema que este trabajo viene a resolver.
