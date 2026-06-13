# Flujo de Dinero — Mapa de Permutaciones

> **Propósito.** Documentar **todas** las formas en que un movimiento de dinero entra,
> se empareja, se concilia y cambia de estado dentro de la sección *Flujo de Dinero*
> (`LedgerEntry`) y su conciliación con SAT (CFDI) y banco.
>
> Doble uso:
> 1. **Para nosotros** — entender el sistema completo y no perder casos al hacer cambios.
> 2. **Para el agente LLM** (Haiku 4.5) — `04-llm-assistant-prompt.md` destila estas reglas
>    en un prompt accionable. Las funciones de scoring son puras (`scoreCfdiMatch`,
>    `amountMatchKind`, `matchMovements`) para que el agente y el motor determinista compartan
>    la misma lógica.

Fecha: 2026-06-13 · Acompaña a `../CONSOLIDATED-MONEY-MODEL.md` y
`../SESSION-RESUMEN-COUNTERPARTY-SETTLEMENT.md`.

---

## Las 4 entidades

| Entidad | Tabla | Rol |
|---|---|---|
| **LedgerEntry** | `ledger_entries` | La verdad única de ingresos/egresos. Todo converge aquí. |
| **SatCfdiMetadata** | `sat_cfdi_metadata` | Un CFDI descargado del SAT (factura emitida o recibida). |
| **BankMovement** | `bank_movements` | Una línea de un estado de cuenta bancario (depósito/retiro). |
| **BankSettlementItem** | `bank_settlement_items` | Une **1 depósito ↔ N entries** (liquidación agrupada). |

## Los 4 motores (cada uno tiene su doc)

| Motor | Doc | Qué empareja |
|---|---|---|
| 1. Nacimiento de entries | [`01-ledger-entry-origins.md`](01-ledger-entry-origins.md) | De dónde sale cada `LedgerEntry` (9 orígenes). |
| 2. CFDI ↔ entry | [`02-cfdi-matching.md`](02-cfdi-matching.md) | Factura del SAT contra un movimiento del ledger. |
| 3. Banco ↔ entry | [`03-bank-reconciliation.md`](03-bank-reconciliation.md) | Línea bancaria contra entry(s): 1:1, neto-de-comisión, liquidación. |
| 4. Prompt del agente | [`04-llm-assistant-prompt.md`](04-llm-assistant-prompt.md) | Reglas destiladas para el agente Haiku. |
| Gap. Identidad fiscal en cita | [`05-appointment-rfc-gap.md`](05-appointment-rfc-gap.md) | Cuánto RFC/nombre lleva un entry `cita` según cómo se creó (recurrente vs walk-in). |
| Gap. Matcher bancario | [`06-bank-matcher-gaps.md`](06-bank-matcher-gaps.md) | Motor 3 ignora `counterpartyName/Rfc`; columna "match" muestra categoría; dedup es a nivel statement, no transacción. |

---

## Glosario / campos clave de `LedgerEntry`

Estos son los campos que **cualquier permutación lee o escribe**. El agente los usa como señales.

| Campo | Tipo | Significado |
|---|---|---|
| `entryType` | `ingreso` \| `egreso` | Dirección del dinero. |
| `origin` | string | Cómo nació el entry (ver doc 01). |
| `amount` / `amountPaid` | decimal | Monto bruto / cuánto se ha cobrado-pagado. |
| `paymentStatus` | `PENDING` \| `PARTIAL` \| `PAID` | Estado de cobro/pago. |
| `transactionDate` | date | Fecha del hecho económico. |
| `formaDePago` | `efectivo`\|`transferencia`\|`tarjeta`\|`cheque` | Habilita la lógica neto-de-comisión (solo `tarjeta`). |
| `counterpartyRfc` | varchar(13) | **RFC de la contraparte denormalizado** (p.ej. RFC del paciente en un entry `cita`). Señal #1 del matcher CFDI. |
| `counterpartyName` | varchar(300) | Razón social de la contraparte (denormalizada). |
| `patientId` | text | Paciente (sin FK cruzada a medical_records, a propósito). |
| `satCfdiUuid` | string\|null | UUID del CFDI vinculado. `null` = sin factura. |
| `hasFactura` | bool | Tiene CFDI/XML. |
| `hasComprobante` | bool | Tiene evidencia bancaria (conciliado). |
| `needsReview` | bool | Auto-vinculado con confianza media → requiere ojo humano. |
| `autoLinkedConfidence` | decimal\|null | Confianza 0–1 del auto-link CFDI. |
| `bankMovementId` | string\|null | Referencia bancaria (texto del estado de cuenta). |
| `bankAccount` | string\|null | "Banco NúmeroCuenta" del estado conciliado. |
| Relación `bankMovement` | 1:1 | Línea bancaria vinculada (match directo). |
| Relación `settlementItem` | 1:1 | Asignación a una liquidación (match agrupado). |

### Las dos "evidencias" independientes
- **`hasFactura` / `satCfdiUuid`** = evidencia **fiscal** (CFDI). La da el motor 2.
- **`hasComprobante` / `bankMovement` / `settlementItem`** = evidencia **bancaria**. La da el motor 3.

Un entry puede tener una, ambas o ninguna. El objetivo de "estar completo" es **ambas**.

---

## Mapa mental (de extremo a extremo)

```
                 cita / venta / compra / webhook / manual
                          │  (crean entry SIN cfdi y normalmente SIN banco)
                          ▼
   SAT descarga ──► CFDI ──► [Motor 2: match-before-create]
                          │        ├─ alta confianza  → auto-link silencioso
                          │        ├─ media confianza → auto-link + needsReview
                          │        ├─ sugerencia (manual) → usuario vincula
                          │        └─ sin match → CREA entry nuevo (sat_emitido/recibido)
                          ▼
   PDF banco  ──► BankMovement ──► [Motor 3: matchMovements]
                          │        ├─ 1:1 exacto / referencia
                          │        ├─ 1:1 neto-de-comisión (tarjeta)
                          │        ├─ liquidación N:1 (manual "Varios")
                          │        ├─ crear entry desde banco (origin=banco)
                          │        └─ ignorar
                          ▼
                  LedgerEntry con hasFactura + hasComprobante = COMPLETO
```

## Cómo leer los docs de permutaciones
Cada doc lista **entradas → condición → resultado → reversibilidad**. Los números (puntajes,
umbrales, tolerancias) son los reales del código a esta fecha; si cambian en código, actualizar aquí.
</content>
</invoke>
