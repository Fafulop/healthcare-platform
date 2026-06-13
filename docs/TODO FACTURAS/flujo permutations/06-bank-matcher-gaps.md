# Gaps — Motor 3 (conciliación bancaria): señales y UX

> Hallazgos de la sesión de pruebas 2026-06-13, al conciliar un depósito real contra entries
> existentes. Documentados como permutaciones/gaps; **sin cambios de código todavía.**
> Relacionado: [`03-bank-reconciliation.md`](03-bank-reconciliation.md).

## Caso que los disparó

| Dato | Valor |
|---|---|
| Movimiento bancario | `09-jun · SPEI RECIBIDO PEGASUS CONTROL · +$2,150.00` |
| Entry existente (cita) | `Consulta de Medicina Interna - PEGASUS CONTROL · $2,150.00 · 14/jun · Ingresos Consulta` (ya con factura CFDI vinculada) |
| Monto | **idéntico** ($2,150.00) |
| Nombre | **coincide** (PEGASUS CONTROL en ambos) |
| Resultado auto | **"Sin match"** (no se auto-concilió) |
| Sugerencia manual (popover) | **Media** (score 60) → requiere clic en *Vincular* |

---

## Gap 1 — El matcher bancario ignora `counterpartyName` / `counterpartyRfc`

**Síntoma:** monto idéntico + mismo nombre de contraparte, pero "Sin match".

**Causa raíz:** `matchMovements` (`apps/api/src/lib/bank-matching.ts`) solo recibe
`LedgerEntryForMatch = Pick<..., 'id'|'amount'|'transactionDate'|'entryType'|'concept'|'bankMovementId'|'formaDePago'>`.
**No selecciona ni usa `counterpartyName` ni `counterpartyRfc`.** La única señal textual es el
*solape de palabras del `concept`* (prioridad 4), y solo cuando la fecha cae a >2 días.

Las identidades denormalizadas que agregó Gap 1 se cablearon al matcher **CFDI** (motor 2) pero
**nunca al matcher bancario** (motor 3). Así, el nombre del ordenante de un SPEI ("PEGASUS
CONTROL") no se compara contra `counterpartyName` del entry.

**Efecto combinado con el peso de la fecha:** `matchMovements` pondera fuerte la fecha
(0 días → 0.85, ≤2 → 0.70, >2 → solo vía solape de concepto, tope 0.65). Con 5 días de diferencia,
**el monto idéntico por sí solo no alcanza**: cae al tramo más débil, que depende del concepto.
Resultado: no auto-concilia.

**Por qué el popover sí lo sugiere (Media):** el endpoint de sugerencias por movimiento
(`movements/[movId]` GET) usa OTRO scoring: monto 40 + fecha 10 (>2 días) + `hasFactura` 10 = 60 →
medium. Por eso aparece para vincular a mano aunque el auto-match no disparó. (Dos motores, dos
conjuntos de señales, inconsistentes entre sí.)

### Enhancement propuesto (post-pruebas)
1. **Pasar `counterpartyName` y `counterpartyRfc` a `LedgerEntryForMatch`** y sumarlos como señal
   fuerte en `findBestMatch`: si el nombre de la contraparte aparece en la descripción del
   movimiento (SPEI suele traer el ordenante), dar un bono alto **independiente de la fecha** —
   un monto exacto + nombre de contraparte coincidente debería conciliar aunque haya días de
   diferencia.
2. **Unificar el scoring** de `matchMovements` (subida) y del endpoint de sugerencias por
   movimiento, igual que se unificó el CFDI con `scoreCfdiMatch`, para que ambos den el mismo
   veredicto.
3. Considerar extraer el nombre del ordenante del SPEI desde la descripción (heurística o el
   mismo agente Haiku) para alimentar la comparación contra `counterpartyName`.

---

## Gap 2 — La columna "match" muestra categoría, no conciliación (UX)

**Síntoma:** la columna que parece de "match" muestra área/subárea sugeridas
("Consultas Médicas / Consulta General") y está vacía en muchas filas; confunde porque no es lo
que el usuario busca (vincular el depósito a una factura/entry existente).

**Causa:** para filas sin match, la UI muestra `suggestedArea/suggestedSubarea/suggestedConcept`
de `categorizeMovement` (un clasificador de categoría, señal débil y aparte). El match real a
entries vive en el popover "Movimientos existentes que coinciden".

**Enhancement propuesto:** separar visualmente **"Conciliación"** (match a entry existente — lo
importante) de **"Categoría sugerida"** (clasificación), o mostrar primero el match a entry y
relegar la categoría. No mezclar ambos en una sola columna ambigua.

---

## Gap 3 — Dedup de estados de cuenta es a nivel statement, no a nivel transacción

**Pregunta que lo disparó:** ¿qué pasa si el usuario sube el MISMO PDF otra vez? ¿se duplican los
movimientos?

**Comportamiento actual** (`conciliacion-bancaria/route.ts` POST): hay una unique key
**(doctorId, bankName, accountNumber, periodMonth, periodYear)**. Antes de crear nada, busca un
statement con esa combinación y devuelve **409 "Ya existe un estado de cuenta para este banco,
cuenta y periodo"** (con `P2002` como respaldo ante carreras). Entonces:

- **Mismo banco + cuenta + periodo otra vez → rechazado, no crea nada.** Sin duplicados. ✓

**Caveat — el dedup es a nivel *statement*, NO a nivel *transacción*.** No hay dedup por movimiento
individual. El guard se evade si cambian los campos identificadores: **periodo distinto**, **número
de cuenta mal tecleado**, o **dos statements con rangos de fecha que se traslapan** (la misma
transacción aparece en ambos). En esos casos la misma transacción real **sí** crea un segundo
`BankMovement`.

**Qué puede / no puede hacer ese movimiento duplicado:**
- **No** puede doble-vincular un entry: la relación entry↔movimiento es 1:1 (unique `ledger_entry_id`
  en `bank_movements`), así que un entry ya conciliado no se vuelve a conciliar — la línea duplicada
  queda **sin match**.
- **Sí** infla los totales de depósitos/retiros del statement y ensucia la lista con una línea fantasma.

**Severidad:** baja. Re-subida normal = segura (409). El riesgo es solo metadata mal capturada o
rangos traslapados, y aun así degrada a **líneas bancarias duplicadas**, no a entries de
ingreso/egreso duplicados.

**Enhancement opcional:** dedup por transacción (hash de fecha+monto+descripción+referencia dentro
del doctor) al importar, o advertir si el rango de fechas se traslapa con un statement existente.

---

## Nota de prueba (no es gap del producto)

El gap de 5 días del caso fue **artefacto de la prueba**: la cita se fechó 14-jun mientras el
depósito real era 09-jun. Para probar el auto-match en sus tramos fuertes, **fechar el entry a
≤2 días del depósito**. Aun así, el Gap 1 de arriba es real: con la mejora propuesta, monto
exacto + nombre coincidente debería conciliar aunque la fecha no sea contigua.

---
*Estado:* documentado 2026-06-13. Enhancements no implementados (en modo pruebas). El matcher
CFDI (motor 2) ya quedó validado en prod; estos gaps son del matcher bancario (motor 3).
</content>
