# Motor 2 — CFDI ↔ LedgerEntry (matching fiscal)

Empareja una **factura del SAT** (`SatCfdiMetadata`) con un movimiento del ledger. El corazón
es una sola función de scoring compartida: **`scoreCfdiMatch`** (`apps/api/src/lib/sat-auto-register.ts`).
Tres caminos la consumen (auto, registro manual, sugerencias) y por eso siempre concuerdan.

---

## 2.1 La función de scoring (máx. 120 puntos)

Los candidatos se **pre-filtran** a: mismo `entryType`, `satCfdiUuid = null`, `amount` dentro de
±1%, `transactionDate` dentro de ±7 días. Luego se puntúan:

| Señal | Puntos | Regla |
|---|---|---|
| **Monto** | 40 / 30 / 20 | exacto / dif < 0.1% / resto |
| **Fecha** | 30 / 25 / 15 / 12 | < 1 día / ≤ 2 / ≤ 4 / más |
| **RFC** | **+30** | `counterpartyRfc` (o fallback `client.rfc`/`supplier.rfc`) == RFC de la contraparte del CFDI (normalizado mayúsculas/sin espacios). Para `received` compara contra el **emisor**; para `emitted`, contra el **receptor**. |
| **Nombre** | **+20** | Nombre de la contraparte del CFDI vs `counterpartyName` **y** `concept` del entry. Fold NFD (sin acentos) + minúsculas, substring en cualquier dirección, requiere ≥ 4 caracteres. |

`confianza = raw / 120`.

### Por qué el RFC es la señal estrella
Monto + fecha + concepto **no distinguen** dos citas de la misma tarifa el mismo día. El RFC sí.
Por eso `cita` denormaliza el RFC del paciente: es lo único que rompe el empate.

### Permutaciones de puntaje (ejemplos reales)
| Escenario | Monto | Fecha | RFC | Nombre | Raw | Conf | Resultado auto |
|---|--:|--:|--:|--:|--:|--:|---|
| RFC + nombre + exacto mismo día | 40 | 30 | 30 | 20 | **120** | 1.00 | auto-link silencioso |
| Solo nombre (paciente sin RFC), exacto mismo día | 40 | 30 | 0 | 20 | **90** | 0.75 | auto-link silencioso |
| Ni RFC ni nombre, exacto mismo día | 40 | 30 | 0 | 0 | **70** | 0.58 | auto-link + `needsReview` |
| Monto aprox, +3 días, sin RFC/nombre | 20 | 15 | 0 | 0 | **35** | 0.29 | crea entry nuevo |

---

## 2.2 Camino A — Auto-registro (cron de sync)

`autoRegisterCfdisToLedger` corre tras un sync del SAT (worker `cron/sat-sync-worker`).
Solo procesa CFDIs con `efecto ∈ {I, E}` (salta P=pagos, T=traslados, N=nómina).

| Confianza del mejor candidato | Acción (`action`) | Qué escribe |
|---|---|---|
| **≥ 0.67** | `auto_linked` | Vincula al entry: `satCfdiUuid`, `hasFactura=true`, `autoLinkedConfidence`, `needsReview=false`. |
| **0.50 – 0.66** | `auto_linked_review` | Igual, pero `needsReview=true` (badge amarillo + botón Desvincular inline). |
| **< 0.50** | `created` | **Crea** entry nuevo (`sat_emitido`/`sat_recibido`) con contraparte denormalizada. |

## 2.3 Camino B — "Registrar pendientes" (manual, `register-to-ledger`)

El usuario selecciona CFDIs y los registra. **Match-before-create** con umbral más conservador:

| Condición | Resultado |
|---|---|
| CFDI ya tiene entry (`satCfdiUuid` set) | `skipped`. |
| Existe candidato con **raw ≥ 70** y el UUID **no** está en `skipMatchUuids` | Devuelve **`suggestion`** (top 5). **No** vincula solo — el usuario confirma. `confidence`: high ≥ 80 / medium si no. |
| Sin candidato ≥ 70, o el usuario eligió "crear nuevo" (`skipMatchUuids`) | `created` (entry nuevo). |

> Diferencia clave vs. Camino A: el registro manual **nunca auto-vincula**; solo sugiere. El
> auto-registro del cron sí auto-vincula (≥ 0.50).

## 2.4 Camino C — Sugerencias por entry (popover "CFDI")

Para un entry **sin** CFDI, el botón ámbar **CFDI** en la tabla Flujo de Dinero abre
`CfdiSuggestionPopover` → `GET .../ledger/:id/cfdi-suggestions`.

- Busca CFDIs `Vigente`, `monto` ±1%, `issuedAt` ±7d, dirección compatible con `entryType`,
  excluyendo los ya vinculados; devuelve **top 5** por puntaje.
- Etiqueta: **Alta** (≥80) / **Media** (≥50) / **Baja** (<50). **Se muestran todas, incluso Baja.**
- El usuario pulsa **Vincular** → `POST .../link-cfdi` → set `satCfdiUuid`, `hasFactura`, crea
  `LedgerFacturaXml` desde el detalle.

### Direcciones esperadas por `entryType`
| entryType | CFDIs candidatos |
|---|---|
| `ingreso` | `emitted`+`I` (vendí) **o** `received`+`E` (nota de crédito recibida) |
| `egreso` | `received`+(no `E`) (compré) **o** `emitted`+`E` (nota de crédito emitida) |

## 2.5 Deshacer un match CFDI (reversibilidad)

`DELETE .../ledger/:id/link-cfdi`:
- Limpia `satCfdiUuid`, `needsReview`, `autoLinkedConfidence`; borra el `LedgerFacturaXml`.
- `hasFactura → false` **salvo** que el entry tenga PDFs de factura subidos (entonces queda `true`).

| Dónde se deshace en la UI | Aplica a |
|---|---|
| Botón **Desvincular / ✕** inline en la tabla | Solo entries con `needsReview` (los auto-links de confianza **media**). |
| Modal **Ver factura CFDI** → **Desvincular** (con confirm) | **Cualquier** entry vinculado, incluidos los auto-links silenciosos de confianza alta. |

> ⚠️ Asimetría intencional: el auto-link **alto** (≥0.67) no marca `needsReview`, así que **no**
> tiene botón inline — se deshace solo desde el modal. Es diseño: los inciertos se revisan, los
> seguros no estorban.

---

## Resumen de permutaciones (motor 2)

| # | Disparador | Confianza/condición | Resultado | Reversible por |
|---|---|---|---|---|
| 2a | Sync cron | ≥ 0.67 | auto-link silencioso | Modal |
| 2b | Sync cron | 0.50–0.66 | auto-link + needsReview | Inline o modal |
| 2c | Sync cron | < 0.50 | crea entry nuevo | (borrar entry) |
| 2d | Registrar pendientes | raw ≥ 70 | sugerencia (usuario confirma) | Modal/inline tras vincular |
| 2e | Registrar pendientes | < 70 o skip | crea entry nuevo | (borrar entry) |
| 2f | Popover CFDI por entry | usuario elige (any score) | vincula | Modal/inline |
| 2g | Cualquiera | CFDI ya vinculado a otro entry | 409 rechazo | — |

→ Continúa en [`03-bank-reconciliation.md`](03-bank-reconciliation.md).
</content>
