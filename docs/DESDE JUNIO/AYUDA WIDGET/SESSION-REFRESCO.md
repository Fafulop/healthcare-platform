# 🔄 SESSION-REFRESCO — AYUDA WIDGET

> **Tipo: ESTADO.** Se lee primero y se escribe al final de cada sesión.

## En una frase

**2026-09-22 — EL WIDGET ESTÁ EN PROD Y FUNCIONA.** Fases 0, 1 y 2 hechas el mismo día.
`68f1918f` desplegado con **SUCCESS en `@healthcare/doctor` y `@healthcare/api`** (verificado
por `commitHash`), y **el usuario lo probó en la app: funciona** ("works live"). El botón azul
**?** abajo a la derecha contesta cómo se usa la app desde
`apps/doctor/src/lib/ayuda/manual-del-doctor.md`, en todos los planes, con `gpt-4o-mini`.

| Fase | Estado | Commit |
|---|---|---|
| 0 — Auditar guías | ✅ | `d2b3d553` · [`03-AUDITORIA-guias`](03-AUDITORIA-guias.md) |
| 1 — Manual Agenda + Expediente | ✅ | `6991c2dc` |
| 2 — Widget punta a punta | ✅ **en prod, probado por el usuario** | `68f1918f` |
| 3 — Evals | 🟡 **empezada 2026-09-23**: suite de 18 casos con cita auto-evaluada, arreglo de citas, prueba de longitud. Sólo `gpt-4o-mini` (decisión del usuario) | `52af1c36` · costo en admin `0f7f043c` |
| 4–6 | **Replanteadas 2026-09-23** → guías por tarea con clip + widget que enlaza (`02-PLAN` § Replanteamiento, fases G1–G6) | — |

---

## ⏭️ Para la próxima sesión — empieza aquí

**1. Fase 3 — sigue abierta** (bitácora 2026-09-23 abajo). `apps/doctor/scripts/ayuda-probar.ts`
ya evalúa la CITA sola (18 casos; `--veces=2`; `--relleno=<tokens>` para la prueba de longitud).
Lo que falta:
- **El veredicto automático de «¿dijo no lo sé donde debía?» y «¿afirmó algo falso?»** — hoy se
  LEE. En la prueba de 40k la cita dio 12/18 pero lo grave fue una respuesta que inventó un
  remedio (crear un expediente duplicado): eso ninguna métrica de cita lo ve.
- Casos fuera del manual: hoy son 5 de 18; el plan pedía la mitad.
- **Sólo `gpt-4o-mini`** por decisión del usuario (2026-09-23: es mucho más barato). La ruta
  Claude sigue sin probarse nunca (no hay `ANTHROPIC_API_KEY` local); no bloquea nada mientras
  `AYUDA_MODELO` no se cambie.

**0. 🧭 El plan cambió (2026-09-23): las Fases 4–6 se reemplazaron** por guías cortas por tarea
con clip en `/dashboard/ayuda`, y un widget que se queda en Agenda + Expediente y **enlaza** guías
para lo demás. Plan completo: [`02-PLAN` § Replanteamiento](02-PLAN-construccion.md). Siguiente
paso: **G1** (catálogo `guias.ts` + la página nueva, Agenda y Expediente, sólo texto).

**1b. ⚠️ El manual del widget NO puede crecer sin volver a medir** (por eso el replanteamiento
deja fuera del manual todo lo que no sea Agenda y Expediente).
Con `gpt-4o-mini`, a ~45k tokens la calidad ya cae (citas 15→12/18, una respuesta inventada,
latencia 1 s → 13 s) y el tope de OpenAI de la organización (200k tokens/min, compartido con
todo prod) deja pasar ~4 preguntas por minuto. Detalle y corrección a `00-POR-QUE` §3 en la
bitácora de abajo.

**1c. Cuánto cuesta Ayuda, en vivo:** admin → menú **«Uso IA»** (`/llm-usage`) → pestaña **«Por Funcionalidad»**
→ fila «Ayuda (widget)» → ábrela para verlo por modelo. Primera lectura (prod, 28 días al
2026-09-23): **6 preguntas, 42,955 tokens de entrada + 860 de salida con gpt-4o-mini ≈ $0.007**.

**2. Bugs de PRODUCTO que salieron al escribir el manual** (tabla en la bitácora de la Fase 1).
El 🔴: en una cita **Pendiente** se pintan «Completar» y «No asistió» y el servidor los rechaza
(*«Transición no permitida»*) — arreglo chico: no pintarlos en Pendiente
(`appointments/_components/BookingActions.tsx:477-488`). ⚠️ Si se arregla, **actualizar el
manual** (`Agenda > Citas que piden tus pacientes` dice hoy que se ven pero no funcionan).

**3. Limpieza pendiente, sin prisa:** el `llm-assistant/ChatWidget` viejo y su endpoint
`/api/llm-assistant/chat` ya no se usan desde ninguna UI — borrarlos es decisión aparte
(`AGENTES/INVENTARIO IA` tenía su retiro planeado en PR 4).

**4. Regla para cualquiera que cambie la UI de Citas o Expedientes:** el manual es la fuente del
widget. Si cambias un botón, **cambia el manual en el mismo commit** — si no, el widget enseña
el botón viejo con toda seguridad. (Hoy no hay gate que lo cace; la idea de gate está en
`03-AUDITORIA` §5.4: que cada «rótulo» del manual exista como texto en algún `.tsx`.)
Caso concreto ya a la vista: **cuando el formato BBVA del informe médico llegue a prod**, hay que
agregarlo en `Expediente > Informe para aseguradora` (hoy dice AXA, Allianz y GNP).

---

## 2026-09-20 — de dónde salió esto

Venía de una conversación sobre cómo dar soporte con planes baratos. La cadena fue:

1. **El problema real:** sin dinero para soporte humano, la ayuda tiene que escalar sola.
2. **Primer instinto: videos por funcionalidad, con narración TTS.** Se frenó al notar que el
   menú del doctor cambió **cuatro veces ese mismo día**: un video no se puede grepear ni
   diffear, y uno viejo enseña un camino falso justo cuando el doctor ya está perdido.
3. **Se propuso un asistente de docs** sobre la infraestructura RAG que ya existe
   (`llm_docs_chunks`).
4. **El usuario empujó de vuelta** — «estás asumiendo que el enfoque que ya tenemos es el
   correcto». Tenía razón: era inercia, no análisis.
5. **Se midió el corpus y la respuesta cambió.** ~1,630 palabras en las guías actuales ⇒
   ~15,000 tokens para todo el menú. Cabe entero en un prompt. **RAG es maquinaria para un
   corpus 10× más grande del que hay.**

> 📌 **La lección de esa cadena, que vale más que la decisión:** el corpus se midió ANTES de
> elegir arquitectura. Si no se mide, se elige por costumbre.

---

## Decisiones tomadas (detalle en `00-POR-QUE` §7)

- **Manual entero en el prompt**, no RAG. `llm_docs_chunks` se queda donde está, para el
  corpus de DESARROLLO, que sí es grande.
- **Asistente separado del Agente.** Cero tools, cero BD, cero escrituras.
- **Texto y widget primero; el video se pospone** hasta poder grabarlo guionado.
- **Modelo intercambiable por variable de entorno**, con dos implementaciones desde el día uno
  para poder comparar.

---

## Decisiones de la Fase 2 — cómo quedaron

1. ~~¿Qué modelo primero?~~ → **`gpt-4o-mini`** (usuario, 2026-09-22). Se revisa con los evals.
2. ~~¿Todas las pantallas?~~ → **Sí**, en toda la pila flotante del dashboard; la bienvenida
   del widget dice «Por ahora conozco Citas y Expedientes».
3. ~~¿Cuenta congelada?~~ → **No en v1** (usuario). El layout congelado no monta widgets.
4. **¿Quién escribe el manual?** Sigue abierta para la Fase 4. La Fase 1 la escribió Claude
   desde el código; el usuario no la ha revisado línea por línea.
5. ~~¿Todos los planes?~~ → **Sí**, FREE incluido (usuario). Tope diario de 60 preguntas.
6. **¿Guías JSX: arreglar o congelar?** Congeladas por default; no se tocaron. Se decide en la
   Fase 5.

---

## Bitácora

### 2026-09-22 — Fase 0 hecha: la auditoría de las guías

Detalle completo en [`03-AUDITORIA-guias`](03-AUDITORIA-guias.md). Lo esencial:

- **`CitasGuide` está mayormente obsoleta** — no por las mudanzas del 09-20, sino porque se
  escribió el **2026-04-08** y cinco meses de agenda (calendario nuevo, agendar sin rango,
  Cobro/Factura, botones de confirmación) pasaron sin tocarla. Botones que cita y **no existen**:
  «Correo», «Enviar Meet», «Reenviar Meet», «Todas», «Aplicar», «Nuevo horario».
- **`ExpedientesGuide` está casi al día** — parches: el botón «Formularios» ya no existe en la
  lista, y **Chat IA / Voz están bloqueados en FREE/BASICO** sin que la guía lo diga.
- **`PagosGuide` es correcta pero no vive en `/ayuda`** (es la pestaña «Guía» de Pagos) y no
  enseña el camino más común: el link de pago desde la cita.

> ⚠️ **Corrección a `02-PLAN` §Fase 0:** decía que la lista «puede ser corta» porque el `grep`
> no encontró «Editar Perfil» ni «Integraciones». **Salió larga, y ese grep era la prueba
> equivocada**: buscaba los nombres que uno sospechaba, no los rótulos que la guía cita. La
> prueba que sí habría servido: que cada rótulo citado exista como texto en algún `.tsx`.

### 2026-09-22 — Fase 1 hecha: el manual de Agenda y Expediente

`apps/doctor/src/lib/ayuda/manual-del-doctor.md` — **3,683 palabras, 36 secciones `###`**,
escrito desde el código (no desde las guías). Publicable tal cual para leerlo; todavía no lo
consume nada.

**Cómo se verificó:** cada afirmación se buscó en el componente o la ruta que la produce, y al
final **cada rótulo entre «» se buscó como texto en `apps/doctor/src`** — todos existen (los dos
con número variable, «Crear N Rangos» y «Bloquear N día(s)», se revisaron a mano). **No se abrió
un navegador**: es lectura de código, igual que la auditoría.

**Decisiones tomadas por default** (el usuario puede revertirlas):
- **El plan del doctor:** el manual marca **«Depende de tu plan»** donde aplica, sin nombrar
  planes ni precios (cambian). Sirve igual si el widget sabe el plan o no.
- **Las guías JSX no se tocaron** — se congelan hasta decidir la Fase 5.
- **El «Asistente» de Citas no se documenta**: `ASISTENTE_IA_VISIBLE = false`, nadie lo ve.
- **Los formatos de informe son AXA, Allianz y GNP** — BBVA está en el árbol sin commitear y
  no se nombra hasta que esté en prod.

⚠️ **El tamaño cambia la cuenta de `00-POR-QUE` §3.** Esas estimaban ~11,000 palabras para las
20 secciones. Sólo Agenda + Expediente ya son 3,683 — un tercio. Son las dos más grandes, así que
el total probablemente sigue cabiendo en un prompt con holgura, pero **hay que volver a medir al
terminar la Fase 4**, no dar el número de septiembre por bueno.

**Hallazgos de PRODUCTO al escribirlo** (no son de las guías — son de la app, y el manual los
dice tal cual en vez de esconderlos):

| | Hallazgo | Dónde |
|---|---|---|
| 🔴 | En una cita **Pendiente** se pintan «Completar» y «No asistió», pero el servidor sólo acepta PENDING → CONFIRMED/CANCELLED: el doctor aprieta y recibe *«Transición no permitida»* | `BookingActions.tsx:477-488` vs `api/.../bookings/[id]/route.ts:25-31` |
| 🟡 | **No hay botón para reactivar un expediente archivado.** La API lo soporta (y descuenta cupo, Q3), la UI no | `usePatientProfile.ts:57`; `PatientForm` no tiene campo de estado |
| 🟡 | `/medical-records/formularios` **redirige** a la lista: la bandeja que describía la guía ya no existe | `formularios/page.tsx` |
| 🟡 | **Reagendar manda DOS correos** al paciente: la cancelación de la anterior y la confirmación de la nueva | `appointments/page.tsx:521-536` → PATCH CANCELLED dispara el correo |
| ⚪ | El correo de confirmación **no trae enlace para cancelar**, aunque la guía vieja decía que sí | `api/src/lib/gmail.ts` |
| ⚪ | La página de Plantillas sigue **en inglés** («Custom Encounter Templates», «Create Template») | `custom-templates/page.tsx:49-59` |
| ⚪ | «Campos de Cita» nombra sus secciones con el mundo de los slots («Horarios disponibles», «Nuevo horario»); agendar hoy usa «Nuevo horario» sin que nada lo diga | `BookingFieldSettingsModal.tsx` |

### 2026-09-22 — Fase 2: el widget, punta a punta

**Decisiones del usuario** (cierran 3 de las 6 pendientes):
- **Todos los planes**, FREE incluido — existe justo por los planes sin soporte humano. Su regla
  en `ROUTE_PERMISSION_MAP` es `{ prefix: 'ayuda', key: 'ayuda' }` **sin** `feature: 'ia'`. El
  costo lo acota un tope diario de preguntas por doctor (`AYUDA_TOPE_DIARIO`, default 60).
- **`gpt-4o-mini` primero.** Se cambia con `AYUDA_MODELO`; un id `claude-*` va a Anthropic.
- **Cuenta congelada: no** en v1 (el layout congelado no monta widgets).

**Lo que había y se reusó** (el diseño no lo sabía):
- **El `ChatWidget` viejo** (`components/llm-assistant/`, RAG sobre los docs de desarrollo,
  apagado por `WIDGET_AYUDA_VISIBLE` desde 2026-08-27). El nuevo toma su lugar en la pila y
  reusa su `ChatInput`. El viejo **ya no se monta** y el flag se retiró (hallazgo 9 del review);
  el archivo y su endpoint siguen ahí, sin UI que los llame — borrarlos es otra decisión.
- **`lib/ai`** ya tenía el proveedor de OpenAI. El de Anthropic de `lib/ai` es un **stub vacío**,
  así que Claude se llama con el `callClaude` del agente (probado en prod, cachea).

**Archivos:** `lib/ayuda/{mapa-de-rutas,manual,prompt,proveedor,respuesta}.ts` ·
`app/api/ayuda/chat/route.ts` · `components/ayuda/AyudaWidget.tsx` · `dashboard/layout.tsx` ·
`route-permissions.ts` · `apps/api/src/lib/llm-features.ts` (etiqueta `ayuda-chat` en el admin) ·
`apps/doctor/scripts/ayuda-probar.ts`.

**Una pieza que no estaba en el diseño y vale la pena:** el modelo contesta en JSON
(`respuesta` · `seccion` · `enlaces`) y **el servidor verifica** que la sección exista en el
manual y que cada enlace esté en el mapa curado; lo que no, se TIRA (y se loguea). Descarta el
elemento, no la respuesta entera. Es la regla 0 aplicada a las citas.

**Verificación:**

| | |
|---|---|
| `type-check` | ✅ (el primero falló por un `timestamp` faltante; corregido) |
| `pnpm gates` | ✅ los siete |
| Smoke read-only contra prod del `count` del tope diario | ✅ 0 filas `ayuda-chat` hoy · la misma forma da 298 para `agenda-agent` (el filtro no es vacuo) |
| **Llamadas reales, 2 corridas × 10 preguntas con gpt-4o-mini** | ✅ **10/10 correctas en las dos**, incluidas las trampas (Completar en Pendiente → «confírmala»; reactivar archivado → «no hay botón»; asistente emitiendo receta → «sólo el titular»; exportar, ventas, WhatsApp → «no viene en mi manual») |
| Claude (`AYUDA_MODELO=claude-*`) | ❌ **sin probar** — no hay `ANTHROPIC_API_KEY` local |
| **El clic en la app** | ✅ **el usuario lo probó en prod el 2026-09-22: funciona** (tras el deploy de `68f1918f`, SUCCESS en doctor y api) |

**Costo medido: ~6,930 tokens de entrada por pregunta con gpt-4o-mini** (manual 21,864
caracteres) y ~50 de salida. A $0.15/$0.60 por millón, ≈ **$0.001 por pregunta con
gpt-4o-mini**, antes de caché.

**El `/code-review high` — 10 hallazgos, 8 arreglados, 2 aceptados.** Cada arreglo se vio
CORRER (no sólo compilar): pruebas sueltas del parser y del tope, y una conversación real de dos
turnos.

| | Hallazgo | Qué se hizo |
|---|---|---|
| 1 | Con `claude-haiku-4-5`, `callClaude` prendía thinking en silencio (4k de presupuesto, `max_tokens` → 6k) y el timeout de 30 s cortaba respuestas de 20–33 s | `callClaude` ganó `noThinking` (aditivo: el agente y form-builder no cambian) |
| 2 | Un JSON roto (cortado por `max_tokens`, o con salto de línea literal) se le enseñaba CRUDO al doctor, con llaves y comillas | Se rescata el valor de `respuesta`; si no se puede, 502 «no pude generar» |
| 3 | La historia reenviaba los turnos del asistente como texto plano ⇒ Claude (sin modo JSON) los imitaría y dejaría de citar | Viajan como el JSON que produjo el modelo (y el tope por mensaje del asistente subió a 8,000 para no romperlo) |
| 4 | `extraerSecciones` con CRLF (autocrlf en Windows) daba `[]` ⇒ TODA cita se tiraba como inventada | `split(/\r?\n/)` |
| 6 | `AYUDA_TOPE_DIARIO` no numérico ⇒ `NaN` ⇒ tope APAGADO en silencio | Se valida; cae a 60 |
| 7 | El `ChatMessage` viejo le quita el número a los pasos y la numeración CSS sigue contando entre listas | Renderer propio que conserva los números tal cual |
| 8 | «Empezar de nuevo» durante una respuesta en camino ⇒ la respuesta huérfana caía en la conversación nueva | Deshabilitado mientras carga |
| 9 | El ternario sobre `WIDGET_AYUDA_VISIBLE` INVERTÍA el flag: ponerlo en `true` "para mostrar la ayuda" le quitaba el widget a FREE/BÁSICO | El `ChatWidget` viejo ya no se monta y el flag se retiró |
| 5 | El tope es check-then-act: pedidas en paralelo pasan todas | **Aceptado.** Es un tope de costo blando (~$0.001 por pregunta con gpt-4o-mini), no de seguridad |
| 10 | El shell flotante se copió del `ChatWidget` | **Aceptado.** El viejo ya no se monta: no hay dos copias vivas que mantener. Si se borra, el duplicado desaparece |

⚠️ **Debilidad conocida de gpt-4o-mini: no siempre cita.** En las dos corridas omitió la sección
en respuestas que SÍ salían del manual (reactivar archivado, emitir receta) aunque el prompt lo
pide explícito desde la segunda. La respuesta es correcta; lo que falta es la fuente. Es
exactamente lo que la Fase 3 (evals, dos modelos) tiene que medir antes de decidir si vale
subir a Claude.

**Dos cosas nuevas que decidir** (se suman a las 4 de arriba):

5. **¿El widget sabe el plan del doctor?** `01-ARQUITECTURA` §6 dice que la ruta es la ÚNICA
   señal de contexto. Pero si no sabe el plan, contesta con seguridad cómo usar Chat IA a quien
   lo tiene bloqueado.
6. **¿Se arreglan las guías JSX ahora, o se congelan y el esfuerzo va al manual?** Arreglar
   `CitasGuide` es reescribirla; hacerlo dos veces (JSX y manual) es exactamente la divergencia
   que `02-PLAN` §Fase 5 quiere evitar.

### 2026-09-23 — Fase 3 empezada: las citas, la longitud y el costo en el admin

Tres encargos del usuario: arreglar que `gpt-4o-mini` no siempre cita, **medir** si el manual
aguanta crecer (en vez de suponerlo), y ver en el admin cuánto cuesta Ayuda por modelo. Claude
(`claude-haiku-4-5`) **no** se probó: sólo `gpt-4o-mini`, por decisión del usuario.

**1. El script ahora evalúa la cita solo.** 18 casos (los 10 de antes + 8 respuestas «no se
puede» que SÍ salen del manual, ninguna igual a los ejemplos del prompt), `--veces=2`. El
problema era más grande de lo anotado el 09-22: con criterio estricto, **12/18**, y siempre los
mismos casos — no es ruido, es un patrón. Dos formas:
- respuestas «no se puede» con `seccion: null` (reactivar archivado, emitir receta, recuperar
  eliminada…);
- citar la **tabla-resumen vecina** («Qué puedes hacer con cada cita») en vez de la sección que
  tiene el dato.

Lo que se probó, todo con `gpt-4o-mini`, dos corridas cada uno:

| Versión | Citas | Qué enseñó |
|---|---|---|
| Base (prompt del 09-22) | 12 · 12 | — |
| A: aclarar la regla + 2 ejemplos «no» con sección | 13 · 14 | Ayuda poco |
| B: A + `seccion` PRIMERO en el JSON | 12 · 12 | Peor. Se descartó |
| C: el modelo COPIA la frase (`cita`) y el **servidor** decide la sección | 16 · 16 | **El salto** |
| D: C + dos respaldos del servidor (fila de tabla por celdas; oración de la respuesta que esté tal cual en el manual) | 16 · 15 | Arregla «reactivar»; el resto es ruido ±1 |
| E: D + «después del no, di qué SÍ se puede» | 15 · 15 | 🔴 **1 respuesta FALSA** en 36 |
| **F (la que queda):** D con ejemplos que traen alternativa, sin empujón | **15 · 15** | **0 falsas en 36** |

- **C es la regla 0 aplicada a la cita:** el modelo trae la evidencia, el servidor decide. Copiar
  una frase le cuesta menos que clasificarla, y **una frase que no está en el manual se detecta**
  (en F, ~3 de 18 citas por corrida son inventadas o parafraseadas; se tiran y se loguean).
- **Lo que no salió en los números, y salió al LEER las 36 respuestas:** los primeros ejemplos
  eran de una línea («No: …») y el modelo copió el ESTILO — dejó de decir qué sí se puede hacer
  (ofrecer el recordatorio por correo, «crea una cita nueva»). Al pedírselo explícito (E) inventó:
  *«una cita eliminada sigue en la tabla con Más estados → Cancelada»* (eso es de CANCELAR, que
  vive en la misma sección). Quitar el empujón y dejar que los ejemplos lo muestren (F) recuperó
  la ayuda sin inventar. Es `feedback_context_is_not_an_instruction` otra vez.
- Fallan todavía: **12** y **16** (citan la tabla vecina; la respuesta es correcta), y **10**
  (WhatsApp: contesta «no viene en mi manual» + ofrece el de correo, sin sección — defendible).
- **Bug de la historia, encontrado en el review de este cambio:** el widget reconstruye los
  turnos del asistente como `{respuesta, seccion, enlaces}` — sin `cita`, el modelo vería turnos
  que no citan y los imitaría (hallazgo 3 de la Fase 2). Ahora el servidor regresa la `cita`
  verificada y el widget la reenvía. **Visto correr:** conversación real de dos turnos, el
  segundo cita frase y sección correctas.
- También: el modelo a veces manda el string `"null"`; se trataba como sección inventada y
  ensuciaba el log.
- El prompt creció ~400 tokens: **~7,370 tokens de entrada por pregunta con gpt-4o-mini**.

**2. La prueba de longitud — la respuesta cambió.** `--relleno=33000` rodea el manual con docs
del repo que NO son de la app (NEW NAME, IMAGE MIGRATION, POSSIBLE FUTURE TOOLS, NEW STYLE/01;
repetidos para alcanzar el tamaño), mitad antes y mitad después: el manual queda EN MEDIO.

| Con gpt-4o-mini, prompt F | ~7.4k tokens | **~45.6k tokens** |
|---|---|---|
| Citas | 15 · 15 | **12 · 12** |
| Respuestas falsas o inventadas (de 36) | 0 | **2 claras + 2 menores** |
| Latencia mediana | ~1.1 s | **~13 s** (el máximo, 47 s, incluye una espera de 20 s por el tope) |
| Costo por pregunta (antes de caché) | ≈ $0.0011 | ≈ $0.0069 |

Lo inventado a 45k: en **«reactivar archivado» (las dos corridas)** agregó *«…y crea un nuevo
expediente si es necesario»* — un expediente DUPLICADO que el manual nunca sugiere. Menores:
«reagendar» dijo UN correo (son dos), y atribuyó los recordatorios a «tu cuenta de Google» (el
manual lo dice de confirmación y cancelación).

**Y un límite que no era de calidad:** el tope de OpenAI es **por organización — 200k tokens por
minuto para gpt-4o-mini, compartido con todo prod**. La prueba se cayó a la quinta pregunta
seguida. A 7k caben ~27 preguntas/minuto; **a 45k, ~4**, y cada una resta a los demás chats.

⚠️ **Corrección a `00-POR-QUE` §3** (anotada ahí también): la regla «si el manual pasa de ~100k
tokens, cambiar a híbrido» **es demasiado alta para `gpt-4o-mini`**; a 45k ya se degrada. Dos
reservas honestas: el relleno es de OTRO tema (secciones reales vecinas probablemente confundan
MÁS, no menos) y es una sola medición de tamaño. Para la Fase 4: medir con el manual real cada
vez que crezca; si se degrada, las salidas son mandar sólo el ÁREA relevante (la pantalla ya
llega como contexto) o un modelo más caro — decisión para cuando haya números del manual real.

**3. El costo por función y por modelo, en el admin** (`/llm-usage` → «Por Funcionalidad»).
Antes sólo tokens: el costo se había dejado fuera a propósito porque el precio es del MODELO.
Ahora el api agrupa `endpoint + model + provider`, cobra cada grupo con `costOfUsd` y suma
(un modelo sin precio deja la función en «n/d», igual que por doctor); la fila se abre por
modelo; nombres legibles («Ayuda (widget)»); 4 decimales ahí porque una pregunta cuesta ~$0.001.
**Smoke test read-only en prod** de la forma nueva del `groupBy`: corre, y los conteos por
función cuadran con el `groupBy` que ya existía. Primera lectura: **Ayuda = 6 preguntas,
42,955 + 860 tokens con gpt-4o-mini ≈ $0.007 en 28 días.**

**4. El `/code-review high` — 10 hallazgos, 9 arreglados, 1 aceptado.** Cada arreglo se vio
correr (pruebas sueltas del parser con los escenarios exactos del review; el helper de costo REAL
contra prod; la suite de 7k otra vez: **16 · 15**).

| | Hallazgo | Qué se hizo |
|---|---|---|
| 1 | Una frase corta y genérica («pide confirmación») movía una sección VÁLIDA a otra | Para corregir la del modelo, la frase tiene que estar en UNA sola sección y medir 25+ caracteres |
| 2 | Frase en varias secciones ⇒ ganaba la primera, que es la tabla-resumen — el error que se venía a arreglar | Ambigua ⇒ no decide; queda la del modelo |
| 3 | `[texto](#ancla)` (10 en el manual), viñetas y números de paso impedían encontrar citas reales | Se normalizan |
| 4 | La nota del admin decía que sólo OpenAI es un techo | Reescrita: también lo es Claude sin costo con caché |
| 5 | El encabezado de `respuesta.ts` decía 7 de 18; el doc, 12/18 | 12/18 en los dos |
| 7 | Se normalizaba el manual entero en cada oración | Se calcula una vez por sección |
| 8 | Dos `groupBy` que tenían que coincidir | `byEndpoint` sale de las mismas filas que el costo |
| 9 | 🔴 **Bug VIEJO de costo, confirmado en prod** (abajo) | `apps/api/src/lib/llm-cost-rows.ts`, una sola fuente para `/llm-usage` y `/feature-usage` |
| 10 | `extraerSecciones` sin llamadores; comentario de la historia sin `cita` | Borrado / corregido |
| 6 | El respaldo pone sección a un «no viene en mi manual, pero…» si una oración está tal cual en el manual | **Aceptado:** si la oración es del manual, sí lo usó; la sección señala lo relacionado |

**El 9 no era de Ayuda y era el más grave.** `_sum.budgetTokens` suma sólo las filas no-NULL, y
`costOfUsd` cobra por budget si el grupo lo trae: en un grupo MEZCLADO las filas sin budget
costaban $0. Lo arrastraba el costo por doctor desde antes, y el costo por función de hoy lo
copió. Medido en prod, 90 días, **mismas solicitudes antes y después**:

| Función | Costo que se veía | Costo corregido |
|---|---|---|
| `form-builder-chat` | $0.19 | **$1.53** (8×) — 51 de 55 filas de Sonnet sin budget |
| `agenda-agent` | $4.46 | **$7.64** — 86 de 171 filas de Sonnet sin budget |
| todas las demás (Ayuda incluida, $0.0070) | igual | igual |

Las filas de Claude sin budget se cobran ahora por prompt completo — un **techo**, como OpenAI.

**Verificación:** type-check de doctor · api · admin ✅ · `pnpm gates` ✅ los siete · las
etiquetas «» de los ejemplos del prompt existen en `.tsx` ✅ · parser con los escenarios del
review ✅ · smoke test read-only del helper de costo contra prod ✅ · **el clic en la app NO** (ni
el widget con el prompt nuevo ni la pantalla del admin). Costo de todas las pruebas de hoy:
< $1 con gpt-4o-mini.
