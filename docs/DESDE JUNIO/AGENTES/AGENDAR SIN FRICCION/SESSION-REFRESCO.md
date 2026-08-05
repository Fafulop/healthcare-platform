# 🔄 SESSION-REFRESCO — AGENDAR SIN FRICCIÓN

> **Para la próxima sesión.** Dónde quedó todo el **2026-08-05** y qué sigue.
> Tipo **ESTADO / BITÁCORA**: se actualiza al cerrar cada sesión.

## En una frase

**EN PROD Y PROBADO A MANO: el agente agendó una cita a las 16:07 en un día SIN NINGÚN RANGO.**
Es exactamente la pantalla muerta que costó dos turnos y un rango basura en la demo. Tres commits
desplegados (`2d343df8` · `0d2181ed` · `f51696c6`), `get_availability` eliminada, y la prueba de
aceptación **verificada contra la BD**, no sólo vista en pantalla.

## 0. ✅ La prueba de aceptación (2026-08-05, post-deploy)

Mensaje real del doctor: *"agéndame a Marcos Ruiz el jueves 6 de agosto a las 16:07, consulta de
seguimiento"*. Fila verificada read-only en `public.bookings`:

```
id             : cmsgk8swb0014ns0tpb4g3xc0
fecha          : 2026-08-06   start_time: 16:07   end_time: 16:37   duration: 30
status         : CONFIRMED    slot_id: null              ← freeform
patient_email  : ""           patient_phone: ""          ← strings vacíos, NO null
google_event_id: t6slph3h316hiia15kd6hc942k
confirmation_email_sent_at: null
rangos publicados el 6-ago : 0                           ← SIN RANGO
```

Lo que esto prueba, punto por punto:

| | |
|---|---|
| **Se agendó sin rango** | 0 rangos ese día. Antes: *"ese día no tiene ningún horario libre"* |
| **El minuto raro sobrevivió** | 16:07 → 16:37, el fin lo calculó el servidor con la duración |
| **`get_availability` ya no existe** | no aparece en la traza — confirma el deploy sin mirar el dashboard |
| **La columna no-nula aguantó** | `patient_email`/`patient_phone` = `""` con una cita SIN contacto: es el fix de la bitácora #21 bajo el caso que lo rompió en prod |
| **Honestidad de notificaciones** | GCal creado, `confirmation_email_sent_at` NULL — y el agente **lo dijo**: *"como no había teléfono ni correo, no se enviaron notificaciones"* |
| **Turnos** | **2** (la demo del #35 gastó 7). Con `f51696c6` debería bajar a 1 |

⚠️ **En esa misma corrida se cazó el último residuo**: con `dr-prueba` (que NO exige contacto) el
agente **pidió correo y teléfono antes de intentar la propuesta** — un turno regalado. Ver §4d.

🔎 **Nit conocido, sin arreglar:** también preguntó *"¿es primera vez?"*, y con `find_patient`
devolviendo 0 expedientes eso es deducible server-side (misma forma de regla 0 que la nota de
walk-in de #31). No amerita un push propio: va en la próxima pasada de prosa de agenda.

---

## 1. Qué se implementó (7 cambios · 3 commits · EN PROD)

| # | Dónde | Qué |
|---|---|---|
| 1 | `proposals.ts` `fetchDaySlots` | `freeform=1&interval=1` + Bearer, y **lee el eco** `freeform` en vez de asumirlo |
| 2–3 | `ProposalContext` · `run-turn.ts` | `apiToken` llega al camino de PROPUESTA (igual que `tier` en T3) |
| 4 | `AgentContext.tsx` | `create_booking` **y la pata create del reagendado** → `/range-bookings/instant` |
| 5 | `missingContactFields` | `bookingHorarios*` → `bookingInstant*` (viaja OBLIGATORIAMENTE con el #4) |
| 6 | `tools.ts` + prosa | **`get_availability` ELIMINADA** — 39 → 38 tools |
| 7 | `prompt.ts` + `modules/agenda.ts` | Una sola pregunta por todo lo que falta · **nunca pedir permiso para proponer** |

**Números del prompt tras los 7 cambios** (medidos, no estimados):

| | Antes (2026-07-30) | Ahora |
|---|---|---|
| sha256 del prompt del dueño | `32d19d6d…` | **`5469e674…`** (tras `f51696c6`) |
| chars del prefijo estable | 28,742 | **31,350** (+2,608 · **+9.1%**) |
| tools | 39 | **38** |

⚠️ **El prefijo CRECIÓ aunque se borró una tool** — quitamos una *tool* y añadimos *prosa*. Y la
prosa de `agenda` ya iba 2.4× sobre su presupuesto antes de hoy (`00-BLUEPRINT` §5.3). La cuenta
que lo justifica: +2,608 chars ≈ **~600 tok ≈ ~750 de budget** en pregunta fría, contra **~41k de
budget** que cuesta UN turno frío. **Si esta prosa evita un solo viaje, se paga ~60 veces.** La
demo tenía SEIS turnos de sobra. Aun así es deuda en la dirección que el blueprint vigila.
🔴 **Al desplegar se invalida el caché del prompt del dueño** (sha nuevo). Esperado.

## 2. Los dos code reviews — 12 hallazgos, 12 atendidos

**Ronda 1 (cambios 1–5), 4 hallazgos, todos reales:**

1. 🔴 En freeform el motor aplica `applyPastFilter` **ignorando `skipCutoff`**, así que las horas
   pasadas de HOY volvían vacías y el código las llamaba **OCUPADO** — afirmación FALSA sobre la
   agenda (clase #32). Y `/instant` SÍ aceptaría esa cita: el pre-check quedó más estricto que el
   endpoint.
2. `get_availability` seguía sin migrar ⇒ el agente podía **contradecirse dentro de un turno**
   (la tool decía "no hay horarios", `checkSlot` decía que estaba libre). Se resolvió con el
   cambio 6.
3. 🔴 `nearestTimes` devolvía **8 minutos CONSECUTIVOS** en rejilla de 1 min (`16:30, 16:31…`) —
   el MISMO hueco 8 veces, y 15:30 nunca aparecía. Acotar por tamaño no bastaba: hacía falta
   acotar por DISTINCIÓN.
4. Las alternativas salían de la lista NO plan-aware ⇒ al reagendar se ocultaba justo la ventana
   que se libera al mover la cita.

**Ronda 2 (cambios 6–7), 8 hallazgos, todos reales:**

5. 🔴 **INTRO y RESILIENCE seguían prometiendo "disponibilidad real"** sin tool detrás ⇒ el modelo
   se cree capaz, no declina, y su única salida es **deducir huecos de `get_bookings`**, que la
   regla 2 prohíbe. Clase #26/#27 exacta.
6. 🔴 **Mi propio gate mentía en su docstring**: decía recorrer "el corpus COMPLETO" y no miraba
   las secciones COMPARTIDAS de `prompt.ts` — donde vivía la regla 2, uno de los sitios que hubo
   que arreglar a mano. Ahora escanea `STABLE_SYSTEM_PROMPT` + las variantes `partial`.
7. 🔴 **"OCUPADO" para cosas que no lo están**: la ventana sintética es 00:00–23:59, así que un
   servicio de 30 min a las 23:45 no CABE y nada lo ocupa. Faltaba una cuarta rama.
8. 🔴 **El mensaje de auth degradada se contradecía**: decía "no se pudo comprobar" y acto seguido
   "No hay ningún horario libre cerca ese día" — con una lista que para un doctor sin rangos está
   SIEMPRE vacía. El modelo relata la segunda mitad.
9. Alternativas sin tope de distancia ⇒ a quien pide 08:00 se le ofrecía 04:00 (bajo rangos el
   tope era implícito; en freeform hay que declararlo). Tope: **180 min**.
10. El fallback de objetivo inválido devolvía "los primeros 8" = **00:00–00:07**, el defecto que la
    función existe para evitar. Ahora devuelve vacío, con assert que lo fija.
11. `/instant` **no aplica el buffer** y `/range-bookings` sí ⇒ divergen en la ventana
    propuesta→confirmación. **INERTE hoy: 0 de 11 doctores tienen buffer ≠ 0** (medido). Documentado.
12. `05-REFERENCIA-TECNICA` seguía listando `get_availability` como tool viva (5 sitios).

## 3. 🛡️ Gate nuevo: prosa que nombra tools INEXISTENTES

`gate:prosa` sólo marcaba tools que **existen pero están fuera del scope** — un filtro
(`REAL_TOOLS.has(n)`) puesto a propósito para no gritar ante nombres ilustrativos. Punto ciego:
**al ELIMINAR una tool, todas las frases que la nombraban se vuelven invisibles para el gate**,
justo en el momento de máximo riesgo #26/#27. Se cazó a mano: dos DESCRIPCIONES seguían diciendo
*"el horario debe salir de get_availability de ESTE turno"* con el gate en verde.

Ahora hay una tercera pasada, scope-independiente, sobre `STABLE_SYSTEM_PROMPT` + secciones de
módulo + variantes `partial` + descripciones. **Probada EN NEGATIVO dos veces** (desde una sección
de módulo y desde una compartida); las dos dispararon.

## 4. Corrida de evals A — `77/85 PASS · 8 WARN · 0 FAIL`

Tras reintentos: **5 flaky · 3 WARN estables · 0 FAIL estables**. Los 8 son `soft` y **ninguno es
regresión de este trabajo**:

| Caso | Qué es de verdad |
|---|---|
| `disponibilidad-dia-bloqueado` | **Fecha podrida**: pregunta por el 3-ago, ya pasado. El agente lo dijo bien |
| `disponibilidad-rango-exactamente-lleno` | **Fecha podrida**: 4-ago |
| `reschedule-noop` | Drift de fixture, documentado desde el 2026-07-23 |
| `fuera-de-horario-ruta-normal` | ⚠️ **OBSOLETO POR DISEÑO** — ver abajo |
| `plan-eliminar-antes-de-crear` | Watch-item documentado (~1/3 bajo tool search, "nunca estable") |
| `tier-core-conciliacion-no-inventa` | Residuo ~50% de la bitácora #28 |
| `f2c-enruta-compuesta` · `tier-core-completar-cita` | Flaky, pasaron al reintento |

🔑 **`fuera-de-horario-ruta-normal` exige que el agente NO proponga y diga "no hay rango"** para
un domingo 07:00 sin rangos. Eso es la premisa vieja de **CIT-6** (*"el agente no tiene
capacidades que la UI no tiene; la ruta normal valida rango"*), muerta desde `480f7f72`: hoy la UI
sí agenda ahí, y `/instant` cumple CIT-6 por el otro lado. **El caso codifica el mundo que
acabamos de dejar — hay que invertirlo, no arreglarlo.**

✅ **Y el caso que prueba que el cambio funciona:** `disponibilidad-dia-sin-rango` —el que mapea a
la pantalla muerta de la demo— **PASÓ**, llamó `get_day_schedule` y contestó:

> *"Sin rangos de disponibilidad publicados… el día está completamente despejado. **Puedes agendar
> citas a cualquier hora que el doctor indique** — los rangos publicados solo son para la página
> pública."*

También verdes: `bloqueo-simple` (sigue creando su card ⇒ el cambio 7 no rompió el proponer),
`weekday-correcto`, `weekday-salida-no-inventado`, `vencidas-flag-server-side`, los dos
`invariante-*`.

⚠️ **La corrida A se lanzó con `| tail -60`**, así que se perdieron las líneas de reintento de los
primeros ~30 casos: de A sola NO se puede atribuir estable/flaky ahí. El JSON completo quedó en el
scratchpad (`run-A.json`). **La corrida B corre con `tee`.**

## 4b. Corrida B, y el bug que destapó (mío)

**B: `77/85 · 7 WARN · 1 FAIL` → 4 flaky · 4 WARN estables · 0 FAIL estables.**

**A ∩ B = `disponibilidad-dia-bloqueado` + `disponibilidad-rango-exactamente-lleno`** — los dos de
fecha podrida. **Ninguna regresión atribuible a este trabajo.** Todo lo demás difirió entre
corridas, que es exactamente #31b; de hecho `f1-billing-status-un-golpe` salió estable en B y PASS
en A — el caso que esa bitácora usa como ejemplo.

🔴 **Pero B destapó un bug REAL, y era mío.** `create-sin-hueco` (PASS en A) falló estable en B: el
agente llamó `find_patient` + `get_services` y **pidió el correo** en vez de proponer — y
`dr-prueba` tiene los 9 toggles en `false`, o sea que ese correo **no hacía falta**. Causa: mi
redacción del cambio 7 enumeraba los campos y decía *"según lo que exija la cuenta"* —
**un dato que el modelo NO PUEDE VER**. Misma familia que la nota de walk-in de la bitácora #31
(pedirle al modelo decidir "primera vez" con un campo que el payload no traía), y con la ironía de
que el cambio existía para AHORRAR turnos y añadía uno.

**Fix — se invirtió el orden:** *propón con lo que tengas; la tool te devuelve la lista EXACTA de
lo que falta; sólo entonces preguntas, todo junto.* El servidor ya calculaba esa lista.
Verificado: `create-sin-hueco` PASA y ahora llama `propose_create_booking`.

⚠️ **Lección de método:** el caso quedó FUERA de la intersección, así que la regla estricta lo
llamaría ruido. **La intersección protege de falsas alarmas; no obliga a ignorar un mecanismo
entendido.**

## 4c. La regla se mudó a su sección más angosta

Las dos reglas del cambio 7 nacieron en `HOW_TO_PROPOSE` (**compartida**) y se movieron a
`AGENDA_CITAS_RULES`. Motivo medido: **60 de 74 casos llevan asserts de propuesta**, así que tocar
una sección compartida pone el ~80% de la suite en riesgo y "correr sólo lo relevante" deja de
ahorrar. El goteo era de CITAS; facturas nunca lo tuvo.

⚠️ **Sin sobrevender:** el prompt compone TODOS los módulos habilitados, así que esa prosa sigue
presente en un turno de facturas. La mudanza compra encabezado que la acota, desaparición en
scopes sin agenda, y `HOW_TO_PROPOSE` quieta — **no** aislamiento duro.

Verificación dirigida tras mudarla: **6/6 PASS** — `plan-eliminar-antes-de-crear` (el watch-item
flaky) con su secuencia completa, `tier-rojo-espontaneo` (*"límpiame la agenda"*) sin cards
espontáneas, `create-sin-hueco`, `bloqueo-simple`, `disponibilidad-dia-sin-rango`, `weekday-correcto`.

Todo el método —qué correr según dónde editaste, cómo no quedarte ciego, y los agujeros conocidos
de la suite— quedó en [`03-METODO-como-probar-esto.md`](03-METODO-como-probar-esto.md).

## 4d. El último residuo: "con el NOMBRE basta" (`f51696c6`)

En la prueba en vivo, con `dr-prueba` —que tiene los **9 toggles en `false`**— el agente pidió
correo y teléfono ANTES de intentar la propuesta. Datos que esa cuenta **no exige**: un turno
regalado, justo el que este trabajo quiere ahorrar.

**Es el mismo agujero que la corrida B ya había marcado y que el fix del §4b no cerró.** Causa:
*"propón con lo que tengas"* se lee como inútil cuando no tienes NADA. Y el eval que debía
cubrirlo (`create-sin-hueco`) **trae un teléfono en el mensaje**, así que el caso de sólo-nombre
no se ejercitaba jamás.

**Fix:** la prosa dice ahora explícitamente que **con el nombre basta para INTENTAR**, que se
propone aunque no haya ningún dato de contacto, y que los datos sólo se piden si la tool falla
nombrándolos. *Nunca pedir contacto antes de haber intentado la propuesta.*

✅ **Y se cerró la cobertura: `walk-in-solo-nombre-propone`** — el **PRIMER caso de la suite que
agenda de verdad** (los 3 asserts positivos que existían cubrían rangos, bloqueos y CFDI; todo
`create_booking` era un assert NEGATIVO — por eso esto pudo romperse dos veces con la suite en
verde). Suite **85 → 86**. Fecha **relativa (+21 días)** a propósito: las fechas duras se pudren
solas, como ya les pasó a los dos casos de #32. Verificado 3/3, con la secuencia
`find_patient → get_services → propose_create_booking`.

⚠️ **Sólo cubre el lado PERMISIVO.** `dr-prueba` no exige contacto; el lado exigente sigue sin
cobertura porque `missingContactFields` lee los settings de la BD por `doctorId` — hace falta poder
INYECTARLOS ([`03-METODO`](03-METODO-como-probar-esto.md) §8).

**Lección que vale más que el fix:** *un eval que trae el dato en el mensaje no prueba el caso en
que ese dato falta.* El caso parecía cubierto y no lo estaba.

## 5. Qué sigue, en orden

1. ✅ **A ∩ B hecho** (§4b): sólo los dos fixtures de fecha podrida. Sin regresión.
   ⚠️ **Pero el prompt cambió DESPUÉS de B** (fix del §4b + mudanza del §4c), así que el par A/B
   describe el árbol anterior. Lo cubierto de la diferencia son **dos corridas dirigidas**
   (4/4 y 6/6). Para rigor pleno antes del push falta una corrida completa **C** que intersecar
   con B; la alternativa es apoyarse en la prueba a mano del punto 4, que es la que de verdad
   valida este trabajo.
2. ✅ **Commiteado, pusheado y desplegado**: `2d343df8` (código) · `0d2181ed` (docs) ·
   `f51696c6` (el fix de sólo-nombre + su eval).
3. ✅ **Prueba de aceptación HECHA y verificada contra la BD** — ver §0.
4. 🔁 **Falta re-correr la prueba con `f51696c6` desplegado**: el mismo mensaje debería crear la
   card **sin pedir ningún dato**, en UN turno.
5. **Deuda de evals** (sesión aparte):
   - **Invertir `fuera-de-horario-ruta-normal`** — exige "no hay rango", que es la premisa MUERTA
     de CIT-6; hoy la respuesta correcta es la contraria.
   - **Des-podrir las fechas** de `disponibilidad-dia-bloqueado` y `-rango-exactamente-lleno`
     (3 y 4 de agosto, hardcodeadas). Patrón a copiar: el `enTresSemanas` de
     `walk-in-solo-nombre-propone`.
   - **Settings inyectables** para cubrir el lado EXIGENTE del contacto (§4d).
   - **Deducir `isFirstTime`** server-side cuando `find_patient` devuelve 0 expedientes (§0).

## 6. Decisiones ABIERTAS (del usuario, no del código)

1. 🔴 **¿Contacto obligatorio cuando agenda el doctor?** Sigue en pie: (a) apagar toggles por
   doctor —cero código, hoy mismo—, o (b) cambiar la regla del endpoint para rol DOCTOR. Debe
   alcanzar a **las dos superficies** o se viola CIT-6.
2. **¿Colapsar "Campos de Cita" de 3 secciones a 2?** (`01` §6). 0 de 11 doctores las usan distinto.
3. **El rango del 11-ago** que el agente creó sólo para poder agendar sigue vivo en prod.
4. **Multi-día sin `get_availability`**: "¿cuándo tengo espacio esta semana?" hoy se contesta con
   `get_day_schedule` día por día (cap de 8 iteraciones). La regla 2 prohíbe deducir huecos, así
   que el modelo debe preguntar en vez de inventar. **Si molesta**, la salida limpia es una tool
   que devuelva las ventanas OCUPADAS de un rango de fechas — no resucitar la lista de libres.

## 7. Lo que conviene no re-aprender

- **Acotar por TAMAÑO no es acotar por UTILIDAD.** El cap de 8 dejó el payload seguro y la
  respuesta inútil (8 minutos seguidos del mismo hueco).
- **Un gate cuyo comentario exagera su cobertura es peor que no tenerlo**: hace que el siguiente
  deje de revisar a mano. El mío decía "corpus COMPLETO" y no leía las secciones compartidas.
- **Una lista vacía sigue sin ser una respuesta** — y ahora el `motivo` tiene CUATRO ramas
  (sin auth · ya pasó · no cabe · ocupado) porque tres no alcanzaban.
- **Un test puede quedar obsoleto POR DISEÑO.** `fuera-de-horario-ruta-normal` no falla: acusa que
  cambiamos el mundo y no lo actualizamos.
- **Las fechas hardcodeadas en fixtures se pudren solas** — dos casos de #32 ya fallan por eso.
- **Un formulario junta N datos en UNA interacción; un chat los junta en N viajes.**
- **La superficie del agente también se mide en TURNOS**, no sólo en tokens.

---

*Sesión del 2026-08-05. Evidencia en [`00`](00-EVIDENCIA-traza-demo.md), hallazgo del modal en
[`01`](01-HALLAZGO-campos-de-cita.md), plan y verificación en [`02`](02-PLAN-agendar-freeform.md).*
