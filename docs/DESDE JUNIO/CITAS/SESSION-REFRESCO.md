# 🔄 SESSION-REFRESCO — CITAS / calendario

> **Para la próxima sesión.** Dónde quedó todo el 2026-08-06 y qué sigue. Tipo
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

🆕 **2026-08-06 (`d6e6d08c`):** el calendario ya es **clicable donde NO hay rango** y el clic
**precarga fecha y hora** en el modal, en bloques de 15 min. Cierra el watch-item §4.1 y el
pedido A del usuario. **Y por una vez SÍ se probó a mano el mismo día: la sección L pasó.**
Detalle en **§10**.

✅ **Lo del AGENTE (§9) se cerró el 2026-08-05** en la carpeta del agente.

🆕 **2026-08-11 (`81403e00`, deploy SUCCESS en los DOS servicios):** el **consultorio** ya se ve en
la tarjeta y en el modal del calendario — y al hacerlo se descubrió que **dos de los cuatro caminos
que crean citas se lo estaban comiendo**. Además la barra pasó de **9 botones a 5** con un menú
"Más". Todo en **§11**. 🔴 **Nada de eso se ha visto en un navegador.**

🆕 **2026-08-27 (`b5f70617` + `3e83814d`, deploy SUCCESS en `@healthcare/doctor`) — las NOTAS
de la cita ya se ven, y el paciente es el titular de la tarjeta.**

⚠️ **Qué está probado y qué no, con precisión** (el resto de esta sección se escribió antes de
los dos commits de abajo): el usuario verificó **que las notas se ven** y que la tarjeta ya no
dice "1 / 1" (`b5f70617` + `3e83814d`). Lo de después — el recorte a 3 renglones y el arreglo
del párrafo (`67c3f106`, `1dca23b0`) — **no se ha visto en un navegador**.

🔴 **La lección de esta tanda: un arreglo de UI que no viste correr puede ser un NO-OP.**
`67c3f106` recortaba la nota a 3 renglones para que no estirara la tarjeta… pero la nota se
pintaba en **UN SOLO renglón**, y recortar una línea a tres no hace nada. Compiló, pasó
type-check y los cinco gates, se desplegó, y no cambió absolutamente nada en pantalla. El
diagnóstico ("crece a lo alto") era falso: crecía **a lo ancho**.

**La causa real** — vale para cualquier texto largo que se meta en esa tabla: la fila
desplegada es un `td colSpan={6}` dentro de `overflow-x-auto` con `table-layout: auto`, y
`StatusActions` mete botones con `whitespace-nowrap`. La fila crece a lo que pidan esos
botones, la tabla se desborda a lo ancho, y al texto **le sobra ancho**, así que no se parte.
Se arregló en `1dca23b0` con dos cosas que no son intercambiables:

- **`max-w-[60ch]`** — lo vuelve párrafo pase lo que pase con el ancho de la fila. Esto **no**
  se puede lograr con reglas de wrapping: hay que ACOTAR el ancho.
- **`overflow-wrap: anywhere`** en vez de `break-words` — `break-word` **no** reduce el ancho
  mín-contenido, así que una tira sin espacios (hay una real en prod: `"cscscscscs…"`, 68
  chars seguidos) sigue ensanchando la tabla en lugar de partirse.

**107 de las 482 citas de prod tenían notas** escritas al agendar (*"seguimiento Wegovy"*,
*"Ecocardiograma de control anual"*, *"Entrega de Holter de 24 h"*) y **no se veían en NINGUNA
pantalla**. Ahora salen en las **cinco** superficies donde uno abre una cita:

| Dónde | Componente |
|---|---|
| tarjeta del día en `/dashboard` → su modal | `day-details/AppointmentDetailModal` |
| `/dashboard/appointments` → modal de la cita | `BookingDetailModal` |
| `/dashboard/appointments` → **fila desplegada de la tabla**, teléfono Y escritorio | `BookingsSection` (×2: la sección rinde tarjetas abajo de `sm` y tabla arriba) |
| expediente del paciente → "Citas e Ingresos" | `patients/[id]/page` |

Casi todo era de **PINTAR, no de traer**: los endpoints de citas y del calendario ya mandaban
`notes` (usan `include`; el de slots hasta la selecciona explícita). **La excepción es el del
expediente**, que selecciona campo por campo — ahí sí hubo que pedirla y devolverla (con smoke
read-only contra prod del select modificado ANTES del push).

🔴 **El `1 / 1 reservado` de la tarjeta era un ARTEFACTO, no un dato.** Una cita freeform
—todas las de hoy— se normaliza a forma de slot con `currentBookings: 1, maxBookings: 1`
**fijos** en `tasks/calendar/route.ts`, así que ese renglón SIEMPRE decía "1 / 1" — y era el
texto grande de la tarjeta, con el nombre del paciente abajo en gris chico. Ahora manda el
PACIENTE y el conteo sólo aparece si `maxBookings > 1` (slots viejos con cupo múltiple), donde
sí informa algo. Es otra cara de lo mismo que ya está anotado: **el mecanismo de slots está
obsoleto y sigue generando UI que miente.**

⚠️ **Dos detalles que NO son cosméticos.** Viven en `components/citas/NotasCita.tsx` — UN solo
bloque para las 5 superficies, con `tieneNotas()` exportado para que nadie recopie la regla:

- **`trim()` antes de pintar** — hay **29** citas con `notes = ""`, y una sección "Notas" vacía
  no se lee como "no hay notas": se lee como que algo falló al cargar;
- **`whitespace-pre-wrap`** — las notas traen saltos de línea de verdad.

🔒 **El texto puede venir del PACIENTE**: `notes` llega en el body del POST de citas, que
también sirve al widget público. Se rinde como nodo de texto de React (que escapa) y **nunca**
con `dangerouslySetInnerHTML`.

📊 **Sólo 34 de las 107** citas con notas tienen expediente ligado: las otras 73 se ven en el
dashboard y en `/appointments`, pero **no** en la lista del expediente, que por definición
muestra las citas de ESE paciente.

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
| **Clic en el calendario para agendar sin rango (§10)** | ✅ **PROBADO POR EL DOCTOR el 2026-08-06 (sección L): pasó.** Único hallazgo, de notación (12h/24h), arreglado — §10. Verde además: `type-check`, `build`, los 5 gates, **49** comprobaciones de `event-model-check.ts` (eran 28) |

Lo automático está verde en todos (`type-check`, `build`, los 5 gates, las **49** comprobaciones
de `event-model-check.ts` — eran 28 antes de §10), más **smoke read-only contra prod** en los dos commits que tocaron
disponibilidad, más `/code-review` en cada uno (6 · 5 · 6 hallazgos, **todos reales**).

**Nada de eso es el clic.** En este trabajo el `type-check` estuvo verde TODAS las veces que
algo estuvo mal, y la sesión del 08-02 cerró con cinco rondas de `/code-review`, cinco con
hallazgos reales, tres de ellos introducidos por la ronda anterior al arreglar otra cosa.

### Qué correr primero

**Del clic en el calendario (§10), que es lo más fresco y NO ha sido tocado por nadie:**

0. **Clic en un día SIN NINGÚN rango, a media tarde.** Debe abrir el modal con esa fecha y esa
   hora ya puestas, alineadas a los 15 min más cercanos hacia abajo (clic a las 16:20 → 16:15),
   y el picker debe decir *"Libre"*. Con 2+ servicios, el orden real es: clic → elegir servicio
   → la fecha y la hora **siguen ahí** (esa preservación es nueva; si se pierden, es el bug).
   0b. **Clic en un hueco ENTRE dos citas** — la hora propuesta no puede caer dentro de ninguna.
   0c. **Hoy, encima de la línea roja de "ahora"** — no debe haber nada clicable arriba de ella.
   0d. **Escribe 16:07 después de que la precarga puso 16:15.** Debe seguir aceptándolo: la
   rejilla de 15 es la afordancia del clic, no el límite de lo agendable.

**Del picker (`480f7f72`), que sigue siendo lo menos ejercitado de lo que ya está en prod:**

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

1. ✅ **`handleBookInGap` ya precarga fecha y hora, y el calendario es clicable FUERA de los
   rangos** (2026-08-06). Ver §10 — el detalle completo está ahí. ⚠️ **Sin probar a mano y sin
   commitear** al escribir esto.
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

- **El consultorio.** 📌 **RE-PEDIDO POR EL USUARIO el 2026-08-05** (que el AGENTE pregunte en
  cuál consultorio es la cita cuando el doctor tiene más de uno). ⚠️ **Pero el agente no puede
  preguntarlo todavía: no hay dónde guardar la respuesta**, y preguntar algo que se descarta en
  silencio es peor que no preguntar. Re-medido ese día: **3 de 11 doctores** con 2+ consultorios
  (`dra-adriana-michelle`, `gerardo`, `dr-prueba`); `bookings` **sin ninguna** columna de
  consultorio, mientras que `availability_ranges` **sí** tiene `location_id` — o sea **el dato
  existe aguas arriba y se TIRA al crear la cita**. Orden obligatorio (columna → endpoint → UI →
  agente) en
  [`../AGENTES/AGENDAR SIN FRICCION/SESSION-REFRESCO.md`](../AGENTES/AGENDAR%20SIN%20FRICCION/SESSION-REFRESCO.md) §5b.
  ⚠️ **Ninguna cita basada en rangos guarda su `locationId` hoy, por
  ningún camino** — `Booking` no tiene la columna y `range-bookings/instant` no acepta el
  campo. No lo rompió este trabajo; lo dejó a la vista. **3 de 11 doctores tienen 2+
  consultorios** (medido en prod), así que no es gratis. El arreglo de verdad es la opción (c)
  de `01-PLAN` §4b: columna `location_id` + aceptarla en el endpoint.
- **Marcar visualmente qué horas caen dentro de un rango** (`01-PLAN` §9.1).
- **`handleBookInGap`** — ver §4.1: este trabajo por fin lo habilita, pero no lo hizo.
- **El corte de 1 hora en modo rangos** (`01-PLAN` §11): el picker del doctor todavía se
  aplica a sí mismo una regla escrita para pacientes públicos. El agente ya manda
  `skipCutoff=1`. Cambio de comportamiento, decisión aparte.
  ⚠️ **Precisión (2026-08-06):** alcanza SÓLO a los **botones de rango**, que salen de la
  petición del MES. La lista contra la que se valida la hora escrita va con `freeform=1`, y esa
  rama de la ruta **no aplica el corte** (`range-availability/route.ts:421` — sólo
  `applyPastFilter`). O sea: el doctor SÍ puede escribir una hora dentro de la próxima hora; lo
  que no puede es verla como botón.

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

⚠️ **Cerrado el 2026-08-05** en `docs/DESDE JUNIO/AGENTES/AGENDAR SIN FRICCIÓN/`
(`2d343df8` · `0d2181ed` · `f51696c6`). Se deja el diagnóstico porque explica POR QUÉ eran tres
puntos y no dos.

**El trabajo es de la carpeta del agente, no de ésta.** Estado y plan en
[`../AGENTES/AGENTE AGENDA/SESSION-REFRESCO.md`](../AGENTES/AGENTE%20AGENDA/SESSION-REFRESCO.md)
**§Próximos pasos punto 7**, que ya tiene los parámetros del endpoint listos para usar. Exige
tocar la prosa del módulo agenda (⇒ `gate:prosa` + `gate:prompt`) y **DOS corridas de evals**
— una sola no distingue regresión de ruido.

---

## 10. ✅ Clic en el calendario para agendar SIN RANGO (2026-08-06, en el árbol)

**El pedido:** *"En rangos, haces clic en el rango y se abre un modal donde puedes crear la
cita. Quiero esa misma funcionalidad para días y horas donde NO hay rangos, en intervalos de
15 minutos."* Era el watch-item §4.1 ampliado, y cierra los dos pendientes de una vez: el hueco
ya **es clicable fuera de rango** y el modal ya **recibe la fecha y la hora**.

### Qué cambió, en cinco piezas

| Dónde | Qué |
|---|---|
| `_lib/event-model.ts` | `computeOpenSpans(events, ventana)` — lo libre de una ventana ARBITRARIA, sin exigir rango. `snapToGrid` + `BOOKING_GRID_MINUTES`. `computeFreeGaps` se reescribió sobre los mismos dos helpers (`mergeOccupied` / `subtractOccupied`) **sin cambiar su resultado**: sus 7 comprobaciones siguen verdes |
| `calendar/TimeGrid.tsx` | La capa clicable ya no sale de `computeFreeGaps` sino de `computeOpenSpans` sobre la ventana visible entera. Una sola capa, misma afordancia dentro y fuera de rango |
| `appointments/page.tsx` | `handleBookInGap` guarda `{date, startTime}` y abre el modal. **Se quitó el aviso** *"elige el horario en el formulario"*: existía para no prometer una precarga que no ocurría |
| `BookPatientModal/index.tsx` | Props nuevos `preselectedDate` / `preselectedTime` — el bloqueo que este item arrastraba desde julio |
| `RangeTimePickerStep.tsx` | Los lee al montar: fecha del paso 2, hora del paso 3, **y el mes arranca en el del hueco** |

### Las cinco decisiones que no son obvias

1. **La hora sale de DÓNDE se clicó, no del inicio del hueco.** Con rangos daba igual (un hueco
   duraba lo que el rango), pero sin rangos un hueco puede ir de 07:00 a 21:00: mandar su
   inicio agendaría a las 07:00 a quien clicó las 16:20. Se traduce la posición vertical del
   clic a minutos y se alinea **hacia abajo** a los 15 — quien clica 16:20 quiere las 16:15, que
   es el bloque que estaba tocando. Con teclado (`e.detail === 0`) no hay punto de clic, así que
   se propone la primera marca del hueco.
2. **Los 15 min son la AFORDANCIA, no el límite** — y hay una comprobación que lo fija: un
   hueco 09:50–10:00, donde ninguna marca de 15 cae dentro, propone **09:50**. El motor acepta
   cualquier minuto y el campo sigue aceptando 16:07. Una rejilla que rechazara 16:07 sería
   volver al mundo de los rangos.
3. **Una sola capa clicable, no dos.** Los huecos de rango y lo libre fuera de rango se
   comportan igual, así que superponer dos capas de botones sólo decide clics por z-index. El
   fondo azul de los rangos sigue diciendo qué está publicado; ya no decide qué es clicable.
4. **Se recorta lo PASADO** (hoy hasta `ahora + 1 min`, los días anteriores enteros): el picker
   contestaría *"esa hora ya pasó"*, y un clic que sólo puede terminar en rechazo es peor que
   ningún clic. El `+1` copia el borde exacto del servidor (`applyPastFilter` conserva
   estrictamente `startTime > now`), el mismo `<=` que ya vive en `classifyTypedTime`.
   ⚠️ **El corte de 1 hora NO se replica**: `freeform` no lo aplica (§8), así que el doctor sí
   puede agendar dentro de la hora. Replicarlo aquí habría sido inventar una restricción que el
   servidor no tiene.
5. **Elegir servicio ya no borra la fecha.** La borraba para forzar re-elegirla, pero las dos
   peticiones dependen de `selectedServiceId` y se relanzan solas (vaciando su estado al
   empezar, así que no se rinde nada del servicio anterior). Con la fecha precargada era además
   una pérdida real: **con 2+ servicios el camino normal es clic → servicio**, y ahí se perdía
   justo el dato que el clic venía a traer.

### Lo que NO cambió, a propósito

- **Precargar no es agendar.** La hora viaja como propuesta y se valida contra la lista del
  servidor igual que si el doctor la hubiera escrito: puede salir ocupada u ofrecer vecinas, y
  confirmar sigue siendo un acto aparte (botón o Enter). El cliente no decide disponibilidad.
- **Sólo la rejilla Día/Semana.** Mes y Año no ganan clic para agendar; Mes baja al día.
- **La ventana visible sigue siendo el límite de lo clicable** (7–21 h por defecto, estirada
  por rangos y citas). Para las 06:00 de un día vacío hay que escribir la hora en el modal.
- **El consultorio sigue sin preguntarse** — no hay columna donde guardarlo (§8 y
  [`../AGENTES/AGENDAR SIN FRICCION/SESSION-REFRESCO.md`](../AGENTES/AGENDAR%20SIN%20FRICCION/SESSION-REFRESCO.md) §5b B).

### Verificación

`type-check` ✅ · `build` de `@healthcare/doctor` ✅ · los 5 gates ✅ ·
`event-model-check.ts` **49 comprobaciones** (eran 28; las **21** nuevas cubren `computeOpenSpans`
y `snapToGrid`, incluida la de que `computeFreeGaps` no ofrece NADA en un día sin rangos —
que es por lo que hizo falta la función nueva).

⚠️ **El número se contó mal la primera vez** (decía 46/18 en tres sitios, medido "a ojo" en vez
de con `| grep -c "  ok "`). Lo cazó el `/code-review`. `gate:numeros` **no** cubre este script,
así que un número de aquí sólo lo protege quien lo vuelva a contar.

⚠️ **Nada de eso es el clic.** Sin API nueva ni SQL, no hay smoke contra prod que valga aquí:
lo que falta es la corrida a mano del punto 0 de §2.

### El `/code-review` — 6 hallazgos, 6 atendidos

Los dos primeros son bugs de verdad, y los dos existen **porque quitamos el marco de los
rangos**: mientras lo clicable venía de un rango, un rango acotaba por los dos lados.

1. 🔴 **Un hueco podía pasarse de las 24:00.** El encuadre se estira con `blockEndMin`, que no
   tiene tope: una cita de 22:00–23:00 con `extendedBlockMinutes = 150` lo empuja a las 24:30,
   y ahí se ofrecía un clic cuya hora `minToTime` rinde como **"24:45"** — que
   `<input type="time">` rechaza, así que el doctor recibía el campo **vacío y sin
   explicación**. `computeOpenSpans` recorta la ventana al día.
2. 🔴 **`snapToGrid` proponía las 07:00 por un clic en el fondo de la columna.** Si el clic cae
   exactamente en el borde inferior (`clientY === rect.bottom`, alcanzable en pantallas de DPI
   fraccionario) y el fin del hueco es marca de rejilla, el candidato quedaba fuera y el
   fallback devolvía `span.start`: **14 horas de error**. Ahora devuelve la última marca DENTRO
   del hueco. ⚠️ Mis pruebas sólo ejercitaban el caso *previsto* del fallback (hueco más corto
   que una celda), que la propia criba de `>= 15 min` vuelve inalcanzable desde la rejilla — o
   sea que **probaban la rama por el único camino que no ocurre en producción**.
3. **Mi comentario inventaba un consumidor.** Decía que `computeFreeGaps` "sigue viva para el
   panel de día"; `DayTimelinePanel` **nunca la usó** —tiene su propio bucle en línea— y hoy su
   único llamador es el script de comprobaciones. Corregido, con la deuda dicha en voz alta.
4. **Volver de "← Cambiar horario" reponía el hueco original.** El picker sólo se rinde con
   `step === "slot"`, así que ir y volver lo **remonta** y re-aplicaba el 16:15 del clic,
   tirando las 17:30 recién elegidas. Ahora el padre manda lo YA elegido y el hueco sólo cuando
   no hay nada elegido.
5. **La ruta muerta `v2` seguía con el aviso mentiroso** (*"Agendar cita: {fecha} a las
   {hora}"*) y sin precargar nada — justo el peligro que documentaba el comentario que esta
   sesión borró de `page.tsx`. Se le pasaron los props: ya no miente por ninguno de los dos
   lados.
6. **Los números de este documento estaban mal** (46/18 en vez de 49/21). Ver arriba.

**Lo que el review verificó y salió limpio:** el refactor de `computeFreeGaps` es
comportamiento idéntico · la matemática del clic normaliza por `rect.height`, así que el piso
de 14px de `heightFor` no la sesga, y `clientY`/`getBoundingClientRect` son ambos relativos al
viewport (el scroll no la afecta) · el z-index no le roba clics a los bloques de cita · el
`gapPreset` se limpia en las tres entradas · quitar el borrado de la fecha al cambiar de
servicio no puede confirmar un horario del servicio anterior · `nowMin + 1` refleja el borde
del servidor.

### La corrida a mano SÍ ocurrió — y salió limpia salvo un detalle de notación

**El doctor corrió la sección L el 2026-08-06: todo correcto.** Es la primera vez en esta
carpeta que algo de este tamaño se prueba a mano el mismo día. Lo único que salió fue esto, y
**no era un error**:

```
Hora
Escribe la hora
  [ 03:45 PM ]          ← el <input type="time">
  Usar 15:45 – 16:30    ← nuestra etiqueta
```

La misma hora, dos notaciones, a un centímetro. **El formato del campo lo elige el NAVEGADOR y
no hay atributo para forzarlo**, así que la única pieza que podíamos mover era la nuestra.

**Decisión del usuario: el modal habla la notación del navegador.** `formatTimeOfDay`
(`lib/dates.ts`) con locale `undefined` —deliberadamente **no** `es-MX` como `formatLocalDate`:
el objetivo no es hablar español, es **coincidir con el campo**, y el campo sigue al navegador.
Alcanza a las horas del modal: botones de rango, el botón "Usar …", las horas cercanas, el
encabezado y la pantalla de éxito (y de paso `SlotPickerStep`, del modal viejo).

⚠️ **El calendario, la franja de rangos y la tabla siguen en 24 h**, a propósito: ahí no hay
ningún `<input type="time">` con el que coincidir, y son densas en horas (una columna de 14 h
con "3 PM" en vez de "15:00" se lee peor). O sea que la coherencia se buscó **dentro de cada
superficie**, no a través de todas.

⚠️ **El `value` del input sigue siendo "HH:MM" 24 h** — lo exige el HTML. Sólo cambió lo que se
RINDE, nunca lo que se manda al servidor.

⚠️ **No usar `formatTimeOfDay` en render de servidor**: el locale del navegador no existe en el
build. Hoy es seguro porque el modal no se rinde hasta abrirlo, y está dicho en su docstring.

**De paso, la duda que trajo el reporte y su respuesta medida:** el `16:30` de `15:45 – 16:30`
no lo inventa el cliente — `endTime = startTime + serviceDurationMinutes`, calculado en el
servidor (`availability.ts:210`). Son 45 min porque el servicio dura 45.

---

## 11. ✅ El consultorio en la tarjeta y en el modal · la barra baja a 5 botones (2026-08-11, `81403e00`)

Deploy **SUCCESS en los DOS servicios** (`@healthcare/api` y `@healthcare/doctor`), verificado por
`commitHash` en cada deployment. Narrativa completa de la sesión (incluye expediente y chats):
[`../SESION-2026-08-11-UI.md`](../SESION-2026-08-11-UI.md).

### 11.1 El consultorio ya se ve — pero el bug estaba en el WRITE

Lo pedido era enseñarlo en las tarjetas de "Todas las Citas" y en el modal que abre el calendario
(el mismo `BookingDetailModal` para los dos). Se pinta como etiqueta con pin junto al servicio.

🔴 **Enseñarlo no bastaba: DOS de los cuatro caminos que crean citas se comían el consultorio.** El
doctor lo elegía en el modal y la cita quedaba en `NULL`. Es el MISMO descuido que
`range-bookings` ya tenía documentado con el rango ("lo tenía en la mano y lo tiraba"), vivo
todavía en los caminos por slot:

| Camino | Antes | Ahora |
|---|---|---|
| `range-bookings` (público) | ✅ heredaba del rango | sin cambios |
| `range-bookings/instant` | ✅ valida + hereda | sin cambios |
| `bookings/instant` | ❌ lo guardaba en el SLOT y no en la CITA | guarda **sólo lo explícito** |
| `bookings` (slot existente) | ❌ nunca lo guardaba | hereda `slot.locationId` |

**Por qué las dos rutas nuevas hacen cosas DISTINTAS** (si esto se "arregla" para que coincidan, se
rompe una de las dos):

- **`bookings/instant` guarda sólo lo explícito**, NO su `resolvedLocationId`. Ese cae al
  consultorio **por defecto** cuando nadie dice nada, y `useAppointmentsChat` agenda por ahí **sin
  mandarlo**: escribiría una suposición como si fuera un hecho. En el SLOT ese default está bien
  —ahí `null` ya significa "el de siempre"—, en la CITA `null` significa **NO REGISTRADO**.
- **`bookings` hereda `slot.locationId`** aunque ese valor **tampoco** sea siempre una elección del
  doctor (`slots/route.ts` resuelve al default al crear el slot, y el `create_slots` del agente no
  manda consultorio). Se hereda **a propósito**: `send-confirmation-email` YA le mandó al paciente
  la dirección de `slot.location`, así que esto no es "donde el doctor eligió" sino **la dirección
  que se le dio al paciente** — justo lo que el doctor necesita ver para cacharla si está mal.
  Guardar `NULL` escondería el problema.

**Y se valida la pertenencia.** `bookings/instant` ahora usa `validateRequestedLocation` (el helper
compartido): la FK apunta a `clinic_locations`, no a "los de este doctor". ⚠️ Es una **400 nueva en
un endpoint vivo**; los dos clientes que lo llaman mandan un id propio o no mandan nada.

### 11.2 Qué se pinta cuando no se sabe

**Sólo se muestra cuando se sabe.** Medido en prod el 2026-08-11 (smoke test read-only del nuevo
`include`, método canónico de TOOLING):

| | |
|---|---|
| Citas totales | **425** |
| Con consultorio | **13** |
| Sin consultorio **pero su slot sí lo trae** | **104** |
| Doctores con MÁS de una sede | **3 de 11** |

Repetir "sin consultorio" en el 97% de las tarjetas no informa nada, y `null` **no** se pinta como
el consultorio por defecto. Las 104 recuperables siguen sobre la mesa como una **escritura aparte y
explícita** — a diferencia del backfill de 269 que el usuario descartó, ésta no adivina: copia lo
que el slot ya declara.

### 11.3 La barra: de 9 botones a 5

Crear Rango · Bloquear · Eliminar Rangos · Enlace Reseña casi no se aprietan —**los rangos
perdieron el día a día cuando se pudo agendar sin rango**— y se fueron a un menú **"Más"**
(`_components/MenuMasAcciones.tsx`) con una sección de Disponibilidad. Reusa el patrón de dropdown
de `TemplateCard` en vez de inventar un tercero.

⚠️ En el teléfono el panel se ancla a la **IZQUIERDA**: la barra es `grid-cols-2`, "Más" cae en la
columna izquierda y un panel de 224px anclado a la derecha **se salía de la pantalla** (en 375px
arrancaba en x≈−41).

### 11.4 Lo que NO se ha visto

🔴 **Nada de §11 se ha probado en un navegador.** La prueba que importa es **agendar una cita nueva
y ver si sale el consultorio**: el arreglo del write path sólo lo ha visto un type-check.

`CitasGuide` quedó al día. Tenía deriva **previa** (decía "Crear Horarios" y "Bloquear Periodo"
para botones llamados "Crear Rango" y "Bloquear") y tres instrucciones que mandaban a apretar
botones **por su color** — "el botón azul", "el amarillo", "el gris oscuro" — que ya no existen.
