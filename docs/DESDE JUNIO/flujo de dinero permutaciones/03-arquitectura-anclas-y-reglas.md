# Arquitectura de anclas y reglas — Generación e input de ingresos

> **Propósito.** Diseñar el "esqueleto" correcto para que un ingreso (venga de cita, factura, banco,
> pago en línea o manual) **converja en un solo `LedgerEntry`** sin orfanatos ni duplicados, con
> **reglas de UI/UX** que lo hagan ordenado por construcción, y que todo se proyecte en el
> **expediente del paciente**.
>
> Nivel: **diseño/blueprint** (sin cambios de código todavía). Lee primero
> [`00-modelo-consolidado.md`](00-modelo-consolidado.md) (modelo y motores actuales) y
> [`01-permutaciones-de-prueba.md`](01-permutaciones-de-prueba.md) (permutaciones).

---

## 1. El problema que resuelve

Hoy **cualquier fuente puede crear cualquier cosa de forma independiente**, y de ahí el caos:

- Se puede **emitir una factura desde el sistema sin vincularla a nada**: el endpoint
  `POST /api/facturacion/cfdi` recibe `ledgerEntryId` **opcional** y guarda
  `ledgerEntryId || null` (`facturacion/cfdi/route.ts:264`). Emisión standalone → **CFDI huérfano**.
- Un pago (Stripe/MercadoPago) puede existir sin ancla clara.
- El mismo ingreso puede aparecer 3 veces (cita, factura, banco) y depender de los motores de dedup
  para reconciliarse *después*.

**Idea central:** en vez de limpiar duplicados a posteriori, hacer que **todo nazca enlazado**. Un
ingreso tiene **un ancla**; factura y pago **cuelgan** del ancla; todo **converge en un solo entry**.

---

## 2. Modelo de anclas

### 2.1 Regla maestra

> **Todo ingreso tiene exactamente UN ancla, y produce exactamente UN `LedgerEntry`.
> La factura y el pago DEBEN adjuntarse a un ancla — nunca existir sueltos.**

El **ancla** es el hecho real que origina el ingreso. Es **polimórfica pero obligatoria**:

| Ancla | Cuándo | Estado hoy |
|---|---|---|
| **`cita`** | Hay una consulta (caso preferente) | ✅ Ya crea 1 entry (`bookingId @unique`) |
| **`venta`** | Venta de producto/servicio | ✅ Existe (`saleId`) |
| **`manual`** | Ingreso sin cita (catch-all) | ✅ Existe |
| **`banco`** | Dinero que aparece sin evento previo | ✅ Existe (`create_entry`) |

> ⚠️ **No "cita-first" como regla universal.** Walk-ins, depósitos bancarios y manuales existen. La
> regla universal NO es "siempre cita", es **"siempre exactamente un ancla, y factura/pago se anclan
> a una"**. La cita es el ancla *preferida* cuando hay consulta.

### 2.2 El `LedgerEntry` como punto de convergencia

El ancla genera **un** `LedgerEntry`. Todo lo demás **enriquece** ese entry, no lo duplica:

```
            ANCLA (cita / venta / manual / banco)
                       │  crea
                       ▼
                 ┌─────────────┐
                 │ LedgerEntry │  ← punto único de convergencia
                 └─────────────┘
            ▲          ▲           ▲
        adjunta     adjunta     adjunta
            │          │           │
       💵 Pago     🧾 Factura   🏦 Banco
   (link MP/Stripe) (CFDI emitido (conciliación
                     o del SAT)    de línea bancaria)
```

No se introduce una tabla nueva: el "ancla" ya está modelada por `bookingId` / `saleId` / `origin`.
Lo que cambia son las **reglas de enlace** y la **UX**, no el esquema base.

---

## 3. Las reglas de UI/UX (los "no puedes…")

Estas reglas son lo que elimina el caos **por construcción**:

1. **No puedes emitir una factura (tipo I) sin elegir para qué es.** La emisión de **ingreso** exige
   un ancla (cita / venta / entry existente), o **crea** el entry en el acto (ancla=factura). Se
   elimina la emisión huérfana.
   → *Cambio A:* `ledgerEntryId` (o `bookingId`) **obligatorio** para CFDI tipo I en
   `POST /facturacion/cfdi`.
   → *Cambio B (CRÍTICO, ver Gap 1 §10):* al emitir, **estampar también `entry.satCfdiUuid = uuid`**
   (hoy solo se pone `hasFactura=true`, `cfdi/route.ts:287`). Sin esto, cuando el SAT descargue esa
   misma factura, Motor 2 la ve "sin vincular" y puede **duplicarla**.
   → *Excepción de tipo:* **REP** (tipo P) y **Nota de Crédito** (tipo E) **no** anclan a un entry de
   ingreso nuevo: el REP ancla a la **factura PPD que paga**; la nota de crédito al **entry/original**
   que corrige (ver Gap 3 §10).
2. **No puedes crear un link de pago sin ancla.** El link (Stripe/MP) se crea **desde** una cita o
   venta y hereda monto, paciente y datos fiscales.
   → *⚠️ Estado real (Gap 2 §10):* hoy el webhook **NO enriquece** el entry existente — si ya hay un
   entry para ese `bookingId`, `createPaymentLedgerEntry` hace `return null` y **omite**
   (`practice-utils.ts:113`). Idempotencia (sin duplicado) ✓, pero **no marca PAID** una cita que se
   completó "por cobrar". *Cambio:* cuando exista el entry, **enriquecerlo** (`paymentStatus=PAID`,
   `amountPaid`, referencia del proveedor de pago) en vez de omitir.
3. **Una cita = un ingreso.** Completar/recompletar no puede bifurcar un segundo entry
   (ya garantizado por `bookingId @unique`).
4. **Factura y link de pago viven DENTRO del flujo de la cita**, pre-llenados con la identidad fiscal
   capturada antes (ver §4). El doctor nunca los arma a mano desde cero.
5. **Ancla obligatoria siempre.** Incluso un ingreso manual es un ancla; nada relacionado a un
   ingreso existe sin una.
6. **PUE vs PPD se respeta al emitir.** Si `metodoPago=PPD`, el entry queda **PENDING** hasta que el
   pago/complemento confirme (corrige el gap #1 de `00` §3).

> Los **motores de dedup se quedan** (Motor 2 CFDI↔entry, Motor 3 banco↔entry). Las reglas mantienen
> limpio el **camino feliz** (todo nace enlazado); los motores siguen atrapando la **evidencia
> externa** que entra por fuera de la UI (descarga del SAT, CSV/PDF bancario). Ver §6.

---

## 4. Captura de identidad fiscal temprana (en la cita)

El punto más débil hoy: el entry `cita` solo trae RFC si la cita está ligada a un expediente con RFC
(gap `05`). La solución es **capturar la identidad fiscal al confirmar la cita**, no al final.

### Flujo propuesto
1. Al **confirmar** la cita, si el paciente **requiere factura**, mostrar un botón
   **"Solicitar datos fiscales"** que genera un **link** para el paciente (WhatsApp/clipboard).
2. El paciente, desde ese link, captura: **RFC, razón social, régimen, uso CFDI, CP fiscal** y
   **sube el PDF de la Constancia de Situación Fiscal**.
3. Esos datos se guardan en el **perfil fiscal del paciente** (y el PDF queda como evidencia).
4. Al **completar** la cita, emitir el CFDI es **un clic** con datos correctos; el RFC ya viaja
   denormalizado al entry → el match CFDI (Motor 2) llega a confianza alta.

### Por qué importa
- Ataca la **causa raíz** del gap `05` (identidad ausente) sin fricción para walk-ins que no
  facturan (el botón solo aparece si `requiereFactura`).
- La **Constancia PDF** da respaldo documental para auditoría y para validar el RFC/razón social.

> ✅ **Sin cambio de esquema.** El modelo `Patient` **ya tiene** todos los campos necesarios
> (`requiereFactura`, `rfc`, `razonSocial`, `regimenFiscal`, `usoCfdi`, `codigoPostalFiscal`,
> `constanciaFiscalUrl`, `constanciaFiscalName` — schema 1768-1775). Esto es **cableado de UX**
> (botón + link + subida del PDF + leer estos campos al completar), no un cambio de base de datos.

---

## 5. El flujo feliz: cita → pago → factura → expediente

```
[Reservar cita] ──► CONFIRMED
      │
      ├─(si requiere factura)─► [Solicitar datos fiscales] ──► paciente llena RFC + sube Constancia
      │
      ▼
[Completar cita] ──► crea 1 LedgerEntry (ancla=cita, RFC denormalizado)
      │
      ├─► [Generar link de pago] (MP/Stripe, anclado a la cita)
      │        └─ webhook PAID ──► adjunta 💵 al MISMO entry (idempotente), set paymentStatus
      │
      ├─► [Emitir CFDI] (anclado a la cita/entry; PUE→PAID, PPD→PENDING)
      │        └─ CfdiEmitted.ledgerEntryId = entry.id ──► 🧾 hasFactura
      │
      ▼
[Subir estado de cuenta] ──► Motor 3 concilia ──► 🏦 hasComprobante
      │
      ▼
[Expediente del paciente] ──► panel de finanzas: 💵 + 🧾 + 🏦 por cada ingreso
```

Resultado: **un solo `LedgerEntry`** con sus tres evidencias, y una vista paciente-céntrica.

---

## 6. Dónde encaja cada fuente (input generation)

| Fuente | Entra por | Cómo se ancla / converge |
|---|---|---|
| **Cita** | UI completar cita | Ancla nativa. Crea el entry. |
| **Pago en línea** (MP/Stripe) | Link creado desde la cita | Webhook adjunta al entry del ancla (idempotente). |
| **Factura emitida** (sistema) | Emisión **obligatoriamente anclada** | `CfdiEmitted.ledgerEntryId` set → 🧾. |
| **Factura del SAT** (descarga) | Cron/backfill, **fuera de la UI** | **Motor 2** match-before-create. Si no hay ancla → nace `sat_emitido`. |
| **Banco** (CSV/PDF) | Subida de estado de cuenta, **fuera de la UI** | **Motor 3** match o `create_entry` (ancla=banco). |
| **Venta / Compra / Manual** | Módulos / alta manual | Ancla nativa. Guard de duplicado al crear (`00` §2). |

**Principio:** lo que entra **por la UI** nace enlazado (reglas §3). Lo que entra **por fuera**
(SAT, banco) lo reconcilian los motores. Las dos vías terminan en el mismo `LedgerEntry`.

---

## 7. La vista expediente (rollup paciente-céntrico)

- Apoyo parcial **hoy**: `LedgerEntry.patientId` está denormalizado (sin FK cruzada a propósito).
- Panel de finanzas en el expediente: lista de ingresos del paciente, cada uno con su estado
  💵 pago / 🧾 factura / 🏦 banco, y accesos al CFDI/PDF/comprobante.
- Es **solo lectura** sobre la fuente única — no una segunda fuente de verdad.

> ⚠️ **Gap 4 (§10): `patientId` no basta.** Solo se llena de forma confiable en entries `cita`.
> `createPaymentLedgerEntry` **no** lo pone; `sat_emitido/recibido` usan `counterpartyRfc` (sin
> `patientId`); manual es opcional. Un paciente que pagó en línea sin cita, o cuyo ingreso vino por
> factura standalone, **faltaría en su propio rollup**. El panel debe usar **fallback por RFC**
> (`counterpartyRfc → patient.rfc`), no solo `patientId`.

---

## 8. Actual vs. propuesto (tabla de gaps)

| Tema | Hoy | Propuesto | Impacto |
|---|---|---|---|
| **Factura huérfana** | `ledgerEntryId` opcional en emisión (`cfdi/route.ts:264`) | **Obligatorio** un ancla para emitir | Elimina CFDIs sin movimiento |
| **Identidad fiscal** | RFC solo si la cita tiene expediente con RFC (gap `05`) | Captura temprana (RFC + Constancia) al confirmar | Sube confianza del match CFDI; menos manual |
| **Pago suelto** | Webhook puede crear `webhook_pago` paralelo | Link anclado a cita; webhook adjunta al entry | Sin duplicados de pago |
| **PUE/PPD** | Emitido siempre PAID (gap #1) | PPD → PENDING hasta complemento/pago | "Factura ≠ dinero" correcto |
| **Vista paciente** | Dispersa | Panel de finanzas en expediente | El "expediente completo" del ingreso |
| **Dedup externo** | Motores 2/3 (se mantienen) | Igual, pero con menos limpieza | Camino feliz ya limpio |

---

## 9. Orden de implementación sugerido (cuando se construya)

1. **Hacer obligatorio el ancla en emisión de CFDI** (regla §3.1) — corta el orfanato de raíz.
2. **Captura fiscal temprana + Constancia PDF** en la cita (§4) — ataca el gap de identidad.
3. **Respetar PUE/PPD** en el `paymentStatus` al emitir/registrar (§3.6) — corrige el gap #1.
4. **Links de pago anclados** + webhook idempotente al entry (§3.2).
5. **Panel de finanzas en el expediente** (§7) — la vista paciente-céntrica.

> Nota: 1–3 son los de mayor impacto/correctitud; 4–5 son de experiencia. Ninguno requiere una tabla
> nueva — son reglas de enlace + UX sobre el modelo actual.

---

## 10. Revisión de la propuesta — gaps y supuestos verificados

> Auto-revisión contra el código (junio 2026). Varios supuestos del borrador original eran
> incompletos o incorrectos; corregidos arriba. Severidad para priorizar.

| # | Gap / supuesto | Hallazgo en código | Severidad | Acción |
|---|---|---|---|---|
| **1** | Emisión de CFDI vincula bien | `cfdi/route.ts:287` solo pone `hasFactura=true`, **NO** `satCfdiUuid`. El SAT round-trip de una factura propia puede **duplicarse** (Motor 2 la ve sin vincular). | **Alta** | Estampar `entry.satCfdiUuid = uuid` al emitir (§3.1 Cambio B). |
| **2** | "El webhook adjunta al entry" | `practice-utils.ts:113`: si ya hay entry para el `bookingId`, **omite** (`return null`). No enriquece. Una cita "por cobrar" pagada por link **no** se marca PAID. | **Media-Alta** | Enriquecer el entry existente en vez de omitir (§3.2). |
| **3** | "Ancla obligatoria para emitir" | Demasiado rígido: **REP** (tipo P) y **Nota de Crédito** (tipo E) no son ingresos. | **Media** | Regla por tipo: REP→factura PPD, NC→entry original (§3.1 excepción). |
| **4** | Rollup expediente "posible hoy" vía `patientId` | `patientId` sí se setea en `cita` y **lo acepta el POST manual** (`ledger/route.ts:325`). Pero **webhook** (`createPaymentLedgerEntry` no lo pone), **`sat_emitido/recibido`** (usan `counterpartyRfc`) y **`banco`** **no** lo tienen. | **Media** | Fallback por RFC (`counterpartyRfc → patient.rfc`) **además** de `patientId` (§7). |
| **5** | ~~Guardar PDF de Constancia requiere campo nuevo~~ | **RESUELTO — no es gap.** El modelo `Patient` **ya tiene** `constanciaFiscalUrl` + `constanciaFiscalName` (schema 1774-75) y todos los campos fiscales (`requiereFactura`, `rfc`, `razonSocial`, `regimenFiscal`, `usoCfdi`, `codigoPostalFiscal`). | **N/A** | §4 es solo **cableado de UX**, sin cambio de esquema. |
| **6** | Emisión PPD | El endpoint **sí** acepta `paymentMethod=PPD` (`cfdi/route.ts:280`), pero el entry no refleja PPD→PENDING (la emisión solo pone `hasFactura`). | **Media** | Driver de `paymentStatus` por `metodoPago` (refuerza gap #1 de `00` §3). |

### Supuestos que SÍ se confirmaron
- ✅ Emisión standalone produce CFDI huérfano (`ledgerEntryId || null`, `cfdi/route.ts:264`).
- ✅ Idempotencia del webhook por `bookingId` existe (no duplica) — `practice-utils.ts:108`.
- ✅ `bookingId @unique` garantiza una-cita-un-entry.
- ✅ `LedgerEntry.patientId` existe y se denormaliza en `cita`; el POST manual también lo acepta.
- ✅ El endpoint de emisión maneja tipo P (REP, `rep/route.ts:135`) y E (`egreso/route.ts:160`) por
  rutas dedicadas → confirma que la regla de ancla debe ser **por tipo** (Gap 3).
- ✅ **El modelo `Patient` ya tiene los campos fiscales + Constancia PDF** (schema 1768-1775) → la
  captura fiscal temprana (§4) no necesita esquema nuevo, solo UX.

### Riesgo de diseño transversal
La pieza más delicada es la **reconciliación entre la factura emitida por el sistema y su copia
descargada del SAT** (mismo UUID). Hoy no se cierra por el candado duro (`satCfdiUuid`) porque la
emisión no lo estampa (Gap 1). **Cerrar el Gap 1 es prerequisito** para que el modelo de anclas no
reintroduzca duplicados por la puerta del SAT.

---

*Estado:* diseño/blueprint, junio 2026. Auto-revisado contra el código (§10). Sin cambios de código.
Decisiones de UX por validar con el producto. Relacionado: `00` (modelo y motores), `01`
(permutaciones), `05`/`06` en `../../TODO FACTURAS/flujo permutations/` (gaps de origen y matcher).
</content>
