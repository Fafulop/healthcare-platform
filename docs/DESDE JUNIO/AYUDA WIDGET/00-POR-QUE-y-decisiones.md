# 🤔 Por qué existe este widget, y por qué así

> **Tipo: DECISIÓN / REFERENCIA.** Describe cómo son las cosas hoy y por qué se eligieron.
> Se actualiza cuando una decisión cambia — anotando la corrección, no borrando la anterior.
>
> Creado el **2026-09-20**.

---

## 1. El problema, dicho sin adornos

Los planes de pago van a ser **baratos**, y algunos doctores no van a pagar nada. Con esos
números **no hay forma de contratar gente que acompañe a cada doctor**. Pero un doctor que no
entiende cómo agendar sin rango, o cómo cobrar una cita, tampoco se queda: se va.

O sea: **la ayuda tiene que escalar sin humanos.** Eso no es una preferencia de producto, es
una consecuencia del precio.

De ahí salen dos necesidades distintas, que conviene no confundir:

| | Qué resuelve | Cómo se mide |
|---|---|---|
| **Documentación** | El doctor que se sienta a aprender | ¿Existe la explicación, y es cierta? |
| **Widget de ayuda** | El doctor **atorado a media tarea** que no va a leer un manual | ¿Le contestó lo que preguntó, sin inventar? |

Este folder es del **segundo**. El primero ya empezó (§2).

---

## 2. Lo que YA existe (no se empieza de cero)

Medido el 2026-09-20:

- **`/dashboard/ayuda` ya es una guía de verdad**: ~3,589 líneas de JSX en
  `apps/doctor/src/app/dashboard/ayuda/_components/` — `CitasGuide`, `ExpedientesGuide`,
  `PagosGuide` — con pestañas **en el mismo orden de importancia** que se quería: Citas y
  Expedientes primero. `Perfil & Contenido` y `Gestión de Práctica` están puestas pero
  **deshabilitadas** («próximamente»).
- Está escrita con **componentes estructurados** (`SectionAccordion`, `WorkflowStep`,
  `WorkflowPath`, `AppBadge`) que dibujan los botones de la app en vez de enlazar a rutas. Por
  eso no hay ni un `/dashboard/...` en su texto.
- **`scripts/demo-seed/seed-cardio.cjs`** ya sembró 8 expedientes de cardiología en dr-prueba
  **para grabar clips**. O sea: el video ya se había empezado a preparar.
- **`llm_docs_chunks` + `search_chunks`** existen (la infraestructura RAG del asistente de
  documentación de DESARROLLO, otra cosa).
- Los cuatro chats del app comparten **un molde de diseño, no un componente**: cada panel
  (`EncounterChatPanel`, `PatientChatPanel`, `PrescriptionChatPanel`, `LedgerChatPanel`) es su
  propio archivo que copia la plantilla de `AgendaAgentPanel` (417 líneas).

---

## 3. La decisión que más sorprende: **NO usar RAG**

Se midió el corpus antes de decidir, y el número cambió la respuesta:

- Las tres guías actuales tienen **~1,630 palabras** de prosa visible.
- El menú tiene **20 secciones**. A la misma densidad, documentarlas TODAS son **~11,000
  palabras ≈ 15,000 tokens**. Aun escribiéndolas tres veces más ricas: ~45,000.

**El manual COMPLETO del doctor cabe entero en un prompt**, con muchísimo espacio de sobra. El
consenso de 2026 es que el contexto largo con caché gana cuando el corpus está por debajo de
~200k tokens y es estable; estamos **un orden de magnitud por debajo de esa línea**.

| | RAG (chunks + embeddings) | El manual entero en el prompt |
|---|---|---|
| Costo/pregunta (modelo barato) | ~$0.0005 | ~$0.003 (menos con caché) |
| A 240 preguntas/mes | $0.12 | **$0.77** |
| Cómo falla | **la búsqueda no encuentra ⇒ el modelo rellena** | no falla: siempre lo tiene todo |
| Qué hay que construir | trocear, embeber, buscar, ingesta | **un archivo en el prompt** |

Se paga **~65 centavos al mes** por borrar toda la capa de recuperación **y** su modo de fallo.
Y el modo de fallo importa más que el dinero: es justo cuando la búsqueda trae poco que un
modelo barato se pone a inventar.

**Regla para el futuro:** si el manual pasa de ~100k tokens, la respuesta cambia al híbrido
(recuperar para acotar, y razonar sobre todo el candidato). Hoy no.

> ⚠️ **Corrección 2026-09-23 — medido, no supuesto: con `gpt-4o-mini` el umbral es mucho más
> bajo.** Con el manual (~7.4k tokens de prompt) rodeado de relleno hasta **~45.6k tokens**:
> citas 15→12 de 18, respuestas inventadas 0→2 de 36 (una sugirió crear un expediente
> DUPLICADO), latencia mediana ~1 s → ~13 s. Y un límite que no es de calidad: el tope de
> OpenAI de la organización (200k tokens/min para gpt-4o-mini, **compartido con todo prod**)
> deja pasar ~4 preguntas por minuto a ese tamaño. Lo de arriba sigue siendo cierto para el
> corpus de HOY (cabe, y cabe bien); lo que cambia es que **«cabe en la ventana» no es «el
> modelo barato lo usa bien»**. El manual se vuelve a medir cada vez que crece; si se degrada,
> la salida probable es mandar sólo el ÁREA relevante, no RAG por trozos. Detalle y reservas:
> `SESSION-REFRESCO` → bitácora 2026-09-23.

> ⚠️ **Lo que NO se toca:** `llm_docs_chunks` sigue siendo correcto para el asistente de
> documentación de DESARROLLO, cuyo corpus sí es grande. Esta decisión es sólo para el manual
> del doctor.

---

## 4. Por qué es un asistente SEPARADO del Agente

No es el mismo asistente con un módulo más, y la diferencia no es cosmética:

| | El Agente (`AGENTES/`) | El widget de Ayuda |
|---|---|---|
| Lee datos del doctor | Sí (38 tools) | **No. Ninguno.** |
| Escribe | Propuesta → card → confirma el doctor | **Nunca** |
| Emite veredictos de negocio | Sí ⇒ **regla 0** (server-side) | **No emite ninguno** |
| De qué habla | De TUS datos | De **cómo funciona la app** |

Todo el aparato del Agente —regla 0, cards de confirmación, permisos por módulo, el cliente
como ejecutor— existe **porque ese agente ACTÚA**. Éste sólo lee un documento. Su radio de daño
es mucho menor, y meterlo en el mismo agente sería heredarle una complejidad que no necesita y
arriesgar la que sí importa.

**Consecuencia práctica:** cero tools, cero acceso a BD, cero permisos que respetar. Un member
y un dueño reciben la misma respuesta, porque la respuesta no depende de sus datos.

---

## 5. El riesgo real, y es uno solo

**Que describa con seguridad un flujo que no existe.**

Es la misma enfermedad que un video viejo —enseña un camino equivocado justo cuando el doctor
ya estaba perdido— pero peor: se genera fresca en cada respuesta, así que **no la puedes
encontrar para arreglarla**.

Tres cosas la contienen, y las tres son estructurales, no buenos deseos:

1. **Responder SÓLO desde el texto entregado**, y **citar la sección**. Una cita inventada se
   detecta; eso solo ya desincentiva inventar.
2. **Una salida legítima para «no sé»**, premiada por el prompt. Sin ella, la presión por
   contestar se convierte en presión por inventar — la lección ya está escrita en este
   proyecto.
3. **El manual como UN archivo**, greppable y diffeable. `gate:prosa` ya verifica que la prosa
   del agente no enrute a secciones que no existen: el mismo patrón puede asegurar que el
   manual no mencione una ruta muerta.

> 🔴 **Y la condición previa a todo:** el bot es un multiplicador de los docs. Indexar un manual
> viejo produce una máquina que repite respuestas viejas, más rápido y más convincente. **Los
> docs se arreglan ANTES de conectarlos.**

---

## 6. Por qué el VIDEO se pospone (no se descarta)

El costo de un video no está en grabarlo: está en **mantenerlo cierto**.

Sólo el 2026-09-20 el menú del doctor cambió **cuatro veces** (Mi Cuenta arriba · «Editar
Perfil» → «Perfil Público» · Integraciones/Equipo a Mi Cuenta · Receta PDF a Expedientes ·
Blog y Audiovisual a pestañas). Un clip grabado el día anterior enseña rutas que ya no existen.
Y un video **no se puede grepear, ni diffear, ni sabes cuál de los 40 se rompió**.

Cuando se haga, la forma correcta es **grabación guionada**: un script maneja la app de verdad,
graba el video, y **la misma lista de pasos genera la narración** que se manda a TTS. Así el
audio y el video no pueden desincronizarse, y cuando la UI cambia **el script FALLA** — la
rotura se vuelve ruidosa en vez de silenciosa. De regalo, esos scripts son pruebas E2E, que
este repo no tiene.

Eso es un proyecto aparte. Primero el texto y el widget, que es lo que contesta preguntas que
no anticipaste.

---

## 7. Lo que se decidió, en una tabla

| Decisión | Qué se eligió | Por qué NO la otra |
|---|---|---|
| Recuperación | **El manual entero en el prompt** | RAG es maquinaria para un corpus 10× más grande del que hay |
| ¿Dentro del Agente? | **Asistente aparte** | Éste no actúa; heredar regla 0 y tools es complejidad sin beneficio |
| Primer entregable | **Texto + widget** | El video no se puede mantener cierto todavía |
| Modelo | **Intercambiable por configuración** (`01-ARQUITECTURA` §3) | Amarrarse a uno hoy es apostarle a un precio que se mueve cada trimestre |
| Alcance de las respuestas | **Sólo cómo funciona la app** | En cuanto lea datos del doctor, hereda todo el aparato del Agente |
