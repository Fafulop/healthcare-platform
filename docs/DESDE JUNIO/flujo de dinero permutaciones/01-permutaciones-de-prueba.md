# Permutaciones de prueba — Flujo de Dinero (ingresos y egresos)

> **Qué es esto.** Una lista exhaustiva de **todas las permutaciones posibles** de un movimiento de
> dinero, escrita como **checklist** para probar una por una en la UI. Cada caso tiene: *setup*
> (qué hacer), *resultado esperado* (estado final) y *qué valida*. Marca la casilla cuando el
> comportamiento observado coincide con el esperado.
>
> Acompaña a [`00-modelo-consolidado.md`](00-modelo-consolidado.md). Los umbrales citados son los
> reales del código a junio 2026.

---

## Cómo usar este checklist

1. **Reset previo** (ver `00-modelo-consolidado.md` §9): borra el ledger, **conserva facturas**.
2. **Orden importa** (§9.5): para los casos de *match*, crea la **cita/operación ANTES** del
   backfill de SAT. Para los casos *standalone*, backfill con el ledger vacío.
3. Prueba **un caso a la vez** y verifica el estado final antes de pasar al siguiente.
4. Reset entre bloques que se contaminan (p.ej. después de probar duplicados).

### Leyenda

- 🧾 = `hasFactura` (evidencia fiscal: CFDI/XML vinculado)
- 🏦 = `hasComprobante` (evidencia bancaria: `bankMovement` o `settlementItem`)
- Estado meta = **🧾✓ 🏦✓** (Completo). Combinaciones: `✗✗` solo registrado · `✓✗` facturado sin banco · `✗✓` banco sin factura · `✓✓` completo.
- `paymentStatus` = `PENDING` / `PARTIAL` / `PAID`
- Umbrales clave: CFDI auto-link **≥0.67** silencioso · **0.50–0.66** `needsReview` · **<0.50** crea nuevo. Banco `card_fee` **≤4%** · liquidación comisión **≤8%**.

---

# PARTE 1 — INGRESOS

## Bloque A — Origen `cita` (consulta completada)

- [ ] **INC-A1 · Efectivo, sin factura.** Setup: completar cita, forma=efectivo, sin emitir factura. → Esperado: entry `origin=cita`, PAID, **🧾✗ 🏦✗**. *Techo* (efectivo no concilia, no habrá CFDI). Valida: nacimiento básico de cita.
- [ ] **INC-A2 · Transferencia, sin factura.** Setup: completar cita, forma=transferencia, sin factura. → entry PAID **🧾✗ 🏦✗**. Valida: entry que luego podrá conciliar banco pero nunca tendrá factura.
- [ ] **INC-A3 · Transferencia + factura PUE (camino feliz completo).** Setup: cita con paciente con RFC → emitir/llegar CFDI PUE → subir estado de cuenta con el SPEI mismo monto/fecha. → **🧾✓ 🏦✓** PAID. Valida: match CFDI por RFC (Motor 2) + match banco 1:1 (Motor 3).
- [ ] **INC-A4 · Tarjeta + factura PUE, depósito neto de comisión.** Setup: cita forma=tarjeta $1,000, CFDI PUE, depósito bancario $970 (3% comisión). → match `card_fee` (≤4%), **🧾✓ 🏦✓**. Valida: tolerancia neto-de-comisión en Motor 3.
- [ ] **INC-A5 · Tarjeta, depósito 5% abajo (fuera de tolerancia).** Setup: depósito $950 vs bruto $1,000. → **NO** auto-concilia (>4%). Valida: límite `MAX_CARD_FEE_PCT`.
- [ ] **INC-A6 · Cheque + factura.** Setup: forma=cheque, CFDI, depósito al cobrarse. → **🧾✓ 🏦✓**. Valida: forma de pago 02.
- [ ] **INC-A7 · Walk-in con RFC formal.** Setup: cita sin expediente pero nombre = razón social del CFDI. → match por **nombre+monto+fecha** (~0.75), auto-link silencioso. Valida: caso B de [`05-appointment-rfc-gap`].
- [ ] **INC-A8 · Walk-in nombre informal/parcial.** Setup: cita "Juanito", CFDI a "JUAN PEREZ SA". → match débil (~0.58 `needsReview`) o falla → vincular a mano con popover CFDI. Valida: red de seguridad manual.
- [ ] **INC-A9 · Dos citas idénticas mismo día, una con RFC.** Setup: 2 citas $800 mismo día, paciente A con RFC, paciente B sin. CFDI de A. → debe vincular a **A** (RFC desempata), no a B. Valida: RFC como señal estrella.

## Bloque B — Origen `manual`

- [ ] **INC-B1 · Manual ingreso, Cobrado.** Setup: nuevo movimiento, ingreso, Estado=Cobrado. → PAID **🧾✗ 🏦✗**. Valida: alta manual básica.
- [ ] **INC-B2 · Manual ingreso, Por Cobrar.** Setup: Estado=Por Cobrar. → **PENDING**, amountPaid=0. Valida: estado de cobro manual.
- [ ] **INC-B3 · Manual + subir comprobante.** Setup: B1 → subir comprobante (attachment). → **🏦✓** (subir attachment fuerza `hasComprobante=true`), `LedgerAttachment` creado. Valida: adjuntos manuales. *Nota: esto marca 🏦 sin que exista línea bancaria real — evidencia ≠ conciliación.*
- [ ] **INC-B4 · Manual + subir CFDI XML.** Setup: B1 → subir XML de factura. → **🧾✓** (parseado). Valida: `LedgerFacturaXml` por upload.
- [ ] **INC-B5 · Manual + vincular CFDI desde popover.** Setup: B1 con monto/fecha que matchee un CFDI del SAT → popover "CFDI" → Vincular. → **🧾✓** `satCfdiUuid` set. Valida: Motor 2 camino C (sugerencias por entry).
- [ ] **INC-B6 · Manual con servicio del catálogo.** Setup: seleccionar Servicio en el dropdown. → `serviceId`/`serviceName` set, auto-fill monto/concepto/área. Valida: referencia a servicio.
- [ ] **INC-B7 · Guard de duplicado al crear (POST).** Setup: crear B1, luego crear otro ingreso con monto ±1% y fecha ±3 días. → **409 `warning`** con `potentialDuplicates`, **no** se crea. Reenviar con `force:true` → se crea. Valida: guard preventivo de POST (ver `00` §2). *No aplica a `cita`/`webhook`.*

## Bloque C — Orígenes `venta` y `webhook_pago`

- [ ] **INC-C1 · Venta directa.** Setup: crear venta en módulo Ventas. → entry `origin=venta`, `saleId`, status según cobro. Valida: integración Ventas.
- [ ] **INC-C2 · Venta parcial.** Setup: venta con abono parcial. → **PARTIAL**, amountPaid < amount. Valida: sync de estado de pago de la venta.
- [ ] **INC-C3 · Pago en línea (webhook).** Setup: pago vía pasarela (Stripe/MP). → `origin=webhook_pago`, PAID, **🏦✓ auto** (`hasComprobante=true`). Valida: el webhook es prueba.
- [ ] **INC-C4 · Webhook + payout agregado en banco.** Setup: 1 estado de cuenta con un payout que suma varios pagos menos comisión. → **NO** concilia 1:1; excluido de KPIs de conciliación. Valida: gap de agregación de pasarela (§8.4).

## Bloque D — Facturas SAT emitidas (Motor 2)

- [ ] **INC-D1 · CFDI emitido sin cita previa (standalone).** Setup: ledger vacío → backfill. → crea entry `origin=sat_emitido`, **🧾✓ 🏦✗**, PAID. Valida: camino "crear" (sin match).
- [ ] **INC-D2 · CFDI emitido CON cita previa (dedup).** Setup: crear cita primero → backfill. → **un solo** entry (la cita) con **🧾✓**; NO se crea `sat_emitido` duplicado. Valida: match-before-create.
- [ ] **INC-D3 · Confianza media (needsReview).** Setup: cita sin RFC, mismo monto/fecha que el CFDI (raw ~70 → 0.58). → auto-link + **`needsReview=true`** (badge amarillo + botón desvincular inline). Valida: bucket 0.50–0.66.
- [ ] **INC-D4 · Confianza alta sin review.** Setup: cita con RFC exacto + monto + mismo día (raw 120). → auto-link silencioso, **sin** badge, desvincular solo desde modal. Valida: asimetría de reversibilidad.
- [ ] **INC-D5 · "Registrar pendientes" (manual) sugiere, no vincula.** Setup: seleccionar CFDIs en panel SAT → registrar. → si hay candidato raw≥70 devuelve **sugerencia** (usuario confirma), no auto-vincula. Valida: Motor 2 camino B.
- [ ] **INC-D6 · CFDI emitido PPD (✅ gap #1 resuelto).** Setup: emitir/llegar CFDI con metodoPago=PPD → backfill. → entry nace **PENDING** (`resolvePaymentStatus`, Parte A), no PAID. Valida: PUE/PPD respetado.
- [ ] **INC-D7 · Complemento de pago (tipo P) de un PPD (✅ Parte B).** Setup: tener PPD + su complemento descargado → backfill ("Registrar pendientes"). → `reconcilePpdToLedger` mueve el entry a **PARTIAL/PAID** según `saldoInsoluto` (upgrade-only; complementos cancelados excluidos). Valida: complemento conectado al ledger (§8.1).
- [ ] **INC-D8 · CFDI emitido cancelado.** Setup: CFDI con `satStatus=Cancelado` → backfill. → **NO** se registra (solo Vigente). Valida: filtro de status.

## Bloque E — Origen `banco` (ingreso)

- [ ] **INC-E1 · Depósito sin entry → crear entrada.** Setup: subir estado de cuenta, depósito sin match → "Crear entrada". → entry `origin=banco`, PAID, **🏦✓**, **🧾✗**. Valida: nacimiento desde banco.
- [ ] **INC-E2 · Banco + vincular CFDI después.** Setup: E1 → popover CFDI → vincular. → **🧾✓ 🏦✓**. Valida: completar un entry nacido en banco.
- [ ] **INC-E3 · Crear entrada + guardar regla.** Setup: E1 con `saveRule`. → se crea `BankCategorizationRule`; el siguiente depósito similar se auto-categoriza. Valida: reglas aprendidas.

## Bloque F — Conciliación bancaria (Motor 3) — tipos de match

- [ ] **INC-F1 · Match prioridad 1 (referencia).** Setup: entry con `bankMovementId` = referencia del SPEI, monto exacto, ≤1 día. → confianza **0.99**. Valida: prioridad 1.
- [ ] **INC-F2 · Match mismo día.** Setup: monto exacto, misma fecha, sin referencia. → **0.85**. Valida: prioridad 2.
- [ ] **INC-F3 · Match ±2 días.** Setup: monto exacto, 2 días de diferencia. → **0.70**. Valida: prioridad 3.
- [ ] **INC-F4 · Match ±7 días por concepto.** Setup: monto exacto, 5 días, solape de palabras del concepto ≥30%. → ≤**0.65**. Valida: prioridad 4.
- [ ] **INC-F5 · ⚠️ Mismo monto + mismo nombre, 5 días, sin solape de concepto.** Setup: depósito "SPEI PEGASUS CONTROL $2,150" vs entry "Consulta - PEGASUS CONTROL $2,150" 5 días aparte. → **"Sin match"** (gap: Motor 3 ignora `counterpartyName/Rfc`). Sugerencia manual aparece como **Media**. Valida: **gap §8.2**.
- [ ] **INC-F6 · Liquidación N:1 ("Varios").** Setup: 3 citas $1,000 → un depósito $3,000 una semana después → "Varios" contra las 3. → 3 `BankSettlementItem`, cada entry **🏦✓ PAID**. (Que ningún entry iguale el depósito solo, si no el 1:1 lo toma.) Valida: liquidación agrupada.
- [ ] **INC-F7 · Liquidación con comisión.** Setup: 3 citas suman $3,000, depósito $2,880 (4% comisión), registrar comisión. → settlement OK (≤8%) + egreso `origin=comision`. Valida: comisión implícita.
- [ ] **INC-F8 · Liquidación rechazada por comisión >8%.** Setup: suma $3,000, depósito $2,600 (13%). → **rechazo** "diferencia demasiado grande". Valida: `MAX_SETTLEMENT_FEE_PCT`.
- [ ] **INC-F9 · Liquidación rechazada (depósito > suma).** Setup: suma $2,000, depósito $3,000. → **rechazo** "suma menor al depósito". Valida: validación de monto.
- [ ] **INC-F10 · Confirmar sugerencia.** Setup: movimiento con match sugerido → confirmar. → `matched_confirmed`, entry enriquecido. Valida: `confirm_match`.
- [ ] **INC-F11 · Vincular a entry elegido (1:1).** Setup: movimiento → "vincular existente". → 1:1 `matched_confirmed`. Valida: `link_existing`.
- [ ] **INC-F12 · Ignorar movimiento.** Setup: transferencia interna → ignorar. → `ignored`. Valida: `ignore`.
- [x] **INC-F13 · ✅ Deshacer match SÍ revierte evidencia (fix jun 2026).** Setup: F10 → `unmatch`. → movimiento vuelve a `unmatched` **y** el entry se **restaura** a su estado previo (`hasComprobante`/PAID/`amountPaid`/refs) vía snapshot-restore. Valida: **§7 (resuelto)**. *(Antes: conservaba PAID — asimetría.)*
- [ ] **INC-F14 · Doble vínculo rechazado.** Setup: intentar vincular un movimiento ya vinculado, o un entry ya conciliado. → **409**. Valida: cardinalidad 1:1.

## Bloque G — Orden y duplicados (cross-cutting)

- [ ] **INC-G1 · Backfill ANTES de la cita → DUPLICADO.** Setup: ledger vacío → backfill (crea `sat_emitido`) → luego crear la cita del mismo ingreso. → **2 entries** (no hay reverse matching). Valida: por qué el orden importa (§9.5). *Negativo esperado.*
- [ ] **INC-G2 · Cita ANTES del backfill → 1 entry.** Setup: cita → backfill. → **1 entry**. Valida: el camino correcto.
- [ ] **INC-G3 · Fusionar duplicados.** Setup: partir de G1 → seleccionar los 2 → fusionar (merge). → queda 1 entry consolidado. Valida: `ledger/merge`.

---

# PARTE 2 — EGRESOS

## Bloque H — Facturas SAT recibidas (Motor 2)

- [ ] **EXP-H1 · CFDI recibido sin entry previo (standalone).** Setup: ledger vacío → backfill. → entry `origin=sat_recibido`, `egreso`, **PENDING**, **🧾✓ 🏦✗**, auto-crea `Proveedor` por RFC. Valida: nacimiento de egreso desde factura.
- [ ] **EXP-H2 · CFDI recibido CON compra/manual previa (dedup).** Setup: crear egreso manual del proveedor primero → backfill. → **1 solo** entry con **🧾✓**. Valida: match-before-create egreso.
- [ ] **EXP-H3 · Proveedor reutilizado.** Setup: 2 CFDIs del mismo RFC emisor. → **un solo** `Proveedor`, ambos entries lo referencian. Valida: find-or-create proveedor.
- [ ] **EXP-H4 · CFDI recibido PPD (✅ Parte B, lado egreso).** Setup: factura de proveedor metodoPago=PPD → al pagar, su complemento se descarga → backfill. → entry nace PENDING y `reconcilePpdToLedger` lo mueve a PARTIAL/PAID según `saldoInsoluto`. Valida: el reconcile aplica a egresos igual (match por `satCfdiUuid`).
- [ ] **EXP-H5 · Nota de crédito recibida (efecto E).** Setup: CFDI received + efecto=E. → `resolveEntryType` lo trata como **ingreso** (reembolso a favor del doctor). Valida: mapeo dirección/efecto.

## Bloque I — Origen `manual` (egreso)

- [x] **EXP-I1 · ✅ Gasto en efectivo sin factura.** Setup: manual egreso, efectivo (renta informal). → **🧾✗ 🏦✗**. Techo = documentado. **Validado en vivo** (`EGR-2026-348`, $700, `origin=manual` PAID).
- [ ] **EXP-I2 · Gasto manual + factura PDF.** Setup: I1 → subir PDF de factura. → `LedgerFactura` adjunto, **🧾✓** (por PDF). Valida: factura por upload (sin XML).
- [ ] **EXP-I3 · Gasto manual Por Pagar.** Setup: Estado=Por Pagar. → **PENDING**. Valida: cuenta por pagar.
- [ ] **EXP-I4 · Egreso manual + vincular CFDI recibido.** Setup: I1 → popover CFDI (dirección received) → vincular. → **🧾✓**. Valida: Motor 2 camino C para egresos.

## Bloque J — Origen `banco` y `compra` (egreso)

- [x] **EXP-J1 · ✅ Retiro sin entry → crear entrada.** Setup: estado de cuenta, retiro sin match → "Crear entrada". → `origin=banco`, `egreso`, PAID, **🏦✓ 🧾✗**. **Validado en vivo** (entry 1554 creado; `unmatch` lo borró → reversibilidad de `create_entry`).
- [ ] **EXP-J2 · Comisión bancaria (sin factura).** Setup: J1 sobre una comisión bancaria. → queda **🧾✗** permanentemente (no hay CFDI). Valida: egreso que nunca tendrá factura.
- [ ] **EXP-J3 · Compra desde módulo.** Setup: crear compra. → `origin=compra`, `transactionType=COMPRA`, `purchaseId`. Valida: integración Compras.
- [x] **EXP-J4 · ✅ Retiro = factura recibida (conciliar).** Setup: EXP-H1 (egreso con factura, PENDING) → subir estado de cuenta con el retiro mismo monto → **Confirmar** el match → **🧾✓ 🏦✓ PAID**. **Validado en vivo** (primer egreso en Completo). ⚠️ La enrichment ocurre al **Confirmar**, no en el upload (queda `matched_auto`).

## Bloque K — Conciliación bancaria de egresos (Motor 3)

- [ ] **EXP-K1 · Retiro match 1:1.** Setup: egreso con factura → retiro mismo monto/fecha. → `withdrawal↔egreso`, match. Valida: dirección de tipo.
- [ ] **EXP-K2 · Tipo cruzado rechazado.** Setup: intentar conciliar un depósito contra un egreso (o viceversa). → no empareja. Valida: `movementTypeMatchesEntryType`.
- [ ] **EXP-K3 · Liquidación de egresos N:1.** Setup: varios egresos pagados con un solo retiro agrupado → **"Varios"** (botón ahora visible en retiros, fix jun 2026). En retiros la suma debe **cuadrar exacto** (sin comisión). Unlink → restaura los entries. Valida: "Varios" para egresos + reversibilidad. *(UI habilitada; click-through manual pendiente.)*
- [ ] **EXP-K4 · `comision` excluida del pool.** Setup: tras INC-F7 (que creó un egreso `origin=comision`) subir un retiro. → el egreso `comision` **NO** aparece como candidato. Valida: exclusión de pools de match.

## Bloque L — Edge cases (ambos)

- [ ] **EXP-L1 · Pago parcial vs match exacto.** Setup: entry amount=$5,000 PARTIAL (amountPaid=$2,500), depósito/retiro $2,500. → **NO** auto-match (compara contra `amount`, no `amountPaid`). Valida: gap de pagos parciales.
- [ ] **EXP-L2 · Re-subir el MISMO estado de cuenta.** Setup: subir el mismo PDF/periodo otra vez. → **409** "ya existe estado de cuenta para este banco/cuenta/periodo". Valida: dedup a nivel statement (§gap 3 de [`06`]).
- [ ] **EXP-L3 · Estados con rangos traslapados.** Setup: subir un statement diario y otro mensual que se traslapan. → la misma transacción crea **2 BankMovements** (dedup es por statement, no por transacción). El duplicado queda sin match (1:1 protege el entry). Valida: límite del dedup.
- [ ] **EXP-L4 · CFDI ya vinculado a otro entry.** Setup: intentar vincular un `satCfdiUuid` que ya está en otro entry. → **409**. Valida: `satCfdiUuid @unique`.
- [ ] **EXP-L5 · Desvincular CFDI con PDF presente.** Setup: entry con CFDI vinculado **y** PDF de factura subido → desvincular CFDI. → `satCfdiUuid` se limpia pero **`hasFactura` sigue true** (por el PDF). Valida: regla de desvinculación.
- [ ] **EXP-L6 · PDF de estado de cuenta (parser GPT-4o).** Setup: subir PDF (no CSV). → GPT-4o extrae movimientos a tabla editable → importar. → crea `BankMovement`s. Valida: parser de PDF (≠ Motor 4).

---

## Matriz de cobertura (resumen)

| Dimensión | Valores cubiertos |
|---|---|
| Origen | cita, manual, venta, webhook_pago, sat_emitido, sat_recibido, banco, compra, comision |
| Forma de pago | efectivo, transferencia, tarjeta, cheque, deposito |
| Evidencia fiscal | sin factura, PDF, XML, CFDI vinculado (auto/manual), PUE, **PPD ✅** (nace PENDING; complemento → PARTIAL/PAID) |
| Evidencia bancaria | sin banco, 1:1 (ref/fecha/concepto), card_fee, liquidación N:1, webhook auto |
| Confianza CFDI | alta (≥0.67), media (`needsReview`), baja (crea/standalone) |
| Orden | operación→factura (dedup), factura→operación (duplicado) |
| Reversibilidad | desvincular CFDI, unmatch, unlink_settlement, merge |
| Negativos | duplicados, 409 doble-vínculo, tipo cruzado, comisión>8%, statement repetido |

> Casos marcados **⚠️** documentan **gaps conocidos** (PPD/PUE, matcher bancario ignora contraparte,
> pagos parciales, dedup por transacción). Al probarlos verás el comportamiento *actual*, no el ideal
> — anota la diferencia. Ver `00-modelo-consolidado.md` §8.

---

*Estado:* checklist creado junio 2026, basado en el comportamiento real del código. Relacionado:
[`00-modelo-consolidado.md`](00-modelo-consolidado.md), `../../TODO FACTURAS/flujo permutations/`.
</content>
