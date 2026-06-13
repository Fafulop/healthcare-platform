# Motor 3 — BankMovement ↔ LedgerEntry (conciliación bancaria)

Al subir un PDF de estado de cuenta se crean `BankMovement`s (depósitos/retiros). Cada uno se
intenta emparejar con entry(s) del ledger. Tres formas de match: **1:1 exacto**,
**1:1 neto-de-comisión** (tarjeta) y **liquidación N:1** (un depósito ↔ varios entries).

`matchStatus` de un movimiento: `matched_auto` · `matched_confirmed` · `unmatched` · `ignored`.

---

## 3.1 Relación de monto: `amountMatchKind`

| Tipo | Condición | Penalización confianza |
|---|---|---|
| **`exact`** | \|monto_banco − monto_entry\| < 0.01 | ×1.0 |
| **`card_fee`** | depósito **y** `entry.formaDePago = 'tarjeta'` **y** el depósito está **por debajo** del bruto en ≤ **4%** (`MAX_CARD_FEE_PCT`) | ×0.9 |
| **`null`** | sin relación | no empareja |

Razón: los pagos con terminal caen **netos de comisión** → el depósito es unos % menor que el
bruto que registró la cita.

## 3.2 Auto-match al subir el PDF (`matchMovements`)

Requisito previo: el tipo coincide (`deposit↔ingreso`, `withdrawal↔egreso`). Se excluyen entries
ya vinculados o ya liquidados. Cada entry se usa **una sola vez** (greedy: primero la confianza
más alta; si su entry ya fue tomado, re-empareja con el siguiente).

| Prioridad | Condición | Confianza |
|---|---|---|
| **1** | `exact` + `reference == entry.bankMovementId` + ≤ 1 día | **0.99** |
| **2** | misma fecha exacta (0 días) | **0.85** × penalización |
| **3** | fecha ± 2 días | **0.70** × penalización |
| **4** | ± 7 días + solape de palabras del concepto ≥ 0.3 | (0.50 + solape×0.15), tope **0.65** |

(`card_fee` aplica la penalización ×0.9 en las prioridades 2–4.)

## 3.3 Sugerencias por movimiento (`GET .../movements/:movId`)

Para conciliar manualmente un movimiento, lista entries candidatos (no vinculados, no liquidados,
`origin ≠ comision`), `entryType` compatible, monto en `[−2%, +4.5%]` (el +4.5% para depósitos
captura el bruto de tarjeta por encima del depósito neto), fecha ± 5 días. Puntaje:

| Señal | Puntos |
|---|---|
| Monto exacto / dif < 0.5% / **card_fee** (tarjeta, bruto ≤ +4.5%) / resto | 40 / 30 / **28** / 15 |
| Fecha < 1d / ≤ 2d / resto | 40 / 25 / 10 |
| Bonus `hasFactura` | +10 |

Etiqueta: **high ≥ 70 / medium ≥ 45 / low**.

## 3.4 Acciones (PATCH `.../movements/:movId`)

| `action` | Qué hace | Enriquece el/los entry | Reversible |
|---|---|---|---|
| **`confirm_match`** | Confirma el match sugerido → `matched_confirmed`. | `hasComprobante=true`, `needsReview=false`, `bankAccount`, `bankMovementId`, `paymentStatus=PAID`. | `unmatch` |
| **`link_existing`** | Vincula 1:1 a un entry elegido. Rechaza si el movimiento o el entry ya están vinculados (409). | igual que confirm. | `unmatch` |
| **`link_settlement`** | **N:1**: liquida un depósito contra **varios** entries (ver 3.5). | por cada entry: igual que confirm. | `unlink_settlement` / `unmatch` |
| **`create_entry`** | Crea un entry nuevo `origin='banco'`, `PAID`, `hasComprobante`. Opcional `saveRule` → guarda `BankCategorizationRule`. | (nace conciliado) | `unmatch` (no borra el entry) |
| **`ignore`** | Marca `ignored` (línea irrelevante: transferencias internas, etc.). | — | volver a conciliar |
| **`unmatch`** | Quita el match 1:1 **o** borra los `BankSettlementItem` → `unmatched`. | **No revierte** `hasComprobante`/`PAID` del entry (ver ⚠️). | re-conciliar |
| **`unlink_settlement`** | Borra todas las asignaciones de la liquidación → `unmatched`. | **No revierte** enriquecimiento. | re-liquidar |
| **`update_category`** | Cambia área/subárea/concepto sugeridos del movimiento. | — | editar otra vez |

## 3.5 Liquidación N:1 (`link_settlement`) — el caso "Varios"

Un depósito (p.ej. payout de terminal o depósito de efectivo agrupado) cubre **varias** entries.

Validaciones:
- El movimiento debe estar libre (sin link 1:1 y sin liquidación previa).
- Todas las entries del mismo `entryType` que el movimiento, no conciliadas.
- **La suma de los brutos ≥ depósito** (el depósito no puede exceder lo que liquida).
- La comisión implícita (`suma − depósito`) ≤ **8%** (`MAX_SETTLEMENT_FEE_PCT`).

Efectos:
- Crea un `BankSettlementItem` por entry (relación UNIQUE → un entry solo se liquida una vez).
- Enriquece cada entry (`hasComprobante`, `PAID`, `bankAccount`).
- Opcional: registra la comisión como **egreso** `origin='comision'` (excluido de pools de match).

### Por qué es manual
El auto-match (`matchMovements`) empareja 1:1; **no** puede adivinar qué N citas suman un depósito.
"Varios" es un paso manual que el usuario repite por cada payout agrupado. Ejemplo canónico:
3 citas de $1,000 el día 1 → un depósito de $3,000 una semana después → se liquida el depósito
contra las 3 entries en vez de crear un 4º entry.

> Para probarlo: que **ningún** entry individual iguale el depósito (si no, el matcher 1:1 lo
> toma y nunca llegas a "Varios").

---

## ⚠️ Asimetría de reversibilidad (gotcha)

Deshacer un match bancario (`unmatch` / `unlink_settlement`) **no** revierte el enriquecimiento
del entry: `hasComprobante` y `paymentStatus=PAID` se quedan. Es consistente con el comportamiento
previo de unmatch, pero significa que un entry puede quedar marcado como cobrado/con-comprobante
aunque ya no tenga línea bancaria asociada. (Contrasta con el unlink de CFDI, que **sí** resetea
`hasFactura`.) Candidato a unificar a futuro.

## Resumen de permutaciones (motor 3)

| # | Entrada | Condición | Resultado |
|---|---|---|---|
| 3a | Subida PDF | exact + ref + ≤1d | auto-match 0.99 |
| 3b | Subida PDF | exact, mismo día / ±2d / ±7d+concepto | auto-match 0.85 / 0.70 / ≤0.65 |
| 3c | Subida PDF | tarjeta, neto ≤4% | auto-match × 0.9 |
| 3d | Subida PDF | sin relación de monto | queda `unmatched` |
| 3e | Manual | confirmar sugerencia | `matched_confirmed` 1:1 |
| 3f | Manual | vincular a entry elegido | `matched_confirmed` 1:1 |
| 3g | Manual | "Varios" suma ≥ depósito, comisión ≤8% | liquidación N:1 |
| 3h | Manual | crear entry desde banco | entry `origin=banco` ya conciliado |
| 3i | Manual | ignorar | `ignored` |
| 3j | Manual | deshacer (unmatch / unlink_settlement) | `unmatched` (entry conserva evidencia) |

> ⚠️ **Gaps conocidos de este motor** (hallados en pruebas 2026-06-13): el matcher **no usa**
> `counterpartyName/counterpartyRfc` (solo solape de `concept`) y es muy sensible a la fecha, así
> que un depósito con monto exacto + mismo nombre pero días de diferencia **no auto-concilia**;
> además la columna "match" muestra categoría sugerida, no conciliación. Detalle + enhancement
> propuesto en [`06-bank-matcher-gaps.md`](06-bank-matcher-gaps.md).

→ Reglas destiladas para el agente: [`04-llm-assistant-prompt.md`](04-llm-assistant-prompt.md).
</content>
