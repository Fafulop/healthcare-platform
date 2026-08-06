# 01-PLAN — agendar sin rango (hora libre en el picker)

> **Tipo PLAN.** Escrito 2026-08-03. Lo del **agente** NO vive aquí — va a
> [`../AGENTES/AGENTE AGENDA/`](../AGENTES/AGENTE%20AGENDA/) (§10).
>
> **Estado: TODO EN PROD (`480f7f72` / docs `29dcdf51`), desplegado y verificado por
> `commitHash` en `@healthcare/doctor` Y `@healthcare/api`.**
> Probado a mano: la **v1** (interruptor — funcionaba, se descartó por diseño) y un **vistazo**
> a la v2. ⚠️ **La rejilla de 1 minuto y la UI grande NO se han probado a mano.**
> **§15 y §16 describen el código de HOY**; §5 y §14 quedan como registro de la v1.
> Estado vivo y qué correr primero: [`SESSION-REFRESCO.md`](SESSION-REFRESCO.md) §2 y §8.
> Verde: `type-check` (api con `--max-old-space-size=6144`) · `build` de `apps/doctor` ·
> **los 5 gates** · smoke read-only del rango sintético contra datos REALES de prod
> (§7b). ⚠️ **Nada de eso es el clic** — falta la prueba a mano. Al shippear y probar:
> banner `🔒 SNAPSHOT` aquí y el estado se mueve a
> [`SESSION-REFRESCO.md`](SESSION-REFRESCO.md).

## En una frase

El picker de agendar gana un **interruptor** que ensancha la lista de horas: apagado ofrece
las horas que salen de los rangos (lo de hoy, sin cambios); encendido ofrece **todo el día**,
dentro y fuera de rango. Mismo flujo de tres pasos (**servicio → día → hora**), misma
matemática de ocupación, **sin columna nueva, sin modo de cuenta, sin migración**.

---

## 1. El problema

Para escribir "Sra. García, martes 4pm" el doctor tiene que declarar antes una ventana de
disponibilidad que no piensa publicar. El rango existe por la **página pública**: un paciente
navegando necesita una respuesta legible por máquina a *"¿cuándo puedo agendar?"*. Los
doctores que no usan esa página pagan ese precio sin recibir nada.

**Lo que NO es el problema:** el backend. `POST /api/appointments/range-bookings/instant` —el
endpoint que el botón *Agendar Cita* ya usa hoy— dice en su propia cabecera:

> `// No range required — doctor can book outside their public availability ranges.`

No consulta `availabilityRange` en ningún punto. **La reja es la UI**: `RangeTimePickerStep`
es el único camino al formulario, y sus horas salen de `range-availability`, que sin rangos
devuelve vacío.

## 2. La decisión de fondo: NO es un modo de cuenta

Se evaluó una bandera por doctor (`RANGES` | `FREEFORM`, excluyentes) y **se descartó**. La
razón la dio el requisito mismo: el doctor quiere poder agendar **fuera de un rango Y también
encima de uno**. Dos caminos que conviven el mismo día para el mismo doctor no son
excluyentes por definición — una bandera excluyente no puede expresarlo.

Lo que se evita al no ponerla, y no es poco:

| Sin bandera | Con bandera |
|---|---|
| — | Columna nueva en `doctors` + SQL manual (`prisma db push` **revierte** el FK compuesto de `bookings`) |
| — | UI de ajuste, endpoint, y decidir quién la prende (doctor / admin) |
| — | Decidir qué pasa con los rangos que ya existen de un doctor que se cambia |
| — | Fork del agente: esconder `propose_create_range` ⇒ **más scopes** que `gate:prosa` enumera (66 hoy) |
| — | Variante FREEFORM de los 65 casos de eval |
| Nadie pierde nada | Hay que garantizar que los doctores contentos con el picker actual no lo pierdan |

Ese último renglón es el argumento decisivo. La preocupación que originó la bandera era
**proteger a los doctores que ya usan y les gusta el picker actual**. Un interruptor apagado
por defecto los protege igual de bien y no cuesta nada de la columna derecha.

## 3. Cómo se calcula la lista de horas — rango sintético, MISMO motor

La trampa obvia de "ofrecer todo el día" es ofrecer horas ya ocupadas. El picker libre
**legacy** (`SlotPickerStep`, `/v1`) tiene justo ese defecto: su desplegable es una rejilla
fija 06:00–22:30 que no sabe nada de citas, y el doctor se entera del choque en el `409`, ya
con el formulario lleno.

No hay que construir nada para evitarlo. `calculateAvailability` recibe los rangos como
**array de entrada**. Se le pasa **uno sintético que cubre el día**:

```ts
ranges: [{ id: 'freeform', startTime: '00:00', endTime: '24:00', intervalMinutes: 15 }]
```

y el motor devuelve toda hora de inicio donde el servicio **cabe** y **nada la ocupa** —
citas restadas, `extendedBlockMinutes` restado, `BlockedTime` restado, `appointmentBufferMinutes`
aplicado. **Cero algoritmo nuevo, cero matemática duplicada, el mismo código que usa la página
pública.**

> 📌 Esto además lo deja del lado correcto de la **regla 0** (*los veredictos de negocio se
> resuelven server-side*). Decidir *"¿15:30 está libre?"* en el cliente obligaría a replicar
> las reglas de buffer y bloqueo extendido — que es exactamente la clase de lógica replicada
> que este repo tiene documentada como su fuente #1 de bugs reales.

**Resultado neto: el camino libre queda MEJOR que el legacy que reemplaza** — no puede
ofrecer una hora ocupada, y el viejo sí podía.

### El cambio real en el endpoint

`GET /api/doctors/[slug]/range-availability` gana `freeform=1`. Con la bandera:

1. No lee `availabilityRange` como fuente de la ventana.
2. **Itera sobre cada fecha del periodo pedido**, no sobre `rangesByDate`. ⚠️ Esto es el
   cambio no trivial: hoy si no hay rangos no hay fechas que recorrer, y el bucle no se
   ejecuta.
3. Por fecha, corre el motor con el rango sintético.

### 🔴 `freeform=1` EXIGE autenticación — el endpoint es PÚBLICO

Este es el hueco más grave que encontró la re-auditoría, y hay que arreglarlo antes de
escribir una línea.

`range-availability` **no llama a `validateAuthToken` en ningún punto** — su cabecera lo dice:
*"Public endpoint"*. Hoy eso es correcto y acotado: un llamador anónimo sólo ve disponibilidad
**dentro de los rangos que el doctor decidió publicar**. Lo que no se publica, no se ve.

Con `freeform=1` sin auth, un anónimo con sólo el `slug` puede pedir 24h × N días y
**deducir la agenda ocupada completa del doctor por inversión**: toda hora que NO vuelve está
tomada por una cita o un bloqueo. Eso convierte un endpoint de disponibilidad publicada en una
**fuga de free/busy** de un doctor que quizá ni usa la página pública.

> ⚠️ Este repo ya pagó exactamente esta factura: `GET /api/doctors` servía TODAS las columnas
> de `Doctor` a llamadores anónimos (tokens de MP, URLs de firma de 3 doctores reales).
> Arreglado el 2026-07-26 (`faa7e829`) con `omit` de Prisma, y de ahí nació el quinto gate,
> `pnpm gate:payload`. **Un parámetro nuevo en un endpoint público es superficie nueva, aunque
> el endpoint ya existiera.**

**Regla:** `freeform=1` sólo se atiende para un llamador **DOCTOR (dueño del slug) o ADMIN**.
Sin auth válida ⇒ se ignora el parámetro (se responde el modo rangos de siempre) o `403` —
decidir cuál, pero **nunca servirlo abierto**. Dos consecuencias:

- El picker del doctor ya usa `authFetch` para otras llamadas, así que el cambio es de una
  línea del lado cliente.
- Si `freeform` es por definición doctor-only, entonces **`skipCutoff` va implícito**: el corte
  de 1 hora es una regla para pacientes públicos (ver §11).

### 🟠 En modo libre se pide POR DÍA, no por mes

`RangeTimePickerStep` hoy pide `?month=YYYY-MM` para poder **resaltar qué días tienen
disponibilidad** en el calendario. En modo libre esa pregunta no existe: **todos los días
tienen disponibilidad**. Pedir el mes entero sería traer ~31 × 96 = **~3 000 objetos** en cada
navegación de mes, para pintar un calendario donde todo está encendido.

**En modo libre el picker pide sólo el día seleccionado** (`startDate=endDate=<día>`). La
respuesta baja a ≤96 entradas, el calendario deja de necesitar `availableDates`, y el tope de
la ventana deja de ser un problema de UI.

⚠️ **El tope sigue haciendo falta en el servidor**, porque el endpoint es genérico y nada
impide pedir un año: 365 × 96 ≈ **35 000 entradas**. **Tope: 62 días** (⚠️ hoy es un
**presupuesto de slots**, no de días — §16) con `400` si se pide
más — mismo patrón que el tope de ~120 días que `get_ranges` del agente ya aplica.

⚠️ Y el estado vacío *"Sin disponibilidad para este servicio"* **no debe rendirse en modo
libre**: hoy se dispara con `availableDates.length === 0`, que en modo libre no significa nada.

## 4. Lo que YA funciona y no hay que construir

**El submit no se toca.** La rama `rangeMode && rangeSelection` (`BookPatientModal/index.tsx:350`)
ya postea a `range-bookings/instant` con `{doctorId, date, startTime, serviceId, …}` y deriva
`endTime` de `service.durationMinutes`. Una selección libre tiene **la misma forma**. Cero
cambios.

**El traslape entre los dos caminos ya está resuelto.** Escenario que se preguntó
explícitamente: rango 10:00–13:00 vacío, se crea una cita libre 08:00–11:00, se vuelve a
agendar desde el rango.

| | |
|---|---|
| Ventana del rango | `10:00 → 13:00` |
| Ventana bloqueada por la cita libre | `08:00 → 11:00` |
| Tras `subtractBlocked` | `11:00 → 13:00` |
| Horas ofrecidas | 11:00, 11:30, 12:00 … |

**10:00 y 10:30 desaparecen. Correcto, y ya es así hoy** — el motor nunca pregunta *cómo* se
creó una cita. Principio que conviene tener escrito: **un rango nunca se consume ni se
modifica.** La fila `AvailabilityRange` sigue diciendo 10:00–13:00 para siempre; la
disponibilidad se recalcula cada vez como *rangos − citas − bloqueos*. Por eso los dos caminos
no pueden desincronizarse: sólo hay una fuente de verdad, y es la tabla de citas.

> ⚠️ **Sutileza que se va a ver y no es un bug.** Si esa cita libre terminara a las **10:45**,
> el rango no ofrecería 10:45: la rejilla se ancla al inicio del rango (10:00) con su
> intervalo, así que la siguiente marca válida es 11:00. Son 15 minutos reales pero no
> ofrecibles. Comportamiento existente de `calculateAvailability`, no lo introduce este plan.

## 4b. 🟠 El consultorio: un hueco que ya existía y que el modo libre deja a la vista

Verificado en el código, no deducido:

| | |
|---|---|
| `Booking` tiene `locationId` | ❌ **No existe la columna** (grep sobre el modelo completo) |
| `range-bookings/instant` acepta `locationId` | ❌ **Cero menciones** en todo el archivo |
| El picker de rangos manda el consultorio al agendar | ❌ `locationName` vive en `rangeSelection` y **sólo se rinde**; el submit (`index.tsx:350`) no lo envía |
| Quién sí lo manda | Sólo la rama **legacy** (`index.tsx:413` → `bookings/instant`), y ahí cuelga del `AppointmentSlot` |

O sea: **ninguna cita basada en rangos registra su consultorio, hoy, por ningún camino.** No
es algo que rompa este plan — es una pérdida de dato que ya está ocurriendo.

Lo que sí cambia con el modo libre: hoy el picker de rangos al menos **muestra** de qué
consultorio es cada hora (viene del rango). El rango sintético no tiene consultorio, así que
un doctor con **2+ consultorios** pierde también esa señal visual y no tendría cómo decir en
cuál atiende.

### Medido en prod (2026-08-03, read-only)

| Consultorios | Doctores |
|---|---|
| 1 | **8** |
| 2 | **3** |

**3 de 11 (27%)**, así que "no hacer nada" **no es gratis** — era la apuesta que la medición
podía haber salvado y no la salvó.

**Decisión para la fase 1: se agenda SIN control de consultorio, y se documenta.** Las tres
opciones que había:

| | Opción | Veredicto |
|---|---|---|
| (a) | Nada en el picker libre | ✅ **Fase 1.** No se pierde ningún dato: hoy tampoco se guarda |
| (b) | Selector visual, no persistido | ❌ **Descartada.** Un control que descarta lo que el doctor elige es PEOR que su ausencia. En modo rangos el consultorio es un dato **derivado** que se muestra; un valor **elegido** que se tira es otra cosa |
| (c) | Columna `location_id` en `bookings` + aceptarla en el endpoint | 🎯 **El arreglo de verdad**, y arregla los DOS caminos. Migración aditiva, cambio de otra naturaleza — **no se mete escondido en éste** |

⚠️ **Lo que la fase 1 sí empeora para esos 3 doctores:** hoy el picker de rangos les *muestra*
de qué consultorio es cada hora. En modo libre no habrá esa señal. Nada se guardaba antes ni
se guarda después, pero la pantalla dice menos. Es el argumento más fuerte para priorizar (c).

## 5. Qué se toca

| Archivo | Cambio |
|---|---|
| `apps/api/src/app/api/doctors/[slug]/range-availability/route.ts` | Parámetro `freeform=1`: rango sintético + iterar fechas del periodo + tope (hoy **presupuesto de slots**, y parámetro `interval` — §16) |
| `apps/doctor/…/_components/RangeTimePickerStep.tsx` | Rejilla de rangos **+ campo de hora escrita** validado contra `freeform=1` (ver §15) |
| `apps/doctor/…/_components/BookPatientModal/index.tsx` | Nada en el submit. Sólo si se hace el prellenado de §9.4 |

**Presentación por camino** ⚠️ **Reemplazada — ver §15.** La primera versión puso un
interruptor y un desplegable; se probó a mano y se descartaron. Se deja escrito porque el
razonamiento de por qué no funcionó es lo útil:

| Camino | Cuántas opciones | Cómo se rindió (v1, ya no) |
|---|---|---|
| Rangos (interruptor apagado) | ~6–12 | Rejilla de botones |
| Libre (interruptor encendido) | hasta 96 | Desplegable |

## 6. Qué NO se toca

- ❌ **`POST /api/appointments/bookings`** — por ahí agenda el **widget público** del sitio
  (pendiente #7 del README lo marca en rojo).
- ❌ **`POST /api/appointments/range-bookings`** (el público, con rango obligatorio). Sigue
  exigiendo rango: es la reja que protege a los pacientes, y debe seguir ahí.
- ❌ **`SlotPickerStep` y el árbol `/v1`.** Este plan **no los revive**. Siguen siendo el
  código muerto del pendiente #7 y su borrado sigue siendo una decisión aparte. El camino
  libre nuevo vive dentro de `RangeTimePickerStep`, con el orden de campos correcto
  (servicio → día → hora); el legacy tiene el orden al revés (día → hora → duración, servicio
  después) y escribe al sistema **legacy de slots** (`AppointmentSlot` por cita, duración
  restringida a 30/60).
- ❌ **`CreateRangeModal` y todo lo de crear/borrar rangos.** Intactos.

## 7. Medido en prod antes de diseñar (2026-08-03, read-only)

Método de [`../flujo de dinero permutaciones/TOOLING-acceso-railway-db.md`](../flujo%20de%20dinero%20permutaciones/TOOLING-acceso-railway-db.md)
(`railway run --service pgvector`), sólo `SELECT`.

| | |
|---|---|
| Doctores totales | **11** |
| `appointment_buffer_minutes` | **0 en los 11** (sin excepción) |
| `default_interval_minutes` | **30 en los 11** (sin excepción) |

**Qué decide esto.** Se iba a diseñar alrededor de una posible discrepancia de buffer entre el
picker (que sí lo aplica, vía el motor) y `range-bookings/instant` (que lo salta a propósito,
por ser el camino de override del doctor). **Con buffer 0 en toda la base es invisible hoy.**
Se deja como está y se documenta:

> ⚠️ **Inconsistencia latente, no activa.** El día que un doctor ponga buffer > 0, el picker
> libre le ofrecerá horas respetando el buffer y el endpoint aceptará horas que lo violan. No
> se arregla ahora (no hay a quién arreglárselo) pero **está escrito para que no se
> re-descubra desde cero**.

## 7b. Smoke del rango sintético contra datos REALES de prod

El diseño entero descansa en una afirmación: *"un rango sintético de día completo a través del
mismo motor da la respuesta correcta"*. Eso **se probó**, no se dio por bueno — se corrió
`calculateAvailability` sobre 3 combinaciones reales de doctor+fecha que tienen rangos **y**
citas activas, comparando los dos modos:

| Fecha | Rangos | Citas | Horas modo RANGOS | Horas modo LIBRE | Superset | Sin choque |
|---|---|---|---|---|---|---|
| 2026-11-27 | 1 | 1 (16:00–16:30) | 7 | 91 | ✅ | ✅ |
| 2026-09-26 | 1 | 1 (11:00–11:30) | 7 | 91 | ✅ | ✅ |
| 2026-09-19 | 1 | 1 (12:00–12:30) | 7 | 91 | ✅ | ✅ |

Las **tres** invariantes que se verificaron:

1. **Superset** — toda hora que ofrece el modo rangos la ofrece también el modo libre. Los dos
   caminos no pueden contradecirse.
2. **Sin choque** — ninguna hora del modo libre se traslapa con una cita existente (incluido
   `extendedBlockMinutes` y el buffer) ni con un bloqueo.
3. **Fin dentro del día** — ningún `endTime` con hora > 23 (la invariante que añadió el
   hallazgo 4 del review). Última hora ofrecida: **23:15 → 23:45**.

> 📌 **El 91 cuadra exactamente**, que es la mejor señal de que el motor hace lo que se cree:
> 96 cuartos de hora − 2 (23:30 y 23:45 no caben en un día que termina 23:59 con consulta de
> 30 min) − 3 que traslapan la cita (15:45, 16:00, 16:15) = **91**.
> ⚠️ La primera corrida dio **92** con el día terminando en `24:00` — el uno de diferencia era
> justo el 23:30 que producía el `endTime: "24:00"` del hallazgo 4. **El número cambió porque
> se arregló un bug, no porque el smoke fuera inestable.**

## 8. Decisiones tomadas

1. **Aditivo, no excluyente.** Sin bandera de cuenta (§2).
2. **Intervalo del camino libre: 15 minutos.** Elegido explícitamente. Nota: los 11 doctores
   tienen `default_interval_minutes = 30`, así que el camino libre será **más fino** que sus
   rangos. Es deliberado — meter un paciente entre dos citas es justo el caso de uso.
3. **Ventana del día: las 24 horas completas**, copiando el patrón que `CreateRangeModal` ya
   usa (`24 * 4` opciones de 15 min) con su aviso ámbar *"Horario inusual detectado"* si es
   antes de 07:00 o después de 22:00. **No se inventa un corte artificial** que algún doctor
   acabará topando.
4. **Interruptor apagado por defecto.** Los doctores que usan rangos hoy no ven ningún cambio.

## 9. Preguntas abiertas

1. **¿Se marcan visualmente las horas que caen dentro de un rango?** El endpoint ya tiene los
   rangos a mano; devolver `dentroDeRango: boolean` por hora es barato y ayuda a leer el
   desplegable. **Propuesta: fase 2**, no bloquea.
2. **¿Cómo se rotula el interruptor?** Tiene que decir qué hace sin mentir. *"Ver todos los
   horarios"* describe el efecto; *"Agendar fuera de mis rangos"* describe la intención.
3. **¿El interruptor recuerda su estado?** Un doctor sin rangos lo va a prender cada vez.
   `localStorage` alcanza y no necesita columna.
4. ✅ **`handleBookInGap`: RESUELTO el 2026-08-06.** Se hizo la fase 2 y con creces: además de
   precargar fecha y hora, la rejilla Día/Semana es clicable **fuera de los rangos**, en
   bloques de 15 min y con la hora tomada de dónde se clicó. `BookPatientModal` recibe
   `preselectedDate`/`preselectedTime`. Detalle en
   [`SESSION-REFRESCO.md`](SESSION-REFRESCO.md) §10.
5. **El consultorio en modo libre** — las tres opciones de §4b. Antes de decidir conviene
   medir: **¿cuántos de los 11 doctores tienen 2+ `ClinicLocation`?** Si son cero, la (a) es
   gratis y la decisión se pospone con datos en vez de con suerte.
6. **Sin servicios configurados, el modo libre tampoco funciona.** La duración sale del
   servicio, así que un doctor con 0 servicios no puede agendar por ningún camino de rangos.
   El botón de confirmar sólo se deshabilita con `services.length > 0 && !selectedServiceId`,
   así que con 0 servicios deja enviar y el endpoint contesta `400` por `serviceId` faltante.
   **Preexistente**, no lo introduce este plan — pero si se va a empujar el camino libre a
   doctores nuevos, es el primer muro que van a topar.

## 10. Fuera de alcance — el agente (doc aparte)

**El agente NO mejora con este plan, y hay que decirlo claro:** un doctor sin rangos seguirá
teniendo un asistente que se niega a agendar. Dos puntos independientes:

| | Dónde | Qué pasa |
|---|---|---|
| El pre-check | `agenda-agent/proposals.ts:833` (`fetchDaySlots`) | Pregunta a `range-availability` sin `freeform`, recibe `[]`, y contesta *"Ese día no tiene ningún horario libre para ese servicio"* |
| El ejecutor | `contexts/AgentContext.tsx:164` | `create_booking` postea a `/api/appointments/range-bookings` — el endpoint **con rango obligatorio** |

Arreglarlo es trabajo de la carpeta del agente, con su propia corrida de evals (⚠️ **una sola
corrida no distingue regresión de ruido**). Va a
[`../AGENTES/AGENTE AGENDA/`](../AGENTES/AGENTE%20AGENDA/), no aquí — aquí sólo se
cross-linkea.

## 11. Hallazgo de paso — el picker del doctor aplica el corte de 1 hora

`RangeTimePickerStep.tsx:101-104` llama a `range-availability` **sin `skipCutoff=1`**. O sea:
`applyCutoff` esconde del propio doctor las horas de hoy a menos de 1 hora vista — una regla
escrita para **pacientes públicos** (*"menos de 1 hora de anticipación requerida"*).

El agente **sí** manda `skipCutoff=1`, con el comentario *"the lead-time filter is for public
patients; the doctor can book inside the hour"*. Así que hoy **el asistente puede agendar en
los próximos 60 minutos y el doctor, desde su propia UI, no.**

Parece un bug real y de una línea, pero es **cambio de comportamiento** y no forma parte de
este plan. Se anota para decidirlo aparte.

## 12. Riesgos

| Riesgo | Mitigación |
|---|---|
| El endpoint cambia y lo consumen la página pública, el agente y el picker | La rama `freeform` es **aditiva**: sin el parámetro, ni una línea del camino actual cambia |
| Respuesta enorme sin rangos que la acoten | Tope con `400` (§3) — hoy presupuesto de slots (§16) |
| Forma de query nueva contra prod | **Smoke test read-only ANTES del push**, método de los `TOOLING-*`. Aquí no hay SQL crudo nuevo (es Prisma + una función pura), pero la iteración por fechas es forma nueva |
| Doble reserva desde el picker libre | No aplica: el motor ya resta lo ocupado, y el `409` del endpoint sigue siendo la red de seguridad bajo la carrera |

**Sin dependencias nuevas · sin `pnpm-lock.yaml` · sin esquema · sin migración.** Todo es un
parámetro de endpoint más UI. Rollback = revert del commit.
⚠️ Deja de ser cierto si se elige la opción (c) de §4b (columna `location_id` en `bookings`).

## 13. Qué cambió al re-auditar este plan contra el código

La primera versión se escribió y **después** se auditó contra el código en vez de darla por
buena. Encontró **cinco** cosas; se dejan anotadas porque tres no eran deducibles del diseño,
sólo de leer los archivos.

| | Hueco | Gravedad |
|---|---|---|
| 1 | `freeform=1` iba a colgarse de un endpoint **público sin auth** ⇒ fuga de free/busy por inversión (§3) | 🔴 **Bloqueante.** El plan lo habría shippeado abierto |
| 2 | El picker pide **por mes**; en modo libre eso son ~3 000 objetos para pintar un calendario donde todo está encendido (§3) | 🟠 Diseño |
| 3 | **Ninguna cita de rangos guarda su consultorio** — `Booking` no tiene la columna y el endpoint no acepta el campo (§4b) | 🟠 Hueco preexistente, ahora visible |
| 4 | El estado vacío *"Sin disponibilidad"* se dispara con `availableDates.length === 0`, que en modo libre no significa nada (§3) | 🟡 UI |
| 5 | Con 0 servicios el camino libre tampoco funciona, y el botón deja enviar igual (§9.6) | 🟡 Preexistente |

> 📌 El hueco 1 es el que justifica la práctica. Era **invisible desde el diseño** —
> "agregarle un parámetro a un endpoint que ya existe" suena inerte— y sólo apareció al abrir
> el archivo y ver que no hay `validateAuthToken` en ninguna línea. Mismo patrón que la fuga
> de `GET /api/doctors` de julio: la superficie pública no se nota porque el endpoint ya
> estaba ahí.

## 14. `/code-review` sobre la fase 1 — 6 hallazgos, 6 arreglados

Ojos frescos sobre el diff ya escrito y con `type-check` + `build` + los 5 gates + el smoke
en verde. **Encontró seis cosas, las seis reales.** Vuelve a ser el argumento de
`05-METODO-code-review`: lo automático estaba TODO verde y el picker tenía un bloqueo duro.

| | Hallazgo | Arreglo |
|---|---|---|
| **1** 🔴 | **`loadingAvailability` se quedaba en `true` PARA SIEMPRE.** El `finally` no apaga el spinner si la petición fue abortada (para que una respuesta vieja no apague el de la nueva). Prender el interruptor con el fetch del mes en vuelo lo abortaba, el efecto de rangos salía por `if (freeform)` y el de libre por `!selectedDate` ⇒ **la rejilla del calendario sustituida por un spinner, sin forma de elegir fecha**. Determinista y sin salida salvo apagar el interruptor | `setLoadingAvailability(false)` explícito en cada salida temprana de los dos efectos |
| **2** 🟠 | **El calendario entero desaparecía en cada clic de día** en modo libre: la rejilla se rinde bajo `loadingAvailability`, y el fetch por día la encendía — incluido el día recién clicado | `loadingSlots`, estado separado, que sólo apaga el **paso 3** |
| **3** 🟠 | Saltarse `applyCutoff` no quitaba sólo el *lead time* de 1 hora: quitaba también **"no en el pasado"**. A las 18:00 el desplegable de HOY abría en "00:00 – 00:30", y `range-bookings/instant` **no tiene check de pasado** | `applyPastFilter` nuevo en `availability-calculator`: conserva exactamente esa mitad |
| **4** 🟠 | `endTime: '24:00'` hacía alcanzable por primera vez un `endTime` de **"24:00"** (servicio de 30 min a las 23:30). Ningún `AvailabilityRange` puede tenerlo (`isValid15MinBoundary` tapa la hora en 23), `instant` lo persiste tal cual y `google-calendar.ts:152` arma `${date}T24:00:00` — **hora inválida en RFC3339, la API de Calendar lo rechaza** | El día sintético termina en **`23:59`**. El problema desaparece por construcción, no por recorte río abajo |
| **5** 🟠 | **Degradación silenciosa.** Con la sesión caída (o un member sin el toggle de citas) el servidor ignora `freeform=1` y responde 200 con horarios de rangos, mientras la UI seguía con el interruptor prendido y el aviso de "cualquier hora". Y `if (data.success)` sin `else` rendía los 400 del endpoint como "Sin horarios disponibles" | La respuesta **devuelve el modo servido** (`freeform: boolean`); el cliente compara, se apaga solo y lo dice. Más estado de error visible |
| **6** 🟡 | Cambiar de mes dejaba `selectedDate` viva: el paso 3 seguía ofreciendo horas de un día fuera de la rejilla — y en modo libre ni se re-piden, así que se veían válidas | El cambio de mes limpia la fecha (arregla también el modo rangos, donde ya pasaba) |

> ⚠️ **La lección del hallazgo 1, que vale más allá de este picker.** El guard
> `if (!abortController.signal.aborted)` es correcto y hay que conservarlo — existe para que
> una respuesta vieja no apague el spinner de la nueva. Pero convierte **toda salida temprana
> del efecto en una fuga del flag**: si el efecto se re-ejecuta y sale antes de disparar otra
> petición, nadie apaga lo que la anterior encendió. **Un guard sobre el apagado obliga a
> apagar a mano en cada `return` temprano.** Aquí había DOS efectos que se cubrían el uno al
> otro, y por eso ninguno de los dos parecía incompleto leído por separado.

> 📌 **El hallazgo 4 es el patrón de "un valor nuevo alcanzable por primera vez".** El código
> río abajo (`google-calendar.ts`) llevaba años siendo correcto **porque la validación de
> `AvailabilityRange` garantizaba hora ≤ 23**. El rango sintético no pasa por esa validación:
> saltarse el guardián de un invariante lo rompe en sitios que ni se tocaron.

## 15. La v1 se probó a mano y se rehízo: fuera el interruptor, fuera el desplegable

**Esto es lo que está en el código hoy.** Lo de §5 y §14 describe la v1, que llegó a prod
(`ca627673`), se probó a mano — **funcionaba, sin bugs**— y se descartó igual por diseño.

**Los dos rechazos, y su raíz común.** El interruptor obligaba al doctor a declarar un **modo**
antes de expresar una intención, y el desplegable de hasta 96 horas era un control de
**exploración** para una tarea donde no hay nada que explorar. La raíz es la misma y estaba
escrita en §1 desde el principio: el caso de uso es *"Sra. García, martes 4pm"* — **la hora ya
se sabe**. Se había construido un buscador para alguien que ya tiene la respuesta.

### Qué hay ahora

| | |
|---|---|
| Interruptor | **No existe.** Nada que prender, ningún modo que elegir |
| Horas de los rangos | Rejilla de botones, **exactamente como antes** (con su consultorio) |
| Cualquier otra hora | Un campo `<input type="time">`: el doctor **escribe** la hora |
| Validación de lo escrito | Contra la lista de `freeform=1` del **día elegido**, que ahora se pide **siempre** |
| Si la hora no está libre | Se ofrecen con un clic las libres **más cercanas** (anterior y siguiente) |
| Si ya pasó | Lo dice como *"ya pasó"*, no como *"ocupada"* — razón distinta, arreglo distinto |

**El servidor no se tocó en la v2** (§16 sí lo tocó después: `interval` y el presupuesto de
slots). `freeform=1`, el rango sintético, el tope y el filtro de
pasado siguen igual: lo que cambió es que el cliente ya no usa esa lista para **pintar** un
desplegable sino para **validar** lo que el doctor escribió. Los dos modos que antes se
excluían ahora **conviven** en la misma pantalla y sus dos listas viven en estados separados
(`timeSlots` los rangos, `freeSlots` el día libre).

### Tres cosas que sólo aparecieron al rehacerlo

1. 🔴 **El calendario era una reja.** Sólo se podían clicar los días **con rango**. Sin
   interruptor que ensanchara el calendario, un doctor sin rangos no tenía **ningún día que
   clicar**: nunca llegaba al paso 3 y por lo tanto nunca podía escribir una hora — la
   pantalla entera muerta para exactamente el usuario que motivó el trabajo. Ahora **todo día
   no pasado es clicable** y el resaltado sólo *informa* dónde hay rangos publicados.
2. 🟠 **El aviso *"Sin disponibilidad para este servicio"* pasó a ser mentira.** Un mes sin
   rangos ya no impide agendar. Decirlo manda al doctor a crear el rango que este trabajo
   existe para no exigirle. Reescrito.
3. 🟠 **El intervalo de 15 min NO se replica en el cliente.** El primer intento hardcodeó
   `GRID_MINUTES = 15` para sugerir horas al redondear, duplicando en silencio
   `FREEFORM_DEFAULT_INTERVAL_MINUTES` del endpoint. Se cambió por *"las libres más cercanas de la
   lista que mandó el servidor"* — mejor sugerencia **y** nada que desincronizarse. Misma
   regla 0 de §3, aplicada a un número en vez de a una fórmula.

> 📌 **La lección.** La v1 pasó `type-check`, los 5 gates, el smoke contra prod, `/code-review`
> con 6 hallazgos arreglados **y** la prueba a mano. Nada de eso podía detectar que el control
> era el equivocado — sólo mirarlo con la pregunta *"¿esto es como el doctor piensa la tarea?"*.
> Y el bug 🔴 del calendario-reja estaba **latente en la v1 desde el diseño**: sólo no se veía
> porque el interruptor lo tapaba.

### `/code-review` sobre la v2 — 5 hallazgos, 5 arreglados

| | Hallazgo | Arreglo |
|---|---|---|
| **1** 🔴 | **Confirmar en `onChange` agendaba la hora equivocada.** El comentario afirmaba que `type="time"` no emite valores a medias; es cierto sólo la PRIMERA vez. Con `16:00` ya puesto, teclear el `1` de las 17:00 emite **`01:00`** (los minutos se conservan), que está libre en cualquier día futuro ⇒ se confirmaba y el modal **saltaba al formulario con una cita a la 1:00 AM** antes de poder teclear el `7`. Las flechitas del control hacen lo mismo desde vacío | El campo ya no confirma nunca: muestra el veredicto al escribir y **confirmar es un acto aparte** (botón *"Usar 16:00 – 16:30"* o Enter) |
| **2** 🟠 | **Un fallo de red se rendía como "esa hora está ocupada"** — de las 96 del día. Todas las salidas de error dejaban `freeSlots` vacío, y una lista vacía es indistinguible de "no hay nada libre" | `freeformReady`: `true` **sólo** tras una respuesta buena que además sirvió el modo libre. El veredicto no se rinde sin ella |
| **3** 🟠 | *"Este día no tiene ninguna hora libre"* salía también con la sesión caída o la petición fallida — le dice al doctor que su día está lleno cuando lo que falló fue el fetch | Mismo `freeformReady` |
| **4** 🟠 | `freeformAllowed` no se restauraba en las rutas de error: un fallo posterior dejaba el campo **deshabilitado sin explicación**, y su razón estaba gateada | Se eliminó ese flag. `freeformReady` se apaga **al empezar** cada petición, y el error del día se rinde **pegado al campo** en vez de arriba, donde se salía de la vista |
| **5** 🟡 | *"Este mes no tienes horarios publicados"* se afirmaba aunque la petición del mes hubiera fallado — un hecho sobre la agenda del doctor construido sobre una respuesta que nunca llegó | `monthError` propio; el aviso se calla si hubo fallo |

> 📌 **El patrón que une 2, 3 y 5: una lista vacía no es una respuesta.** Tres mensajes
> distintos afirmaban con seguridad un hecho sobre la agenda (*ocupada* · *día lleno* · *sin
> rangos*) cuando el estado real era **"no sé"**. El bug no está en ningún mensaje: está en
> haber colapsado *"el servidor dijo que no hay"* y *"el servidor no dijo nada"* en el mismo
> `[]`. **Cada vez que un fallo cae en el mismo estado que un vacío legítimo, la UI acaba
> mintiendo con total confianza** — y aquí manda al doctor a debuggear su agenda por un 500.

## 16. La rejilla pasa de 15 min a **1 min** (y el tope deja de contarse en días)

La v2 se probó a mano y salió la pregunta correcta: *¿por qué 15 minutos?* **Con un campo de
hora escrita, la rejilla dejó de ser un detalle de presentación y pasó a ser una regla de
rechazo.** En el desplegable, 15 min sólo decidía cuántas filas se pintaban; escribiendo,
decide que un `16:07` perfectamente libre se rechace sin que el doctor pueda ver por qué.

**Ahora el intervalo es un parámetro:** `interval` (1–60, default **15** para no cambiarle la
respuesta a ningún llamador existente). El picker del doctor pide **`interval=1`**.

### El tope de 62 días se convirtió en un presupuesto de slots

⚠️ **El hallazgo con más filo del cambio.** `FREEFORM_MAX_DAYS = 62` protegía el tamaño de la
respuesta, pero sólo funcionaba mientras la rejilla estuviera clavada en 15 min:

| Intervalo | 62 días son… |
|---|---|
| 15 min | 62 × 96 = **~6 000** entradas ✅ |
| 1 min | 62 × 1440 = **~89 000** entradas 💥 |

El tope no se habría roto: **habría dejado de aplicar en silencio**, que es peor. Sustituido
por `FREEFORM_MAX_SLOTS = 6000`, evaluado como `días × (1440 / intervalo)`.

> 📌 **La lección, que no es sobre citas:** un límite escrito en una unidad distinta de la que
> protege deja de proteger en cuanto se mueve la perilla de al lado. El tope hablaba de
> **días** y cuidaba **bytes**; los dos coincidían sólo por una constante que este cambio
> convirtió en variable.

### Smoke read-only contra prod (2026-08-03) — interval=1 vs interval=15

Mismas invariantes de §7b, sobre 3 combinaciones reales de doctor+fecha con citas activas:

| Fecha | 15 min | 1 min | Superset | Sin choque | Fin dentro del día | JSON | gzip |
|---|---|---|---|---|---|---|---|
| 2026-11-27 | 91 | **1 351** | ✅ | ✅ | ✅ | 130.6 KB | **7.1 KB** |
| 2026-09-26 | 91 | 1 351 | ✅ | ✅ | ✅ | 130.6 KB | 7.1 KB |
| 2026-09-19 | 91 | 1 351 | ✅ | ✅ | ✅ | 130.6 KB | 7.1 KB |

**El 1 351 cuadra exactamente**, que es la señal de que el motor hace lo que se cree: 1 410
inicios posibles (00:00 → 23:29, porque una consulta de 30 min tiene que terminar antes de las
23:59) − 59 que traslapan la cita de 16:00–16:30 = **1 351**.

> 📌 **El tamaño se midió, no se supuso.** 130 KB por clic de día sonaba a que había que
> recortar el payload (quitar `rangeId`/`locationId`/`locationName`, constantes en modo libre).
> **Comprimido son 7.1 KB** —el JSON es extremadamente repetitivo y `next.config.ts` no
> desactiva `compress`, que viene en `true` por defecto— así que no se recortó nada. Optimizar
> sobre la cifra sin comprimir habría sido trabajo real contra un problema inexistente.

### `/code-review` sobre §16 — 6 hallazgos, 6 arreglados

| | Hallazgo | Arreglo |
|---|---|---|
| **1** 🟠 | **`interval` se degradaba en silencio y no se devolvía**, justo lo que `freeform` sí hace y por la misma razón. Si el cliente pide 1 y el servidor sirve 15, teclear `16:07` renderiza *"Esa hora no está libre"* — una afirmación falsa **indistinguible de un choque real** | Se devuelve `intervalMinutes`. El cliente compara y, fuera de rejilla, dice *"los horarios van de N en N minutos"* en vez de *"ocupada"* |
| **2** 🔴 | **La invariante de superset había dejado de ser cierta.** El comentario la justifica con "los rangos van a cuartos y esta rejilla también", pero el validador aceptaba **cualquier** entero 1–60: con `interval=20`, un rango que empieza 09:30 **no** cae en la rejilla, y el picker pintaba 09:30 como botón clicable mientras le decía al doctor que 09:30 no está libre | Sólo se aceptan **divisores de 15** (`1 · 3 · 5 · 15`). La invariante vuelve a ser cierta **por construcción**, y el comentario dice por qué |
| **3** 🟠 | **El límite del pasado estaba desfasado un minuto contra el servidor.** `applyPastFilter` conserva `startTime > ahora` (estricto); el cliente marcaba pasado con `< ahora`. El minuto exacto de ahora no viene en la lista y se rendía como *"no está libre"* | `<=`. Con la rejilla de 15 min hacía falta acertar un cuarto en punto dentro de 60 s; **con la de 1 min lo topa siempre quien escriba la hora actual** para agendar "ahora mismo" |
| **4** 🟡 | El comentario que justifica pedir por día seguía diciendo "~31 × 96 = ~3 000" y "la respuesta baja a ≤96" — **15× desfasado** | Números reales (~1 400/día, 130 KB → 7 KB) |
| **5** 🟡 | Dos comentarios más con "15 min"/"96 horas", uno de ellos el que explica **por qué existe `freeformReady`** — el de más valor del archivo, subestimando el radio del fallo 15× | Actualizados |
| **6** 🟡 | El doc citaba `FREEFORM_INTERVAL_MINUTES`, constante que este mismo cambio **renombró**, y describía el tope como "62 días" en tres sitios | Corregidos, con puntero a §16 |

> 📌 **Los hallazgos 1 y 2 son la misma historia contada dos veces: convertir una constante en
> parámetro invalida los razonamientos que se apoyaban en su valor.** El eco de `freeform` ya
> existía porque un modo servido distinto del pedido es indetectable — y `interval` nació con
> exactamente esa forma sin heredar la lección. La invariante de superset era **verdadera**
> mientras 15 fuera literal y pasó a ser **una suposición** en cuanto fue configurable, sin
> que nada fallara. Junto con el tope de días, son **tres** cosas que dependían del 15 y sólo
> una era visible.

### La UI, de paso

Se agrandó todo el picker (va a ser de las pantallas más usadas): encabezados de paso
numerados, servicios y días más grandes y clicables, y el campo de hora convertido en el
ancla visual del paso 3 —caja propia, número grande tabular, botón de confirmar de tamaño
real— en vez de un input suelto de `text-xs`.

---

*Índice: [`README.md`](README.md) · Estado vivo: [`SESSION-REFRESCO.md`](SESSION-REFRESCO.md) ·
Prueba a mano: [`00-METODO-prueba-manual-punta-a-punta.md`](00-METODO-prueba-manual-punta-a-punta.md).*
