# 01 — Qué ya funciona y dónde exactamente se pierde el dato

> Tipo **DECISIÓN / REFERENCIA**: describe cómo son las cosas HOY. Medido contra el código el
> **2026-08-06**, no deducido de otros docs.

> 🔄 **Este doc describía el estado ANTES de los pasos 1 y 2.** Las §§2 y 3 ya no son ciertas: la
> columna existe (`e2d10151`) y los dos endpoints de rangos la escriben. Se conservan **como
> diagnóstico**, marcadas, porque explican por qué la feature se construyó así — no como
> descripción del presente. El estado vivo está en `02-PLAN` §4.1.

## 1. Lo que YA está construido y vivo

| | Dónde | Estado |
|---|---|---|
| El modelo `ClinicLocation` | `schema.prisma:553` | ✅ `name` · `address` · `phone` · `whatsapp` · `hours` · `isDefault` · `displayOrder` |
| Crear un **segundo** consultorio | `components/profile/ClinicSection.tsx` | ✅ Botones *"+ Agregar segundo consultorio"* / *"Eliminar segundo consultorio"* |
| Un **rango** sabe su consultorio | `availability_ranges.location_id` | ✅ Existe y el modal de crear rango lo ofrece |
| El endpoint público de consultorios | `api/doctors/[slug]/locations` | ✅ |

⚠️ **El tope es DOS, no N.** `ClinicSection` corta con `slice(0, 1)` al eliminar y sólo ofrece
"segundo". No es un bug: es el alcance elegido. Si algún día hay tres, es ahí donde se abre.

⚠️ **Y ya hay una protección puesta**: el aviso al eliminar el segundo consultorio dice *"si tiene
horarios asignados en la sección de Citas, el sistema no permitirá guardar"*.

## 2. ~~Lo único que falta: la CITA~~ — RESUELTO (pasos 1 y 2)

> ✅ **Ya no es cierto.** `bookings.location_id` existe desde `e2d10151` y las citas creadas por
> los dos endpoints de rangos la escriben. Lo de abajo es el diagnóstico original.

**`bookings` no tiene ninguna columna de consultorio.** Revisado el modelo completo: no hay
`locationId`, ni relación con `ClinicLocation`. `ClinicLocation` sí declara sus relaciones
inversas (`slots`, `availabilityRanges`) — **`bookings` no está entre ellas.**

Consecuencia directa: **ninguna cita registra dónde es**, y por lo tanto:

- Nadie puede contestar *"¿a qué dirección va este paciente?"* desde la cita.
- El agente **no debe preguntarlo** — la respuesta se descartaría en silencio.
- `02-CAPACIDADES` dice que el agente "NO puede filtrar citas por consultorio (**el dato no
  existe**)". Es **correcto hoy** y hay que revisarlo el día que la columna aparezca.

## 3. 🎯 ~~El punto exacto donde el dato se tira~~ — TAPADO (paso 2)

> ✅ **Ya no se tira**: `range-bookings/route.ts` escribe `locationId: matchingRange.locationId`.
> Se conserva porque es el hallazgo que originó la feature.

`apps/api/src/app/api/appointments/range-bookings/route.ts:186-194` — al crear la cita busca el
rango que la contiene y **selecciona su `locationId`**:

```ts
const matchingRange = await tx.availabilityRange.findFirst({
  where: { doctorId, date: bookingDate, startTime: { lte: … }, endTime: { gte: … } },
  select: { id: true, locationId: true },   // ← lo pide
});
```

Y `matchingRange` aparece **tres veces** en todo el archivo: la declaración, el `if (!matchingRange)`
que lanza `NO_RANGE`, y nada más. **`locationId` se carga a memoria y se descarta.**

O sea: en el camino de rangos el dato **ya está en la mano** en el instante de crear la cita. Con
la columna puesta, heredarlo es una línea. No hace falta preguntarle nada al doctor para las citas
que nacen dentro de un rango.

⚠️ **En freeform (fuera de rango) no hay de dónde heredarlo** — ahí hay que preguntar (paso 3) o
dejarlo en `NULL`. ~~o caer al consultorio por defecto~~: **caer al default quedó PROHIBIDO** al
implementar, ver `02-PLAN` §2.1. Hoy el paso 2 lo deja en `NULL` = no registrado.

## 4. Los datos, medidos en prod (`yamanote.proxy.rlwy.net`, 2026-08-06, solo lectura)

| | |
|---|---|
| Columna de consultorio en `bookings` | **NINGUNA** (ni constraint ni índice) → ✅ existe desde `e2d10151` |
| Columna en `availability_ranges` | **`location_id` SÍ** |
| `clinic_locations.id` | `text` — la FK empata |
| Doctores con 2+ consultorios | **3**, con **exactamente 2** cada uno |
| Citas totales | **411** |
| Citas dentro de un rango CON consultorio | **268** |

**Re-medido el 2026-08-06 al cerrar el paso 2** (mismo host, solo lectura): 412 citas · **269**
heredables · 14 `clinic_locations` en 11 doctores · **856 de 856** rangos tienen consultorio.

🔑 Ese último dato importa: **no existe hoy un solo rango sin consultorio**, así que la guarda
`locationId: { not: null }` del helper no se dispara nunca con los datos actuales. Está puesta
igual, porque la columna del rango es nullable y el día que aparezca uno vacío la alternativa
sería heredar un `null` disfrazado de respuesta.

### 🎯 Pero el 268 esconde lo único que importa

De esas 268, sólo **86** son de doctores con 2+ consultorios — y de ésas, casi todas son de
doctores que **en la práctica usan uno solo**:

| Doctor | Citas heredables | Consultorios DISTINTOS en juego | Sus rangos |
|---|---|---|---|
| `dr-prueba` (de prueba) | 69 | **1** | 79 rangos, todos en Consultorio Polanco |
| `gerardo` | 11 | **1** | 27 rangos, todos en Consultorio Principal |
| **`dra-adriana-michelle`** | **6** | **2** | **52 en Hospital Ángeles Valle Oriente · 45 en CHRISTUS Muguerza Cumbres** |

Y de sus 6, el reparto exacto *(medido 2026-08-06)*: **4** heredarían Hospital Ángeles Valle
Oriente — que **es** su default — y **2** CHRISTUS Muguerza Cumbres, que **no**. Las 80 citas
heredables de los otros dos doctores con 2+ consultorios caen todas en su default. O sea: en
toda la BD hay **exactamente 2 citas** a las que resolver `NULL`→default les cambiaría el
hospital. Dos, y son las que justifican la regla entera.

🔑 **Hay UNA sola doctora que de verdad opera en dos sedes**, y son **dos hospitales distintos de
Monterrey** — mandar a un paciente al equivocado no es un detalle cosmético. Ésa es la razón de
ser de esta feature, y a la vez la razón de que el backfill sea diminuto: **seis filas.**

⚠️ **`NULL` NO es neutro para ella.** La convención del schema es *null = el consultorio por
defecto*, así que en cuanto el paso 3 lo muestre, sus citas sin dato afirmarían **un hospital
concreto y equivocado** en la mitad de los casos. No es un vacío que se ve vacío: es un vacío que
se rinde como una afirmación falsa. Ver `02-PLAN` §5.1.

## 5. ⚠️ Corrección — el camino de SLOTS no cuenta

`appointment_slots` también tiene `location_id`, y `bookings/instant` lo resuelve y lo guarda. Al
analizar esto el 2026-08-06 se concluyó por un rato que "las citas basadas en slot sí guardan su
consultorio". **Es cierto en el código e irrelevante en el producto: el mecanismo de slots está
OBSOLETO** — hoy sólo se agenda por rango o freeform (`slot_id = null`).

Se anota porque el código conserva los dos caminos completos y funcionando, así que leyendo el
repo se vuelve a deducir mal. **La afirmación correcta es la simple: ninguna cita que se cree hoy
registra su consultorio.**
