# 🔄 Refresco de sesión — LÉEME PRIMERO cada sesión

> Snapshot del estado, decisiones y próximos pasos del trabajo en **Flujo de Dinero**. Para una
> sesión/LLM en frío: lee **este** archivo, luego el [`README.md`](README.md) (índice) y de ahí los
> numerados. Última actualización: **2026-07-01**.

---

## En una frase

Estamos **re-entendiendo y endureciendo** el núcleo de *Flujo de Dinero*: una **sola fuente de verdad**
(`LedgerEntry`) para todos los ingresos/egresos del doctor, que agrega automáticamente las 3 puertas
por las que entra el dinero (**cita/operación, factura del SAT, banco**) **sin duplicar** el mismo
hecho económico, y lo proyecta al expediente del paciente.

## Modelo mental (5 puntos)

1. **Una tabla = la verdad:** `LedgerEntry` (`practice_management.ledger_entries`). Todo lo demás se
   *adjunta*.
2. **Dos evidencias por entry:** 🧾 fiscal (`hasFactura`/`satCfdiUuid`) y 🏦 bancaria
   (relación `bankMovement`/`settlementItem`; `hasComprobante` es un flag más débil). Meta = ambas.
3. **Tres puertas (`origin`):** operación (`cita`/`venta`/`compra`/`webhook_pago`/`manual`),
   factura SAT (`sat_emitido`/`sat_recibido`), banco (`banco`). Interno: `comision`.
4. **Dedup = match-before-create** en 2 motores: Motor 2 (CFDI↔entry, `scoreCfdiMatch`) y Motor 3
   (banco↔entry, `matchMovements`). + un guard preventivo en el POST manual.
5. **PUE = pagado; PPD = se paga después** (vía complemento tipo P). Hoy el sistema **no** respeta
   esto (gap #1).

---

## Estado: qué está hecho vs. qué falta

**Construido y verificado contra el código:**
- Tabla única + 2 ejes de evidencia; dedup Motor 2 (CFDI) y Motor 3 (banco); SAT descarga como fuente
  de facturas; liquidación N:1; auditoría de matches.
- **El match probabilístico CFDI YA EXISTE y funciona** (Motor 2).

**✅ SHIPPED esta sesión (2026-06-28/29, todo en `main`, ver commits abajo):**
1. **Enrich-on-XML** — los entries `sat_*` que nacían con concepto genérico + forma default (porque
   el auto-registro corre en la etapa de metadata, antes del XML) ahora se **re-enriquecen** con el
   concepto real + forma cuando llega el XML. `mapFormaPago()` ampliado (códigos `99` etc. → `null`/"—").
2. **Gap #1 (PUE/PPD) — CERRADO (Parts A+B):** `resolvePaymentStatus()` → emitido PPD nace **PENDING**;
   `reconcilePpdToLedger()` propaga complementos (`SatPago`) por `satCfdiUuid==facturaUuid`
   (case-insensitive), **upgrade-only**, excluye cancelados. **Validado en prod: 0 under-reconciled.**
3. **Contraparte** — `register-to-ledger` y el enrich denormalizan `counterpartyRfc/Name`. Helper
   `counterpartyOf()`. Columnas **Paciente/Proveedor** muestran nombre + RFC.
4. **Filtro de mes** en Movimientos (tabla + cards reflejan el período); `ledger/balance` con fechas.
5. **Gap §7/EXP-F13 — CERRADO (reversibilidad bancaria):** `lib/bank-reversibility.ts`
   (`revertEntryEffects`) — al deshacer un match se **restaura el estado previo** del entry (snapshot
   en `matchHistory`), y los entries **nacidos del banco** (`origin=banco`/`comision`) se **borran si
   prístinos**. Cubre `unmatch`, `unlink_settlement` **y borrar el estado de cuenta** (revierte cada
   movimiento `matched_confirmed` antes del cascade). **Validado en vivo** (confirm→PAID→unmatch→PENDING).
6. **Settlement de egresos ("Varios" en retiros):** la UI ocultaba el botón en retiros (gate deposit);
   ahora aparece → un retiro paga **varias facturas**. Comisión solo en depósitos; en retiros la suma
   **cuadra exacto**. Panel = modal acotado al viewport.
7. **Modal de Evidencia:** click en el icono de comprobante ya **no sale en blanco** para conciliados
   por banco — muestra de qué **estado de cuenta** vino (banco/cuenta/periodo/movimiento) + adjuntos.
   Endpoint **lazy** `GET /ledger/[id]/evidence`.

**✅ SHIPPED 2026-07-01 (esta sesión — íconos de evidencia + fixes de vinculación de factura):**
1. **Bug de gate `hasFactura` (CFDI-link):** el popover para **vincular CFDI** estaba gated en
   `!hasFactura`, así que un entry con **PDF de factura** ya no podía vincular su CFDI. Ahora en
   `!satCfdiUuid`. (commit `4dc3ca1b`)
2. **Ícono de factura = TODA la evidencia fiscal:** FileCheck2 abre el modal "Factura" con el **CFDI
   vinculado** (si hay) **+** links "Abrir" de las **facturas subidas** (PDF `LedgerFactura` / XML
   subido). Antes era CFDI-o-PDF **excluyente** → un entry con **CFDI y PDF** perdía acceso al PDF al
   vincular. `CfdiDetailModal` ahora recibe el `entry` completo (no solo `uuid`), omite el fetch a SAT
   sin CFDI, y **Desvincular** solo aparece si hay CFDI. (commit `71acbe34`)
3. **MergeModal** badge "CFDI" vs "Factura" según `satCfdiUuid`; **"Facturar"** (detalle de ingreso)
   pide confirmación si ya hay CFDI vinculado (evita doble emisión; **no** toca el endpoint de emisión).
   (commit `71acbe34`)
4. **Regla de íconos de evidencia (documentada en `04` §J):** **Receipt** = 🏦 banco/comprobante
   (`LedgerAttachment` + referencia de estado de cuenta); **FileCheck2** = 🧾 fiscal (CFDI + PDF/XML);
   pill ámbar **"CFDI"** = única acción (vincular CFDI).

**Permutaciones de EGRESO probadas EN VIVO esta sesión (2026-07-01):**
- **EXP-K3 ✅** settlement de egresos "Varios" (mov #57 $3,845.97 → 3 facturas a PAID/Completo) + unlink
  (restauró PENDING/🏦✗, factura conservada). **Primer settlement de egresos completo.**
- **EXP-K2 ✅** cruce imposible por UI (un retiro solo ofrece **egresos** como candidatos a vincular).
- **EXP-I2/I3/I4 ✅** manual + PDF (`EGR-2026-352`) / Por Pagar→PENDING / vincular CFDI recibido
  (`EGR-2026-353`; se **borró** `EGR-2026-276` para liberar el CFDI `954E28FD` de CRESCENCIO).
- **EXP-L5 ✅** desvincular CFDI con PDF presente → `sat_cfdi_uuid` null pero `hasFactura` sigue true
  (el PDF sobrevive). *(En `EGR-2026-353`; fue el caso que expuso el bug de gate #1.)*

> **Datos de prueba nuevos (dr-prueba):** `EGR-2026-352` (manual $500 + PDF), `EGR-2026-353` (manual
> $400 + CFDI 954E + PDF). `EGR-2026-276` (CRESCENCIO $400) fue **borrado** para liberar su CFDI →
> re-registrable desde el panel SAT si se quiere restaurar el baseline original.

**Gaps que QUEDAN (prioridad):**
1. Matcher bancario (Motor 3) **ignora** `counterpartyName/Rfc` → mismo monto + mismo nombre, días
   distintos = "Sin match". (Ahora la contraparte SÍ está denormalizada en los entries — alimenta
   Motor 2 pero todavía **no** Motor 3.)
2. Sin reverse matching; agregación de payouts de pasarela; sin agente Motor 4.
3. Emisión de factura: `ledgerEntryId` **opcional** → CFDIs huérfanos; emisión no estampa `satCfdiUuid`.
4. **L1:** pago parcial vs match bancario compara contra `amount`, no `amountPaid`.

---

## DECISIONES de esta sesión (no re-litigar)

- ✅ **Enfoque de match = PROBABILÍSTICO (ahora).** El **determinista por UUID se DIFIERE**: no se puede
  probar hoy (0 overlap, ver abajo). El probabilístico ya existe y es altamente certero → **no hay que
  construir nada** para el flujo del 99%. Detalle en `02` §4.1.
- ✅ **NO tocar el endpoint de emisión** (`facturacion/cfdi`). Es ruta de facturación (dinero/legal),
  va directo a prod sin pruebas, y `satCfdiUuid` es `@unique` → un fallo rompe la emisión tras timbrar.
  (Por esto se **rechazó** un edit a emisión antes.)
- ✅ Si algún día se hace el determinista: en el camino **tolerante** (`sat-auto-register.ts`), con
  **fallback** al match difuso, y comparación **case-insensitive** (obligatorio, ver dato verificado).
- ✅ **Modelo de anclas** (`03`) es el blueprint de diseño a futuro (sin construir). Captura fiscal
  temprana (RFC + Constancia) **no requiere esquema nuevo** — los campos ya existen en `Patient`.

---

## Datos verificados en PRODUCCIÓN (Railway, solo lectura)

**Doctor de prueba (CONFIRMADO por datos):** `dr-prueba` = *Dr. Gerardo Lopez Fafutis* (facturas a
*DIEGO PABLO LOPEZ FAFUTIS*, RFC `LOFD9406276F8`). **doctor_id = `cmni1bov90000mk0lyeztr3ad`**.
Único con datos SAT: **734 CFDIs, 653 ledger entries** (los demás doctores: 0 CFDIs).

**Casing (2026-06-27):** `cfdis_emitted.uuid` = minúsculas; `sat_cfdi_metadata.uuid` = MAYÚSCULAS;
`sat_pagos.facturaUuid/pagoUuid` = minúsculas; `ledger.satCfdiUuid` = MAYÚSCULAS → **todo match por
UUID debe ser case-insensitive** (ya aplicado en autoRegister, reconcile, filterActiveByVigente).
`cfdis_emitted`=6 vs `sat_cfdi_metadata`=734, **0 overlap** (las 6 emitidas no están en metadata aún).

**Baseline de EGRESOS (2026-06-28, 346 entries reales):**
- **100% `sat_recibido`** (Bloque H). `manual`/`banco`/`compra`/`comision` = **0** → Bloques I/J/K
  **sin cobertura** (hay que crearlos en la UI).
- Todos **🧾✓ 🏦✗** — **ningún egreso bank-reconciled** → ninguno llegó a Completo.
- Contraparte **346/346** poblada ✅. Dedup: **0 UUID duplicados** ✅.
- **EXP-H4 PUE/PPD validado contra complementos:** 295 PUE→todas PENDING; PPD: 43 PAID, 6 PENDING,
  1 PARTIAL (todos matchean sus complementos) + 1 PARTIAL→PAID por marca manual (ok). **UNDER-RECONCILED
  (bug) = 0** → Parts A+B correctos en prod.
- **Probados en vivo (2026-06-29):** EXP-I1 (manual efectivo), EXP-J1 (nace de banco + unmatch borra),
  EXP-J4 (primer egreso en Completo vía Confirmar), EXP-F13 (confirm→PAID→unmatch→PENDING). Detalle en
  [`STEP-BY-STEP-TESTING.md`](STEP-BY-STEP-TESTING.md) §7.

> Cómo se accedió a prod: ver [`TOOLING-acceso-railway-db.md`](TOOLING-acceso-railway-db.md)
> (`railway run --service pgvector node script.cjs`, usando `DATABASE_PUBLIC_URL`, solo `SELECT`).
> ⚠️ El `DATABASE_URL` del repo apunta a una BD local **vacía** — no es prod.

---

## Cómo probar (cuando se retome) — "como doctor nuevo"

1. Wipe del ledger (UI bulk-delete por página, o SQL en Railway). **Las facturas sobreviven** (tablas
   independientes). SQL y blast-radius en `00` §9.
2. ⚠️ El wipe **anula** `CfdiEmitted.ledgerEntryId` (SetNull) → el match por back-link no aplica justo
   tras el reset (esperado).
3. Recrear citas → **luego** Backfill SAT (auto) o "Registrar pendientes" (manual). **Orden importa:**
   citas ANTES del backfill o salen duplicados (no hay reverse matching).
4. Recorrer el checklist de `01` (todas las permutaciones de ingreso/egreso).

---

## Cómo testear (método acordado esta sesión)

El LLM **NO** puede manejar la UI de prod ni escribir a prod. **SÍ** puede verificar resultados con
consultas **solo lectura** a Railway (`railway run --service pgvector node script.cjs`,
`DATABASE_PUBLIC_URL`, solo `SELECT` — ver [`TOOLING-acceso-railway-db.md`](TOOLING-acceso-railway-db.md)).
**Flujo:** el usuario hace la acción en la UI → el LLM consulta prod y **asevera** el estado del entry.
Scripts read-only ya escritos (scratchpad): `egreso-baseline.cjs`, `ppd-validate.cjs`.

## Qué NO hacer

- ❌ No editar el endpoint de emisión a ciegas (riesgo prod/legal).
- ❌ No construir el determinista todavía (no hay cómo probarlo).
- ❌ No manejar la UI de prod ni **escribir** a prod por el canal de Railway (solo `SELECT`; mutaciones
  van por consola SQL con respaldo).
- ❌ No confiar en los números de línea citados sin verificar contra el código actual (se desfasan).
- ❌ No confundir "Registrar pendientes" (Auto/bulk, `backfill-ledger`) con "Registrar" por fila
  (Manual, `register-to-ledger`) ni con "Nuevo Movimiento" (captura manual sin factura). Ver `02` §1.

---

## Próximo paso sugerido (RETOMAR AQUÍ)

Seguimos **probando las permutaciones de EGRESO de `01` (PARTE 2)** contra prod, doctor `dr-prueba`,
método: el usuario hace la acción en la UI → el LLM verifica en la BD (read-only, ver `TOOLING`).

**Ya en vivo (✅):** EXP-I1, EXP-I2, EXP-I3, EXP-I4, EXP-J1, EXP-J4, EXP-K2, EXP-K3, EXP-L5,
EXP-H4, EXP-F13. **Por código/baseline (🟩):** EXP-H1, EXP-K1. Tablero completo en `05-test-log.md`.

**Egresos que FALTAN por probar (⬜):**
1. **EXP-H2** — CFDI recibido con manual/compra previa → **dedup** (1 solo entry). *(sin banco)*
2. **EXP-H3** — proveedor reutilizado: 2 CFDIs del mismo RFC emisor → un solo `Proveedor`. *(sin banco)*
3. **EXP-H5** — nota de crédito recibida (efecto **E**) → `resolveEntryType` la trata como **ingreso**. *(sin banco)*
4. **EXP-J2** — comisión bancaria sin factura → egreso `origin=banco` que queda 🧾✗ permanente.
5. **EXP-J3** — compra desde el módulo Compras → `origin=compra`, `transactionType=COMPRA`, `purchaseId`.
6. **EXP-K4** — `comision` excluida del pool de match. **Requiere primero** un settlement de **depósito**
   (INC-F7) que cree un egreso `origin=comision`; luego subir un retiro y ver que **no** aparece como candidato.
7. **EXP-L2** — re-subir el mismo estado de cuenta → 409. **EXP-L3** — rangos traslapados → 2 `BankMovement`.
   **EXP-L4** — CFDI ya vinculado a otro entry → 409. **EXP-L6** — parser PDF de estado de cuenta (GPT-4o).

**Sugerencia:** empezar por H2/H3/H5 (no necesitan subir estado de cuenta), luego J2/J3, y dejar K4 para
cuando toque el lado ingresos (necesita el settlement de depósito). PARTE 1 (INGRESOS) sigue casi toda ⬜.

Follow-up menor pendiente: el cambio de mes dispara el loader de página completa (acotar a la tabla).

---

## Commits (en `main`)

**Sesión 2026-07-01 (íconos de evidencia + fixes de factura + pruebas de egreso):**
- `4dc3ca1b` fix: vincular CFDI a entries con PDF (gate `!satCfdiUuid`) + ver PDF subido desde la tabla.
- `71acbe34` feat: unificar evidencia fiscal bajo el ícono de factura (CFDI + PDF/XML) + MergeModal badge + confirm "Facturar".
- `70fd9adf` docs: mapeo de íconos de evidencia (`04` §J) + resultados de egreso K3/K2/I2-I4 (`05`).
- *(este)* docs: refresco de sesión + `05` con EXP-L5.

**Sesión 2026-06-28/29 (enrich-on-XML, gap #1, reversibilidad, settlement de egresos):**
- `38aa5898` enrich-on-XML (concepto + forma de pago desde el XML).
- `d9c97d49` UI: columnas Paciente/Proveedor con nombre + RFC.
- `76b0aa5c` gap #1 PUE/PPD (Parts A+B): `resolvePaymentStatus` + `sat-ppd-reconcile.ts`.
- `620e7b9d` contraparte en register-to-ledger + enrich backfill (`counterpartyOf`).
- `76a2afb7` docs: corrección "Registrar pendientes" = Auto en `02`.
- `5f971b33` UI: filtro de mes (tabla + cards) + `MonthNavigator` + `balance` con fechas.
- `de6d0cc1` F13: `unmatch` reversible (snapshot-restore).
- `5efb228c` F13: `create_entry` + comisión de settlement reversibles (borrado-si-prístino).
- `75552ee6` F13: borrar estado de cuenta reversible + `lib/bank-reversibility.ts` compartido.
- `9443e284` docs: catálogo por flujo de UI (`04`).
- `fbe4b62a` settlement de egresos ("Varios" en retiros) + comisión solo-depósito + suma-exacta.
- `ac561c52` UI: panel de settlement como modal acotado al viewport.
- `d1dc2c82` modal de Evidencia (referencia de estado de cuenta + adjuntos) + endpoint lazy `/evidence`.
- *(este)* docs: resultados de pruebas de egresos + refresco de sesión.

Archivos nuevos clave: `apps/api/src/lib/sat-ppd-reconcile.ts`, `apps/api/src/lib/bank-reversibility.ts`,
`apps/api/.../ledger/[id]/evidence/route.ts`, `apps/doctor/.../MonthNavigator.tsx`.
Helpers reusables: `sat-auto-register.ts` (`resolvePaymentStatus`, `mapFormaPago`, `counterpartyOf`,
`normalizeRfc`), `bank-reversibility.ts` (`revertEntryEffects`, `bornEntryIsPristine`, snapshot/restore).
Deploy: solo `apps/api` + `apps/doctor`.

---

*Mantener este archivo actualizado al final de cada sesión.* Índice completo: [`README.md`](README.md).
</content>
