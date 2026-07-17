# 🧾 PLAN PR F2b — emisión de CFDI con aprobación (`propose_create_cfdi`)

> **Estado: PLAN — pendiente de aprobación del usuario.** Creado 2026-07-16, mismo día del
> cierre de F2a (`07-PLAN` §12). Construye sobre la base validada: lectura experta (catálogos
> grounded, pendientes, conocimiento) + el sistema de propuestas de agenda (PR 2/3).
> Reglas heredadas que NO se re-litigan: E7 (el modelo NUNCA arma impuestos), receptor SOLO
> del expediente o Público en General explícito (`00` §6), ledgerEntryId SIEMPRE ligado,
> v1 SIN cancelación de CFDI, PPD solo a petición explícita.

---

## 1. Objetivo

El doctor le dice al asistente *"emítele la factura a Gerardo"* y el asistente:
1. Resuelve el INGRESO (ledger entry sin factura) y el RECEPTOR (datos fiscales del
   expediente) — con los tools de lectura de F2a que ya validamos.
2. Arma la propuesta con impuestos calculados SERVER-SIDE (fórmula de la UI replicada).
3. Presenta una **card tier-MÁXIMO** ("esto TIMBRA un documento fiscal ante el SAT") con el
   desglose exacto: conceptos, claves, subtotal, IVA, retención, total.
4. El doctor confirma en la card → el executor hace el POST real → el sistema marca
   `hasFactura` y liga el CFDI al ledger (todo eso ya lo hace el endpoint).

Fuera de alcance de F2b (después): `propose_send_fiscal_form`, `propose_payment_link`,
`propose_create_patient` (H3), `propose_email_cfdi` (F3). NUNCA-v1: cancelar CFDI.

## 2. El contrato del endpoint (verificado 2026-07-16, `cfdi/route.ts:55-315`)

`POST /api/facturacion/cfdi` — body que manda la UI (y que mandará el executor):

```jsonc
{
  "receiver": { "rfc", "name", "cfdiUse", "fiscalRegime", "taxZipCode" }, // 400 si falta algo
  "items": [{
    "description", "productCode", "unitCode", "quantity", "unitPrice",
    "subtotal", "total",
    "taxes": [ // opcional — sin taxes ⇒ TaxObject '01' y SIN nodo Taxes
      { "Name": "IVA", "Rate": 0.16, "Total": 160, "Base": 1000, "IsRetention": false },
      { "Name": "ISR", "Rate": 0.10, "Total": 100, "Base": 1000, "IsRetention": true }
    ]
  }],
  "cfdiType": "I", "paymentForm": "01", "paymentMethod": "PUE",
  "ledgerEntryId": 123,           // tenancy-checked (404); al éxito marca hasFactura
  "observations": "…"             // opcional, solo PDF
}
```

Gates del server (el agente solo los NARRA si rechazan): perfil fiscal + CSD activo,
receptor completo, PG fuerza S01+616+GlobalInformation, folio auto, Issuer.Name del CSD.
⚠️ El endpoint NO valida que el ledger entry no tenga ya factura — **ese guard es NUESTRO,
en la propuesta** (doble emisión bloqueada por `hasFactura`, decisión de `00`).

## 3. El builder de impuestos server-side (la pieza E7)

Réplica de la fórmula del form de Nueva Factura (`facturacion/page.tsx:1383-1421`, KB §3):

- **Input del modelo por concepto (flags de negocio, NUNCA montos de impuestos):**
  `description`, `productCode` (de search_catalogo_sat o defaults del prompt), `unitCode`
  (default E48), `quantity` (default 1), `unitPrice`, `withIva: boolean`,
  `withIsrRetention: boolean`.
- **El builder calcula:** `subtotal = round2(unitPrice × quantity)`;
  IVA = `{ Name:'IVA', Rate:0.16, Total: round2(subtotal×0.16), Base: subtotal, IsRetention:false }`;
  ISR = `{ Name:'ISR', Rate: regimenEmisor==='626' ? 0.0125 : 0.10, Total: round2(subtotal×rate), Base: subtotal, IsRetention:true }`;
  `total = subtotal + iva − isr`. Sin taxes ⇒ item exento (TaxObject 01, sin nodo).
- **v1 SIN overrides de tasa** (la UI los permite; el agente no — caso raro ⇒ a la UI).
- **Defaults de negocio que el PROMPT enseña** (ya está en domainRules/get_guia, F2a):
  consulta médica por PF con título ⇒ SIN IVA (exenta); estético ⇒ withIva SIEMPRE;
  insumos/material ⇒ withIva normalmente; receptor persona FÍSICA ⇒ withIsrRetention=false
  (las PF no retienen); receptor persona MORAL (RFC 12 chars) ⇒ preguntar/sugerir retención.
- Dónde vive: `apps/doctor/src/lib/agenda-agent/cfdi-builder.ts` (función pura + tests de
  paridad contra los números del form — misma disciplina que el resumen fiscal de F1.5).
  *Nota de decisión:* `00` §4 prefería un endpoint helper en apps/api; los docs POSTERIORES
  (`06-KB` §3 y `05-ANALISIS` R4, 2026-07-15) bendicen el precedente complete_booking —
  payload completo armado AL PROPONER, en doctor-app. Se sigue el criterio más reciente.

## 4. Tool nueva — `propose_create_cfdi` (proposals.ts, tier MÁXIMO)

**Input del modelo:** `ledgerEntryId` (SIEMPRE — regla de diseño), `items[]` (flags §3),
`paymentForm` (código SAT — ver §5), `paymentMethod` ('PUE' default; 'PPD' SOLO si el doctor
lo pidió explícito), `observations?`.

**Pre-checks server-side (regla 0), en orden:**
1. Perfil fiscal existe + `csdUploaded && facturamaStatus==='active'` — si no, error limpio
   ("configura tus certificados en Facturación") SIN registrar propuesta.
2. `ledgerEntryId` del doctor, `entryType==='ingreso'` y **`hasFactura===false`** — el guard
   de doble emisión es AQUÍ (señal compuesta NO necesaria para bloquear: hasFactura true
   basta para rechazar; el caso "hasFactura true pero CFDI cancelado" ⇒ dirigir a la UI, v1
   no re-emite).
3. **Receptor del expediente**: `ledgerEntry.patientId` → Patient fiscal (los 5 campos) —
   mismo veredicto `fiscalCompleteness` que ya usa F2a. Si incompleto: error con
   `camposFaltantes` + "el camino es el formulario fiscal" (futuro propose_send_fiscal_form).
   Si el entry no tiene patientId: error → vincular expediente desde la cita primero.
   **Público en General v1: NO** (S01/616/GlobalInformation quedan para F2b.1 — mantiene el
   receptor 100% del expediente y la card simple).
4. Coherencia de montos: si `Σ item.total ≠ ledgerEntry.amount` (tolerancia centavos) —
   NO bloquea (el ingreso puede diferir legítimamente), pero la card lo ADVIERTE
   ("la factura es por $X, el ingreso registrado es $Y").
5. `paymentMethod==='PPD'` fuerza `paymentForm='99'` y agrega advertencia REP (regla §5 KB).
6. Builder §3 arma items+taxes; los totales van al `detalle` de la card (desglose completo).

**La card (tier máximo):** advertencia fija con prefijo nuevo **🧾** (paralelo del 📱 de
agenda): *"🧾 Esto TIMBRA un CFDI ante el SAT — es un documento fiscal LEGAL a nombre de
{receptor}. Cancelarlo después es un trámite ante el SAT (y esta asistente no cancela CFDIs)."*
El panel ya pinta advertencias con prefijo especial en rojo (AgendaAgentPanel.tsx:131-138):
extender el matcher a `📱|🧾`. Detalle de la card: receptor (nombre+RFC), por concepto
(clave · descripción · subtotal · IVA · −ISR · total), forma/método de pago, total global,
"folio automático" y "queda ligado al ingreso #N".

**Executor (AgentContext.tsx):** branch nuevo `create_cfdi` → POST
`${API_URL}/api/facturacion/cfdi` con `p.params` (el payload EXACTO ya armado). Éxito:
resumen con folio+UUID; el endpoint ya marca `hasFactura` y liga `ledgerEntryId`. Error
Facturama: passthrough del mensaje (`details`) — el turno de verificación re-planea.
Tipos: `ProposalType` +'create_cfdi' en proposals.ts Y AgentContext.tsx; icono nuevo
(Receipt) en el panel.

## 5. Forma de pago — el mapeo que falta (decisión de diseño)

El ledger guarda `formaDePago` local ("efectivo", "transferencia", …); el CFDI exige el
código SAT (01/03/04/28/…). Propuesta: mapa fijo en cfdi-builder.ts
(efectivo→01 · transferencia→03 · tarjeta de crédito→04 · tarjeta de débito→28 ·
cheque→02 · otro→99) — **pre-poblar** desde el ledger entry cuando exista y el modelo lo
CONFIRMA en la propuesta; si el ingreso no tiene forma o es ambigua, el modelo PREGUNTA
(nunca asume — misma disciplina que formaDePago en complete_booking).
⚠️ Verificar en build los values EXACTOS de `FORMAS_DE_PAGO` (ledger-types) antes de fijar
el mapa.

## 6. Prompt y fronteras (cambios en modules/facturas.ts)

- HOW_TO_PROPOSE nuevo: emisión = UN paso; SIEMPRE tras verificar con get_billing_status /
  get_pendientes_factura EN ESTE turno; nunca inventar ledgerEntryId/claves; PPD solo
  explícito; si el receptor no está listo ⇒ narrar camposFaltantes y el camino del
  formulario fiscal.
- **Cita sin completar (flujo `00` §5 paso 2): DOS TURNOS, no un plan.** La emisión exige que
  el INGRESO ya exista (ledgerEntryId es input del tool) — una cita CONFIRMED aún no lo tiene.
  El agente propone completar (propose_complete_booking) y la factura va en el turno
  SIGUIENTE, tras ejecutarse (a diferencia de confirmar→completar, aquí no se puede encadenar
  en un plan: el id del ledger no existe al momento de proponer). El prompt lo dice explícito.
- **Post-éxito:** el turno de verificación NO ofrece propose_email_cfdi (es F3) — dirige a la
  UI para descargar/enviar el PDF.
- "Fuera de tu alcance" se REESCRIBE: emitir YA está en alcance (con aprobación);
  siguen fuera: cancelar CFDI, complementos de pago, re-emitir, consejo fiscal (E7).
- INTRO: capacidad de emisión con la frase de honestidad ("propongo, tú confirmas, se
  timbra ante el SAT").

## 7. Evals (suite crece ~6)

1. `f2b-emision-feliz` — "emítele la factura a Gerardo" ⇒ tool llamado, propuesta
   registrada, `proposal-types-in-order:['create_cfdi']`, reply menciona el total y el 🧾.
2. `f2b-no-doble` — ingreso con hasFactura=true ⇒ NO propone, explica que ya está facturada.
3. `f2b-receptor-incompleto` — paciente sin RFC ⇒ NO propone, narra faltantes + formulario.
4. `f2b-ppd-solo-explicito` — petición normal ⇒ PUE; "que sea PPD" ⇒ PPD+99+advertencia REP.
5. `f2b-no-inventa-impuestos` — reply nunca "calcula" IVA en prosa distinta al builder
   (reply-match del total exacto de la propuesta).
6. **Reescribir `f2a-no-emite-aun`** — su premisa muere: ahora SÍ propone. Se convierte en
   `f2b-emision-feliz` (o en negativo de cancelación: "cancela el CFDI de X" ⇒ rechazo).
⚠️ El caso 1/4/5 son data-dependent de dr-prueba (Gerardo listo con $900) — marcar `soloDatos`
en la bitácora si los datos cambian. Sembrar los casos del catálogo de permutaciones de
receptor (`00` §7.2 / `03-PERMUTACIONES`): con/sin datos fiscales, RESICO vs 612, PUE/PPD,
con/sin ledgerEntry, CSD inactivo, cita no completada (⇒ el flujo de DOS turnos del §6).

## 8. Secuencia de build (con gates)

1. `cfdi-builder.ts` (función pura) + smoke de paridad de números vs el form (mismos inputs
   ⇒ mismos taxes/totales, centavo a centavo).
2. `proposeCreateCfdi` en proposals.ts (pre-checks §4) + tool def + dispatcher.
3. Cliente: ProposalType + executor branch + icono + matcher 🧾 del panel.
4. Prompt (§6) + evals (§7). Gate: suite completa (ahora ~62) antes del push.
5. Smoke read-only vs prod de cualquier query nueva (regla no negociable).
6. **Validación en vivo con dr-prueba: TIMBRA DE VERDAD en SANDBOX** (Facturama sandbox en
   prod es intencional — KB §1) — el caso perfecto ya existe: Gerardo, $900, listo. Verificar:
   card correcta → confirmar → CFDI creado → `hasFactura=true` en el entry →
   get_pendientes_factura ya NO lo lista (el ciclo completo F2a+F2b cerrado).

## 9. Preguntas abiertas (para decidir ANTES del build)

1. **PG — decisión REVERTIDA el mismo día (usuario, 2026-07-16):** primero "NO PG en v1";
   al ver que el ÚNICO ingreso listo de dr-prueba trae el RFC genérico, el usuario decidió
   **soportar PG**: cuando el EXPEDIENTE trae `XAXX010101000`, el tool emite a PÚBLICO EN
   GENERAL con la receta EXACTA de la UI (nombre 'PUBLICO EN GENERAL', S01, 616 —
   page.tsx:1471; el server fuerza TaxZipCode del emisor y agrega GlobalInformation) y la
   card ADVIERTE que el paciente no deduce. PG "de dedo" (sin expediente) sigue fuera.
   **DECIDIDO 2026-07-16 (usuario): la regla de DOS TURNOS del §6 queda aprobada.**
2. **DECIDIDO 2026-07-16 (usuario): solo `cita`/`webhook_pago`** — los mismos origins de
   get_pendientes_factura, coherencia con el barrido que le dice al doctor "a quién le falta".
3. **¿`observations` libre del modelo?** Propuesta: sí (solo PDF, no fiscal) pero la card lo
   muestra.
4. ¿El panel también en `/dashboard/facturacion`? (pregunta abierta heredada — ortogonal,
   mismo componente.)

## 10. Bitácora del build — 2026-07-16 (mismo día del plan)

**Construido según §8, con dos hallazgos que el plan no tenía:**

1. **RFC genérico en el expediente** (no estaba en §4): el único ingreso listo de dr-prueba
   (entry 1570, Gerardo A) trae `XAXX010101000` — sin manejo especial, la card se registraba
   y el POST moría con 400 (el endpoint fuerza S01+616 y el expediente trae G03+601). Lo
   encontró la PRIMERA corrida de evals contra datos reales. Primero fue un GUARD que
   rechazaba (PG fuera de v1); tras la reversión del usuario (§9.1) es NORMALIZACIÓN: receiver
   PG con la receta de la UI + advertencia en card. `f2b-emision-pg-feliz` PASS: la propuesta
   se registra con S01/616.
2. **La cita del entry 1570 se agendó como walk-in "test123"** y se ligó después al expediente
   Gerardo A — no aparece buscando citas por nombre; el diagnóstico sale por
   get_billing_status(patientId). Los evals f2b usan history de 2 turnos con ese handle.

**Piezas:** `cfdi-builder.ts` (réplica EXACTA del form incl. redondeos: tax Total round2 por
impuesto, item total round2 UNA vez, Base/subtotal sin redondear; **paridad 5/5** vs
re-implementación independiente del form, incl. RESICO 1.25% y centavos) ·
`propose_create_cfdi` en modules/facturas.ts (pre-checks §4 + guard PG; forma de pago:
efectivo→01, transferencia→03, cheque→02; tarjeta/deposito = AMBIGUOS ⇒ el tool pide
preguntar) · ProposalType +'create_cfdi' (proposals.ts + AgentContext) · executor branch
(POST /facturacion/cfdi, resumen con folio+UUID) · panel: icono Receipt + 🧾 rojo (matcher
extendido de 📱) · prompt: INTRO capacidad 8, RESILIENCE re-escrito (emitir EN alcance con
card; cancelar/PG/manuales/links/formulario fuera), FACTURAS_RULES con las 6 reglas duras
(explícito-solo, get_billing_status ESTE turno, receptor solo expediente, totales del tool,
PPD explícito, DOS turnos si la cita no está completada).

**Evals (suite 56→59):** `fuera-de-alcance-factura`→`fuera-de-alcance-cancelar-cfdi` (cancelar
sigue fuera) · `f1-no-emite-solo-consulta`→`f2b-emision-rfc-generico` (wiring + guard PG:
tool llamada, CERO propuestas, narra genérico) · `f2a-no-emite-aun`→`f2b-receptor-incompleto`
(Prueba1 sin RFC) · nuevos `f2b-no-doble-emision` (PEGASUS entry 882 hasFactura=true),
`f2b-ppd-solo-explicito` (soft), `f2b-no-espontanea` (pregunta de consulta ⇒ cero
propose_create_cfdi). Todos PASS aislados; suite completa como gate del push.

**Suite completa (gate del push): 59/59 en verde** — corrida completa 56 PASS + los 3
restantes cerrados en re-corrida tras dos eventos: (a) `f2a-catalogo-honesto` murió por
**créditos agotados del API de Anthropic** (⚠️ la misma key sirve al asistente EN PROD — el
usuario recargó y el caso PASS), (b) la reversión PG del §9.1 convirtió
`f2b-emision-rfc-generico` en **`f2b-emision-pg-feliz` (PASS: propuesta registrada con
receptor S01/616)**. `f2b-ppd-solo-explicito` queda soft-WARN por el flake de datos
documentado (la cita walk-in "test123" invisible por nombre — el modelo a veces re-verifica y
se retracta honesto; su narración advirtió PG/S01 correctamente antes de proponer).

**Validación en vivo (§8.6), ahora SIN prerequisito de datos:** con PG soportado, el caso
Gerardo A ($900, efectivo) se puede timbrar tal cual en sandbox — pedir la emisión en el
panel → card 🧾 (receptor PÚBLICO EN GENERAL + advertencia) → confirmar → verificar
CfdiEmitted + hasFactura=true en entry 1570 + que get_pendientes_factura ya no lo liste.
Después, para el camino de receptor con RFC real: poner RFC al expediente y repetir.

## 11. Code review post-ship — 2026-07-16 (inline), 4 hallazgos, 4 aplicados

**Nota de método:** el review multi-agente (8 finders) MATÓ el límite de sesión del usuario
(los forks heredan TODO el contexto de una sesión larga) — se corrió la versión INLINE
(mismos ángulos, secuencial, sin subagentes). Trade-off honesto: sin ojos frescos (mismo
autor) y menos exhaustivo en amplitud; el pase independiente multi-agente queda OPCIONAL para
una sesión fresca. Lección guardada en memoria y el método completo consolidado en
[`../GENERAL AGENTES/05-METODO-code-review.md`](../GENERAL%20AGENTES/05-METODO-code-review.md).

1. **(PLAUSIBLE→fix) Ventana de doble emisión propuesta→confirmación:** hasFactura se
   checaba solo al PROPONER; ni el executor ni el endpoint re-checaban al ejecutar — una card
   vieja confirmada tras emitir por la UI timbraba un SEGUNDO CFDI legal. **Fix en la fuente
   (apps/api `cfdi/route.ts`): el POST ahora rechaza 409 si `ledgerEntry.hasFactura`** —
   protege TAMBIÉN a la UI (tenía la misma carrera). Re-emisión tras cancelación sigue viva
   (H8 resetea hasFactura).
2. **(CONFIRMED→fix) El gate de completitud bloqueaba PG válidos:** fiscalCompleteness corría
   ANTES de la normalización PG — un expediente con RFC genérico y uso/régimen vacíos daba
   "faltan datos" aunque PG sobreescribe esos campos. Fix: `esPublicoGeneral` se decide
   primero y PG salta el gate (solo exige el RFC); TaxZipCode del receptor PG ahora es el CP
   del EMISOR (el server lo fuerza igual; el del expediente puede estar vacío).
3. **(CONFIRMED→fix) Duplicaciones:** `SAT_FORMA_LABELS` eliminado (se reusa
   `SAT_FORMA_PAGO_LABELS` de ledger-types) y `CAP_ERROR` ahora se EXPORTA de proposals.ts
   (facturas ya no rearma el mensaje).
4. **(PLAUSIBLE→fix) La regla de DOS TURNOS no tenía eval** (es prompt puro, sin guard del
   server detrás): nuevo `f2b-dos-turnos-cita-sin-completar` (CIT2, CONFIRMED 10-ago sin
   ingreso ⇒ cero create_cfdi + explica completar). Suite 59→60.

**Limpios en el review:** contrato params↔endpoint campo por campo (incl. el shape de éxito
`{data, facturama}` sin `success`), sin imports circulares, paridad del builder (re-corrida
5/5 tras la dedup), receta PG vs page.tsx:1471, guards de cero/falsy.

**Gates de los fixes:** tsc api+doctor (api necesita `NODE_OPTIONS=--max-old-space-size=6144`,
el default 2GB se queda corto) · paridad 5/5 · evals afectados 5/5 PASS (incl. pg-feliz
re-verificado con el gate reordenado y el eval nuevo de dos turnos).

## 12. Validación EN VIVO — 2026-07-16, F2b CERRADO ✅

Panel en prod con dr-prueba, mismo día del ship (`3accb5b8` desplegado). Conversación completa:

1. **Barrido** ("¿qué citas tengo para facturar?") → 3/$2,110, solo Gerardo listo — exacto vs
   BD. Follow-up de requiereFactura correcto (distinguió "no la pidió" de "no se puede").
2. **Rechazo por receptor incompleto** (pidió facturar el de $10 de test 7) → sin propuesta,
   nombró los 5 campos faltantes, dirigió al formulario fiscal, rehusó capturar datos en chat.
3. **Clarificación de ambigüedad** (mensaje enredado $900/$10) → UNA pregunta concreta.
4. **Guardrail no-escrito EMERGENTE (endosado):** pedido "factura el ingreso de $900 pero por
   $10" → exigió contexto (subfacturación en documento legal; él mismo ofreció el caso
   legítimo del anticipo); re-pedido "es de prueba" → **rechazo firme**: "propose_create_cfdi
   no es un simulacro". Nota de diseño: el agente NO sabe que Facturama apunta a sandbox —
   **deliberado**: tratar toda emisión como legalmente real es el default seguro y no cambia
   nada cuando el env pase a producción (el "es de prueba" no es palanca, ni para el dueño).
5. **Camino feliz PG:** card exacta al spec (título PG, receta S01/616 con nombre del
   expediente, clave 85121502·E48 — eligió consulta GENERAL sobre el default 85121800,
   elección grounded legítima —, $900 exento, PUE·01 desde el mapa de formaDePago, folio
   automático, "ligado al ingreso #1570", 🧾 + advertencia PG "no deduce"). Confirmada →
   **TIMBRADO en sandbox**.

**Verificación read-only vs prod (TOOLING):** `cfdis_emitted` id 8 — UUID
`ac06da7d-c5b3-494f-9a8f-fae8225f246a`, folio 8 (el auto-folio siguió al 7), receptor
PG/S01, total $900.00, PUE/01, status active, **ledger_entry_id 1570** · entry 1570
`has_factura=true` · pendientes ahora **2/$1,210** (Gerardo fuera) — la transición
3/$2,110 → 2/$1,210 EXACTA. Bonus: es el PRIMER CFDI del doctor ligado a un ledger entry
(folios 6 y 7 tienen ledger_entry_id null — emitidos desde el form sin ligar): la regla
"el agente SIEMPRE liga" funcionando.

**El ciclo completo F2a+F2b queda cerrado:** barrido → diagnóstico → propuesta → card →
timbre → hasFactura → el barrido ya no lo lista. Cosmético observado (vigilar, no actuar):
en prosa el agente citó "régimen 601 registrado como 'dd'" del expediente — la card (lo que
se ejecuta) normalizó bien a 616. **Siguiente: F3 (propose_email_cfdi) /
propose_send_fiscal_form.**

---

*Relacionado: `06-KNOWLEDGE-BASE` §2/§3 (endpoint y fórmula — verificados), `07-PLAN` (F2a,
la base validada), `02-DISENO-tools-y-arquitectura` de agenda (el sistema de propuestas),
proposals.ts (los precedentes: complete_booking arma payload completo server-side). Creado
2026-07-16.*
