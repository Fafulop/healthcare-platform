# 🧾 DISEÑO F2c — factura COMPUESTA (consulta + insumos + quirófano) vía BORRADOR en el form

> **Estado: CONSTRUIDO + VALIDADO EN VIVO 2026-07-16 (todo el ciclo en un día) — bitácora §8,
> validación §9 (CFDI folio 9, $1,548, draft emitted+ligado; 5 follow-ups).** Decisiones del
> usuario: card de confirmación LIGERA para crear el borrador (§5.1) y migración aplicada a
> prod con aprobación explícita. Creado 2026-07-16 a partir de
> la idea del usuario tras cerrar F2b: *"el agente arrastra el total de la cita, pero el
> doctor también cobra insumos o quirófano; que el agente LLENE la factura con todos los
> datos en /dashboard/facturacion para que el usuario la revise y apruebe, y quizá se guarde
> como borrador en el expediente del paciente"*. Este doc desarrolla esa idea contra el
> código real.

---

## 1. El problema, dicho con precisión

**Corrección importante primero:** `propose_create_cfdi` YA acepta hasta 10 conceptos con
clave/flags propios por item (F2b §4) — el modelo *puede* proponer consulta + insumos +
quirófano en una card. Lo que NO funciona bien hoy para el caso compuesto:

1. **Captura conversacional torpe.** Dictar 4 conceptos con precios, claves y tratamiento de
   IVA por chat es lento y propenso a error; la card es PREVIEW, no editor — cualquier ajuste
   ("ponle 3 gasas, no 2") obliga a re-proponer todo.
2. **La tensión con el money model.** El tool exige un `ledgerEntryId` y el ingreso de la
   cita registró (p. ej.) $900 de la consulta. Si la factura real es consulta $900 + insumos
   $350 + quirófano $2,000 = $3,250, la factura ≠ ingreso: hoy solo hay una ADVERTENCIA de
   discrepancia. El ledger queda subcontando $2,350 de ingreso real — eso es un hueco del
   money model, no del agente (¿el cobro de insumos/quirófano dónde se registró?).
3. **El guardrail anti-subfacturación emergente** (F2b §12) hace que el agente se resista a
   montos ≠ ingreso sin contexto — correcto para abusos, fricción para el caso compuesto
   legítimo.
4. **La revisión de una factura compleja pertenece a un FORM, no a una card de chat**: el
   form de Nueva Factura ya tiene búsqueda de catálogo, toggles de IVA/retención por item,
   hints PF/servicio médico, y validación — re-crear eso en el panel sería duplicar la UI.

## 2. La idea del usuario, convertida en arquitectura: el BORRADOR

El agente deja de ser el EMISOR del caso compuesto y se vuelve el PREPARADOR:

```
Dr: "factúrale a García la consulta de hoy más 2 gasas y el quirófano, $2,000"
 1. Agente: get_billing_status (ingreso, receptor) + search_catalogo_sat (claves de gasas/quirófano)
 2. propose_prepare_factura_borrador → card LIGERA (sin 🧾: NO timbra nada)
 3. Doctor confirma la card → se crea un CfdiDraft en BD
 4. Link directo: /dashboard/facturacion?draft=<id> → la pestaña Nueva Factura se HIDRATA
    del borrador (receptor + N conceptos + flags + forma de pago)
 5. El doctor REVISA/EDITA en el form real (todas las affordances existentes) y presiona
    "Emitir" — el POST existente timbra (con el guard 409 y toda la validación de siempre)
 6. El borrador queda emitted y ligado al CFDI; en el expediente del paciente aparece la
    traza (borradores pendientes y emitidos)
```

**Por qué esta división es correcta (tiers):** crear un borrador es 100% REVERSIBLE (se
descarta sin efecto legal ni notificación) → tier BAJO, card ligera sin la advertencia 🧾.
El timbre — el acto legal — queda donde siempre estuvo: el botón del form, con el doctor
mirando la factura completa. El agente nunca pierde su regla E7 (los impuestos los calcula
el sistema) ni gana superficie de riesgo nueva.

## 3. El sustrato que falta (verificado contra código 2026-07-16)

| Pieza | Hoy | Qué falta |
|---|---|---|
| Prefill del form | Query params `?from=ledger\|booking` — UN concepto/monto, receptor plano (page.tsx:150-162) | Hidratación desde BORRADOR (`?draft=<id>`): N conceptos con clave/unidad/qty/flags — los query params no escalan a esto |
| Persistencia | No existe ningún draft de factura | Tabla nueva `practice_management.cfdi_drafts` |
| Expediente | Muestra CFDIs de plataforma (parcial) | Sección "Borradores de factura" (pendientes/emitidos) con link al form |
| Agente | `propose_create_cfdi` (emisión directa, card 🧾) | `propose_prepare_factura_borrador` (tier bajo) |

**Modelo de datos propuesto — `CfdiDraft`:**
`id` · `doctorId` · `patientId?` (la liga al expediente que pidió el usuario) ·
`ledgerEntryId?` · `receiver` JSONB (o se re-deriva del expediente al hidratar — ver §5.2) ·
`items` JSONB — **guardar FLAGS de negocio, no impuestos calculados**: `{description,
productCode, unitCode, quantity, unitPrice, withIva, withIsrRetention}[]` — el form
recalcula con su fórmula al hidratar (UNA fuente de verdad, la misma disciplina E7 del
builder) · `paymentForm/paymentMethod` · `observations?` · `origin` (`agent`|`user`) ·
`status` (`draft`|`emitted`|`discarded`) · `emittedCfdiId?` · timestamps.

**Endpoints nuevos (apps/api):** `POST /facturacion/drafts` (crear) ·
`GET /facturacion/drafts/[id]` (hidratar — tenancy) · `GET /facturacion/drafts?patientId=`
(lista del expediente) · `PATCH` (marcar emitted/discarded; el POST /cfdi existente marca
emitted+liga al recibir `draftId?` opcional).

## 4. El tool nuevo — `propose_prepare_factura_borrador`

- **Input:** igual que propose_create_cfdi (ledgerEntryId, items con flags, paymentForm/
  Method, observations) — el agente reusa TODO lo aprendido (claves grounded del catálogo,
  defaults médicos, receptor del expediente, PG por RFC genérico).
- **Pre-checks (subconjunto de F2b):** CSD activo (para no preparar lo inemitible) · ingreso
  del doctor sin hasFactura · receptor del expediente (completo o PG). **La discrepancia de
  monto vs ingreso aquí NO es fricción sino lo esperado** — la card la informa como dato
  ("factura $3,250 sobre ingreso registrado de $900 — ver §6") sin exigir justificación: el
  doctor la va a REVISAR en el form de todos modos.
- **Card (tier bajo):** título "Preparar borrador de factura $X · {receptor}", detalle con
  los conceptos, advertencia única: "Esto SOLO crea un borrador — nada se timbra; lo revisas
  y emites tú en Facturación." Al ejecutarse, el resumen incluye el LINK al form.
- **Prompt:** el agente OFRECE el borrador cuando detecta factura compuesta o el doctor pide
  "prepárala/llénala"; la emisión directa por card (F2b) queda para el caso simple
  1-concepto = ingreso. Regla de enrutamiento explícita para no confundir al modelo.

## 5. Decisiones de diseño a discutir (las honestas)

1. **¿Card de confirmación para CREAR el borrador, o escritura autónoma?** Propuesta: card
   ligera igual (consistencia del modelo de confianza: TODA escritura pasa por card), aunque
   el riesgo real es ~cero. Alternativa defendible: autónomo con undo (descartar). **Decidir.**
2. **¿El borrador congela el receptor o lo re-deriva al hidratar?** Propuesta: guardar
   `patientId` y re-derivar datos fiscales AL HIDRATAR (si el paciente completó su RFC entre
   el borrador y la revisión, el form muestra lo fresco). Congelar solo lo que el doctor
   dictó (conceptos/precios).
3. **El hueco del money model (§1.2) — ¿qué pasa con los $2,350 no registrados?** El
   borrador NO lo resuelve; lo hace VISIBLE. Opciones futuras (radar, NO en F2c): (a) al
   emitir con total > ingreso, ofrecer crear el ingreso complementario ("insumos/quirófano
   cita X") ligado al mismo booking; (b) que el agente lo proponga como paso 2 del plan.
   Anotar en `flujo de dinero permutaciones/`.
4. **¿Borradores también para el camino simple (auditoría)?** No en v1 — la card 🧾 directa
   ya funciona validada; no duplicar caminos.
5. **¿El guardrail anti-subfacturación aplica al borrador?** Sí en espíritu pero SUAVE: el
   agente informa la discrepancia sin bloquear (el form + el doctor son la revisión). El
   caso F2b §12 ($10 "de prueba" sobre $900 PARA TIMBRAR YA) sigue rechazándose en
   propose_create_cfdi.
6. **Deep-link y sesión:** el link del resumen (`/dashboard/facturacion?draft=<id>`) abre en
   la MISMA app autenticada — sin token en URL, el GET del draft valida tenancy.

## 6. Secuencia de build propuesta (playbook: sustrato → agente)

1. **PR sustrato:** tabla (MIGRACIÓN, no db push — §7.6) + endpoints (GET deriva receptor
   fresco + estado del ingreso — §7.4/7.5) + hidratación del form (`?draft=` fuerza pestaña
   "nueva", gana sobre ledgerData — §7.3) + sección en expediente. Utilizable SIN agente
   (un doctor podría guardar borradores a mano — valor propio). Smoke read-only de shapes
   vs prod; el form re-usa `calculateTotals` existente.
2. **PR agente:** `propose_prepare_factura_borrador` (pre-check anti-duplicado — §7.2) +
   botón "Abrir borrador" en la card exitosa (§7.1) + enriquecimiento `borradorPendiente` en
   get_billing_status/get_pendientes_factura (§7.2) + regla de enrutamiento en prompt +
   evals (~6: compuesta-feliz, enruta-simple-vs-compuesta, discrepancia-informada,
   receptor-incompleto→sigue siendo formulario fiscal, no-espontáneo, no-duplica-borrador).
3. **Validación en vivo:** dr-prueba — borrador compuesto (consulta+insumos con clave del
   catálogo real) → editar en form → emitir → verificar draft emitted + CFDI ligado +
   expediente lo muestra.

## 7. Huecos encontrados en el RE-CHEQUEO (2026-07-16, contra código) — ya incorporados

1. **🔴 El link del borrador NO sería clickeable en el panel.** `renderInline`
   (AgendaAgentPanel.tsx:49-57) solo renderiza `**bold**` — una URL en el `resultado` de la
   card sale como TEXTO plano. **Fix de diseño:** el executor devuelve `draftId` en el
   resultado y la card de `prepare_factura_borrador` exitosa renderiza un BOTÓN "Abrir
   borrador →" (`router.push('/dashboard/facturacion?draft=<id>')`) — no un link en prosa.
2. **🔴 El agente queda CIEGO a los borradores existentes.** Tras preparar uno, si el doctor
   pregunta "¿a quién le falta factura?" o "¿cómo va la cita X?", el agente lo re-ofrecería
   desde cero (o prepararía un DUPLICADO). **Fix:** enriquecer `get_billing_status` y
   `get_pendientes_factura` con `borradorPendiente` (id+total+fecha) cuando exista un draft
   `status='draft'` para el entry/paciente, y el pre-check del tool nuevo rechaza duplicar
   ("ya hay un borrador — ábrelo o descártalo").
3. **La hidratación debe replicar el switch de pestaña**: el form abre en "config"/"facturas"
   y solo `ledgerData` fuerza "nueva" (page.tsx:195-199) — `?draft=` necesita el mismo efecto,
   y DESPLAZA a `ledgerData` si vinieran ambos (draft gana: es el dato más rico).
4. **El receptor lo deriva el SERVER al hidratar, no el form**: `GET /drafts/[id]` devuelve
   el receptor YA derivado del expediente fresco (mismas reglas fiscalCompleteness + la
   normalización PG de la receta de la UI) + el estado del ingreso. Si el form aplicara su
   propia lógica de PG-al-teclear sobre datos hidratados, habría dos caminos de normalización.
5. **Borrador viejo vs realidad**: al hidratar, el GET reporta si el ingreso YA tiene factura
   (hasFactura) o el receptor dejó de estar completo — el form lo muestra ANTES del submit
   (el 409 del endpoint es la red, no la primera línea). Y si el CFDI se emite con EDICIONES
   sobre el borrador, el draft igual queda `emitted` + ligado — es punto de partida, no
   contrato.
6. **Migración**: tabla nueva en `practice_management` vía MIGRACIÓN, nunca `prisma db push`
   (⚠️ memoria del proyecto: db push REVIERTE el composite FK que vive en prod).
7. **Los evals NO ejecutan executors** (solo registran propuestas server-side) — el camino
   card→POST /drafts→hidratación solo se prueba EN VIVO; presupuestarlo en la validación.

Considerado y rechazado: `sessionStorage` como handoff (patrón del voice-hub) — no persiste,
no llega al expediente, muere entre dispositivos; el draft en BD es lo que pidió el usuario y
lo correcto. · `ledgerEntryId` OPCIONAL: v1 lo exige (sin ingreso no hay borrador; la regla de
DOS TURNOS de F2b aplica igual — completar la cita primero).

## 8. Bitácora del build — 2026-07-16 (mismo día del diseño)

**Sustrato:** `CfdiDraft` en schema.prisma + migración `create-cfdi-drafts.sql` **APLICADA A
PROD y verificada** (13 columnas, 4 índices, 0 filas — patrón agent_tool_errors/enum-MP;
aprobación explícita del usuario tras revisar riesgos: aditiva/idempotente/reversible-vacía).
Endpoints: `POST/GET /facturacion/drafts` (POST: tenencia+ingreso+hasFactura+anti-dup 409),
`GET/PATCH /drafts/[id]` (GET deriva receptor FRESCO server-side — helper
`deriveReceiverFromPatient` en `lib/cfdi-drafts.ts` con la MISMA receta PG — y reporta estado
del ingreso; PATCH solo discard). `POST /cfdi` acepta `draftId` y cierra el draft al timbrar
(updateMany no-fatal). Form: `?draft=` fuerza pestaña nueva, gana sobre ledgerData, monta el
form SOLO tras cargar el draft (los initializers corren una vez), banner de contexto con las
advertencias de §7.5. Expediente: `CfdiDraftsBlock` en Citas-e-Ingresos (abrir/descartar,
solo pendientes).

**Agente:** `propose_prepare_factura_borrador` (card ligera SIN 🧾) con pre-checks
compartidos — refactor: `resolveEmisionContext` + `parseConcepts` extraídos de
proposeCreateCfdi, UNA fuente para ambos proposals — + anti-dup + mapa de forma de pago
draft-friendly (semántica del form: tarjeta→04, deposito→03 — la ambigüedad es aceptable
porque el doctor revisa). Executor: POST /drafts + **`accion` en la card** ("Abrir borrador
→", botón real — §7.1; AgendaProposal ganó el campo opcional). Reads: `borradorPendiente` en
get_billing_status (batched en fetchVerdictData) y `borradoresPendientes` por paciente en
get_pendientes_factura (§7.2). Prompt: capacidad 9 + regla de ENRUTAMIENTO
(simple⇒create_cfdi, compuesta/revisar⇒borrador, discrepancia normal en borrador,
borradorPendiente⇒no duplicar).

**⚠️ Realidad de datos post-F2b:** el timbre en vivo (folio 8) dejó a dr-prueba SIN ingresos
listos sin factura → el camino FELIZ del borrador (y el de emisión) quedaron data-blocked en
evals. Re-apuntados: `f2b-emision-pg-feliz`→`f2b-ya-facturada-no-reemite`,
`f2b-ppd-solo-explicito` (soft, narración honesta), y los f2c validan enrutamiento + gate de
receptor (test 7/Prueba1, ambos sin datos fiscales). Suite 60→62. **La validación EN VIVO de
F2c necesita PRIMERO datos frescos:** completar una cita de prueba (ingreso nuevo) con
expediente completo o PG.

**Gates:** prisma generate + tsc api/doctor limpios · evals afectados 7/9 PASS + 2 soft-WARN
investigados (ambos = conducta CORRECTA sobre datos rotos: honestidad ante premisa stale, y
el gate de receptor aplicado DESDE la lectura sin gastar el tool call) · **suite completa
60/62 PASS + 2 soft-WARN documentados + 0 FAIL** (la corrida estrella:
`f2c-enruta-compuesta` ejercitó la cadena completa — find_patient → billing_status → 3×
search_catalogo_sat → propose_prepare_factura_borrador → gate de receptor → narración).

**Code review INLINE pre-commit (modo B de `../GENERAL AGENTES/05-METODO`, mismo día):**
clasificación automática = review obligatorio (lógica replicada: la derivación de
receptor/PG ganó una TERCERA copia). Ángulos corridos: contrato cross-file campo-por-campo
(proposal→POST /drafts→validateDraftItems; GET→DraftPrefill→form; POST /cfdi draftId) —
LIMPIO, el endpoint RE-valida todo (la propuesta es UX, el endpoint es la garantía) ·
carreras card→click (lección F2b §4): anti-dup + hasFactura en propuesta Y en POST /drafts,
banner de staleness al hidratar, 409 como red final — LIMPIO · comportamiento-eliminado: el
refactor resolveEmisionContext preserva orden y textos EXACTOS — LIMPIO. **3 hallazgos
cleanup, ACEPTADOS conscientes:** (1) derivación receptor/PG en 3 copias (form UI, módulo
agente, api lib — cross-app no importa directo; candidato a packages/ compartido, radar;
comentarios cruzados en las 3), (2) mapa forma-de-pago duplicado del form (deliberado:
el borrador tolera ambigüedad; comentado), (3) cobertura eval del camino feliz de emisión
muerta por datos (folio 8) — notas de restauración en los evals. Cero CONFIRMED de
correctness. Caveat de siempre: mismo autor; pase multi-agente independiente OPCIONAL en
sesión fresca para el stack F2b+F2c.

## 9. Validación EN VIVO — 2026-07-16/17 (madrugada), F2c CERRADO ✅

Flujo completo con datos REALES sembrados en la misma conversación (dr-prueba, panel):

1. **Dos-turnos orgánico:** "prepara la factura de Gerardo" sin ingreso → el agente detectó
   los 2 expedientes duplicados, explicó que sin ingreso no hay factura, y propuso el camino:
   crear cita (card 🔴, ejecutada) → completar con efectivo (card, ejecutada, ingreso 1598).
2. **Enrutamiento compuesta:** 3 conceptos + total ≠ ingreso → eligió BORRADOR explícito
   ("no lo timbro directo"). Claves grounded: buscó el catálogo, honesto con "gasas" (sin
   match literal → 42311500 vendas) y 42312400 curación. Flags correctos: consulta exenta,
   insumos +IVA, sin retención (receptor PF).
3. **Card ligera al spec:** receptor real, conceptos con claves, "total $1,548 vs ingreso
   $1,200 — difiere, el doctor lo revisa en el form" (informativo, sin fricción), PUE·01,
   advertencia única sin 🧾. Confirmada → borrador #1 → botón "Abrir borrador" → form
   hidratado con los 3 conceptos.
4. **El form como capa de revisión REAL (la tesis del diseño, probada 2 veces):**
   (a) el usuario corrigió uso CFDI D01→G03 (el expediente traía D01×626, combinación que
   el PAC rechaza); (b) primer Emitir RECHAZADO por el SAT — "DomicilioFiscalReceptor no
   inscrito" (CP del expediente ≠ constancia; la causa #1 de la KB §5 confirmada en vivo);
   el draft quedó `draft` (no marcado en falso), el usuario corrigió el CP y el retry timbró.
5. **Verificación read-only vs prod:** draft #1 `emitted` + `emitted_cfdi_id 9` · CFDI
   folio 9, UUID `7da0adb1-1fec-4e04-b549-89781f243a92`, receptor LOFG910521283, uso G03
   (la EDICIÓN del doctor sobre el borrador — punto de partida, no contrato), subtotal
   $1,500 + IVA $48 − $0 = **$1,548 EXACTO al estimado de la card**, ligado a 1598 ·
   entry 1598 `hasFactura=true` · pendientes de vuelta a 2 (Prueba1 + test 7).

**Follow-ups nacidos de la validación (pendientes, en orden de valor):**
1. **UI para editar datos fiscales del paciente** — hoy NO existe camino directo en el
   expediente (solo el formulario fiscal por link); el usuario lo pidió explícito.
2. **Claves visibles/editables en el form de Nueva Factura** — los conceptos hidratados
   traen productCode pero el form no lo muestra ni deja editarlo (el usuario lo señaló).
3. **Warning D01×régimen-incompatible en el pre-check del borrador** (el agente SABE la
   regla en prosa; aplicarla al derivar el receptor).
4. **CP-vs-constancia**: el error del SAT es críptico — hint amigable en el form y/o
   reconsiderar `validar/rfc` opcional (costo: 1 folio) antes de emitir.
5. Radar money-model (§5.3): el ingreso quedó en $1,200 y la factura en $1,548 — los $348
   de insumos+IVA no existen en el ledger; ofrecer ingreso complementario al emitir.

## 10. Qué NO cambia

Regla E7 (impuestos server-side/form) · receptor solo del expediente · guard 409 de doble
emisión (el form emite por el mismo POST) · cancelación fuera · PPD solo explícito · el
camino simple F2b (card 🧾) queda intacto y validado.

---

*Relacionado: `08-PLAN-F2b-emision.md` (la base: builder, PG, guard 409, guardrail
anti-subfacturación §12), `06-KNOWLEDGE-BASE` §3 (fórmula del form), `02-FLUJO-SISTEMA`
(grafo ingreso↔factura), `../GENERAL AGENTES/02-CAPACIDADES` (matriz — actualizar al
construir). Idea original del usuario 2026-07-16; desarrollado contra código el mismo día.*
