# Permutaciones por flujo de UI — qué pasa al hacer cada acción

> **Qué es esto.** El catálogo de **todas las acciones que el doctor puede hacer en la UI** y, para
> cada una, sus **ramas/permutaciones** y el **estado resultante** del `LedgerEntry`. Es el corte
> *"por flujo de UI"* (complementa a [`01`](01-permutaciones-de-prueba.md), que está organizado por
> *origen* del entry). Si quieres saber "si hago clic en X, ¿qué puede pasar?", este es el doc.
>
> Convenciones: 🧾 = `hasFactura` · 🏦 = `hasComprobante` · estados de pago `PENDING`/`PARTIAL`/`PAID`.
> Verificado contra el código a jun 2026 — los nombres de archivo/función pueden desfasarse; verificar.

---

## Índice de superficies de UI

| # | Superficie | Crea/cambia |
|---|---|---|
| A | **Completar cita** (agenda) | nace entry `origin=cita` |
| B | **Nuevo Movimiento** (Flujo de Dinero) | nace entry `origin=manual` |
| C | **Ventas / Compras** (módulos) | nace entry `origin=venta`/`compra` |
| D | **Pago en línea** (Stripe/MercadoPago webhook) | nace/enriquece `origin=webhook_pago` |
| E | **Emitir CFDI** (Facturación) | adjunta 🧾 (o nace standalone) |
| F | **SAT-descarga** (Registrar / Registrar pendientes / Reiniciar / auto-sync) | nace/enriquece `sat_*` |
| G | **Conciliación Bancaria — subir estado de cuenta** | crea `BankStatement`+`BankMovement`, auto-match |
| H | **Conciliación Bancaria — acciones por movimiento** | confirm / vincular / Varios / crear / ignorar / deshacer |
| I | **Conciliación Bancaria — borrar estado de cuenta** | revierte todo lo que el estado tocó |
| J | **Flujo de Dinero — tabla** | editar, borrar, fusionar, vincular/desvincular CFDI, adjuntos, filtro de mes |

---

## A. Completar cita

**Trigger:** marcar una cita como completada en la agenda (`useBookings.ts`).

| Rama | Condición | Resultado |
|---|---|---|
| A1 | forma=efectivo, sin factura | entry `cita`, PAID, 🧾✗ 🏦✗ (*techo*: no concilia, no habrá CFDI) |
| A2 | paciente con RFC en expediente | entry con `counterpartyRfc` denormalizado → alimenta match CFDI (Motor 2) |
| A3 | paciente sin RFC | entry sin RFC → match CFDI cae a nombre+monto+fecha |
| A4 | re-completar / completar dos veces | **NO** duplica (`bookingId @unique`) |

> Idempotencia dura por `bookingId @unique`. Mapea a INC-A1..A9.

---

## B. Nuevo Movimiento (captura manual)

**Trigger:** botón **"Nuevo Movimiento"** → formulario (`flujo-de-dinero/new`). **No** es lo mismo que
"Registrar pendientes" (eso registra una *factura* del SAT).

| Rama | Condición | Resultado |
|---|---|---|
| B1 | ingreso/egreso, Estado=Cobrado/Realizado | PAID, amountPaid=amount |
| B2 | Estado=Por Cobrar/Por Pagar | **PENDING**, amountPaid=0 |
| B3 | con Servicio del catálogo | `serviceId`/`serviceName` set, auto-fill monto/área |
| B4 | sin contraparte capturada | `counterpartyRfc/Name` = null (columna Paciente/Proveedor vacía) |
| B5 | monto ±1% y fecha ±3 días de otro entry similar | **409 warning** con `potentialDuplicates`; reenviar con `force:true` para crear |

> El guard de duplicado (B5) **no** aplica a `origin=cita`/`webhook_pago`. Mapea a INC-B1..B7, EXP-I1/I3.

---

## C. Ventas / Compras

**Trigger:** crear venta/compra en sus módulos.

| Rama | Resultado |
|---|---|
| C1 venta cobrada | entry `origin=venta`, `saleId`, PAID |
| C2 venta con abono parcial | **PARTIAL**, amountPaid < amount (sigue el estado de la venta) |
| C3 compra | entry `origin=compra`, `transactionType=COMPRA`, `purchaseId` |

---

## D. Pago en línea (webhook Stripe/MercadoPago)

**Trigger:** el proveedor de pago confirma → webhook (`createPaymentLedgerEntry`, `practice-utils.ts`).

| Rama | Condición | Resultado |
|---|---|---|
| D1 | sin entry para ese `bookingId` | nace `origin=webhook_pago`, PAID, 🏦✓ auto (`hasComprobante=true`) |
| D2 | ya existe entry para el `bookingId` | **omite** (`return null`) — idempotente, pero ⚠️ **no** marca PAID la cita "por cobrar" (gap conocido) |
| D3 | payout bancario real es lote agregado | NO concilia 1:1 → excluido de KPIs de conciliación |

---

## E. Emitir CFDI (Facturación)

**Trigger:** emitir factura (`POST /facturacion/cfdi`). ⚠️ **No tocar este endpoint a ciegas** (ruta
fiscal/legal, va a prod sin pruebas; ver `SESSION-REFRESCO`).

| Rama | Condición | Resultado |
|---|---|---|
| E1 | con `ledgerEntryId` | adjunta 🧾 al entry (`hasFactura=true`) |
| E2 | sin ancla (`ledgerEntryId` opcional) | **CFDI huérfano** (gap: standalone, `03 §8`) |
| E3 | emisión PUE vs PPD | hoy la emisión solo pone `hasFactura`; **no** estampa `satCfdiUuid` (gap 1, `03 §10`) → riesgo de duplicado cuando el SAT lo descargue |

> Cuando el SAT descargue esa factura propia, el match es por Motor 2 (probabilístico). Ver `02`.

---

## F. SAT-descarga

**Trigger por botón:**

| Botón / evento | Endpoint | Alcance | Comportamiento |
|---|---|---|---|
| **Registrar pendientes** (bulk) | `POST /backfill-ledger` → `autoRegisterCfdisToLedger` | TODOS los CFDIs Vigentes sin vincular | auto-vincula ≥0.67, vincula+review 0.50–0.66, crea <0.50; **enriquece** entries `sat_*` viejos (concepto/forma/contraparte); **reconcilia PPD** (Parte B) |
| **Registrar** (por fila) | `POST /register-to-ledger` | el CFDI elegido | si hay candidato fuerte muestra **sugerencia** (no auto-vincula); si no, crea |
| **Auto-sync ON** (cron) | `sat-sync-worker` | solo CFDIs **nuevos** del job (acotado a `syncJobId`); el XML reconcilia/enriquece sin filtro | no re-registra un movimiento borrado de un sync viejo |
| **Reiniciar** | `DELETE /backfill` | TODO el SAT | borra metadata/detail/pago/alert/syncJob y re-descarga. **No** toca el ledger. ⚠️ nuclear |

**Permutaciones de registro (auto):**

| Rama | Condición | Resultado |
|---|---|---|
| F1 | CFDI recibido (efecto I) sin entry previo | crea `sat_recibido`, egreso, **PENDING**, 🧾✓, auto-crea `Proveedor`, contraparte denormalizada |
| F2 | CFDI emitido PUE sin entry previo | crea `sat_emitido`, ingreso, **PAID** |
| F3 | CFDI **emitido PPD** | nace **PENDING** (`resolvePaymentStatus`, Parte A) — no PAID |
| F4 | CFDI con cita/manual previa que coincide | **vincula** (no duplica) — dedup match-before-create |
| F5 | complemento (tipo P) de un PPD descargado | `reconcilePpdToLedger` mueve el entry a PARTIAL/PAID por `saldoInsoluto` (upgrade-only) |
| F6 | CFDI Cancelado | **no** se registra (solo Vigente) |
| F7 | nota de crédito recibida (efecto E) | `resolveEntryType` la trata como **ingreso** (reembolso) |
| F8 | registrar primero (ledger vacío) y luego crear la cita | **duplicado** (no hay reverse matching) → usar Fusionar (J) |

> "Registro" (columna del panel SAT) es **estado derivado**: existe un `LedgerEntry` con ese
> `satCfdiUuid`. Borrar el movimiento lo regresa a "Registrar" (ver `STEP-BY-STEP §1`).

---

## G. Conciliación Bancaria — subir estado de cuenta

**Trigger:** **Subir Estado de Cuenta** (modal). Acepta **CSV** (parseo directo por banco) o **PDF**
(extracción con GPT-4o → tabla editable). Pide banco, número de cuenta, mes/año.

| Rama | Condición | Resultado |
|---|---|---|
| G1 | banco soportado + cuenta + periodo | crea `BankStatement` + N `BankMovement`; corre **auto-match** + categorización |
| G2 | mismo banco/cuenta/periodo ya existe | **409** (dedup a nivel statement) |
| G3 | movimiento con match (monto+fecha) | `matched_auto` con confianza (0.99 ref / 0.85 mismo día / 0.70 ±2d / ≤0.65 ±7d+concepto) — **sugerencia, NO enriquece aún** |
| G4 | `card_fee` ≤4% | el depósito neto de comisión hace match 1:1 (×0.9) |
| G5 | movimiento sin match | `unmatched` + categoría sugerida (reglas aprendidas) |
| G6 | mismo banco/cuenta/periodo con cuenta distinta | NO 409 (la unicidad incluye la cuenta) → puede duplicar el mismo retiro real en otro statement (EXP-L3) |

> ⚠️ **Clave:** subir el estado de cuenta **no** marca nada como pagado. El auto-match deja
> `matched_auto` (sugerencia). La **enrichment** del entry (🏦, PAID) ocurre **solo al confirmar** (H).

---

## H. Conciliación Bancaria — acciones por movimiento

**Trigger:** `PATCH .../movements/[movId]` con `action`. Estas son las ramas más ricas del sistema.

| Acción | Qué hace | Estado resultante | Reversible? |
|---|---|---|---|
| **`confirm_match`** | confirma la sugerencia auto | movimiento `matched_confirmed`; entry → 🏦✓, **PAID** si no lo estaba (no pisa marca manual ni PPD) | ✅ `unmatch` restaura |
| **`link_existing`** (Vincular a existente) | enlaza 1:1 a un entry que tú eliges | igual que confirm | ✅ |
| **`link_settlement`** (Varios) | N:1 — varios entries contra **un depósito o un retiro** | cada entry → 🏦✓ PAID. **Depósito:** la diferencia es comisión → opcional **egreso `comision`** (≤8%). **Retiro:** la suma debe **cuadrar exacto** (sin comisión; si no, se doble-contaría gasto). | ✅ `unlink_settlement` |
| **`create_entry`** (Crear nueva) | el movimiento **nace** como entry | `origin=banco`, PAID, 🏦✓ 🧾✗ | ✅ `unmatch` **borra** el entry si prístino |
| **`ignore`** | marca el movimiento como ignorado | `ignored`, sin tocar ledger | — |
| **`update_category`** | cambia categoría sugerida | solo metadata del movimiento | — |
| **`unmatch`** | deshace un match 1:1 | movimiento→`unmatched`; **restaura** el estado previo del entry, o **borra** el entry nacido del banco si prístino | (es el undo) |
| **`unlink_settlement`** | deshace un "Varios" | restaura cada entry; **borra** el egreso `comision` si prístino | (es el undo) |

**Rechazos (negativos):**

| Rama | Resultado |
|---|---|
| H-neg1 | vincular un movimiento ya vinculado, o un entry ya conciliado → **409** |
| H-neg2 | conciliar depósito↔egreso (tipo cruzado) → no empareja (`movementTypeMatchesEntryType`) |
| H-neg3 | liquidación con comisión >8% → **rechazo** |
| H-neg4 | liquidación: **depósito** > suma → rechazo; **retiro** ≠ suma exacta (sobrante) → rechazo |
| H-neg5 | `comision` egreso → **excluido** del pool de match (no es candidato) |

### ⚠️ Reversibilidad (snapshot-restore) — el detalle importante

Al **enriquecer** (confirm/link/settlement) se guarda un **snapshot** del estado previo del entry en
`bankMovement.matchHistory`. Al **deshacer** se **restaura** ese snapshot (lógica compartida en
`lib/bank-reversibility.ts`, `revertEntryEffects`). Implicaciones:

- Un entry **manual marcado PAID** que luego concilias a banco y luego deshaces → **sigue PAID**
  (el snapshot capturó tu marca; solo se quita el 🏦). Solo se revierte a PENDING lo que el *match*
  cambió.
- Un PPD ya probado por complemento → sigue PAID (o lo re-afirma el reconcile).
- Un entry **nacido del banco** (`create_entry`/`comision`) → se **borra** al deshacer, salvo que ya
  le hayas puesto factura/CFDI/adjunto (entonces se conserva, solo se desvincula).

Mapea a INC-F1..F14, EXP-K1..K4. **EXP-F13** = este comportamiento de reversibilidad (✅ validado en
vivo jun 2026: confirm→PAID/🏦, unmatch→PENDING/🏦✗, factura conservada).

> **"Varios" en retiros (egresos) — habilitado jun 2026.** El backend siempre soportó settlement de
> egresos, pero la UI ocultaba el botón "Varios" salvo en depósitos (gate `movementType==='deposit'`).
> Ya aparece en retiros: paga **varias facturas de proveedor con un solo retiro**. Regla: en retiros
> la suma seleccionada debe **cuadrar exacto** (no hay comisión que absorba diferencia). El panel es
> un **modal** acotado al viewport.

---

## I. Conciliación Bancaria — borrar estado de cuenta

**Trigger:** **`DELETE .../conciliacion-bancaria/[id]`** (botón eliminar en la lista de estados).

| Aspecto | Comportamiento (jun 2026) |
|---|---|
| Statement + movimientos + settlement items | borrados (cascade) |
| Entries **pre-existentes** (cita/manual/sat_*) que el statement enriqueció | **sobreviven**, pero **restaurados** a su estado previo a la conciliación (p.ej. PAID→PENDING, se quita 🏦) |
| Entries **manual-PAID** conciliados | **siguen PAID** (snapshot), solo se quita el 🏦 |
| Entries **nacidos del banco** (`origin=banco`/`comision`) prístinos | **borrados** (solo existían por esa línea bancaria) |
| Entries nacidos del banco con factura/adjunto | **conservados** (solo se desvinculan) |

> Antes era un cascade crudo que dejaba entries **stale/huérfanos**. Ahora **revierte cada movimiento
> `matched_confirmed`** (vía `revertEntryEffects`) antes del cascade → borrar un estado de cuenta =
> hacer `unmatch` a todo lo que tocó. Solo procesa los `matched_confirmed` (los `matched_auto`/
> `unmatched`/`ignored` nunca tocaron el ledger).

---

## J. Flujo de Dinero — tabla (Movimientos)

| Acción | Qué hace | Notas |
|---|---|---|
| **Editar área/subárea** | inline | PATCH `area`/`subarea` |
| **Editar forma de pago** | inline | PATCH `formaDePago` |
| **Editar monto pagado** | inline | recalcula `paymentStatus` (0→PENDING, <total→PARTIAL, =total→PAID); refresca balance |
| **Borrar movimiento** | DELETE entry | cascade a adjuntos/facturas/xml/settlement; pone null los links de `bankMovement`/`cfdiEmitted`. **No** toca facturas SAT. Un `sat_*` borrado vuelve a "Registrar" en el panel SAT |
| **Fusionar (Merge)** | une 2 entries duplicados | transfiere evidencia upgrade-only (🧾/🏦/paymentStatus), re-vincula relaciones, borra el origen (INC-G3) |
| **Vincular CFDI** (popover) | adjunta un CFDI del SAT a un entry | 🧾✓, `satCfdiUuid` set; 409 si el UUID ya está en otro entry (`@unique`) |
| **Desvincular CFDI** | quita el CFDI | limpia `satCfdiUuid`/review/confianza; `hasFactura→false` **salvo** que haya PDF subido |
| **Subir comprobante** (adjunto) | sube archivo | `LedgerAttachment`; **fuerza `hasComprobante=true`** (⚠️ evidencia ≠ conciliación bancaria) |
| **Subir factura PDF** | sube PDF | `LedgerFactura`, 🧾✓ (sin XML) |
| **Subir factura XML** | sube XML | `LedgerFacturaXml` parseado, 🧾✓ |
| **Ver evidencia bancaria** (icono **Receipt**, 🏦) | abre el modal "Evidencia" | muestra **de qué estado de cuenta** vino la conciliación (banco · cuenta · periodo · movimiento · referencia; nota "Varios" para settlements) **+** los adjuntos `LedgerAttachment`. Carga **lazy** vía `GET /ledger/[id]/evidence`. Empty state amable para webhook/manual |
| **Ver factura** (icono **FileCheck2**, 🧾) | abre el modal "Factura" | muestra **toda la evidencia fiscal en un solo lugar**: detalle del **CFDI** vinculado (si hay) + **Desvincular**, **y** links "Abrir" de las **facturas subidas** (`LedgerFactura` PDF, `LedgerFacturaXml` subido). Ver §"Íconos de evidencia" abajo |
| **Filtro de mes** (`MonthNavigator`) | acota tabla **y** cards | default = mes actual; ◄ ► / month picker / "Todos"; las cards Balance/Ingresos/Egresos reflejan el período |

### Íconos de evidencia en la fila — qué abre cada uno (jul 2026)

Tres íconos, dos ejes de evidencia + una acción. **Regla:** lo **fiscal** (🧾) va en el ícono de
factura; lo del **dinero/pago** (🏦) va en el ícono Receipt; el pill ámbar es la única **acción**.

| Ícono | Eje | Abre | Assets que muestra / adjunta | Visible cuando |
|---|---|---|---|---|
| **Receipt** (parece recibo) | 🏦 banco / comprobante | modal "Evidencia" | referencia del **estado de cuenta** conciliado (banco · cuenta · periodo · movimiento · referencia; "Varios" en settlements) **+** comprobantes `LedgerAttachment` | `hasComprobante` |
| **FileCheck2** (factura) | 🧾 fiscal | modal "Factura" | **CFDI** SAT vinculado (metadata · desglose · conceptos · Desvincular) **+** facturas subidas: PDF (`LedgerFactura`) y XML subido (`LedgerFacturaXml`), con "Abrir" | `hasFactura` |
| **"CFDI"** (pill ámbar) | 🧾 (acción) | popover de sugerencias | **vincula** un CFDI del SAT al entry (no es visor) | sin CFDI (`!satCfdiUuid`) |

**Entradas de subida** (detalle del movimiento, `LedgerAttachmentsSection`): "Subir Archivo" →
`LedgerAttachment` (🏦, Receipt); "Factura PDF" → `LedgerFactura` (🧾, factura); "Factura XML" →
`LedgerFacturaXml` (🧾, factura).

> **Fix jul 2026 (`71acbe34`):** el ícono de factura antes era **CFDI-o-PDF (excluyente)** → un entry con
> **CFDI y PDF** perdía acceso al PDF al vincular el CFDI. Ahora el modal "Factura" muestra **ambos**.
> El botón **Desvincular** solo aparece si hay CFDI vinculado (un entry solo-PDF no puede disparar
> `DELETE link-cfdi`). El XML **derivado** de vincular un CFDI (URL vacía) **no** se lista como archivo
> subido — su contenido ya se ve como detalle del CFDI. `CfdiDetailModal` recibe el `entry` completo
> (no solo el `uuid`) y omite el fetch a SAT cuando no hay CFDI.

---

## Matriz: ¿qué acción produce/cambia cada evidencia?

| | 🧾 fiscal (factura) | 🏦 bancaria (conciliación) | paymentStatus |
|---|---|---|---|
| **La pone** | emitir CFDI (E), registrar SAT (F), vincular CFDI / subir PDF·XML (J) | confirm/link/settlement/create banco (H), subir comprobante (J, débil), webhook (D) | confirm banco (H), webhook (D), editar monto (J), reconcile PPD (F5) |
| **La quita** | desvincular CFDI (J), borrar entry (J) | `unmatch`/`unlink`/borrar statement (H/I), borrar entry (J) | `unmatch`/borrar statement restauran el previo (H/I) |

---

*Estado:* catálogo por flujo de UI, jun 2026. Verificado contra el código. Complementa a
[`01`](01-permutaciones-de-prueba.md) (por origen) y [`00`](00-modelo-consolidado.md) (modelo/motores).
Reversibilidad bancaria: `lib/bank-reversibility.ts`. Resultados de pruebas: [`STEP-BY-STEP-TESTING.md`](STEP-BY-STEP-TESTING.md).
