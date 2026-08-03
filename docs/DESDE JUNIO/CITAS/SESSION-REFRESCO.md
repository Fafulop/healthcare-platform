# 🔄 SESSION-REFRESCO — CITAS / calendario

> **Para la próxima sesión.** Dónde quedó todo el 2026-08-03 y qué sigue. Tipo
> **ESTADO / BITÁCORA**: se actualiza al cerrar cada sesión.
> El detalle histórico (qué se construyó y por qué) vive en [`README.md`](README.md);
> el guion de prueba a mano, en
> [`00-METODO-prueba-manual-punta-a-punta.md`](00-METODO-prueba-manual-punta-a-punta.md).

## En una frase

**El clic en una cita del calendario ya abre su modal de acciones** — lo único que faltaba
del calendario, y lo que el doctor había pedido — **está en producción (`3447b9c3`, deploy
SUCCESS)**. Sigue **sin probarse a mano**: ni el modal (sección **K**), ni el calendario
(sección **J**), ni la tabla (secciones **A–I**).

---

## 1. Qué está en prod

| Commit | Qué |
|---|---|
| `07ff7ed0` | El calendario Día/Semana/Mes/Año, reemplazando el mini-calendario + panel de día |
| `c8fe484c` | Arreglos tras probarlo: franja "Rangos", canceladas ocultas, interruptor "Todas las fechas", barrido de zona horaria, 7 hallazgos de review |
| `3447b9c3` | **Clic en una cita → modal con sus acciones** + extracción de los controles a `BookingActions.tsx` |

Los tres en `main` (= producción, sin staging). `3447b9c3` **sí se desplegó solo**: el
servicio `@healthcare/doctor` pasó BUILDING → DEPLOYING → SUCCESS en ~4½ min y quedó en ese
`commitHash`. Los demás servicios se quedaron donde estaban, que es lo correcto — el commit
sólo toca `apps/doctor`.

**Rollback:** `git revert --no-edit 3447b9c3` quita el modal y deja el calendario como
estaba. No hay esquema, ni SQL, ni migración, ni lockfile de por medio — todo es cliente.

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

Lo automático está verde en los tres commits (`type-check`, `build`, los 5 gates, las 28
comprobaciones de `event-model-check.ts`) y en `3447b9c3` además dos rondas de review, una de
ellas con **la extracción diffeada contra el original** (idéntica salvo los imports).

**Nada de eso es el clic.** En este trabajo el `type-check` estuvo verde TODAS las veces que
algo estuvo mal, y la sesión del 08-02 cerró con cinco rondas de `/code-review`, cinco con
hallazgos reales, tres de ellos introducidos por la ronda anterior al arreglar otra cosa.

### Qué correr primero

1. **K-5** — modal dentro de modal: Completar desde el modal de la cita y hacer clic DENTRO
   del modal de precio. Es el bug que ya ocurrió una vez en la tarjeta móvil.
2. **K-12** — el buscador de expediente sin recorte. Es el código más fresco y menos
   ejercitado de todo el commit (ver §4).
3. **K-6** — un bloque `COMPLETED`/`NO_SHOW` encima de un hueco libre: debe ganar el BLOQUE.
4. **J-11** — vista Año: los meses pasados tintados. Si salen en blanco, volvió el bug del
   predicado.
5. **J-4 + zona horaria** — cambiar la zona del sistema a Madrid o Tokio a última hora del
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
