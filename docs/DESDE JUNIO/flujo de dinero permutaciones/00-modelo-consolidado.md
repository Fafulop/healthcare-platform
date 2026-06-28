# Flujo de Dinero — Modelo Consolidado (entendimiento a junio 2026)

> **Propósito.** Una sola fuente de verdad para **todos** los ingresos y egresos del doctor,
> agregando automáticamente las tres "puertas" por las que entra el dinero (operación, factura SAT,
> banco) **sin duplicar** el mismo hecho económico. Este documento consolida cómo está construido
> hoy, qué falta, y cómo se ve el flujo en todas sus permutaciones.
>
> Acompaña a `../../TODO FACTURAS/flujo permutations/` (mapa por motor) y a
> `../../PERMUTATIONS/` (lifecycle y arquitectura). Los números, campos y umbrales aquí citados son
> los **reales del código** a esta fecha; si cambian en código, actualizar aquí.

---

## 1. El principio: una tabla, dos evidencias, tres puertas

Existe **exactamente una fuente de verdad**: `LedgerEntry`
(`packages/database/prisma/schema.prisma:1115`, tabla `practice_management.ledger_entries`).
Cada ingreso y cada egreso es **una fila** aquí. Todo lo demás se **adjunta** a esa fila.

Cada entry lleva **dos evidencias independientes**. Esta es la clave para no duplicar:

| Eje | Campos | Qué prueba | Cardinalidad con el entry |
|---|---|---|---|
| 🧾 **Fiscal** | `hasFactura`, `satCfdiUuid` (+ `LedgerFacturaXml`, `CfdiEmitted`) | Que existe un CFDI que respalda el dinero | **1:1** (`satCfdiUuid` es `@unique`) |
| 🏦 **Bancaria** | relación `bankMovement` *o* `settlementItem` (+ flag `hasComprobante`) | Que el dinero **realmente** entró/salió de un banco | **1:1** directa, o **N:1** vía liquidación |

Un entry puede tener **una, ambas o ninguna**. La meta de "estar completo" es **ambas**.

> ⚠️ **Matiz importante de `hasComprobante`.** El flag `hasComprobante` **no** es prueba estricta de
> conciliación bancaria: se pone en `true` tanto por un match bancario real (Motor 3) **como** por
> **subir cualquier adjunto/comprobante manual** (`ledger/[id]/attachments`), por un webhook, o por
> nacer con `origin=banco`. La señal **dura** de "el dinero pasó por el banco" es la **relación**
> `bankMovement` / `settlementItem`, no el flag. Para "saber dónde está el dinero" de verdad, confiar
> en la relación; `hasComprobante` solo dice "hay *alguna* evidencia adjunta".

El dinero entra por **tres puertas** (`origin`):

1. **Operación** — `cita`, `venta`, `compra`, `webhook_pago`, `manual`. El hecho real; trae la
   identidad de la contraparte (RFC/nombre) pero **sin** factura ni banco todavía.
2. **Factura SAT** — `sat_emitido` / `sat_recibido`. Un CFDI descargado que **no** encontró entry
   previo, así que **se vuelve** su propio entry.
3. **Banco** — `banco`. Una línea bancaria sin entry previo que **se vuelve** entry.
4. *(interno)* `comision` — la comisión neta de terminal/banco; **excluida** de los pools de match
   para que no se empareje con un retiro futuro.

---

## 2. El problema central: "tres puntos, un solo ingreso"

Un mismo ingreso puede aparecer hasta **tres veces**:
- desde la **cita** (el doctor atendió y cobró),
- desde la **factura** (CFDI emitido, p.ej. a una empresa como Elanco),
- desde el **banco** (el depósito real).

El sistema debe registrar **un solo `LedgerEntry`** con esos tres conceptos plegados. Eso se logra
con **match-before-create** en dos motores:

- **Motor 2 (CFDI ↔ entry)** — cuando llega el CFDI del SAT, intenta **adjuntarse** al entry de
  `cita` existente (`satCfdiUuid` + `hasFactura=true`) en vez de crear una segunda fila. El **RFC**
  es la señal decisiva.
- **Motor 3 (Banco ↔ entry)** — cuando llega la línea bancaria, intenta **adjuntarse** a ese mismo
  entry (`hasComprobante=true` + vincula el `BankMovement`) en vez de crear una tercera fila.

```
  cita  (crea el entry; RFC denormalizado)
        │
        ├──◄ Motor 2: CFDI del SAT se adjunta   → 🧾 hasFactura
        │
        └──◄ Motor 3: línea bancaria se adjunta → 🏦 hasComprobante
        ▼
  UN SOLO LedgerEntry: fiscal + banco = COMPLETO
```

> **Regla anti-duplicado.** El error que estos motores evitan: que la *misma* operación económica
> genere **dos** entries (uno por `cita` y otro por `sat_emitido`, o uno por `cita` y otro por
> `banco`). Antes de crear, ambos buscan un entry existente y se vinculan a él.

### Orden recomendado para que el match funcione
1. **Primero** nacen los entries de operación (`cita`, `venta`, `compra`, `webhook_pago`, manual):
   traen identidad de contraparte, **sin** factura ni banco.
2. **Después** llega el CFDI (Motor 2) y se **vincula** en vez de duplicar.
3. **Al final** llega la línea bancaria (Motor 3) y aporta 🏦.

Si se invierte (registrar CFDIs primero con el ledger vacío), cada CFDI nace como
`sat_emitido`/`sat_recibido` por su cuenta — válido para un doctor nuevo sin historial, pero **no**
ejercita el match `cita → CFDI`.

### Tercer guard: detección de duplicados al crear (POST)

Además de los Motores 2 y 3 (que deduplican cuando *llega* un CFDI o una línea bancaria), existe un
**tercer guard, más simple**, en la **creación manual/API** de entries
(`POST /api/practice-management/ledger`, `route.ts:256`). Es una advertencia "blanda", no un match.

**Cuándo corre:** en todo POST **excepto** cuando `body.force === true`, o `origin === 'cita'`, o
`origin === 'webhook_pago'` (esos dos tienen su propia idempotencia: `bookingId @unique` y el
chequeo de idempotencia del webhook).

**Qué busca** (ventana de posible duplicado):
- mismo `entryType`,
- `amount` dentro de **±1%** (`amount*0.99 … amount*1.01`),
- `transactionDate` dentro de **±3 días**.

**Qué hace si encuentra ≥1 candidato:**
- **NO crea** el entry. Devuelve **`409`** con `warning: true`, un mensaje y hasta **5**
  `potentialDuplicates`.
- El usuario decide: re-enviar el POST con **`force: true`** para crear de todos modos, o cancelar.

> **Diferencia con los otros dedup.** Este guard es **preventivo y manual** (avisa al capturar, antes
> de duplicar), mientras que Motores 2/3 son **reactivos** (vinculan cuando llega evidencia externa).
> Y es distinto de los candados **duros** de unicidad (`satCfdiUuid @unique`, `bookingId @unique`,
> `BankMovement.ledgerEntryId @unique`), que **rechazan** sí o sí. Este solo **advierte** y es
> override-able con `force`.

**Implicación para pruebas:** al capturar manuales (Bloque B/I del checklist), si repites un monto
similar en ±3 días verás el **409 de advertencia** — es el comportamiento correcto, no un error.
Para forzar el alta usa `force: true` (o cambia monto/fecha fuera de la ventana).

---

## 3. ⚠️ Mismatch importante con el modelo de negocio: PUE vs PPD

**Verdad de negocio:** que exista una factura **no** implica que el dinero ya se movió.
- **PUE** (Pago en Una Exhibición) = pagado al momento de emitir. ~90% de los casos.
- **PPD** (Pago en Parcialidades o Diferido) = se paga después, vía **complemento de pago**
  (CFDI tipo **P**). La factura existe, pero el dinero llega en el futuro.

**Qué hace el código (✅ resuelto jun 2026 — antes era el gap #1):**
- `metodoPago` (PUE/PPD) se captura en `SatCfdiDetail.metodoPago` y `LedgerFacturaXml.metodoPago`.
- Los complementos de pago (tipo P) se rastrean en `SatPago` (`pagoUuid → facturaUuid` con
  `montoPagado`, `saldoInsoluto`, `numParcialidad`).
- **Parte A — estado inicial correcto:** el auto-registro deriva el `paymentStatus` de `metodoPago`
  vía `resolvePaymentStatus()` (`sat-auto-register.ts`): un CFDI **emitido PUE → PAID**, **emitido
  PPD → PENDING** (antes era PAID sin condición). El back-enrich corrige los PPD ya creados al
  llegar el XML. Una factura PPD a Elanco ahora nace **PENDING** (sin dinero aún), como debe ser.
- **Parte B — el complemento mueve el estado:** `reconcilePpdToLedger()`
  (`sat-ppd-reconcile.ts`) toma los `SatPago` y, por factura, deriva el estado con
  `computePpdStatus()` (misma lógica que el tab PPD/Pagos) y lo propaga al `LedgerEntry` por
  `satCfdiUuid == facturaUuid` (case-insensitive). **Upgrade-only** (PENDING→PARTIAL→PAID; nunca
  degrada ni pisa una marca manual). Excluye complementos **cancelados**
  (`filterActiveByVigenteComplement`). Corre tras cada sync XML (acotado a las facturas pagadas en
  ese job) y en el backfill ("Registrar pendientes", catch-up total).
- El auto-registro sigue procesando solo `efecto ∈ {I, E}`; los complementos `P` ya **no** necesitan
  crear entry — alimentan el `paymentStatus` del entry de la factura vía el reconcile.

> **Gap #1 — CERRADO.** El sistema ya distingue *evidencia fiscal* (existe la factura) de *dinero
> movido* para los PPD: la factura nace PENDING y solo pasa a PARTIAL/PAID cuando llega el
> complemento que lo prueba. Detalle y límites en §8.1. (El plan original
> `../../PERMUTATIONS/ppd-ledger-redesign.md` queda como antecedente.)

---

## 4. Campos clave de `LedgerEntry` (señales que leen/escriben los motores)

| Campo | Tipo | Significado |
|---|---|---|
| `entryType` | `ingreso` \| `egreso` | Dirección del dinero. |
| `origin` | string | Puerta por la que nació (ver §1). |
| `amount` / `amountPaid` | decimal | Monto bruto / cuánto se ha cobrado-pagado. |
| `paymentStatus` | `PENDING`\|`PARTIAL`\|`PAID` | Estado de cobro/pago. |
| `transactionDate` | date | Fecha del hecho económico. |
| `formaDePago` | `efectivo`\|`transferencia`\|`tarjeta`\|`cheque`\|`deposito` | Habilita lógica neto-de-comisión (solo `tarjeta`). |
| `counterpartyRfc` | varchar(13) | **RFC de la contraparte denormalizado**. Señal #1 del matcher CFDI. |
| `counterpartyName` | varchar(300) | Razón social de la contraparte (denormalizada). |
| `patientId` | text | Paciente (sin FK cruzada, a propósito). |
| `serviceId` / `serviceName` | string | Servicio del catálogo del doctor (fuente de ingresos). |
| `satCfdiUuid` | string\|null | UUID del CFDI vinculado. `null` = sin factura. **`@unique`.** |
| `hasFactura` | bool | Tiene CFDI/XML. |
| `hasComprobante` | bool | Tiene evidencia bancaria. |
| `needsReview` | bool | Auto-vinculado con confianza media → requiere ojo humano. |
| `autoLinkedConfidence` | decimal\|null | Confianza 0–1 del auto-link CFDI. |
| `bankMovementId` | string\|null | **Referencia de texto** del estado de cuenta (NO es FK). |
| `bankAccount` | string\|null | "Banco NúmeroCuenta" del estado conciliado. |
| relación `bankMovement` | 1:1 | Línea bancaria vinculada (match directo). |
| relación `settlementItem` | 1:1 | Asignación a una liquidación (match agrupado N:1). |

---

## 5. Los motores (dónde vive cada uno en el código)

| Motor | Qué hace | Archivo |
|---|---|---|
| **1. Nacimiento** | De qué puerta sale cada entry (9 orígenes). | `cita`: `apps/doctor/.../appointments/_hooks/useBookings.ts:250`; `sat_*`/`comision`/`banco`: ver motores 2/3. |
| **2. CFDI ↔ entry** | `scoreCfdiMatch` (máx 120: monto 40 / fecha 30 / **RFC +30** / nombre +20; conf = raw/120). ≥0.67 auto-link; 0.50–0.66 auto-link + `needsReview`; <0.50 crea entry. | `apps/api/src/lib/sat-auto-register.ts` |
| **3. Banco ↔ entry** | `amountMatchKind` (`exact` / `card_fee` ≤4% ×0.9 / null) + 4 prioridades (0.99 ref+exacto+≤1d · 0.85 mismo día · 0.70 ±2d · ≤0.65 ±7d+concepto). Acciones manuales: confirm, link_existing, **link_settlement** (N:1, comisión ≤8%), create_entry, ignore, unmatch. | `apps/api/src/lib/bank-matching.ts` y `.../conciliacion-bancaria/[id]/movements/[movId]/route.ts` |
| **4. Agente LLM** | *(diseño, no implementado)* leería las señales del entry y **propondría** la siguiente acción (vincular CFDI, confirmar banco, "Varios", crear, ignorar, escalar a humano). | — (borrador en `../../TODO FACTURAS/flujo permutations/04-llm-assistant-prompt.md`) |
| **5. PPD ↔ pago** | Propaga complementos (tipo P → `SatPago`) al `paymentStatus` del entry de la factura: `computePpdStatus` (último `saldoInsoluto`: 0=PAID, parcial=PARTIAL) → match por `satCfdiUuid == facturaUuid` (case-insensitive) → **upgrade-only**. Excluye complementos cancelados. Corre tras el sync XML (acotado) y en el backfill. *(Parte B del gap #1, §3/§8.1.)* | `apps/api/src/lib/sat-ppd-reconcile.ts` |

> **Nota — parser de PDF bancario (≠ Motor 4).** Subir un PDF de estado de cuenta usa **GPT-4o**
> (`apps/doctor/src/app/api/bank-statement-parse/route.ts`) **solo para extraer** los movimientos
> a JSON estructurado. No concilia nada; es un alimentador alterno (vs CSV) que produce los
> `BankMovement` que luego procesa el Motor 3.

---

## 6. Permutaciones — estado del entry = 🧾 × 🏦

Todo entry está en uno de cuatro estados. La meta es la esquina inferior derecha.

| | 🏦 sin banco | 🏦 banco conciliado |
|---|---|---|
| **🧾 sin factura** | Solo registrado | Dinero confirmado, falta factura |
| **🧾 con factura** | Facturado, dinero no confirmado | ✅ **Completo** |

### Ingresos

**A. Consulta en efectivo, paciente NO quiere factura** (`efectivo`)
`cita` → entry PAID, 🧾✗ 🏦✗. **Techo** = se queda arriba-izquierda para siempre (el efectivo no
deja rastro bancario, no habrá CFDI). Es *correctamente completo* para su tipo: no hay nada que
adjuntar.

**B. Consulta por transferencia, paciente SÍ quiere factura** (`transferencia`, PUE) — camino feliz
1. `cita` completada → entry, RFC denormalizado, 🧾✗ 🏦✗
2. Sync SAT baja el CFDI emitido → Motor 2 empareja por RFC+monto+fecha (~120) → adjunta → 🧾✓
3. Se sube estado de cuenta → Motor 3 empareja el SPEI → 🏦✓ → **Completo**

**C. Consulta con tarjeta, factura PUE** (`tarjeta`) — neto de comisión
Igual que B, pero el depósito llega ~3% por debajo del bruto. El `card_fee` (≤4%) del Motor 3 lo
toma 1:1; **o** si es un payout agrupado, se liquidan varias citas contra un depósito
(`link_settlement`, N:1) y opcionalmente se registra la comisión como egreso `origin=comision`.

**D. Factura PPD a una empresa (caso Elanco)** — ✅ resuelto (gap #1, §3)
1. Emites CFDI PPD → nace `sat_emitido`, **PENDING** (Parte A: `resolvePaymentStatus`, sin dinero aún)
2. Semanas después Elanco paga → llega un **complemento (tipo P)** → `SatPago` → **Motor 5**
   (`reconcilePpdToLedger`) mueve el entry a **PARTIAL/PAID** según `saldoInsoluto`
3. Llega el depósito bancario → Motor 3 *puede* adjuntar 🏦 → **Completo**
El estado de pago ahora sigue al dinero real: PENDING hasta que el complemento lo prueba.

**E. Pago en línea** (`webhook_pago`)
Entry nace PAID + 🏦 auto (`hasComprobante=true`, el webhook es prueba). Pero el payout bancario
real es un **lote agregado** (N pagos menos comisiones), así que el Motor 3 no lo empareja 1:1 →
estos se **excluyen** de los KPIs de conciliación bancaria. El CFDI se adjunta normal.

**F. Depósito bancario sin entry previo** (`banco`)
Depósito sin match → `create_entry` → entry nuevo nace 🏦✓, origin=banco. Luego el Motor 2 puede
adjuntar un CFDI → 🧾✓.

### Egresos

**G. Factura de proveedor, PUE** — egreso limpio
CFDI recibido → sin entry que coincida → crea entry `sat_recibido`, `egreso`, **PENDING**, 🧾✓,
auto-crea el `Proveedor` por RFC. Después el retiro bancario adjunta → 🏦✓ → Completo y pagado.

**H. Factura de proveedor, PPD** — pagar después
Igual que G pero realmente lo debes a futuro; el complemento + retiro bancario confirman el pago.
(Aplica el mismo gap de complemento del caso D, lado egreso.)

**I. Gasto en efectivo, sin factura** (renta a arrendador informal)
`manual` egreso → 🧾✗ 🏦✗. Techo = documentado. No llegará factura; efectivo, sin línea bancaria.

**J. Retiro bancario, sin factura** (comisión bancaria)
`banco` egreso vía `create_entry` → 🏦✓, 🧾✗ (suele quedarse así; las comisiones bancarias rara vez
tienen CFDI aparte).

---

## 7. Reversibilidad (deshacer) y su asimetría

| Deshacer | Qué limpia | Asimetría |
|---|---|---|
| **Desvincular CFDI** (`DELETE .../link-cfdi`) | `satCfdiUuid`, `needsReview`, `autoLinkedConfidence`; `hasFactura→false` salvo que haya PDFs subidos. | ✓ Sí resetea evidencia fiscal. |
| **`unmatch` / `unlink_settlement`** banco | Devuelve el `BankMovement` a `unmatched`; borra `BankSettlementItem`. | ⚠️ **NO** revierte `hasComprobante` ni `paymentStatus=PAID` del entry. |

> ⚠️ **Gotcha:** un entry puede quedar marcado como cobrado/con-comprobante aunque ya no tenga línea
> bancaria asociada. Candidato a unificar con el comportamiento del CFDI a futuro.

---

## 8. Qué está construido vs. qué falta

**Construido y sólido:**
- ✅ Tabla única `LedgerEntry` con los dos ejes de evidencia.
- ✅ Dedup vía match-before-create en CFDI (Motor 2) y banco (Motor 3) — la anti-duplicación.
- ✅ SAT descarga como fuente de verdad de facturas; auto-link de CFDI por RFC.
- ✅ Liquidación N:1 para payouts agrupados/tarjeta; tolerancia de comisión.
- ✅ Auditoría en matches bancarios (`matchedAt`/`matchedBy`/`matchHistory`).

**Faltante / gaps para el objetivo:**
1. **PUE/PPD no respetado** *(gap #1)* — ✅ **Cerrado (jun 2026, A+B).**
   - **Parte A:** el `paymentStatus` se deriva de `metodoPago` vía `resolvePaymentStatus()` — un CFDI
     **emitido PPD** nace **PENDING** (antes PAID sin condición); el back-enrich corrige los ya creados.
   - **Parte B:** los complementos (tipo P → `SatPago`) ahora **sí** alimentan el ledger:
     `reconcilePpdToLedger()` deriva el estado por factura (misma lógica que el tab PPD, vía
     `computePpdStatus()`) y lo propaga al `LedgerEntry` por `satCfdiUuid == facturaUuid`
     (case-insensitive). **Upgrade-only** (PENDING→PARTIAL→PAID; nunca degrada ni pisa una marca
     manual). Corre tras cada sync XML (acotado a las facturas pagadas en ese job) y en el backfill
     (catch-up total).
   - Los complementos **cancelados** se excluyen (`filterActiveByVigenteComplement`, join
     `pagoUuid → SatCfdiMetadata.satStatus`) tanto en el reconcile como en el tab PPD, así no marcan
     PAID dinero que no entró válidamente.
   - ⚠️ *Límite:* por ser upgrade-only, un PPD marcado PAID a mano por error no se baja a PARTIAL.
2. **Matcher bancario ignora contraparte** — mismo monto + mismo nombre, días distintos → "Sin
   match". El RFC/nombre denormalizado alimenta el Motor 2 pero **nunca** el Motor 3.
3. **Sin reverse matching** — un entry creado *después* de importar un estado de cuenta no se
   auto-adjunta a la línea bancaria ya cargada.
4. **Agregación de payouts de pasarela** — depósitos en lote no concilian 1:1.
5. **Sin agente de conciliación** (Motor 4) — los casos ambiguos de 2–4 son manuales hoy.
6. **Registro de CFDI antes del XML → datos pobres** *(detectado jun 2026)* — el auto-registro corre
   en la etapa de **metadata** (`sat-sync-worker:493`), **antes** de descargar el XML, así que los
   entries `sat_emitido`/`sat_recibido` nacen con **concepto genérico** ("CFDI recibido de…"),
   **forma de pago default** y sin `metodoPago`. Cuando el XML llega, el UUID ya está vinculado y el
   filtro `alreadyLinked` lo **saltaba** → nunca se enriquecía. Síntoma observable: borrar y
   **re-registrar** el mismo CFDI produce un entry **distinto** (concepto real, forma correcta),
   porque ahí ya existe el XML. *(Fix aplicado: enrich-on-XML + mapa de forma ampliado; ver
   [`STEP-BY-STEP-TESTING.md`](STEP-BY-STEP-TESTING.md) §5.)*

**Prioridad sugerida:** #1 (PPD/PUE) por encima de las demás — es un problema de **correctitud**
sobre ~10% de las facturas, no de conveniencia. Rompe directamente "una factura ≠ dinero movido".

---

## 9. Reset para pruebas — qué se puede borrar y cómo recrear

> **Objetivo del reset.** Probar todas las permutaciones "como doctor nuevo": borrar **todos** los
> `LedgerEntry` y reconstruirlos a mano (citas, banco, manuales) + backfill de SAT, **conservando
> intactas las facturas**. Solo Railway (app desplegada); no hay base de datos ni código local.

### 9.1 Por qué es seguro borrar todo el Flujo de Dinero

La conexión SAT → Flujo de Dinero es **unidireccional y débilmente acoplada**: el único vínculo es
la columna `LedgerEntry.satCfdiUuid`, que **apunta hacia** la metadata del SAT. Las tablas de
facturas **no** tienen FK de regreso al ledger. Por eso borrar entries **no toca ninguna factura**.

| Registro relacionado | onDelete | Resultado al borrar el entry |
|---|---|---|
| `SatCfdiMetadata` / `SatCfdiDetail` / `SatPago` (facturas descargadas) | **sin FK al ledger** | ✅ **Intacto** |
| `CfdiEmitted` (facturas emitidas por el sistema vía Facturama) | `SetNull` (schema:2558) | ✅ **Sobrevive**, solo se desvincula |
| `BankStatement` / `BankMovement` | `SetNull` en `ledger_entry_id` del movimiento | ✅ Movimientos sobreviven (quedan unmatched, estado stale) |
| `Booking` (citas) | padre, sin cascade | ✅ Sobrevive |
| `LedgerAttachment`, `LedgerFactura`, `LedgerFacturaXml`, `BankSettlementItem` | `Cascade` | ❌ Se borran (son hijos del entry; se recrean al reconstruir) |

**Conclusión:** tanto las facturas **descargadas del SAT** como las **emitidas por el sistema** son
seguras. Solo mueren las filas del ledger y sus adjuntos derivados.

### 9.2 Dos formas de borrar en masa

| Vía | Cómo | Alcance / límites |
|---|---|---|
| **UI Flujo de Dinero** | Checkbox "seleccionar todo" → eliminar seleccionados (`handleBatchDelete`) | Solo la **página actual** (paginación server-side, `PAGE_SIZE = 100`). Hay que repetir por página. Hace **1 request DELETE por fila**. Bien para volúmenes chicos. |
| **SQL en Railway** | Correr SQL contra el Postgres (igual que `check.sql`/`fix.sql`) | Borra todo en una sentencia. Recomendado para wipe completo. |

Ambas usan el **mismo endpoint/cascade** → las facturas quedan seguras en cualquier caso.
(No existe un botón único de "borrar todo el ledger"; por eso el SQL es la vía limpia para wipe total.)

### 9.3 SQL de reset (Railway) — acotado a un doctor

```sql
-- 1. Obtener el id del doctor de prueba
SELECT id, email FROM "public"."doctors" WHERE email = 'tu-doctor-de-prueba@email';

-- 2. Clean slate (CONSERVA todas las facturas). Cascade a attachments/facturas/xml/settlement;
--    pone en null los links de bank_movements y cfdis_emitted automáticamente.
DELETE FROM practice_management.ledger_entries WHERE doctor_id = '<DOCTOR_ID>';

-- 3. (recomendado) borrar también estados de cuenta para re-subirlos limpios,
--    en vez de dejar movimientos "matched" apuntando a nada. Cascade a los movimientos.
DELETE FROM practice_management.bank_statements WHERE doctor_id = '<DOCTOR_ID>';
```

> Nombres confirmados del schema: `public.doctors`, `practice_management.ledger_entries`,
> `practice_management.bank_statements`.

### 9.4 Recrear las facturas como entries (sin re-descargar del SAT)

El guard de idempotencia (`sat-auto-register.ts:187`) solo evita recrear un CFDI **si ya existe un
entry con ese `satCfdiUuid`**. Al borrar los entries, ese guard queda vacío → **todos los CFDIs
Vigentes (efecto I/E) vuelven a ser "sin vincular"** y se pueden reconstruir.

- **Backfill (todos):** `POST /api/sat-descarga/backfill-ledger` — botón en el panel de Sync.
  Llama a `autoRegisterCfdisToLedger(doctorId)` sin filtro de sync job → procesa **todos**.
- **Manual (selección):** `POST /api/sat-descarga/register-to-ledger` con UUIDs específicos.

### 9.5 ⚠️ El ORDEN de reconstrucción decide si la prueba es válida

El matcher solo deduplica si el **entry de operación existe ANTES de que llegue la factura**.
Orden correcto (refleja el mundo real):

1. **Primero: recrear citas / manuales / ventas** → entries **sin** factura ni banco.
2. **Después: backfill de SAT** → las facturas intentan **emparejar** esas citas (Motor 2).
   Aquí se verifican las permutaciones de dedup (auto-link ≥0.67, `needsReview` 0.50–0.66, etc.).
3. **Al final: re-subir el estado de cuenta** → Motor 3 adjunta 🏦.

> **Gotcha:** si se hace **backfill primero** con el ledger vacío, cada factura crea un entry
> standalone (`sat_emitido`/`sat_recibido`) y luego las citas recreadas **no** retro-emparejan (no
> hay reverse matching — gap §8.3) → **duplicados**: un `sat_emitido` + una `cita` por el mismo
> ingreso. Útil para *ver* el problema de duplicados, pero incorrecto para validar el camino feliz.
> **Regla:** citas antes del backfill, siempre.

---

*Estado:* consolidado a junio 2026. Verificado contra el código en esta fecha. Relacionado:
`../../TODO FACTURAS/flujo permutations/` (detalle por motor), `../../PERMUTATIONS/` (lifecycle).
</content>
</invoke>
