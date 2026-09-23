# 🔄 SESSION-REFRESCO — AYUDA WIDGET

> **Tipo: ESTADO.** Se lee primero y se escribe al final de cada sesión.

## En una frase

**2026-09-20 — sesión de DISEÑO. No hay código.** Quedó escrito qué se va a construir, por qué
no lleva RAG, por qué es un asistente aparte del Agente, y el plan por fases.

**2026-09-22 — Fase 0 HECHA** ([`03-AUDITORIA-guias`](03-AUDITORIA-guias.md)): la guía de Citas
está mayormente obsoleta (escrita en abril, nunca actualizada); Expedientes y Pagos, con parches.
**2026-09-22 — Fase 2 CONSTRUIDA (sin commitear al escribir esto):** el widget existe —
`/api/ayuda/chat` + `AyudaWidget` en la pila flotante, en todos los planes, con `gpt-4o-mini`.
Probado con **llamadas reales** al modelo (10 preguntas, todas correctas, cero inventos) pero
**nadie lo ha clicado en la app**. Detalle en la bitácora.

**2026-09-22 — Fase 1 HECHA:** `apps/doctor/src/lib/ayuda/manual-del-doctor.md` cubre Agenda y
Expediente, escrito desde el código. Al escribirlo salieron **7 hallazgos de producto** (uno 🔴:
«Completar» en una cita Pendiente falla). Sigue la **Fase 2 — el widget**, que está bloqueada
por las decisiones de abajo.

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

## Pendiente de decidir (bloquea la fase 2)

1. ¿Qué modelo primero? (recomendado: el barato, y medir si alcanza)
2. ¿El widget en todas las pantallas, o sólo en las documentadas?
3. ¿Una cuenta **congelada** puede usarlo? Hay que meterlo a `RUTAS_DE_CUENTA_CONGELADA`
   a propósito; el default es que quede bloqueada.
4. **¿Quién escribe el manual?** La grande. Días de código contra semanas de escritura.

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
| **El clic en la app** | ❌ **nadie lo ha hecho** |

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
