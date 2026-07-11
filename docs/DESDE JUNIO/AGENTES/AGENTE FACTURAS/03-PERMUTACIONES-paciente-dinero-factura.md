# Permutaciones: paciente × pago × factura × expediente

> **Qué es esto.** El catálogo de permutaciones del ciclo de vida paciente↔dinero↔factura —
> el equivalente de [`../AGENTE AGENDA/04-PERMUTACIONES-agenda.md`](../AGENTE%20AGENDA/04-PERMUTACIONES-agenda.md)
> para este dominio. Para cada permutación: qué filas nacen en qué tablas, **qué ve el
> expediente** (la fuente única de verdad del paciente), y qué hueco se activa. Verificado
> contra el código 2026-07-10; los huecos H1–H5 vienen de
> [`02-FLUJO-SISTEMA`](02-FLUJO-SISTEMA-cita-paciente-factura-pago.md) §5, los H6–H9 son
> nuevos de esta pasada. Los checkboxes se marcan al validar en vivo (método TOOLING,
> dr-prueba).

---

## 0. Las dimensiones que se permutan

| Dimensión | Valores |
|---|---|
| **E — Expediente** | E1 existente antes de la cita · E2 creado nuevo (alta manual en `/medical-records/patients/new`) · E3 vinculado **post-hoc** ("Buscar paciente" en la card, después de la cita/pago) · E4 nunca (walk-in puro) |
| **M — Pago** | M1 manual al completar (efectivo/transferencia/tarjeta física — el modal de completar pide precio+forma) · M2 link de Stripe · M3 link de Mercado Pago · M4 sin pago registrado |
| **F — Factura** | F0 no requiere · F1 requiere + datos fiscales completos · F2 requiere + SIN datos (→ formulario fiscal) · F3 Público en General · F4 emitida FUERA de la plataforma (SAT Descarga) · F5 cancelada (+ posible re-emisión) |
| **O — Orden** | pago antes/después de completar la cita · factura PUE (tras el pago) vs PPD (antes, con REP después) |

**Hechos del código que gobiernan todo el catálogo:**
- `completeBooking` SIEMPRE crea el ingreso como `PAID` con la forma que el doctor eligió
  (`useBookings.ts:205` — no existe "completada pero no pagada" por ese camino).
- El webhook de link pagado crea el ingreso **al momento del pago** (`origin:'webhook_pago'`,
  idempotente por `bookingId` — `practice-utils.ts:102`), SIN `patientId`/`counterpartyRfc` (H1).
- El expediente muestra **solo** citas con `patientId` (walk-ins invisibles), y su columna
  financiera/CFDI viene del JOIN `Booking → LedgerEntry → CfdiEmitted(status:'active')`
  (`/api/medical-records/patients/[id]/bookings`).
- El formulario fiscal EXIGE `patientId` (`fiscal-form-link/route.ts:27`) y rechaza si el
  paciente ya tiene rfc+requiereFactura.
- ⚠️ **H10 (descubierto 2026-07-10):** los links de pago HOY nacen SIEMPRE sueltos. La única
  UI de creación es `/dashboard/pagos` (StripeSection/MercadoPagoSection: solo monto +
  descripción). El endpoint de Stripe SÍ acepta `bookingId` (lo valida + un link activo por
  cita, `stripe/payment-links/route.ts:63-84`) pero **ninguna UI se lo manda**; el de MP
  (`mercadopago/preferences`) **ni siquiera acepta `bookingId`** — la columna
  `mp_payment_preferences.booking_id` existe y el webhook la lee, pero nada la escribe.
  Consecuencia: todo ingreso `webhook_pago` real es HUÉRFANO (sin booking, sin paciente, sin
  RFC). Las permutaciones A4/A5/ORD-1/ORD-2 con link LIGADO solo son alcanzables por API
  directa (Stripe) o imposibles (MP).
- Emitir CFDI liga `ledgerEntryId` + `hasFactura:true` (`facturacion/cfdi/route.ts:287`);
  **cancelar NO lo revierte** (H8).
- Vincular paciente post-hoc NO toca el ledger entry ya creado (H7).

---

## 1. Bloque A — paciente NUEVO (los 4 casos del usuario)

- [ ] **PERM-A1 · Nuevo + efectivo + sin factura** (E2·M1·F0) — *el camino feliz mínimo.*
  Alta del expediente → cita vinculada → completar (precio+forma) →
  filas: `patients` ✓ · `bookings.patient_id` ✓ · `ledger_entries` (`origin:'cita'`, PAID,
  patientId + counterpartyName; RFC null si el expediente no lo tiene) · `hasFactura:false`.
  **Expediente ve:** cita + monto + forma de pago + "Sin factura". Flujo de Dinero ve el ingreso.
  ✅ Todo conectado, cero huecos.

- [ ] **PERM-A2 · Nuevo + efectivo + CON factura, datos completos** (E2·M1·F1).
  Como A1 + los 5 campos fiscales en el expediente (`requiereFactura:true`) → emitir desde el
  expediente (pre-fill → `/dashboard/facturacion?from=booking&ledgerId=…`) o desde la tabla de
  citas → `cfdis_emitted.ledgerEntryId` + `hasFactura:true`.
  **Expediente ve:** cita + monto + "CFDI emitida · Folio X" + descargar PDF/XML.
  ✅ El único camino 100% redondo hoy. *Es el flujo que el asistente debe saber narrar y
  (fase 2) orquestar.*

- [ ] **PERM-A3 · Nuevo + efectivo + factura, SIN datos fiscales** (E2·M1·F2).
  Como A1 → el doctor pide facturar → no hay RFC → `POST fiscal-form-link` (exige expediente ✓)
  → el paciente llena el formulario → Patient queda con datos + `requiereFactura:true` → sigue
  como A2. **Pista para el asistente:** `requiereFactura=false` + sin RFC ≠ "no quiere factura"
  — puede ser "aún no capturado"; la señal fuerte es el flag + la conversación.

- [x] **PERM-A4 · Nuevo + link Stripe/MP + sin factura** (E2·M2/M3·F0). ✅ **VALIDADA EN VIVO
  2026-07-11** (variante E3: cita "test 7", link MP ligado, pagado $10 → ledger `webhook_pago`
  con `bookingId`; expediente vinculado post-hoc → ver C3/H7; completar → ver ORD-1/H2). Los
  fixes de `04` eliminaron los huecos que esta permutación activaba.
  ⚠️ **H10 primero:** hoy la UI solo crea links SUELTOS — este flujo "como debería ser" (link
  ligado a la cita) no es alcanzable desde la UI. Como debería funcionar: cita vinculada →
  link con `bookingId` → paciente paga → webhook: `PaymentLinkStatus:PAID` + ledger
  `origin:'webhook_pago'` (PAID, `hasComprobante:true`). ⚠️ **H1**: el entry nace SIN
  patientId/RFC aunque la cita tenga expediente. **Expediente ve:** la cita y (via
  booking→ledger) el monto — se salva por el JOIN por bookingId, no por patientId.
  Luego el doctor completa la cita → PATCH ok, POST ledger → **409 P2002** → toast de error
  engañoso. ⚠️ **H2** (y el pre-check del agente PR 3 tampoco lo detecta).

- [ ] **PERM-A4b · Link SUELTO pagado (la realidad actual con H10)** (E*·M2/M3).
  El doctor crea el link en `/dashboard/pagos` (monto+descripción, sin cita) → pagado →
  ledger `webhook_pago` HUÉRFANO: sin bookingId, sin patientId, sin RFC. **Expediente ve:
  NADA. La cita ve NADA** (sigue "sin cobrar"). Solo Flujo de Dinero lo muestra, desconectado.
  Si además el doctor completa la cita → **ingreso DUPLICADO** (el entry `cita` se crea normal
  porque el huérfano no tiene el bookingId que dispararía la idempotencia). *El peor caso del
  catálogo y es el ÚNICO alcanzable hoy con links.*

- [ ] **PERM-A5 · Nuevo + link Stripe/MP + CON factura** (E2·M2/M3·F1/F2).
  Como A4 + emitir: el flujo del expediente usa `booking.ledgerEntryId` → liga el entry del
  webhook ✓ (funciona). Con datos → A2; sin datos → A3. Los huecos de A4 aplican igual.
  Nota PUE: forma de pago real = tarjeta/transferencia del link, no lo que diga el modal.

## 2. Bloque B — paciente EXISTENTE (E1)

- [ ] **PERM-B1 · Existente, cualquier M×F.** Idéntico al bloque A menos el alta. Diferencia
  operativa: `requiereFactura` y los datos fiscales YA se conocen → el asistente puede
  anticipar ("García siempre pide factura — ¿la emito?"). La cita puede nacer vinculada
  (agente PR 3: `find_patient → propose_create_booking con patientId`) o vincularse post-hoc.

## 3. Bloque C — WALK-IN (E4 / E3)

- [ ] **PERM-C1 · Walk-in puro + efectivo + sin factura** (E4·M1·F0).
  `bookings.patient_id NULL` → completar → ledger `origin:'cita'` con `patientId:null`,
  `counterpartyName` = nombre suelto de la cita.
  **Expediente:** NO EXISTE — la cita y su ingreso viven solo en agenda y Flujo de Dinero.
  *Por diseño; el asistente debe saber que "historial del paciente" ≠ "todas las citas con ese
  nombre".*

- [ ] **PERM-C2 · Walk-in pide factura** (E4·F1/F2).
  **Bloqueado sin expediente**: el formulario fiscal exige `patientId` (⚠️ **H3**). Caminos:
  (a) crear el expediente primero (hoy: manual; fase 2: `propose_create_patient`) → vincular →
  A3; (b) **Público en General** (PERM-D1) si el paciente no quiere factura nominativa.

- [x] **PERM-C3 · Walk-in vinculado POST-HOC después de completar/pagar** (E3). ✅ **VALIDADA
  EN VIVO 2026-07-11**: re-vincular el expediente a "test 7" disparó el backfill H7 — entry
  1577 reescrito con `patient_id`, `counterparty_rfc` null (el expediente no tiene RFC) y
  `counterparty_name` fallback al nombre de la cita. (El primer intento NO backfilleó porque
  la vinculación ocurrió 14 min antes del deploy de `cf42c67b` — timing, no bug.)
  Cita completada (ledger con `patientId:null`) → luego "Buscar paciente" escribe
  `bookings.patient_id`. ⚠️ **H7 (nuevo)**: el ledger entry NO se backfillea — queda sin
  patientId/RFC para siempre (el PATCH de vinculación no toca ledger; verificado).
  **Expediente ve:** la cita aparece (JOIN por booking) con su monto ✓ — pero las consultas
  patient-scoped sobre `ledger_entries.patient_id` y el matcher SAT por RFC la ignoran.

## 4. Bloque D — variantes de FACTURA

- [ ] **PERM-D1 · Público en General** (F3). Receptor genérico (reglas S01/616/GlobalInformation
  server-side en el POST ✓). No exige expediente ni datos del paciente. **Expediente ve** el
  CFDI si la cita/ledger están ligados (el receptor dirá PÚBLICO EN GENERAL).

- [ ] **PERM-D2 · PPD explícita** (O: factura antes del pago). `metodoPago:PPD` → el pago llega
  después → complemento REP (`cfdi/rep` en plataforma, o `sat_pagos` si viene por SAT) →
  `sat-ppd-reconcile` actualiza `paymentStatus` del entry por `satCfdiUuid`. v1 del asistente:
  default PUE; PPD solo a petición explícita con advertencia (decisión de `00` §6).

- [ ] **PERM-D3 · Factura emitida FUERA de la plataforma** (F4). El doctor timbra en otro
  sistema → SAT Descarga la baja → `autoRegisterCfdisToLedger` la liga al entry de la cita por
  score RFC/nombre/monto/fecha (≥0.67 auto; 0.50–0.66 needsReview) → `satCfdiUuid` +
  `hasFactura:true`. ⚠️ **H6 (nuevo)**: el expediente SOLO muestra `cfdis_emitted` (Facturama)
  — una factura externa matcheada es invisible en el expediente aunque el sistema la conozca.
  Sin RFC en el entry (H1/H7/walk-in) el match se degrada a nombre+monto+fecha.

- [ ] **PERM-D4 · Cancelación de CFDI** (F5). `cfdi/[id]/cancel` (motivo SAT) → `status` deja
  de ser `active` → el expediente vuelve a mostrar "Sin factura" (el JOIN filtra active ✓).
  ⚠️ **H8 (nuevo)**: `hasFactura` del ledger entry NO se revierte → la killer query
  "consultas sin factura" (`hasFactura=false`) se pierde las canceladas-sin-reemitir, y la
  card del asistente diría "ya está facturada". La señal correcta es compuesta:
  `hasFactura ∧ (∃ cfdi active ∨ satCfdiUuid vigente)`.

## 5. Bloque O — permutaciones de ORDEN del dinero

- [x] **ORD-1 · Link pagado ANTES de completar** → webhook crea el entry → completar → 409
  (H2). *El caso más probable en la práctica real (el paciente paga al agendar).*
  ✅ **VALIDADA EN VIVO 2026-07-11** con el fix H2: completar "test 7" tras el pago del link =
  éxito, UN solo ingreso ($10 del link), sin duplicado ni 409 engañoso. Confirmado también:
  `final_price` ($1,000,000 de prueba) NO genera movimiento — el ledger solo registra dinero
  real (diseño correcto).
- [ ] **ORD-2 · Completar ANTES, link pagado DESPUÉS** → el entry `origin:'cita'` ya existe →
  el webhook es idempotente por bookingId y NO duplica ✓ (verificado,
  `practice-utils.ts:108-114`). Matiz: `formaDePago` del entry queda como dijo el doctor al
  completar, no como se pagó realmente el link.
- [ ] **ORD-3 · Link pagado y la cita NUNCA se completa** (paciente pagó y no vino, o el doctor
  no cierra). Ingreso PAID existe + cita CONFIRMED/vencida → la limpieza de vencidas (NO_SHOW)
  deja un ingreso pagado sobre una cita a la que "no asistió". El asistente debe narrar esto,
  no "arreglarlo" solo (¿reembolso? ¿reagendar? decisión del doctor).
- [ ] **ORD-4 · Factura ANTES del pago** = PPD (PERM-D2). PUE antes del pago real es mentira
  fiscal — el asistente nunca la propone (regla de prompt).

---

## 6. El expediente como fuente única de verdad — qué ve HOY vs qué le falta

Lo que la página del expediente (`patients/[id]`) muestra hoy, verificado:

| Historia | ¿La tiene? | Fuente |
|---|---|---|
| Médica (encounters, recetas, notas, media, timeline, historial de cambios) | ✅ completa | tablas clínicas por patientId |
| Datos fiscales + constancia | ✅ | campos de `Patient` |
| **Citas** | ⚠️ solo las vinculadas (`bookings.patient_id`) | endpoint `[id]/bookings` |
| **Pagos** | ⚠️ parcial: monto+forma del ledger entry LIGADO A CITA vinculada; NO muestra status de links de pago (enviado/pagado/pendiente) ni ingresos del paciente sin cita | JOIN booking→ledger |
| **Facturas** | ⚠️ solo CFDIs de plataforma (`cfdis_emitted` active) de citas vinculadas; NO las externas (SAT, H6), NO las de ledger entries sin booking | JOIN ledger→cfdi |

**Consecuencia de diseño para el asistente:** "el expediente es la verdad" es cierto para lo
MÉDICO; para dinero/factura la verdad completa vive en el grafo LedgerEntry (hub) y el
expediente es una **vista parcial**. El tool `get_billing_status` / `get_patient_profile` del
asistente debe leer el grafo completo (booking + ledger + cfdi + sat + links de pago), no
replicar la vista del expediente — y puede DECIR qué le falta a la vista del expediente
("tiene una factura externa del SAT que la página no muestra").

## 7. Huecos consolidados (H1–H9)

| # | Hueco | Permutaciones que lo activan | Severidad para el asistente |
|---|---|---|---|
| H1 | webhook no denormaliza patientId/RFC | A4, A5, ORD-1 | alta — rompe trazabilidad e ingresos por paciente |
| H2 | completar tras webhook → 409 engañoso (UI y pre-check del agente) | A4, A5, ORD-1 | alta — el flujo más común con links |
| H3 | walk-in + factura exige expediente manual | C2 | media — fase 2 `propose_create_patient` |
| H4 | CfdiEmitted sin patientId/bookingId directo | D3 (vista) | baja — opción A transitiva basta v1 |
| H5 | fallback SAT nace 'Vigente' (cancelaciones tardías) | D3, D4 | baja — exponer frescura del sync |
| **H6** | expediente ciego a facturas externas (SAT) | D3 | media — la vista miente para doctores que emiten fuera |
| **H7** | vinculación post-hoc no backfillea el ledger | C3 | media — fix pequeño: backfill al vincular |
| **H8** | cancelar CFDI no revierte `hasFactura` | D4 | media — corrige la definición de "facturada" (señal compuesta) o el endpoint |
| **H9** | el expediente no muestra links de pago ni su status | A4, A5, ORD-3 | baja — feature de UI; el tool del asistente sí lo leerá |
| **H10** | no hay UI para crear un link de pago LIGADO a cita/paciente (Stripe: endpoint-only; MP: el endpoint ni acepta bookingId) → todo ingreso `webhook_pago` real es huérfano y completar la cita lo DUPLICA | A4b — hoy TODOS los links | **alta** — invalida en la práctica el camino M2/M3; sin esto, H1/H2 son teóricos |

**✅ SUSTRATO CERRADO (2026-07-10/11):** H10, H1, H2, H7 y H8 **HECHOS Y DESPLEGADOS** —
registro completo con commits en [`04-FIXES`](04-FIXES-links-de-pago-ligados.md) (incluye
además: link de pago requiere expediente, celda Paciente sin estado muerto — el hueco de las
citas creadas por el agente con `isFirstTime` null). El grafo del ingreso converge a la verdad
sin importar el orden. H9 quedó parcialmente cubierto (el estado del link de pago SÍ se ve ya
en la fila de la cita del expediente). Quedan abiertos: **H3** (crear expediente desde el
asistente — fase 2 `propose_create_patient`), **H4** (opción A transitiva decidida para v1),
**H5** (frescura del sync SAT — el tool la expone), **H6** (expediente ciego a facturas
externas — el tool compensa leyendo el grafo). Nota: `propose_payment_link` se vuelve un tool
natural de la fase 2 — "mándale un link de pago a García por su consulta" es exactamente la
clase de flujo que este asistente debe orquestar.

## 8. Implicación directa para los tools de lectura (PR F1)

1. **`get_billing_status {bookingId|patientId}`** responde la matriz de diagnóstico de `02` §3
   usando **señales compuestas server-side** (regla 0): *pagada* = paymentStatus/link status;
   *facturada* = `hasFactura ∧ (cfdi active ∨ satCfdiUuid)` (por H8); *fuente* = origin.
2. **`get_patient_profile`** reporta el grado de completitud fiscal (los 5 campos + flag) como
   enum server-side: `completo · parcial · vacío · no-requiere` — el modelo nunca decide "le
   falta el CP" contando campos.
3. Todo conteo/agregado del paciente (citas, ingresos, facturas) declara su **alcance**: "de
   las citas VINCULADAS al expediente" (C1/C3 — los walk-ins no cuentan) y "facturas de
   plataforma + externas SAT" (H6).
4. Cada permutación de este catálogo es un candidato a eval (G11-facturas) antes de cualquier
   tool de escritura — mínimo los negativos: C2 (no proponer formulario sin expediente), D4
   (no decir "ya facturada" sobre una cancelada), ORD-3 (no proponer NO_SHOW sin narrar el
   pago), H2 (no doble-crear el ingreso).

---

*Estado: catálogo creado 2026-07-10 (verificado contra código; sin validación en vivo aún —
los checkboxes se marcan con el método TOOLING cuando toque). Relacionado:
[`02-FLUJO-SISTEMA`](02-FLUJO-SISTEMA-cita-paciente-factura-pago.md) (el grafo y la matriz de
diagnóstico), [`00-FACTIBILIDAD`](00-FACTIBILIDAD-Y-ARQUITECTURA.md) §6-7 (tiers y secuencia).*
