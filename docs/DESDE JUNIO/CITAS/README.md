# 📅 CITAS — los flujos de `/dashboard/appointments`

> **Qué vive aquí.** Todo lo de la tabla "Todas las Citas" y sus modales: agendar, reagendar,
> completar, cobrar, confirmar, y la relación cita ↔ expediente. Tipo **ESTADO / BITÁCORA**:
> este README se actualiza al cerrar cada sesión.
>
> **Qué NO vive aquí.** Lo del **agente** (aunque lo haya disparado un cambio de citas) va a
> `../AGENTES/AGENTE AGENDA/` o `../AGENTES/AGENTE FACTURAS/` — la bitácora de fallos del
> agente es la de `AGENTE AGENDA/SESSION-REFRESCO.md`. Aquí solo se resume y se cross-linkea.
> Convención completa: [`../AGENTES/GENERAL AGENTES/07-CONVENCIONES-docs.md`](../AGENTES/GENERAL%20AGENTES/07-CONVENCIONES-docs.md).

## Índice

| Doc | Tipo | Qué es |
|---|---|---|
| [`00-METODO-prueba-manual-punta-a-punta.md`](00-METODO-prueba-manual-punta-a-punta.md) | REFERENCIA | El guion de la prueba a mano de cada flujo de una cita |

## En una frase

El **calendario Día · Semana · Mes · Año** (2026-08-02) reemplaza el mini-calendario + panel
de día; la tabla "Todas las Citas" no se tocó. **Escrito y compilado, NO probado a mano** —
le corresponde la sección **J** del guion. Sigue faltando la prueba punta a punta de A–I.

## Bitácora de la sesión 2026-08-02 — calendario tipo Google

**Qué se ve.** Selector de 4 vistas + `Hoy` + `‹ ›`. Día y Semana son una **rejilla de horas
real** (bloques posicionados por minuto, no una lista): los rangos de disponibilidad son el
fondo azul, las citas bloques por estado, los bloqueos un rayado naranja, los huecos libres
zonas clicables que abren Agendar, y hay línea roja de "ahora". Mes lleva hasta 3 citas por
día y "+N más"; Año son 12 mini-meses tintados por densidad.

**Tres cosas que no eran evidentes y decidieron el diseño:**

1. **La ventana de datos era MENSUAL y eso rompía la semana.** `useRanges` y `useBlockedTimes`
   derivaban `startDate`/`endDate` del mes de `selectedDate`, así que una semana a caballo
   entre dos meses (29 jul – 4 ago) mostraba los rangos de uno solo, y el año era imposible.
   Ahora reciben la **ventana visible** desde `useCalendar`. El API ya aceptaba fechas
   arbitrarias: **fue cambio de cliente, sin tocar endpoints ni SQL.**
   `useBookings` **no** se ventaneó a propósito — ya trae todas las citas y de ahí come la
   tabla; ventanearlo habría sido otro cambio, de otra naturaleza, escondido en éste.
2. **El reloj.** `useCalendar` sembraba `new Date()` del **navegador** mientras el resto del
   producto asume `America/Mexico_City` (hardcodeado en ~27 lugares, no hay campo de zona por
   doctor). Un selector de fechas a nivel de DÍA lo toleraba; una rejilla de horas lo exhibe
   en la línea de ahora y en la columna de hoy. Se añadieron `nowInClinicTz`,
   `getClinicDateString`, `getClinicMinutesOfDay` y `todayInClinicTz` a `lib/dates.ts`, y
   **"ahora" se deriva siempre de ahí**.
3. **Un bug latente que la rejilla habría multiplicado por 7.** `DayTimelinePanel` formateaba
   su encabezado con `selectedDate.toISOString()`: `toISOString` pasa a UTC, así que abriendo
   la página **después de las 18:00** (UTC−6) el título decía MAÑANA mientras el contenido
   filtraba por HOY. Se salvaba sólo porque el clic en el mini-calendario anclaba al mediodía;
   el estado inicial era la hora real. En una vista de semana serían 7 encabezados mal.
   Arreglado con `getLocalDateString`, y `todayInClinicTz` ancla al mediodía por lo mismo.

**Lo que se verificó y lo que NO.** `pnpm type-check` limpio, `pnpm build` del app doctor OK,
los **5 gates** en verde, y las comprobaciones de la matemática de `_lib/event-model.ts`
(traslapes → columnas, contiguas sin partir, `extendedBlockMinutes`, recorte de huecos,
citas libres vs. con `slot`, paridad con el panel viejo en qué estados liberan un hueco).
⚠️ **Nada de eso es la prueba a mano**: falta el clic. Sección **J** del guion (20 checks:
J-1…J-19 más J-18b).

**Fuera de alcance a propósito.** *Arrastrar para reagendar*: aquí reagendar no es mutar una
fecha — `page.tsx` crea una cita NUEVA y hace PATCH a `CANCELLED` sobre la vieja, con efectos
de correo. Arrastrar un bloque tendría que disparar esa cadena entera. Es lo que quitó el
argumento para meter una librería de calendario: sin arrastre, `date-fns` (ya instalado)
alcanza, y **no hubo dependencia nueva ni regeneración de `pnpm-lock.yaml`**.

**Deuda que deja.** `AppointmentsCalendar` y `DayTimelinePanel` ya no los usa la página
principal, sólo las rutas muertas `v1`/`v2` (no enlazadas desde ningún lado, alcanzables por
URL). Se dejaron compilando a propósito — `v2` recibió el cambio mecánico a `monthWindowFor`.
Borrarlas es una decisión aparte.

### Code review de la misma sesión — 8 arreglos aplicados

Se corrió primero un pase **inline** (el autor revisando su propio diff) y después
`/code-review` con **ojos frescos**. El resultado es el argumento más fuerte a favor del
segundo: **el pase inline no encontró los tres hallazgos más graves.** Queda como dato para
`GENERAL AGENTES/05-METODO-code-review.md` §2 — la debilidad declarada del modo B ("el mismo
autor puede *saber* lo que el código quiere decir") no es teórica, se midió aquí.

> ⚠️ **La lección que hay que recordar no es un bug, es un NOMBRE.**
> Existía un solo `INACTIVE_STATUSES = {CANCELLED, COMPLETED, NO_SHOW}`, escrito para
> calcular huecos, donde significa *"¿este estado LIBERA el horario?"* — y ahí `COMPLETED`
> pertenece, porque una consulta que ya pasó devuelve su hueco. La vista de AÑO lo reusó para
> otra pregunta distinta, *"¿hubo trabajo ese día?"*, y como `COMPLETED` es el estado de toda
> consulta realizada, **pintaba en blanco todo el pasado del año**: exactamente lo contrario
> de lo que la vista existe para mostrar. Un conjunto, dos preguntas, una sola de ellas bien
> contestada. Ahora son `FREES_THE_SLOT` y `NO_WORKLOAD`, con nombres que dicen qué preguntan.
> **El nombre ambiguo era el bug; los nombres largos son el arreglo.**

| | Hallazgo | Arreglo |
|---|---|---|
| **A** | Año pintaba vacío TODO el pasado (`COMPLETED` excluido de la densidad) | Dos predicados con nombre propio + 7 comprobaciones nuevas |
| **B** | Borrar un rango era **inalcanzable**: los huecos (z-5) y las citas (z-10) son HERMANOS del fondo del rango, no descendientes, así que el `group-hover` nunca disparaba. En táctil, invisible pero **sí tocable**. Y era la única forma de borrar un rango tras quitar el panel | Controles SIEMPRE visibles a `z-20` |
| **C** | Clic en un día de relleno del mes vecino reencuadraba la rejilla entera y volvía a pedir datos | `anchorDate` (qué periodo se ve) separado de `selectedDate` (qué día se resalta) |
| **D** | Respuestas fuera de orden se quedaban pegadas, sin spinner que lo delatara (`hasLoadedOnce`) | Guard de "gana la más reciente" en los dos hooks |
| **E** | `intervalMinutes` había desaparecido de toda la interfaz | Vuelve en el chip del rango ("cada 30 min") |
| **F** | Año pedía 365 días de rangos y bloqueos que ningún componente lee | `enabled=false` en esa vista |
| **G** | `MONTH_NAMES` ×4 y `DAY_NAMES` ×3 — dos de cada una las agregó esta sesión | `_lib/calendar-labels.ts`, fuente única, 5 componentes migrados |
| **H** | Se perdió el estado vacío "Sin disponibilidad este día" | Restaurado (y variante de semana) |

**Refutado (1).** El review sostuvo que descartar huecos < 15 min era una regresión frente al
panel viejo. No lo es, por dos razones independientes: `git show HEAD:…/DayTimelinePanel.tsx`
línea 247 aplicaba `.filter(g => g.end - g.start >= 15)` en el render —paridad exacta—, y el
escenario que construyó (un rango de 10 minutos) es imposible: `VALID_INTERVALS = [15,30,45,60]`
en `ranges/route.ts`.

**Aceptado sin arreglar (1) — watch-item.** `handleBookInGap` ignora sus parámetros: el toast
afirma "Agendar cita: {fecha} a las {hora}" y el modal no recibe ninguno de los dos. Es
**preexistente**, pero la rejilla lo amplifica (antes el hueco clicable era una fila estrecha;
ahora es toda la superficie libre). Arreglarlo implica pasar fecha/hora por `BookPatientModal`
— otro cambio, de otra naturaleza. **Dueño: la próxima sesión de CITAS.**

### Segunda vuelta de `/code-review` — 5 arreglos más

Se volvió a correr con ojos frescos **sobre los arreglos**, y encontró cinco cosas más. Dos
las había *introducido* la propia ronda anterior: es el argumento para no dar por bueno un
diff sólo porque cierra hallazgos.

| | Hallazgo | Arreglo |
|---|---|---|
| 1 | Una cita que libera su horario producía un hueco en `computeFreeGaps`, pero su bloque (z-10) se comía el clic del hueco (z-5), así que **no se podía reagendar ahí** | `pointer-events-none` en los bloques cuyo estado libera el horario (cuesta su tooltip). ⚠️ **Sigue siendo necesario** aunque después se ocultaran las canceladas: `COMPLETED` y `NO_SHOW` también liberan el horario y **sí se dibujan** |
| 2 | El aviso al clicar un hueco prometía "Agendar cita: {fecha} a las {hora}" y el modal **no recibe ninguna de las dos** → agendar en el horario equivocado creyendo que venía puesto | El texto ya no promete lo que no entrega. El watch-item de pasarlas de verdad **sigue abierto** |
| 3 | El corte por `enabled` iba **antes** de `++lastRequestId`, así que apagar el hook (Mes→Año) **no invalidaba** la petición en vuelo — justo el caso que el guard nuevo debía cubrir | El id se incrementa antes del corte |
| 4 | `nowInClinicTz` parseaba `"YYYY-MM-DD HH:mm:ss"` (con espacio), formato que ECMA-262 no obliga a aceptar. Siendo la raíz de todo "hoy"/"ahora", un `Invalid Date` habría dejado la rejilla en blanco **sin un error en consola** | `.replace(' ', 'T')` → fecha-hora ISO local, que la norma sí define |
| 5 | El README decía "13 checks" cuando la sección J ya tenía 17, y J-14…J-17 estaban listados **antes** de J-12/J-13 | Renumerado y en orden (J-1…J-19 más J-18b = **20**) |

**Confirmado limpio por el review** (para no re-auditarlo): la paridad de `computeFreeGaps`
con el panel viejo · los límites de `visibleDays` (1/7/35-42/`[]`) · que la memoización por
string evita el bucle de render · que los bordes `T00:00:00Z`/`T23:59:59Z` son inclusivos
contra el `gte`/`lte` del API · que `inMonth` no colisiona en dic/ene · que el `todayStr` se
recalcula con el tick de 60s y la columna de "hoy" cambia sola a medianoche · y el reparto
en columnas de `layoutDayEvents`.

### Ajustes tras la primera prueba sobre el deploy

**La franja "Rangos" salió de la rejilla.** El chip con ubicación · intervalo · 🗑 se había
puesto SIEMPRE visible a z-20 para arreglar que fuera inalcanzable — y quedó justo encima de
la cita de las 09:00, tapando su contenido. Se cambió un solape por otro. La corrección de
fondo es de **altitud**: esos datos describen el DÍA, no un instante suyo, así que ahora
viven en una franja bajo los encabezados, donde no compiten con nada. En Semana se abrevian
(el detalle NO se esconde en el `title`: un tooltip no existe en táctil, que es justamente lo
que este rework venía a resolver). Botón de borrar a ~26px, por encima del mínimo táctil.

**Las canceladas ya no se dibujan en el calendario.** Una cita cancelada no ocurrió y no va a
ocurrir; en la rejilla sólo tapaba un horario libre. `HIDDEN_IN_CALENDAR` — **tercer**
conjunto con nombre propio, junto a `FREES_THE_SLOT` y `NO_WORKLOAD`: tres preguntas
distintas, tres conjuntos, ninguno reusado para responder otra. `COMPLETED` y `NO_SHOW`
**sí se siguen dibujando**: son registro de lo que pasó. Nada se pierde — la tabla las sigue
listando con el filtro *Todas*. Efecto colateral bueno: al reagendar, la vieja (que el flujo
pasa a `CANCELLED`) desaparece sola y sólo queda la nueva.

⚠️ **Deriva de doc que esto provocó:** J-18 decía "el bloque gris de la cancelada no debe
comerse el clic". Ese bloque ya no existe, así que el check **pasaría trivialmente sin probar
nada**. Se partió en J-18 (la cancelada desaparece) y **J-18b**, que usa una **COMPLETADA**
—la que sí se dibuja encima de un hueco libre— para ejercitar de verdad el `pointer-events`.

**Gates tras los arreglos.** `type-check` limpio · `build` OK (2 warnings preexistentes de
Prisma/middleware) · los 5 gates verdes · y las comprobaciones de `_lib/event-model.ts`:

```bash
cd apps/doctor && npx tsx scripts/event-model-check.ts
```

⚠️ Esas comprobaciones **vivían en un scratchpad**, así que los "17/24/28 checks" que
citaron las versiones anteriores de este doc no eran verificables por nadie más y no podían
fallar en una regresión — un número que sólo existe en la prosa. Ahora están versionadas en
`apps/doctor/scripts/event-model-check.ts`, junto a los demás `*-check.ts`/`*-smoke.ts`, y
`event-model.ts` lo merece: es la matemática que comparten las TRES vistas.

Sigue faltando la prueba a mano: sección **J**, ahora **20 checks**.

### Estado anterior — en una frase

El rediseño de la tabla (2026-07-28/29) está **shipped y verificado en prod**; encima de eso,
el 2026-07-29 se apilaron cinco pasadas más: **nombre y apellidos separados** al agendar,
**aviso de correo duplicado** al crear expediente, **FACTURA como grupo propio** debajo de
Cobro, **Primera vez ya no ofrece buscar expediente**, y el arreglo de **dos fallas
silenciosas** (el enlace fiscal que se invalidaba solo y el WhatsApp sin destinatario).
**Falta la prueba a mano punta a punta.**

### Bitácora de la sesión 2026-07-29

| Commit | Qué |
|---|---|
| `57859a37` | Nombre y apellidos separados en la cita (+ migración aditiva) |
| `2aa4725a` | Aviso de correo duplicado también en `Expedientes → nuevo paciente` |
| `6b555447` | **FACTURA** como grupo propio bajo Cobro · separación visible entre citas · etiquetas |
| `4eb117da` | A una cita de **Primera vez** ya no se le ofrece BUSCAR expediente existente |
| `eed733c2` | El enlace fiscal dejaba de servir en silencio · WhatsApp sin destinatario |

## Estado

**Rediseño de la tabla — SHIPPED (2026-07-28/29).** Filas colapsables · filtros "Todas las
fechas" + Activas/Completada · bloqueo de horario bajo FECHA Y HORA · Cobro y Documentos
sobreviven a COMPLETADA · casilla **Factura** por cita (`bookings.factura_solicitada`) ·
grupo **Confirmación** con estados honestos por canal · contacto resuelto `cita → expediente`
en la fila, los 2 endpoints de envío y el link de pago · reagendar conserva `patientId` y
manda `isRescheduled`.

**Nombre y apellidos separados — SHIPPED (2026-07-29, `57859a37`).** Dos campos en el modal
de agendar; `bookings.patient_first_name` / `patient_last_name` (migración aditiva, nullable).
`patient_name` **sigue siendo la concatenación** — es lo que leen los correos, el agente, el
widget público, la fila y el link de pago; los campos separados van ADEMÁS.
Lo viejo NO cambia de comportamiento: las 366 citas previas, las del widget público y las que
crea el agente quedan en NULL y siguen usando el split de `partirNombreDeCita`.
De paso, el modal de crear expediente avisa de dónde vienen los datos y **flagea el correo
duplicado** ofreciendo vincular el expediente que ya existe (aviso, NO bloqueo).

**Correo duplicado también en el alta directa — SHIPPED (`2aa4725a`).** `Expedientes → nuevo
paciente` avisa igual, listando TODOS los expedientes que comparten el correo como links.
Solo al CREAR (`!isEditing`): editando, el propio paciente haría match consigo mismo. Param
`?email=` exacto, aparte de `?search=` para no cambiar lo que devuelven los buscadores por
nombre. **Aviso, no bloqueo** — ni UI, ni API, ni BD impiden repetir correo (no hay unique en
`patients.email`), y en prod hay CUATRO expedientes con el mismo a propósito: familias y
cuidadores.

**FACTURA como grupo propio — SHIPPED (`6b555447`).** Estaba metido en "Documentos", junto al
formulario CLÍNICO pre-consulta. Ahora vive **debajo de Cobro**, que es el paso anterior de la
MISMA cadena, y espeja sus estados uno a uno:

| | Cobro | Factura |
|---|---|---|
| Sin expediente | Requiere expediente | Requiere expediente |
| Acción inicial | Link de pago | Facturación |
| Enlace creado | Link enviado + compartir | Esperando datos + compartir |
| Listo | Pagado ✓ | Datos fiscales ✓ |

Al emparejarlos salieron dos huecos: marcar *¿Necesita factura?* en una cita **sin expediente**
no mostraba NADA (doble guard: el gate del padre exigía `patientId` y el botón devolvía `null`),
y con el enlace creado quedaban dos botones sueltos sin chip que dijera de qué eran.
Verificado sin regresión enumerando las **60** combinaciones de estado × formulario ×
expediente × casilla: cambian 12, todas son el grupo Factura apareciendo donde no había nada, y
todas con la casilla marcada. La columna del formulario clínico es idéntica en las 60.

En la misma pasada: **separación visible entre citas** (`divide-y divide-gray-50` era casi
invisible Y dibujaba la misma línea entre dos citas que entre una cita y su propia fila
desplegada — una cita abierta se leía como dos; ahora el borde cierra la CITA, con
`last:border-b-0`), y las etiquetas **Confirmación → Confirmación cita** y la casilla
**Factura → ¿Necesita factura?** (que es como el propio comentario del componente ya la
llamaba).

**Primera vez ya no ofrece BUSCAR expediente — SHIPPED (`4eb117da`).** Un paciente nuevo debe
nacer con su propio expediente: colgarle uno existente hace que el correo de la cita y el del
expediente puedan diferir desde el minuto uno, y **la copia de la cita gana en todos lados**.
La fila, sin expediente: `isFirstTime === true` → solo "+ Crear expediente"; `false` y `null`
(las 22 del agente) conservan las dos opciones. El modal de agendar no necesitó cambios — su
bloque ya estaba gateado a `isFirstTime === false || selectedPatientId`.
⚠️ La búsqueda **se repliega detrás de un enlace**, no desaparece: `isFirstTime` NO se puede
corregir después (el PATCH no lo acepta), así que esconderla a secas dejaría atrapado al doctor
que marcó mal la cita, y su única salida sería crear un DUPLICADO.
⚠️ **Es convención de UI, no invariante:** el PATCH acepta `patientId` para cualquier cita y
`propose_create_booking` del agente recibe `patientId` y `patientEmail` como entradas
independientes.

**Dos fallas SILENCIOSAS arregladas — SHIPPED (`eed733c2`).**

1. **El enlace de datos fiscales se invalidaba solo.** `POST /fiscal-form-link` rotaba el token
   en CADA llamada si ya había uno PENDIENTE, y el estado del botón vivía en un `useState`, así
   que al refrescar volvía a decir "Facturación". Secuencia real: crear enlace → mandarlo por
   WhatsApp → refrescar → clic otra vez → **el enlace que el paciente tiene deja de servir**,
   sin aviso por ningún lado. Arreglado en tres capas: el endpoint DEVUELVE el existente
   (rotar exige `regenerar: true`), el enlace pendiente viaja en el payload de la cita, y el
   botón deriva su estado del servidor.
   ⚠️ El enlace fiscal cuelga del **PACIENTE** (`templateId='FISCAL'`, `bookingId` NULL), por
   eso no llegaba en `formLink`, que se resuelve por `bookingId`. **El filtro por `templateId`
   es obligatorio** — comparte tabla con los formularios clínicos y se distingue solo por ese
   centinela; olvidarlo es el bug que hoy infla `formulariosPreConsulta` en el agente (§8.2).
2. **El formulario pre-consulta se "mandaba" a nadie.** Armaba `wa.me/?text=…` **sin
   destinatario**: abría WhatsApp con el mensaje listo y sin nadie a quién enviarlo. Si el
   doctor no notaba que faltaba elegir contacto, lo daba por enviado.

Y una inconsistencia que salió revisando eso: el teléfono se resolvía de **dos maneras** — la
fila con respaldo al expediente y los botones de compartir con `booking.patientPhone` a secas,
así que la fila MOSTRABA un número mientras el botón de WhatsApp se escondía diciendo que no
había. Se extrajo **`lib/booking-contact.ts`** (`resolverContacto` + `telefonoWhatsApp`), que
ahora usan la fila, el link de pago, el botón fiscal y el modal pre-consulta. **Es el único
archivo a tocar si se decide la bitácora #30.**

### Números medidos en prod (2026-07-29 — baseline)

| | |
|---|---|
| Citas totales | 366 (368 al re-medir más tarde el mismo día) |
| Sin expediente | 304 (de ellas 195 con correo, 256 con teléfono) |
| `patient_name` de UNA sola palabra | 124 (34%) — por eso **Apellidos es opcional** |
| Marcadas "Primera vez" | 255, de ellas **34 CON expediente** |
| Citas con `is_first_time` NULL (las crea el agente) | 22 |
| Citas vinculadas con nombre distinto al del expediente | 36 de 62 (58%) |
| Citas vinculadas con correos DISTINTOS cita↔expediente | **4 de 64 (1%)** |
| Citas vinculadas con el correo SOLO en el expediente | 21 de 64 |
| Acierto del split viejo (citas vinculadas con nombre idéntico) | **23 de 26** |
| Acierto de la alternativa "las 2 últimas palabras son apellidos" | **22 de 26** — peor, se descartó |
| Enlaces fiscales PENDING vs SUBMITTED | 4 / 5 (el resto de la tabla son formularios clínicos) |

> 📌 Los **34 "Primera vez" CON expediente** son la razón por la que la regla de `4eb117da`
> se limita a **no ofrecer la búsqueda** y NO prohíbe estar vinculada: crear el expediente
> desde la cita la vincula, y ése es el flujo bueno. Prohibirlo habría contradicho más de la
> mitad de las 64 citas vinculadas que ya existen.
>
> 📌 Y los **4 correos distintos (1%)** son la medida de lo que la regla puede evitar. La fuga
> grande no es vincular, es **editar el correo en el expediente DESPUÉS** — la cita conserva su
> copia vieja y ésa gana. Eso es la bitácora #30 y sigue abierto.

> 📌 Esa última fila es la lección: la forma agregada de los expedientes (**117 de 160** tienen
> 2 palabras en `last_name`) *sugería* que el split debía cambiar. La prueba directa dijo que no.
> **Se midió antes de cambiar una heurística viva, y la medición ganó.**
>
> ⚠️ El mensaje del commit `57859a37` dice "118 de 160" — está mal por uno (117). No se
> reescribe la historia por eso; el número bueno es éste. Es, de paso, el segundo tropiezo de
> la misma clase en esta pasada: **el agregado que "se ve" convincente es justo el que hay que
> recontar.**

## Pendiente

1. **Prueba a mano punta a punta** — el guion está en
   [`00-METODO`](00-METODO-prueba-manual-punta-a-punta.md). Casi todos los bugs de este trabajo
   salieron de probar en vivo o de consultar la BD; **el `type-check` estuvo verde todas las
   veces que estuvo mal**.
2. **Unificar los tres flujos de ENLACE** (formulario pre-consulta · datos fiscales · link de
   pago) — la reorganización quedó a medias. El diseño acordado: un modal compartido de
   **compartir** (Copiar · WhatsApp · **Correo**) y, al cerrarlo, chip de estado + menú
   (Reenviar / Regenerar / Cancelar). Lo que falta y sus trampas:
   - **Correo: no existe en ninguno de los tres.** Es la única pieza nueva de verdad. Reusaría
     `lib/gmail` (cuenta de Google del doctor). Login es siempre Google, pero eso NO garantiza
     el scope `gmail.send` ni un refresh token vivo — medido: de 104 citas CONFIRMED, 17 tenían
     correo y NO se envió. 🔒 **Bloqueado por la decisión #30**: el destinatario sale de fuentes
     distintas hoy (el fiscal guarda `patient.email`, el clínico `booking.patientEmail` **sin
     respaldo** — una cita sin correo genera un enlace con destinatario vacío).
   - **"Regenerar" no es hermano de "Cancelar" en el link de pago:** el guard bloquea crear otro
     mientras haya uno ACTIVO, así que Regenerar = cancelar y luego crear. Y si está **PAGADO**
     no hay ninguno de los dos.
   - **"Cancelar" el enlace fiscal no significa lo mismo:** es del PACIENTE, no de la cita, así
     que cancelarlo desde una cita lo cancela para TODAS las de esa persona. Y no existe
     endpoint. Diseñarlo aparte, no copiar el menú del link de pago.
   - **Cancelar el link de pago ya existe en el servidor** (`DELETE` en Stripe y en MP) y la UI
     **nunca lo llama** — ese punto del menú es cablear algo hecho.
   - **Regenerar el enlace fiscal quedó sin camino en la UI** tras `eed733c2`: el endpoint acepta
     `regenerar: true` y ningún botón lo manda. Nadie queda bloqueado (se puede copiar el que
     existe), pero rotarlo espera este menú.
   - El formulario clínico **caduca** con la fecha del slot (o 7 días en freeform); el fiscal
     **no caduca nunca**. Mismo flujo ≠ mismos estados.
3. **Los BLOQUEOS deben decirse, no esconderse.** Hoy un requisito no cumplido se comunica
   ocultando el botón o con un `title=`. Ya existe el patrón bueno —`faltaContacto()` en
   `BookingsSection` rinde *"Necesita correo"* como **link al expediente**— y hay que
   generalizarlo: todo requisito rinde algo que **nombra lo que falta y lleva a donde se
   arregla**. Falta en: el CSD/perfil fiscal del doctor (nada lo dice en la cita), los 6 campos
   fiscales para poder timbrar, y el expediente en el formulario clínico (hoy solo un `title`).
4. **Pulir los flujos restantes** — **recordatorios** (sin tocar aún) · el formulario pre-cita
   dice "Crear formulario" · orden/acomodo de la fila · el `prompt()` del navegador con el que
   se manda un CFDI por correo (`facturacion/page.tsx`, sin prellenar nada).
5. **Renombrar `Cobro` y `Facturación`** — se dejaron tal cual A PROPÓSITO: el prompt del agente
   los nombra ("botón Cobro" ×3, "botón Facturación" ×2 en `modules/facturas.ts`). Renombrarlos
   exige editar el prompt ⇒ cambian los bytes del prefijo y hay que correr los 81 casos. Va
   junto con la deuda de agente del punto 6. (`Confirmación` y la casilla NO los nombra:
   verificado antes de cambiarlas.)
6. ~~**Deuda de AGENTE, agrupada a propósito** — 3 arreglos que comparten UNA corrida de la suite.~~
   ✅ **CERRADA 2026-07-30** — se pagó en UNA pasada junto con los otros 3 puntos del plan 07
   (✅ **en prod**, `d1f9a4d3`). Detalle:
   [`../AGENTES/AGENTE AGENDA/07-PLAN-realinear-agente-con-citas.md`](../AGENTES/AGENTE%20AGENDA/07-PLAN-realinear-agente-con-citas.md)
   (SNAPSHOT) y bitácora **#31** de
   [`../AGENTES/AGENTE AGENDA/SESSION-REFRESCO.md`](../AGENTES/AGENTE%20AGENDA/SESSION-REFRESCO.md).
   ⚠️ **El punto 5 de arriba (renombrar `Cobro`/`Facturación`) NO se hizo** — seguía dependiendo
   de esta corrida y ahora vuelve a necesitar una propia.
7. **Código muerto**: el picker de slots ya no se usa (`SlotPickerStep`, las 2 ramas de submit
   que no son rangos, el árbol `/v1`). ⚠️ NO tocar `POST /api/appointments/bookings` — el
   widget público del sitio agenda por ahí.

Menores: vincular expediente sigue **sin ser obligatorio** pese a haber quitado el "(opcional)" ·
reagendar pierde `notes` · `calculateAge` off-by-one en ~7 archivos · `apps/doctor` sin ESLint ·
`errorMsg` de `FiscalFormButton` se setea en 3 sitios y no se rinde en ninguno.

## ✅ Decisión #30 — quién manda sobre el contacto (2026-07-29)

**El EXPEDIENTE manda; la copia de la cita es el respaldo.** `patient.email || booking.patientEmail`.

El orden estaba al revés, y eso hacía imposible que el dato VIVO corrigiera al viejo: la cita
guarda lo que se capturó al agendar y **ninguna ruta la actualiza después**, mientras el
expediente sí se edita. Consecuencia medida: **corregir el correo al crear el expediente desde
una cita no tenía ningún efecto visible** — la fila seguía mostrando el viejo y el botón de
confirmación seguía enviando ahí.

Por qué el expediente, en los tres flujos que existen de verdad:

| Flujo | Quién tiene el correo bueno |
|---|---|
| Recurrente ligado a un expediente | el del expediente |
| Paciente nuevo | el expediente NACE con el de la cita ⇒ coinciden, y de ahí se edita en el expediente |
| Paciente nuevo ligado después a un expediente que ya existía | el del expediente |

**Dos reglas que van con la decisión:**
- ⚠️ **El `||` no es opcional.** "El expediente manda" significa *cuando tiene valor*. Sin el
  respaldo, un expediente creado por otro camino y sin correo tiraría a la basura uno utilizable.
- ⚠️ **WhatsApp NO puede seguir la regla.** `Patient` no tiene columna de WhatsApp: ese número
  existe solo en la cita. No es inconsistencia que haya que arreglar, es el esquema.

**La copia de la cita queda como registro HISTÓRICO** de lo que se capturó al agendar — ya no se
lee para enviar. No hay que "mantenerla sincronizada": eso reintroduciría la divergencia.

**Medido antes de tocar nada** (368 citas): 304 sin expediente **no cambian** · 60 resuelven
**igual** con cualquiera de los dos órdenes · **4 cambian de destinatario** (las cuatro de la
cuenta de prueba, todas ya enviadas y en estado terminal) · **0 se quedan sin destinatario**.

**Los SEIS sitios que se voltearon** — la lista importa, porque revisando salieron dos envíos al
paciente que se habían quedado fuera:

| Sitio | Qué resuelve |
|---|---|
| `lib/booking-contact.ts` | fila, link de pago, botón fiscal, modal pre-consulta |
| `bookings/[id]/send-email` | confirmación manual |
| `lib/send-confirmation-email` | confirmación automática al crear/confirmar |
| `bookings/[id]/form-link` | el correo que se guarda en el formulario pre-consulta |
| `cron/appointment-reminders` | **recordatorios** ← se había quedado fuera |
| `bookings/[id]` (PATCH) | correo de **CANCELACIÓN** ← se había quedado fuera |

Los dos últimos leían `patientEmail` **a secas**, así que **se SALTABAN** por completo a los
pacientes cuyo correo solo vive en el expediente. Medido en los recordatorios: de 97 citas
CONFIRMED pendientes de recordatorio, **3 pacientes REALES pasan a recibirlo** (antes, ninguno) y
1 cambia de destinatario. ⚠️ Eso sí es un cambio hacia afuera sobre gente real —a diferencia de
los 4 del correo de confirmación, que son de la cuenta de prueba— y es justo lo que el arreglo
pretende: el doctor tenía los recordatorios prendidos y esos pacientes no los recibían.

`form-link` además era **el único de los tres flujos de enlace sin respaldo**: guardaba
`booking.patientEmail` a secas, así que una cita sin correo creaba un formulario con destinatario
vacío aunque el expediente lo tuviera.

✅ **El AGENTE ya está alineado (2026-07-30).** `get_booking_detail` resuelve
`patient.email || patientEmail` — el mismo orden que `lib/booking-contact.ts` — así que agente y UI
vuelven a coincidir. Medido antes de tocar: de 368 citas la respuesta del agente cambia en **25**
(21 donde decía "sin correo" y la UI sí tenía · 4 con un correo distinto al que la UI usa).
✅ **En prod 2026-07-30** (`d1f9a4d3`, deploy SUCCESS). Bitácora **#31**.

~~🔻 **Falta el AGENTE.** `mapBooking` en `tools.ts` sigue devolviendo `b.patientEmail` a secas, así
que hasta que se pague la deuda §8 el agente contradice a la UI — ahora **en el sentido
contrario** al que documentaba #30.~~

## Rarezas que NO son bugs (para no "arreglarlas" dos veces)

- **"Esperando datos" aparece en TODAS las citas de ese paciente.** El enlace fiscal es del
  paciente, no de la cita: los datos fiscales se piden una vez, no una por consulta. Es correcto,
  y es justo por eso que "Cancelar" ahí no puede copiar el menú del link de pago.
- **`SKIPPED` en `@healthcare/api` al desplegar es normal** cuando el commit no toca `apps/api`.
  Lo peligroso es lo otro: un servicio que SÍ cambió y no tiene registro para ese commit.
- **Apellidos es opcional en la cita pero obligatorio en el expediente.** Deliberado: 34% de las
  citas traen un nombre de una sola palabra.
- **Borrar rangos EN LOTE sí elimina los que tienen citas activas.** No es un bug y no hay que
  "arreglarlo": el borrado individual (`ranges/[id]`) SÍ se niega con 409 *"cancela las citas
  primero"*, pero el lote (`ranges/bulk`) los borra igual — las citas son filas independientes,
  el motor de disponibilidad las sigue usando como ventana ocupada, y el modal se lo advierte al
  doctor con nombre y hora de cada paciente afectado (*"se eliminarán, citas no se afectan"*).
  Las dos rutas contestan distinto **a propósito**; lo que sí estaba mal era el ACTA:
  ⚠️ **corregido 2026-07-31 (`21c2dd30`)** — el log de actividad decía *"N protegido(s) por citas
  activas"* de rangos que acababa de borrar, y guardaba ese conteo bajo la llave `protected`.
  Quien leyera el feed semanas después concluía que esos rangos habían sobrevivido. El texto y la
  llave (`withActiveBookings`) ya dicen la verdad. **Los campos `protected`/`protectedRanges` de la
  RESPUESTA se conservan con ese nombre**: `DeleteRangesModal` los consume en 3 lugares y
  renombrarlos es un cambio de API + UI, no una corrección — hay un comentario en el endpoint
  avisando que el nombre es histórico.

## Cómo se trabaja aquí

- **La verdad es el CÓDIGO y la BD**, no los docs ni un `grep` acotado a una carpeta (ya pasó:
  se afirmó una "inversión de CIT-6" que no existía).
- Toda forma de query nueva **se smoke-testea read-only contra prod ANTES del push** —
  método en los `TOOLING-*`, nunca improvisado.
- Migraciones = **SQL manual + `prisma db execute`**, nunca `prisma db push` (revierte el FK
  compuesto de `bookings`). ⚠️ Contra prod va con `--url` y la **URL pública**
  (`LLM_DATABASE_URL`): `--schema prisma/schema.prisma` resuelve `DATABASE_URL`, que en la
  máquina de desarrollo apunta a **localhost**.
- **La BD va ANTES que el código**: el GET de citas usa `include`, así que una columna del
  schema ausente en la BD tumba la página.
- Tras desplegar: **verificar el `commitHash` por servicio** (`railway deployment list --service
  "<nombre>" --limit 1 --json`) y **hard refresh**, o se prueba el bundle viejo.
