# Bitácora de pruebas — registro consolidado

> **Qué es esto.** Una sola tabla con **todas** las permutaciones de [`01`](01-permutaciones-de-prueba.md)
> y su estado de prueba: ¿probado? ¿cómo? ¿con qué evidencia? Es el "tablero" de cobertura. El detalle
> narrativo de cada resultado vive en [`STEP-BY-STEP-TESTING.md`](STEP-BY-STEP-TESTING.md) §7; aquí solo
> el estado de un vistazo. Doctor de prueba: **`dr-prueba`** (`cmni1bov90000mk0lyeztr3ad`).

## Leyenda de estado

- **✅ LIVE** — verificado en prod (read-only) con un entry/dato específico.
- **🟩 CÓDIGO** — lógica verificada / code-review + soportada por la baseline, sin click-through dedicado.
- **🟦 UI-LISTA** — la capacidad/UI ya existe y se habilitó, falta el recorrido manual.
- **⬜ PENDIENTE** — sin probar.
- **⚠️ GAP** — documenta el comportamiento *actual* (gap conocido), no el ideal.

## Resumen (2026-07-01)

- **✅ LIVE:** EXP-I1, EXP-J1, EXP-J4, INC-F13/EXP-F13, EXP-H4, INC-D6, **EXP-K3** (settle + unlink de egresos), **EXP-K2** (cruce imposible en UI), **EXP-I2/I3/I4** (manual + PDF / Por Pagar / vincular CFDI) — en vivo 2026-07-01.
- **🟩 CÓDIGO:** EXP-H1, EXP-K1, INC-D7, INC-F10 (cubiertos por baseline / por J4).
- El resto **⬜ PENDIENTE** (toda la PARTE 1 ingresos salvo D6/D7/F10/F13; varios egresos).

---

## PARTE 1 — INGRESOS (INC-*)

| Caso | Qué valida | Estado | Evidencia / nota |
|---|---|---|---|
| INC-A1 | cita efectivo sin factura | ⬜ | |
| INC-A2 | cita transferencia sin factura | ⬜ | |
| INC-A3 | cita + CFDI PUE + banco (camino feliz) | ⬜ | el round-trip CFDI ya funciona (Motor 2), falta click-through |
| INC-A4 | tarjeta + PUE, neto de comisión (`card_fee` ≤4%) | ⬜ | |
| INC-A5 | tarjeta 5% abajo (fuera de tolerancia) | ⬜ | |
| INC-A6 | cheque + factura | ⬜ | |
| INC-A7 | walk-in con RFC formal (match por nombre) | ⬜ | |
| INC-A8 | walk-in nombre informal (needsReview / manual) | ⬜ | |
| INC-A9 | 2 citas idénticas mismo día, RFC desempata | ⬜ | |
| INC-B1 | manual ingreso Cobrado → PAID | ⬜ | (análogo a EXP-I1 ✅ del lado egreso) |
| INC-B2 | manual ingreso Por Cobrar → PENDING | ⬜ | |
| INC-B3 | manual + subir comprobante → 🏦 | ⬜ | |
| INC-B4 | manual + subir CFDI XML → 🧾 | ⬜ | |
| INC-B5 | manual + vincular CFDI (popover) | ⬜ | |
| INC-B6 | manual con servicio del catálogo | ⬜ | |
| INC-B7 | guard de duplicado al crear (409) | ⬜ | |
| INC-C1 | venta directa | ⬜ | |
| INC-C2 | venta parcial → PARTIAL | ⬜ | |
| INC-C3 | pago en línea (webhook) → PAID 🏦 auto | ⬜ | |
| INC-C4 | webhook + payout agregado (excluido KPIs) | ⬜ | |
| INC-D1 | CFDI emitido standalone | ⬜ | |
| INC-D2 | CFDI emitido CON cita (dedup) | ⬜ | |
| INC-D3 | confianza media (needsReview) | ⬜ | |
| INC-D4 | confianza alta sin review | ⬜ | |
| INC-D5 | "Registrar" por fila sugiere, no auto-vincula | ⬜ | |
| INC-D6 | CFDI **emitido PPD** nace PENDING | ✅ LIVE | PASTELERIA emitido PPD observado PENDING tras fix (gap #1 Parte A) |
| INC-D7 | complemento (tipo P) actualiza paymentStatus | 🟩 CÓDIGO | `reconcilePpdToLedger` validado vs complementos (EXP-H4) |
| INC-D8 | CFDI emitido cancelado → no se registra | ⬜ | |
| INC-E1 | depósito sin entry → "Crear entrada" | ⬜ | (análogo a EXP-J1 ✅ del lado egreso) |
| INC-E2 | banco + vincular CFDI después | ⬜ | |
| INC-E3 | crear entrada + guardar regla | ⬜ | |
| INC-F1 | match prioridad 1 (referencia, 0.99) | ⬜ | |
| INC-F2 | match mismo día (0.85) | ✅ LIVE | el auto-match de EXP-J4/F13 fue 0.85 (mismo día) |
| INC-F3 | match ±2 días (0.70) | ⬜ | |
| INC-F4 | match ±7 días por concepto (≤0.65) | ⬜ | |
| INC-F5 | ⚠️ mismo monto+nombre, días distintos = "Sin match" | ⚠️ GAP | Motor 3 ignora `counterpartyName/Rfc` (gap §8.2) |
| INC-F6 | liquidación N:1 ("Varios") | ⬜ | |
| INC-F7 | liquidación con comisión | ⬜ | |
| INC-F8 | liquidación rechazada comisión >8% | ⬜ | |
| INC-F9 | liquidación rechazada depósito>suma | ⬜ | |
| INC-F10 | confirmar sugerencia (`confirm_match`) | 🟩 CÓDIGO | ejercido en EXP-J4/F13 (confirm → enrich) |
| INC-F11 | vincular a entry elegido (1:1) | ⬜ | |
| INC-F12 | ignorar movimiento | ⬜ | |
| INC-F13 | ✅ deshacer match **revierte** evidencia (fix) | ✅ LIVE | `EGR-2026-350`: confirm→PAID/🏦 → unmatch→PENDING/🏦✗ |
| INC-F14 | doble vínculo rechazado (409) | ⬜ | |
| INC-G1 | backfill antes de cita → duplicado (negativo) | ⬜ | |
| INC-G2 | cita antes del backfill → 1 entry | ⬜ | |
| INC-G3 | fusionar duplicados (merge) | ⬜ | |

---

## PARTE 2 — EGRESOS (EXP-*)

| Caso | Qué valida | Estado | Evidencia / nota |
|---|---|---|---|
| EXP-H1 | CFDI recibido standalone (PENDING, 🧾✓, Proveedor) | 🟩 CÓDIGO | baseline: 346 `sat_recibido` correctos |
| EXP-H2 | CFDI recibido CON compra/manual (dedup) | ⬜ | |
| EXP-H3 | proveedor reutilizado (find-or-create) | ⬜ | |
| EXP-H4 | CFDI recibido PPD + complemento | ✅ LIVE | 295 PUE PENDING; PPD vs complementos: 0 under-reconciled |
| EXP-H5 | nota de crédito (efecto E) → ingreso | ⬜ | |
| EXP-I1 | gasto efectivo sin factura | ✅ LIVE | `EGR-2026-348` $700, origin=manual PAID, 🧾✗🏦✗ |
| EXP-I2 | gasto manual + factura PDF → 🧾 | ✅ LIVE | `EGR-2026-352`: subió `reporte-contador-2026-05.pdf` → `ledger_facturas` id=1 (uuid null), has_factura=true, sat_cfdi_uuid null (2026-07-01) |
| EXP-I3 | gasto manual Por Pagar → PENDING | ✅ LIVE | `EGR-2026-352` $500 origin=manual PENDING amount_paid=0 🧾✗🏦✗ (2026-07-01) |
| EXP-I4 | egreso manual + vincular CFDI recibido | ✅ LIVE | `EGR-2026-353` $400: borré `EGR-2026-276` para liberar CFDI 954E28FD (CRESCENCIO), popover High → Vincular → sat_cfdi_uuid set, has_factura=true, sin duplicado, sigue PENDING (vincular ≠ pago) (2026-07-01) |
| EXP-J1 | retiro sin entry → "Crear entrada" (`origin=banco`) | ✅ LIVE | entry 1554 creado; `unmatch` lo borró (reversibilidad create_entry) |
| EXP-J2 | comisión bancaria sin factura (🧾✗ permanente) | ⬜ | |
| EXP-J3 | compra desde módulo (`origin=compra`) | ⬜ | |
| EXP-J4 | retiro = factura recibida → conciliar → Completo | ✅ LIVE | `EGR-2026-001` primer egreso 🧾✓🏦✓ PAID (vía Confirmar) |
| EXP-K1 | retiro match 1:1 (dirección de tipo) | 🟩 CÓDIGO | cubierto por EXP-J4 (withdrawal↔egreso) |
| EXP-K2 | tipo cruzado rechazado (depósito vs egreso) | ✅ LIVE | UI: un retiro (mov #57) solo ofrece **egresos** como candidatos a vincular/Varios → cruce imposible por construcción, no solo rechazo backend (2026-07-01) |
| EXP-K3 | liquidación de egresos N:1 ("Varios") | ✅ LIVE | mov #57 $3,845.97 → 3 items (EGR-342/343/347) → los 3 PAID 🧾✓🏦✓, sin `comision`; unlink → los 3 PENDING 🏦✗, items=0, mov unmatched, factura conservada (2026-07-01) |
| EXP-K4 | `comision` excluida del pool de match | ⬜ | |
| EXP-L1 | ⚠️ pago parcial vs match (compara `amount`) | ⚠️ GAP | gap conocido |
| EXP-L2 | re-subir mismo estado de cuenta → 409 | ⬜ | (observado indirecto: se evitó usando otra cuenta) |
| EXP-L3 | rangos traslapados → 2 BankMovements | ⬜ | |
| EXP-L4 | CFDI ya vinculado a otro entry → 409 | ⬜ | |
| EXP-L5 | desvincular CFDI con PDF → `hasFactura` sigue | ⬜ | |
| EXP-L6 | PDF de estado de cuenta (parser GPT-4o) | ⬜ | |

---

## Cómo actualizar

Al probar un caso: cambia su **Estado** y pon la **evidencia** (entry id / dato verificado / fecha).
Mantén el **Resumen** arriba sincronizado. El detalle largo va en `STEP-BY-STEP-TESTING.md` §7; este
archivo es el índice de cobertura. Método de verificación: usuario hace la acción en la UI → LLM
consulta prod read-only (ver [`TOOLING-acceso-railway-db.md`](TOOLING-acceso-railway-db.md)).

*Estado:* bitácora creada 2026-06-29.
