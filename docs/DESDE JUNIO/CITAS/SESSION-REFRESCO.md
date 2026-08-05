# 🔄 SESSION-REFRESCO — CITAS / calendario

> **Para la próxima sesión.** Dónde quedó todo el 2026-08-03 y qué sigue. Tipo
> **ESTADO / BITÁCORA**: se actualiza al cerrar cada sesión.
> El detalle histórico (qué se construyó y por qué) vive en [`README.md`](README.md);
> el guion de prueba a mano, en
> [`00-METODO-prueba-manual-punta-a-punta.md`](00-METODO-prueba-manual-punta-a-punta.md);
> el diseño de agendar sin rango, en
> [`01-PLAN-agendar-sin-rango.md`](01-PLAN-agendar-sin-rango.md).

## En una frase

**El doctor ya puede agendar a CUALQUIER MINUTO sin declarar un rango** — escribe la hora en
el picker y se valida contra la disponibilidad real (`29dcdf51`, deploy SUCCESS en
`@healthcare/doctor` **y** `@healthcare/api`). Antes de eso, el clic en una cita del
calendario ya abría su modal de acciones (`3447b9c3`). ⚠️ **Lo único probado a mano es la v1
del interruptor y un vistazo a la v2; la rejilla de 1 minuto y la UI grande NO se han
probado**, y el calendario (**J**), el modal (**K**) y la tabla (**A–I**) siguen sin correr.

🔴 **Lo más importante que queda abierto no está en esta carpeta: el AGENTE.** Ver §9.

---

## 1. Qué está en prod

| Commit | Qué |
|---|---|
| `07ff7ed0` | El calendario Día/Semana/Mes/Año, reemplazando el mini-calendario + panel de día |
| `c8fe484c` | Arreglos tras probarlo: franja "Rangos", canceladas ocultas, interruptor "Todas las fechas", barrido de zona horaria, 7 hallazgos de review |
| `3447b9c3` | **Clic en una cita → modal con sus acciones** + extracción de los controles a `BookingActions.tsx` |
| `ca627673` | **Agendar sin rango v1** — `freeform=1` en `range-availability` (auth-gated) + interruptor en el picker. **Probada a mano; el control se descartó por diseño** |
| `dcf64de6` | **v2 — se quita el interruptor y se ESCRIBE la hora.** Rejilla de rangos + campo de hora validado contra la lista del servidor |
| `480f7f72` | **Rejilla de 1 minuto** + presupuesto de slots + eco de `intervalMinutes` + off-by-one del pasado + UI más grande |

Todos en `main` (= producción, sin staging). **`480f7f72` es el primero de esta tanda que toca
`apps/api`**, y se verificó `SUCCESS` con el `commitHash` correcto en **los dos** servicios
(`@healthcare/doctor` y `@healthcare/api`) — no se dio por hecho.

**Rollback:** `git revert --no-edit 480f7f72 dcf64de6 ca627673` deja el picker como estaba.
No hay esquema, ni SQL, ni migración, ni lockfile de por medio en ninguno de los tres.

---

## 2. ⚠️ Qué está probado y qué NO

Esto sigue siendo lo más importante de este documento.

| | Estado |
|---|---|
| `07ff7ed0`, Tier 1 (bloque gris no se come el clic · navegación rápida · chip del rango) | ✅ **Probado por el doctor, pasó** |
| `07ff7ed0`, el resto de la sección J | ❌ Sin correr |
| `c8fe484c` **completo** | ❌ **Sin probar por nadie** |
| `3447b9c3` **completo** (sección **K**, 16 checks) | ❌ **Sin probar por nadie.** Sólo se confirmó que desplegó |
| La tabla, secciones **A–I** (rediseño de julio) | ❌ Sin correr desde entonces |
| `ca627673` (v1, interruptor) | ✅ **Probada por el doctor: funcionaba.** Se descartó igual, por diseño (§8) |
| `dcf64de6` (v2, hora escrita) | ⚠️ **Vistazo del doctor: "se ve mucho mejor".** No es la corrida del guion |
| `480f7f72` (1 min + UI grande) | ❌ **Sin probar por nadie.** Sólo se confirmó que desplegó |

Lo automático está verde en todos (`type-check`, `build`, los 5 gates, las 28 comprobaciones
de `event-model-check.ts`), más **smoke read-only contra prod** en los dos commits que tocaron
disponibilidad, más `/code-review` en cada uno (6 · 5 · 6 hallazgos, **todos reales**).

**Nada de eso es el clic.** En este trabajo el `type-check` estuvo verde TODAS las veces que
algo estuvo mal, y la sesión del 08-02 cerró con cinco rondas de `/code-review`, cinco con
hallazgos reales, tres de ellos introducidos por la ronda anterior al arreglar otra cosa.

### Qué correr primero

**Del picker nuevo (`480f7f72`), que es lo más fresco y lo menos ejercitado:**

1. **Escribe la hora ACTUAL** para agendar "ahora mismo". Debe decir *"ya pasó"* sólo si de
   verdad pasó — el minuto exacto de ahora se rendía como *"no está libre"* hasta este commit,
   y con la rejilla de 1 minuto lo topa **siempre** quien intente esto (§8).
2. **Escribe una hora con minutos "raros"** (16:07, 09:23). Debe agendar tal cual: esa es toda
   la razón de la rejilla de 1 min.
3. **Teclea una hora y cámbiala de opinión** (con `16:00` puesto, ve a las 17:00). Debe
   esperarte mostrando "Libre" — NO saltar al formulario a mitad de la edición.
4. **Un día SIN rangos publicados.** Debe ser clicable y ofrecer el campo de hora como control
   principal. Era la pantalla muerta que motivó todo esto.
5. **Una hora ocupada.** Debe ofrecer las libres más cercanas como botones, no un error seco.
6. **23:30 con un servicio de 30 min** → la cita debe llegar a Google Calendar (el peligro del
   `endTime: "24:00"`, tapado por construcción pero **nunca verificado a mano**).
7. **El botón de confirmar en móvil**: dice *"Usar 16:00 – 16:30"*, así que crece con la hora
   y puede envolver a su propia línea en el modal de 512px. Sin verificar visualmente.

**Del calendario y el modal, que siguen pendientes de antes:**

8. **K-5** — modal dentro de modal: Completar desde el modal de la cita y hacer clic DENTRO
   del modal de precio. Es el bug que ya ocurrió una vez en la tarjeta móvil.
9. **K-12** — el buscador de expediente sin recorte. Ver §4.
10. **K-6** — un bloque `COMPLETED`/`NO_SHOW` encima de un hueco libre: debe ganar el BLOQUE.
11. **J-11** — vista Año: los meses pasados tintados. Si salen en blanco, volvió el bug del
    predicado.
12. **J-4 + zona horaria** — cambiar la zona del sistema a Madrid o Tokio a última hora del
    día de la clínica: tabla y calendario deben coincidir en qué día es "hoy", **y crear un
    horario debe seguir funcionando**.

⚠️ **Hard refresh (Ctrl+Shift+R) antes de nada.** Ya pasó: se probó el bundle viejo y el bug
"seguía ahí".

---

## 3. ✅ Clic en una cita → modal (CERRADO, `3447b9c3`)

~~🎯 Es lo que el doctor pidió y lo único que quedó sin hacer.~~
**Hecho.** Lo que sigue es lo que hay que saber para tocarlo, no lo que falta por construir.

### Cómo está armado

**No reimplementa ninguna acción.** Los controles de una cita se sacaron de
`BookingsSection.tsx` a **`_components/BookingActions.tsx`** SIN cambiarles nada —
`StopClick` · `FacturaCheckbox` · `PriceCell` · `ExtendedBlockControl` · `ExpedienteCell` ·
`StatusActions`— y ahora los comparten las **TRES** superficies: la tarjeta móvil, la fila
desplegada de la tabla y `BookingDetailModal`. La estimación vieja de que esto era "un
refactor cuidadoso de un archivo de 1,256 líneas" era falsa: la extracción ya existía a
medias y sólo faltaba exportarla.

`BookingsSection.tsx` quedó **754 líneas más corto** y su comportamiento no cambió.

### Las cinco decisiones que no son obvias

1. **El modal recibe un ID, no un objeto.** `page.tsx` guarda `openBookingId` y resuelve la
   cita desde `useBookings` en CADA render. Por eso el modal refleja lo que se escribe
   (completar, precio, vincular expediente) en vez de quedarse con la copia del instante del
   clic, y por eso eliminar la cita lo cierra solo.
   ⚠️ **Cancelarla NO lo cierra**: la cita sigue en `bookings` con estado `CANCELLED`; lo que
   desaparece es su **bloque** del calendario (`HIDDEN_IN_CALENDAR`). El modal se queda
   mostrando la cita cancelada y su botón Eliminar, igual que la fila de la tabla.
2. **El clic en el fondo cierra sólo si el clic fue en el fondo MISMO**
   (`target === currentTarget`). `CompleteBookingModal` y `CreatePatientFromBookingModal` se
   rinden DENTRO de este modal, así que todo lo suyo burbujea hasta aquí.
   ⚠️ **Precisión, para no atribuirle al guard un mérito que no tiene:** hoy NINGÚN modal de
   la carpeta cierra al clicar su propio fondo (verificado en los dos internos), así que la
   cadena "cierro el interno por su fondo → burbujea → desmonta el de la cita" **todavía no
   puede ocurrir**. Lo que el guard evita hoy es que soltar un arrastre fuera del panel
   cierre el modal a media edición. Se queda porque el día que alguien le ponga
   cierre-por-fondo al interno —que es lo natural— el bug aparecería sin que nada lo delate.
3. **El scroll vive en el FONDO, no en el panel.** Con `overflow-y-auto` en el panel, la
   lista de resultados de `InlinePatientSearch` quedaba **recortada**: `overflow` recorta a
   sus descendientes absolutos **aunque la caja no necesite scroll**. En la tabla no pasa
   porque allí no hay ningún ancestro con overflow. Mismo patrón que los otros 4 modales de
   la carpeta, más `min-h-full` para no cortar el encabezado de un panel más alto que la
   pantalla.
4. **El bloque de la rejilla pasó de `<div>` a `<button>`** (teclado + rol anunciado), con
   hijos `<span className="block">` porque un `<div>` dentro de un `<button>` es anidamiento
   inválido, y con `block` + `text-left` porque un `<button>` centra su contenido en los dos
   ejes: sin eso el nombre del paciente saldría centrado en un bloque de 1 h.
5. **Reagendar y "crear formulario" cierran antes el modal de la cita**, para no apilar dos.
   Desde la tabla eso ya es un no-op.

**Año no lleva clic por cita** — es tinte de densidad, no dibuja citas individuales. Es a
propósito; no hay que "arreglarlo".

### El review de esta sesión — 5 hallazgos, 4 arreglados

| | Hallazgo | Qué se hizo |
|---|---|---|
| 1 | El desplegable de `InlinePatientSearch` quedaba recortado por el `overflow` del panel. Caso concreto: una `NO_SHOW` sin expediente sólo rinde *Eliminar*, el panel mide ~300px y se comía media lista | El scroll se movió al fondo (§3, punto 3) |
| 2 | El comentario del guard de fondo justificaba un bug que **no puede ocurrir** (ningún modal interno cierra por su fondo) | Comentario corregido; el guard se queda con su razón real |
| 3 | **Dos secciones tituladas FACTURA** en el mismo modal angosto: la casilla y el grupo de `StatusActions`, que aparecen juntas al marcarla | Se quitó el rótulo de la casilla — ya se rotula sola, igual que en la tabla |
| 4 | El `aria-label` de los bloques **sustituye** al `title` como nombre accesible (no se suman), así que perdía estado y hora de fin | Los dos `aria-label` llevan ya estado y hora de fin |
| 5 | Los `useCallback` de `page.tsx` no memorizan nada (`bookingsHook`/`rangesHook` son objetos nuevos cada render) | **Aceptado sin arreglar.** Es inerte (nada es `React.memo`) y `onRefresh`, justo arriba, tiene la misma forma desde antes |

### Dos comentarios que estaban MAL, corregidos de paso

- `StatusActions` decía *"Cita primero, expediente de respaldo"*. La **decisión #30**
  (2026-07-29) invirtió ese orden y `resolverContacto` resuelve
  `patient.email || patientEmail`. **El código siempre estuvo bien; el comentario describía
  el orden viejo.**
- El `aria-label` nuevo perdía datos que el tooltip sí daba (hallazgo 4).

⚠️ **La misma deriva sigue viva en el guion**: el encabezado de la sección **C** de
`00-METODO` también decía el orden viejo. Se corrigió en esta pasada — pero es la tercera vez
que este orden aparece invertido en un texto, así que al tocar contacto conviene buscarlo.

---

## 4. Watch-items abiertos

1. **`handleBookInGap` no precarga fecha ni hora** (`page.tsx`). Al clicar un hueco, el modal
   de agendar abre vacío. El aviso ya no promete fecha/hora.
   ⚠️ **Corrección a lo que decía este documento:** se afirmaba que esto *"se cerraría de
   paso"* al hacer el modal de la cita. **No se cerró.** Son cosas distintas: el modal de la
   cita rinde acciones sobre una cita que YA existe, mientras que precargar el hueco exige
   tocar los props de `BookPatientModal`, que no tiene dónde recibirlas. Sigue abierto.
   🎯 **Pero ahora por fin es HACIBLE de verdad:** hasta `480f7f72`, precargar un hueco fuera
   de rango no servía de nada porque el picker no podía ofrecer esa hora. Hoy sí — el hueco
   clicado se traduce a una fecha + una hora que el campo acepta tal cual. Es el pendiente que
   este trabajo habilita (`01-PLAN` §9.4).
2. **`AppointmentsCalendar` y `DayTimelinePanel`** ya no los usa la página principal, sólo
   las rutas muertas `v1`/`v2`. Borrarlas es una decisión aparte.
3. **Los `useCallback` inertes** de `page.tsx` (hallazgo 5 de arriba).

## 5. Decisiones abiertas (del doctor, no del código)

1. **Cancelar una cita la hace desaparecer de las DOS superficies.** El calendario ya no la
   dibuja, y el filtro de entrada de la tabla es *Activas*. No se pierde nada, pero puede
   *sentirse* como pérdida. Mitigación si molesta: que la tabla entre con *Todos los estados*.
2. **`min=` de los inputs de fecha usa el día de la CLÍNICA.** Para un doctor en Tijuana
   (UTC−7) a última hora, el día de la clínica ya es mañana. Es coherente pero es un borde
   elegido, no obvio.
3. **Cancelar desde el modal no lo cierra** (§3, punto 1). Es lo consistente con la tabla,
   pero si al doctor le resulta raro, cerrarlo es una línea.

## 6. Lo que conviene no re-aprender

- **Un conjunto, una pregunta.** El bug más grave del 08-02 fue reusar `INACTIVE_STATUSES`
  (escrito para "¿libera el horario?") para medir carga de trabajo en la vista de Año — que
  por eso pintaba **en blanco todo el pasado**. Hoy son tres conjuntos con nombre propio en
  `_lib/event-model.ts`: `FREES_THE_SLOT`, `NO_WORKLOAD`, `HIDDEN_IN_CALENDAR`.
  **El nombre ambiguo era el bug.**
- **Lógica replicada = deriva garantizada.** Por eso el modal RINDE `StatusActions` en vez de
  reimplementarlo. Cuando la extracción se hizo, el review la diffeó contra el original para
  probar que no se había colado un cambio: hacerlo verbatim es lo que permite esa prueba.
- **`overflow` recorta descendientes absolutos aunque no haga falta scroll.** Es lo que
  rompía el buscador dentro del modal y no se ve en la tabla, que no tiene ancestro con
  overflow.
- **Un `aria-label` SUSTITUYE al `title`**, no se suma. Enriquecer un tooltip y poner un
  `aria-label` corto es quitarle información al lector de pantalla.
- **Las comprobaciones ya no viven en un scratchpad.** `apps/doctor/scripts/event-model-check.ts`
  (28, exit 0): `cd apps/doctor && npx tsx scripts/event-model-check.ts`.
- **La deriva de docs muerde.** Ya van tres veces: J-18 iba a pasar trivialmente sin probar
  nada, J-9/J-14 habrían hecho reprobar una implementación correcta, y el orden de contacto
  de #30 aparecía invertido en dos comentarios y un encabezado del guion.
  **Al cambiar comportamiento, revisar si algún check o comentario lo describe.**
- **Ojos frescos ganan.** El pase inline no encontró los tres hallazgos más graves del 08-02.
  Playbook: [`../AGENTES/GENERAL AGENTES/05-METODO-code-review.md`](../AGENTES/GENERAL%20AGENTES/05-METODO-code-review.md).

## 7. Datos de prueba en prod

Fixtures en un doctor de prueba para el **11 de agosto de 2026**: rango 09:00–13:00
(intervalo 30 min), citas a las 10:00 (CONFIRMADA, con bloqueo extendido hasta 11:30), 11:00
(dos, solapadas), 12:00 (**cancelada** durante la prueba) y 06:30 (fuera de rango a
propósito), más un bloqueo 16:30–17:00. El rango 16:00–18:00 **se borró** probando J-14.

Para la sección **K** hacen falta además: una cita **COMPLETADA** encima de un horario que el
rango deja libre (K-6) y una **NO_SHOW SIN expediente** (K-12, el modal más corto que existe).

---

## 8. ✅ Agendar sin rango (CERRADO en código, `ca627673` → `dcf64de6` → `480f7f72`)

**El problema que resolvía:** para escribir *"Sra. García, martes 4pm"* el doctor tenía que
declarar antes una ventana de disponibilidad que no piensa publicar. El rango existe para la
**página pública**; quien no la usa pagaba ese precio a cambio de nada.

**Diseño completo, con las decisiones y su porqué:**
[`01-PLAN-agendar-sin-rango.md`](01-PLAN-agendar-sin-rango.md). §15 y §16 describen el código
de HOY; §5 y §14 quedan como registro de la v1.

### Cómo funciona ahora, en cuatro líneas

1. El picker pide **siempre** las horas libres del día elegido a
   `range-availability?freeform=1&interval=1` (**`authFetch`** — va gateado por auth).
2. Los rangos publicados se siguen rindiendo como **botones**; conviven con lo libre, ya no se
   excluyen.
3. El doctor **escribe** cualquier hora. Se valida por pertenencia contra la lista del
   servidor — el cliente **no** recalcula ocupación (regla 0).
4. Confirmar es un **acto aparte** (botón o Enter). Escribir NUNCA agenda.

### Las cuatro cosas que costaron caro y no hay que re-aprender

1. **El interruptor y el desplegable eran el control equivocado, y todo lo automático estaba
   verde.** La v1 pasó `type-check`, 5 gates, smoke, `/code-review` (6 hallazgos) **y la prueba
   a mano** — y aun así se tiró, porque obligaba al doctor a declarar un **modo** antes de
   expresar una intención, y ofrecía un buscador a quien **ya sabe la hora**. Ninguna
   comprobación puede detectar eso; sólo mirarlo preguntando *"¿es así como el doctor piensa
   la tarea?"*.
2. **Una lista vacía NO es una respuesta.** Tres mensajes distintos afirmaban con seguridad un
   hecho sobre la agenda (*ocupada* · *día lleno* · *sin rangos*) cuando el estado real era
   **"no sé"**: todas las rutas de error caían en el mismo `[]` que un día legítimamente lleno.
   Se separó con `freeformReady` y `monthError`. **Cada vez que un fallo aterriza en el mismo
   estado que un vacío legítimo, la UI acaba mintiendo con total confianza.**
3. **Convertir una constante en parámetro invalida los razonamientos que se apoyaban en su
   valor.** El `15` hardcodeado era load-bearing en **TRES** sitios y sólo uno era visible:
   el tope de días (62 × 96 ≈ 6 k, pero 62 × 1440 ≈ 89 k → ahora es un **presupuesto de
   slots**), la invariante de **superset** (sólo cierta si el intervalo **divide** 15 → sólo
   se aceptan `1·3·5·15`) y el **eco del modo servido** (`freeform` ya se devolvía por esa
   razón; `interval` nació con la misma forma sin heredar la lección → ahora se devuelve
   `intervalMinutes`).
4. **`<input type="time">` SÍ emite valores completos a medio editar.** Con `16:00` puesto,
   teclear el `1` de las 17:00 emite `01:00` — los minutos se conservan. Confirmar en
   `onChange` saltaba al formulario con una cita a la 1:00 AM. **Nunca confirmar en `onChange`.**

### Lo que quedó fuera a propósito

- **El consultorio.** ⚠️ **Ninguna cita basada en rangos guarda su `locationId` hoy, por
  ningún camino** — `Booking` no tiene la columna y `range-bookings/instant` no acepta el
  campo. No lo rompió este trabajo; lo dejó a la vista. **3 de 11 doctores tienen 2+
  consultorios** (medido en prod), así que no es gratis. El arreglo de verdad es la opción (c)
  de `01-PLAN` §4b: columna `location_id` + aceptarla en el endpoint.
- **Marcar visualmente qué horas caen dentro de un rango** (`01-PLAN` §9.1).
- **`handleBookInGap`** — ver §4.1: este trabajo por fin lo habilita, pero no lo hizo.
- **El corte de 1 hora en modo rangos** (`01-PLAN` §11): el picker del doctor todavía se
  aplica a sí mismo una regla escrita para pacientes públicos. El agente ya manda
  `skipCutoff=1`. Cambio de comportamiento, decisión aparte.

---

## 9. 🔴 Lo que SIGUE — el agente de citas (y no vive en esta carpeta)

**Desde `29dcdf51` esto dejó de ser una carencia y pasó a ser una incoherencia visible.** El
picker agenda a cualquier minuto sin rango; el agente no. Mismo doctor, mismo día, misma
hora: la UI agenda y el asistente contesta *"ese día no tiene ningún horario libre"*. **Eso se
lee como asistente roto**, y es peor que el estado anterior, donde ninguno de los dos podía.

Verificado en el código el 2026-08-03, no deducido:

| | Dónde | Qué pasa |
|---|---|---|
| Pre-check | `agenda-agent/proposals.ts:836` | Sin `freeform` en los params ⇒ `[]` ⇒ "no hay horarios" |
| Ejecutor | `contexts/AgentContext.tsx:164` | Postea a `range-bookings` (**rango obligatorio**), no a `range-bookings/instant` |

⚠️ **No es "añadir `&freeform=1`":** esa llamada usa `fetch` pelado y `freeform=1` exige auth
por diseño (si no, se deduce la agenda ocupada del doctor por inversión).

> ⚠️ **CORRECCIÓN 2026-08-05 — son TRES puntos, no dos, y el de auth ya está resuelto.**
> Verificado contra el árbol de esa fecha (`docs/DESDE JUNIO/AGENTES/AGENDAR SIN FRICCION/`):
>
> 1. **Falta el tercero, y es el que el doctor VE:** `agenda-agent/tools.ts:387`
>    (`get_availability`) también llama a `range-availability` con `fetch` pelado y sin
>    `freeform`. El pre-check de arriba sólo corre cuando el modelo YA está armando una
>    propuesta; **`get_availability` es el que contesta "ese día no tiene horarios"**. Arreglar
>    los dos de la tabla y no éste deja la queja intacta.
> 2. **"La llamada tiene que volverse autenticada primero" da a entender infraestructura que
>    falta — no falta.** `agenda-agent/api-token.ts` ya acuña el Bearer HS256 por turno desde la
>    sesión del doctor, `ToolContext.apiToken` ya lo transporta y `search_catalogo_sat` ya lo usa
>    (`modules/facturas.ts:1009`). Lo único pendiente es pasarlo a `ProposalContext`.
> 3. **Trampa que ninguna de las dos filas menciona:** los dos endpoints validan contra
>    **columnas de settings DISTINTAS** (`range-bookings` → `bookingHorarios*`; `/instant` →
>    `bookingInstant*`), y el pre-check del agente lee las de Horarios. Cambiar el ejecutor sin
>    cambiar el pre-check produce cards que validan y luego **400**.
>
> Evidencia y plan: [`../AGENTES/AGENDAR SIN FRICCION/`](../AGENTES/AGENDAR%20SIN%20FRICCION/README.md).

**El trabajo es de la carpeta del agente, no de ésta.** Estado y plan en
[`../AGENTES/AGENTE AGENDA/SESSION-REFRESCO.md`](../AGENTES/AGENTE%20AGENDA/SESSION-REFRESCO.md)
**§Próximos pasos punto 7**, que ya tiene los parámetros del endpoint listos para usar. Exige
tocar la prosa del módulo agenda (⇒ `gate:prosa` + `gate:prompt`) y **DOS corridas de evals**
— una sola no distingue regresión de ruido.
