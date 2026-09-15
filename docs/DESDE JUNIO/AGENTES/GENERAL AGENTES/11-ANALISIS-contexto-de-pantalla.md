# 🔬 ANÁLISIS — contexto de pantalla: cómo lo resuelve Google en Chrome y qué copiamos (2026-09-14)

> **Tipo: DECISIÓN / REFERENCIA.** Se mantiene al día.
>
> **La pregunta:** cuando el doctor abre el panel del asistente, ¿cómo hacemos que el modelo
> sepa **qué está viendo en el resto de la pantalla**? Google acaba de shippear exactamente esa
> relación —navegador ↔ LLM ↔ humano— en *Gemini in Chrome*. Este doc **disecciona su
> arquitectura y decide qué pieza es nuestra y cuál no**.
>
> ⚠️ **No se trata de conectarnos a Gemini.** El objeto de estudio es el PATRÓN, con nuestro
> propio modelo y nuestras propias tools. Las tres superficies de Google que sí son integrables
> (WebMCP · Prompt API · Live API) se anotan aparte en el **§11**, para que nadie las confunda
> con la recomendación.
>
> **§3 y §11 son datos EXTERNOS con fecha (2026-09-14) y caducan** — versiones, estados de
> origin trial y precios de Google se mueven cada release. El análisis (§4–§9) no depende de
> esas versiones. **Conteos nuestros citados = foto, con su fecha; los vigentes viven SOLO en
> [`02-CAPACIDADES`](02-CAPACIDADES-matriz-que-puede-y-que-no.md) §4.**
>
> 👉 **El CÓMO ya está escrito:** [`12-PLAN-contexto-de-pantalla.md`](12-PLAN-contexto-de-pantalla.md)
> (verificaciones contra el código, fases, evals, métricas). Este doc es el PORQUÉ.

---

## 1. Esto NO es una idea nueva: es un pendiente diferido en julio

Antes de nada, el registro. Cuando se diseñó el panel acoplado, esto quedó explícitamente
**fuera de alcance**, con su razón:

> *"**Fuera de alcance:** contexto de pantalla al modelo («estás viendo /facturacion» en el
> bloque temporal — barato y cache-safe, pero es un cambio de COMPORTAMIENTO del agente → PR
> aparte con evals)."*
> — [`01-PLAN-panel-copilot-persistente.md`](01-PLAN-panel-copilot-persistente.md) §5 (2026-07-11, SHIPPED)

O sea: la idea ya estaba, el diagnóstico de costo ya estaba (**barato y cache-safe**), y la
razón para no hacerlo entonces sigue siendo válida hoy (**es cambio de conducta ⇒ exige evals**).
Lo que aporta este doc es **la forma concreta** que en julio no teníamos, sacada de un sistema
que ya está en producción a escala de navegador.

## 2. Por qué la pregunta importa más de lo que parece

Hoy el producto tiene **19 superficies de IA** (foto 2026-08-27,
[`../INVENTARIO IA/01`](../INVENTARIO%20IA/01-INVENTARIO-donde-vive-cada-chat.md)) y **8 de
ellas son el mismo bot repetido**: `encounter-chat`, `prescription-chat`, `patient-chat`,
`task-chat`, `ledger-chat`, `sale-chat`, `purchase-chat`, `quotation-chat`. Todas hacen *"convierte
texto libre en los campos de ESTE formulario"*, y existen **por pantalla** — cada una es su propio
endpoint, su propio prompt, su propio hook y su propio panel.

Existen así por una razón: **era la única manera de que el modelo supiera qué está viendo el
doctor.** El contexto de pantalla estaba cableado en el *deploy*, no en el *runtime*.

Google resolvió la misma pregunta al revés: **UN asistente, y el contexto entra como dato**. Esa
es la tesis arquitectónica de este doc, y coincide con una decisión que ya habíamos tomado por
otro camino —
[`10-ANALISIS`](10-ANALISIS-especializar-agente-por-area.md) (2026-08-01) concluyó **no partir el
agente por área**. Google llega a lo mismo desde el otro extremo: no especializa el cerebro,
**varía el contexto**.

## 3. El mecanismo de Google, en detalle (externo · 2026-09-14)

### 3.1 El contexto NO es un screenshot ni el HTML

Chrome corre el **Page Content Agent (PCA)**: recorre su propio árbol de render y produce un
**árbol de nodos de contenido** (~21 tipos: Root, Container, Text, Heading, Anchor, Image, Form,
FormControl, Table, TableRow, TableCell…). Cada nodo lleva:

| Campo | Para qué sirve |
|---|---|
| `content_node_id` | numeración secuencial en recorrido depth-first — **le da NOMBRE a cada cosa de la pantalla** |
| `dom_node_id` | solo para tipos en allowlist |
| 3 bounding boxes (outer · visible · fragment) | geometría: dónde está en la pantalla |
| info de interacción | focusable, tabbable, 16 razones de "clickable", disabled, z-order, scroller |
| estilo de texto + datos de accesibilidad | jerarquía y énfasis |

Ese árbol se serializa a **Markdown con referencias de nodo**, con los elementos marcados
`{#ID}` (p. ej. `# {#458} DEJAN is an AI SEO agency…`), y se entrega al modelo como **contexto
grounded**. Un dato de escala: de una home típica, **198 nodos interactivos etiquetados de 471
totales**.

### 3.2 Las tres propiedades que hacen que el patrón funcione

1. **Los IDs hacen que el modelo pueda SEÑALAR, no describir.** El modelo responde
   refiriéndose a `content_node_id`, y Chrome **vuelve a resolver el ID contra el DOM
   verificando tipo, posición y contenido**, para el caso de que la página haya cambiado desde
   la extracción. Es anti-alucinación **por construcción**: el modelo no puede apuntar a algo
   que no existe, y si existió y se movió, el sistema lo detecta.
2. **La privacidad se filtra ANTES de serializar, no después.** Durante el recorrido del árbol
   Chrome aplica **redacción de passwords** y **redacción de iframes cross-origin**; solo se
   incluye el contenido de iframes same-origin. El recorte vive en el extractor, no en el prompt.
3. **El modelo ve la vista AUTENTICADA.** Chrome extrae la página *tal como está renderizada en
   la sesión actual* — lo que el usuario ve, lo ve el modelo, incluidos paneles de administración
   y datos personalizados. Es lo que hace útil al patrón, y es exactamente lo que lo hace
   peligroso en salud (§10).

### 3.3 El humano en el lazo: checkpoints por CLASE DE CONSECUENCIA

*Auto browse* (delegar una tarea de varios pasos) corre solo para investigar, comparar, llenar
formularios y aplicar cupones, pero **"está diseñado para pausar y pedir confirmación, o pedirte
que completes tú algunas tareas como hacer una compra o publicar en redes sociales"**.

La pieza a robar no es "pide permiso" —eso ya lo hacemos— sino **dónde pone la línea**: no es
*lectura vs escritura*, es **por consecuencia**. Llenar el formulario: solo. Pagar: el humano.

### 3.4 El alcance es EXPLÍCITO y VISIBLE

El usuario puede compartir hasta 10 pestañas; cuando Gemini agrupa un contexto, **Chrome pinta
una línea de color a lo ancho de esas pestañas**. El usuario *ve* qué puede ver el modelo. Y la
entrada más barata al patrón es la más pequeña: un botón flotante **"Ask Gemini" junto al texto
que seleccionas**.

## 4. Las 7 ideas que SÍ transfieren

| # | Idea de Google | Cómo aterriza en nuestro código | Valor |
|---|---|---|---|
| **1** | **Un cerebro + contexto variable** (en vez de N bots por pantalla) | El panel ya vive en el root layout y sobrevive navegación (`contexts/AgentContext.tsx`). Falta que sepa DÓNDE está parado | 🟢 alto |
| **2** | **El contexto es un objeto TIPADO, no texto libre** | Nosotros no necesitamos recorrer el DOM: **la app conoce su propio estado**. Emitimos `{ ruta, entidad: {tipo, id, label} }` | 🟢 alto |
| **3** | **IDs para señalar** | Es **regla 0 con otro nombre**: el modelo no inventa IDs, los recibe. El contexto de pantalla ENTREGA el `patientId`/`bookingId` que hoy el agente tiene que ir a buscar con `find_patient` | 🟢 alto |
| **4** | **Filtrar en el EXTRACTOR, no en el prompt** | El payload de contexto se compone server-side y pasa por `resolveAgentScope` **antes** de entrar al turno (§7) | 🟢 alto (es seguridad) |
| **5** | **Checkpoints por clase de consecuencia** | Ya lo tenemos y esto lo valida: la card tier-máximo de `propose_create_cfdi` es nuestro "pagar" | 🟡 confirma |
| **6** | **Alcance visible y removible** | Un chip en el panel: *"viendo: expediente de Juan Pérez ✕"*. Es la UX de la honestidad **y** el consentimiento | 🟢 alto |
| **7** | **Selección como prompt** | "pregunta sobre esto" en una fila/campo seleccionado. Es el canal de contexto más barato que existe | 🟡 después |
| **8** | **Sesgar la selección de tools por pantalla** (idea del usuario, 2026-09-14) | Una línea en el bloque volátil, NO un recorte del toolset. Detalle y por qué la versión "cortar" es la cara: [`12-PLAN`](12-PLAN-contexto-de-pantalla.md) §8.1 | 🟢 alto — viaja gratis con la #1 |

### 4.1 La idea #3 merece su párrafo: el contexto de pantalla es FONTANERÍA gratis

[`09-ANALISIS`](09-ANALISIS-recortar-superficie-del-agente.md) §2 estableció el reencuadre más
útil que tenemos: casi toda la lectura de `agenda` es **fontanería** — `find_patient` existe para
producir un `patientId`, `get_bookings` para producir un `bookingId`. No se puede quitar porque
**la escritura muere con ella**.

Pero si el doctor está parado en el expediente de Juan Pérez y el panel **ya sabe** que
`patientId = X`, ese viaje de fontanería **se lo ahorra**. No se quita la tool (sigue haciendo
falta cuando el doctor pregunta en frío), pero el camino caliente —el que de verdad usa— pierde
una iteración completa del loop.

Eso toca la métrica que el plan de costos dice que manda: **avg de iteraciones por turno**
([`../OPTIMIZACION COSTOS/01-PLAN`](../OPTIMIZACION%20COSTOS/01-PLAN-experimentos.md) lever 2d).
⚠️ **Es una hipótesis, no un resultado** — se mide, no se asume.

### 4.2 🔬 Y ya hay evidencia MEDIDA, no solo teoría (2026-09-14)

Cuando se escribió la primera versión de este doc, todo el §4 era razonamiento. La lectura de
`agent_tool_calls` (bitácora **#37**) le puso un número:

> **`get_services` se llamó CUATRO veces en CINCO minutos, en cuatro turnos distintos**
> (23:56:45 · 23:57:07 · 23:57:33 · 23:58:23 del 2026-08-03), devolviendo siempre el mismo
> `servicios_n: 2`. Una lista de dos elementos que no cambia, re-consultada cuatro veces seguidas.

Es exactamente la clase que mata un panel que sabe en qué pantalla está. Y la línea base para
medir el §9.3 también salió de ahí: **37 turnos, media ~1.8 llamadas por turno**.

⚠️ Antes de volver a medir con esa tabla hay que arreglarla: **`ok=true` en llamadas cuyo digest
trae `error`** (bitácora #37.1). Un instrumento sesgado no sirve para probar una hipótesis.

## 5. Lo que NO transfiere (y por qué anotarlo)

| Pieza | Por qué no |
|---|---|
| **El PCA / recorrer el DOM** | Chrome lo hace porque **no escribió la app que está mirando**. Nosotros sí. Copiar el árbol de nodos sería reconstruir por inferencia un estado que ya tenemos tipado. **Nuestra ventaja estructural sobre Gemini en nuestra propia app es exactamente ésta** |
| **Auto browse / multi-paso autónomo** | Choca de frente con *propuesta → card → el doctor confirma → el CLIENTE ejecuta*. Y [`10-ANALISIS`](10-ANALISIS-especializar-agente-por-area.md) ya dice que ampliar superficie no es la palanca pendiente |
| **Contexto multi-pestaña (10 tabs)** | Nuestro panel vive DENTRO de una sola app. El equivalente sería "varias entidades a la vez" — eso ya existe y ya tiene su lección: el chat del informe con `sources` a nivel paciente y **tope explícito de 6,000 tokens que NO recorta solo** (`06-MAPA` §2) |
| **Bounding boxes / geometría** | Solo sirven para pintar highlights (fase 3 del §8). Para *entender* qué mira el doctor, la ruta y el ID bastan |

## 6. La restricción que manda todo: el caché

**Esto es lo primero que hay que entender antes de escribir una línea.**

El prefijo del sistema mide **27,151 tokens** (medido 2026-07-23, `00-BLUEPRINT` §5.1) y está
cacheado. El contexto de pantalla **cambia en cada navegación** — que es justo lo que lo hace
valioso, y justo lo que lo vuelve una bomba de costo si se pone en el lugar equivocado.

| Dónde meter el contexto | Qué pasa |
|---|---|
| En el system prompt / prosa de módulo | ❌ **Invalida el prefijo en CADA cambio de pantalla.** Cada navegación = una pregunta fría (~$0.083 medidos) |
| En el **bloque temporal** (la cola ya no cacheada) | ✅ Cache-safe. Es lo que dijo `01-PLAN` §5 y sigue siendo correcto |

⚠️ Y un corolario que no es obvio: **el chip de "viendo X" no puede re-disparar un turno.** Si
el contexto se inyecta al navegar en vez de al ENVIAR un mensaje, el doctor paseando por la app
con el panel abierto genera turnos sin haber escrito nada. El contexto se adjunta **en
`sendMessage`**, con la pantalla en la que está al preguntar.

> ⚠️ Los dos hechos de este §6 salen de los docs, no de una lectura de `run-turn.ts` en esta
> sesión. **Verificar contra el código antes de construir** (la verdad es el código —
> `08-EMPIEZA-AQUI` §8).

## 7. El cuarto eje de recorte: el contexto de pantalla TAMBIÉN filtra

Esta es la parte que más fácil se olvida, y ya tenemos la cicatriz.

`02-CAPACIDADES` §1.5.1 documenta tres ejes por los que se recorta lo que ve un usuario: **tools**
(scope), **prosa** (`gate:prosa`) y **payload** — y la bitácora #28 cuenta cómo el *cuarto*
apareció solo: en CORE, unos buckets `sat_emitido`/`sat_recibido` que **sobrevivieron** al recorte
de tools bastaron para que el modelo **fabricara un diagnóstico de conciliación en 4/4 corridas**,
con la prosa diciéndole lo contrario.

**El contexto de pantalla es un payload nuevo, y por lo tanto un quinto eje del mismo problema.**

- Un **member** sin el toggle `facturacion` puede estar parado en una pantalla de facturación
  (o llegar a ella por un link). Si el contexto dice *"viendo: CFDI folio 10"*, le acabamos de
  dar al modelo un dato de un módulo que **no tiene**.
- Un doctor **BASICO** está fuera de `ia`, y **PRO** está fuera de `asistente_ia`
  (`TIERS/02-PLAN` §3.3) — el techo del tier aplica **también al dueño**.

⇒ **El contexto se compone server-side y se pasa por `resolveAgentScope(access)`**, igual que las
tools. Nunca se toma del navegador tal cual. Es literalmente la lección #2 de Google (§3.2):
**el recorte vive en el extractor**.

⚠️ Y hay una consecuencia de máquina: **`gate:prosa` no puede ver esto** — mira prosa y
descripciones de tools, no payloads. Igual que el caso #28, **esta clase no tiene garantía
automática: solo evals.**

## 8. La versión más barata para nosotros (fases)

> 👉 Estas fases están desarrolladas —con archivos, evals, métricas y checklist— en
> [`12-PLAN-contexto-de-pantalla.md`](12-PLAN-contexto-de-pantalla.md). Lo de abajo es el resumen.

| Fase | Qué | Costo | Riesgo |
|---|---|---|---|
| **0** | Solo la **ruta** en el bloque temporal (*"el doctor está viendo /dashboard/facturacion"*) | ~20 tokens | Cambio de conducta ⇒ evals. **Es el alcance exacto que `01-PLAN` §5 difirió** |
| **1** | **Contexto tipado con ENTIDAD**: `{ ruta, entidad: {tipo:'paciente', id, label} }`, compuesto server-side y recortado por scope (§7) | bajo | El de verdad: §7 + evals de fuga |
| **2** | **Chip visible y removible** en el panel (idea #6) + "preguntar sobre esto" desde una selección (idea #7) | UI | bajo |
| **3** | **Grounding de vuelta**: que el asistente pueda resaltar el campo del que habla | alto | alto — requiere canal bidireccional de IDs |

**La fase 1 casi no necesita plomería nueva, y ésta es la mejor noticia del análisis:** el canal
página→provider **ya existe y ya está probado en prod**. `01-PLAN` §3 paso 2 lo construyó como
`subscribeAgendaChanged(cb)` — la página de appointments **se registra** en el provider con un
`useEffect` y se des-registra al desmontar. Un `registerScreenContext(ctx)` es **el mismo patrón,
en el sentido contrario**, sobre el mismo provider.

⚠️ Con dos advertencias del propio `01-PLAN` §7: (a) hay **DOS contexts a propósito** —
`useAgentActions` (barato, para layouts y páginas) y `useAgentChat` (**solo el panel**); el
registro de contexto va en el primero o cada tecleo del chat re-renderiza la página entera.
(b) el root layout **también envuelve `/login` y `/consent`**: el provider debe seguir inerte ahí.

## 9. Lo que hay que medir antes de creerse nada

1. **Evals, no intuición.** Es cambio de conducta. Y las dos trampas propias ya documentadas:
   *una corrida no distingue regresión de ruido* (la misma config dio 64, 63 y 58 —
   [`10-ANALISIS`](10-ANALISIS-especializar-agente-por-area.md) §3), y **un eval VERDE puede
   estar afirmando algo falso** (el check mira la forma de la respuesta, no su verdad).
2. **Evals NUEVOS de fuga**, no solo los existentes: member sin `facturacion` parado en
   facturación · doctor PRO (sin `asistente_ia`) · doctor BASICO (sin `ia`). Los casos de §7 no
   los cubre ningún eval de hoy.
3. **Iteraciones por turno antes/después** (la hipótesis de §4.1). Si el contexto no baja el
   número de viajes de fontanería, su valor es solo de UX — que también es válido, pero es otro
   argumento.
4. **Prefijo re-medido** (`scripts/measure-agent-prefix.ts`) para probar que no se movió: si el
   contexto se coló al prefijo, se nota ahí.

### 9.1 El prerrequisito incómodo

**El asistente está OCULTO de la UI desde 2026-08-27** (`ASISTENTE_IA_VISIBLE = false`,
`lib/agenda-agent/feature-flag.ts`; su endpoint sigue vivo). Y por tiers, el asistente es
**la única función que LAB tiene y PRO no** (`asistente_ia`, `TIERS/02-PLAN` §3.3).

⇒ Nada de este doc entrega valor hasta que el asistente vuelva a ser visible. **Este análisis
describe qué construir cuando se retome, no un argumento para retomarlo ya.** La decisión de
volver a encenderlo es de producto y vive en
[`../AGENTE AGENDA/SESSION-REFRESCO.md`](../AGENTE%20AGENDA/SESSION-REFRESCO.md).

> 🔬 **Y ahora se sabe POR QUÉ se ocultó, con traza (bitácora #37, 2026-09-14).** Se ocultó tras
> una época en que el agente ofrecía horarios inexistentes. La causa medida **no fue el modelo**:
> fue un resultado VACÍO de `get_availability` tomado por verdad (dijo "no hay nada" de un día con
> 2 rangos y 3 citas). **`get_availability` se ELIMINÓ el 2026-08-05 — dos días después de esa
> traza — y nadie ha vuelto a evaluar al agente desde entonces.**
>
> ⇒ **La pregunta previa a retomar esto NO es "¿Haiku o Sonnet?" sino "¿sigue fallando?"**.
> Replicar los escenarios de la traza contra el código de hoy es más barato que cualquier otra
> cosa de este doc, y puede cambiar la decisión de producto.

## 10. ⚠️ El riesgo INVERSO: Gemini en Chrome ya lee NUESTRAS pantallas

Independiente de todo lo anterior, y accionable hoy.

*Gemini in Chrome* llegó a **Latinoamérica (México incluido) alrededor de junio de 2026**, en
~172 países y ~50 idiomas **incluido español**. Y por §3.2 punto 3, **extrae la vista
autenticada**: lo que el doctor ve, lo ve Gemini. Lo que el doctor ve son expedientes.

Lo que dice la propia documentación de Google:

- *Gemini in Chrome* **no declara** HIPAA BAA, SOC, ISO, FedRAMP High ni BSI C5, y **queda
  bloqueado automáticamente para clientes que firmaron el HIPAA BAA**. Google mismo trata la
  lectura de página como incompatible con datos de salud regulados.
- La política empresarial **`GeminiSettings`** (Chrome 137+, Windows/Mac, a nivel de perfil)
  lo desactiva dejando vivo el sitio web de Gemini.
- La afirmación "tus prompts no entrenan el modelo público" está acotada a **cuentas de Google
  gestionadas**.

Nuestro régimen es **LFPDPPP**, no HIPAA, pero la forma del problema es idéntica — y esto pasa
en **el navegador del doctor**, donde no tenemos voz ni voto.

**Dos preguntas abiertas que NO pude contestar** (y que no conviene suponer):

1. ¿Existe alguna señal del lado del SITIO para pedir que su contenido no se use como contexto?
   No encontré ninguna; **ausencia de evidencia no es evidencia de ausencia**.
2. ¿Qué hace el flujo de consumidor (cuenta NO gestionada) con los prompts?

⇒ **Acción sugerida (no es de esta carpeta):** anotarlo en el material de
`project_legal_compliance` / LFPDPPP y decidir si el onboarding del doctor dice algo al respecto.

## 11. Apéndice — las otras 3 superficies de Google (para no confundirlas con §4)

Verificado 2026-09-14. **Ninguna es la recomendación de este doc**; se anotan porque la próxima
sesión que investigue esto las va a encontrar y conviene que sepa dónde caen.

| Superficie | Qué es | Estado (2026-09-14) | Nuestro veredicto |
|---|---|---|---|
| **WebMCP** | Una página **declara tools** (`registerTool({name, description, inputSchema, execute})`) que un agente del navegador invoca, en vez de adivinar el DOM. Gated por Permissions Policy `tools` (default `self`), exige documento origin-isolated | **Origin trial Chrome 149→156.** El único consumidor es Gemini in Chrome, y su soporte se describe como *"coming soon"* | 🟡 **Doc, no código.** Su no-objetivo declarado es *"flujos totalmente autónomos"* y su objetivo *"human-in-the-loop"* — **es nuestro modelo de escrituras**. Pero: expone nuestras tools a un agente que no controlamos, exigiría replicar `resolveAgentScope` en una segunda superficie, y **le regala a Gemini gratis lo único que LAB vende** |
| **Prompt API (Gemini Nano)** | LLM **on-device**, gratis, sin red. JSON Schema (`responseConstraint`), tool calling, entrada multimodal (audio requiere GPU), **español soportado**, *"no data is sent to Google"* | **Estable en Chrome 148**, web y extensiones | 🟡 **Experimento**, no arquitectura. Encaja con las 8 `*-chat` de formulario. Pero el piso de hardware (22 GB libres, 16 GB RAM o GPU 4 GB) y ser Chrome-only lo condenan a **mejora progresiva con fallback a la nube** |
| **Gemini Live API** | WebSocket persistente con **audio nativo** in/out (sin cadena STT→LLM→TTS) | producción | 🟢 **Segunda cotización para el canal de voz.** Anotado en [`../AGENTE ELEVENLABS/README.md`](../AGENTE%20ELEVENLABS/README.md); no cambia la secuencia de esa carpeta |

⚠️ **Discrepancia sin resolver en WebMCP:** el explainer de la especificación usa
`document.modelContext` y parte del material de Chrome menciona `navigator.modelContext`.
**Verificar contra la doc vigente del origin trial antes de escribir nada.**

---

## Fuentes (externas, 2026-09-14 — caducan)

- Mecanismo de contexto (§3): [Google Uses Chrome to Supply Context to Gemini Chat (dejan.ai)](https://dejan.ai/blog/chrome-context-gemini/) —
  la descripción más técnica del Page Content Agent, el árbol de nodos y el markdown `{#id}`
- Producto y human-in-the-loop (§3.3, §3.4): [Gemini in Chrome](https://gemini.google/overview/gemini-in-chrome/) ·
  [Putting Gemini to work in Chrome — auto browse](https://blog.google/products-and-platforms/products/chrome/gemini-3-auto-browse/) ·
  [Use Gemini in Chrome (soporte)](https://support.google.com/chrome/answer/16283624) ·
  [Go Live with Gemini in Chrome](https://support.google.com/chrome/answer/16363185)
- Disponibilidad LatAm/español (§10): [blog de Chrome](https://blog.google/products-and-platforms/products/chrome/chrome-expands-latin-america/) ·
  [9to5Google](https://9to5google.com/2026/06/10/gemini-chrome-latin-america-more/)
- Cumplimiento (§10): [Chrome Enterprise — privacy and security](https://support.google.com/chrome/a/answer/17030282) ·
  [Disable Gemini in Chrome: enterprise policy guide](https://www.kursol.io/blog/ai-breaking-news-2026-05-06-chrome-gemini-nano-privacy) ·
  [Is Google Gemini HIPAA compliant?](https://www.accountablehq.com/post/is-google-gemini-hipaa-compliant-baa-phi-and-how-to-use-it-safely)
- Apéndice (§11): [WebMCP (Chrome for Developers)](https://developer.chrome.com/docs/ai/webmcp) ·
  [WebMCP explainer](https://github.com/webmachinelearning/webmcp) ·
  [Prompt API](https://developer.chrome.com/docs/ai/prompt-api) ·
  [Chrome at I/O 2026](https://developer.chrome.com/blog/chrome-at-io26)

---

*Relacionado: [`01-PLAN-panel-copilot-persistente.md`](01-PLAN-panel-copilot-persistente.md) §5
(donde esto se difirió) · [`09-ANALISIS`](09-ANALISIS-recortar-superficie-del-agente.md) §2
(fontanería vs lectura-respuesta — la base del §4.1) ·
[`10-ANALISIS`](10-ANALISIS-especializar-agente-por-area.md) (por qué NO se parte el agente) ·
[`02-CAPACIDADES`](02-CAPACIDADES-matriz-que-puede-y-que-no.md) §1.5.1 (los ejes de recorte, de
los que el §7 agrega uno) · [`06-MAPA-superficie-IA.md`](06-MAPA-superficie-IA.md) (las 19
superficies y las 3 arquitecturas).*
