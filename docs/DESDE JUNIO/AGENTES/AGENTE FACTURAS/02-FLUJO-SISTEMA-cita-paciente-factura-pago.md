# Flujo del sistema: cita → paciente → factura → pago (definición pre-PR F1)

> **Qué es esto.** Antes de darle al asistente tools de lectura sobre expedientes, facturación,
> SAT y pagos, este doc define **el flujo canónico que conecta esas piezas** y **qué tan
> interconectadas están HOY en el código** — qué liga existe, quién la escribe, y dónde hay
> huecos. Todo verificado contra el código el 2026-07-10 (regla de la fila 19: los docs
> alucinan; este doc cita archivos).
>
> Complementa a [`00-FACTIBILIDAD-Y-ARQUITECTURA.md`](00-FACTIBILIDAD-Y-ARQUITECTURA.md) (la
> arquitectura de UN asistente con módulos) y a
> [`01-CONTEXTO-SAT-DESCARGA.md`](01-CONTEXTO-SAT-DESCARGA.md) (la fuente dual de CFDIs).

---

## 1. El grafo de datos real (quién apunta a quién, verificado)

```
                    ┌────────────────────┐
                    │  Patient (expediente)│  rfc · razonSocial · regimenFiscal · usoCfdi
                    │  schema ~1767        │  codigoPostalFiscal · requiereFactura ·
                    └─────────┬────────────┘  constanciaFiscalUrl
                 patientId    │ (nullable; validatePatientLink + FK compuesta en prod)
                              │
┌──────────┐  bookingId    ┌──┴──────────┐  ledgerEntryId   ┌──────────────┐
│ Booking  │◄─(@unique)────│ LedgerEntry │◄─────────────────│ CfdiEmitted  │
│ (cita)   │               │ (flujo $)   │                  │ (Facturama)  │
└────┬─────┘               └──────┬──────┘                  └──────────────┘
     │ bookingId (@unique)        │ satCfdiUuid (@unique)
     │                            ▼
┌────┴─────────────┐       ┌──────────────────┐
│ PaymentLink      │       │ sat_cfdi_metadata │  ← SAT Descarga (e.Firma):
│ MpPaymentPref.   │       │ sat_cfdi_details  │    TODO el RFC, emitidos y recibidos
│ (links de pago)  │       │ sat_pagos (REP)   │
└──────────────────┘       └──────────────────┘
```

Campos de `LedgerEntry` que hacen de hub (schema ~1131–1205): `bookingId @unique`,
`patientId`, `counterpartyRfc/Name` (denormalizados), `hasFactura`, `hasComprobante`,
`satCfdiUuid @unique`, `paymentStatus`/`amountPaid`/`formaDePago`, `origin`.

**`origin` es la clave para diagnosticar cómo nació un ingreso:**

| origin | Quién lo escribe | Trae patientId/RFC |
|---|---|---|
| `cita` | UI `useBookings.completeBooking` (doble-call) o agente PR 3 (D4) | ✅ sí (denormaliza del expediente) |
| `webhook_pago` | webhooks Stripe/MP → `createPaymentLedgerEntry()` (`apps/api/src/lib/practice-utils.ts:102`) | ❌ **NO** (hueco §5.1) |
| `sat_emitido` / `sat_recibido` | `autoRegisterCfdisToLedger` (`sat-auto-register.ts`) | RFC de contraparte sí; patientId no |
| `manual` | captura directa en Flujo de Dinero | lo que el doctor teclee |
| `comision` | egreso de comisión (excluido de match pools) | — |

## 2. El flujo canónico (lo que el asistente debe poder recorrer)

**Etapa A — Cita ↔ Expediente**
- La cita nace pública (PENDING) o del doctor (CONFIRMED). `patientId` es **opcional**: walk-in
  = datos sueltos en la cita, sin expediente.
- Vinculación post-hoc: "Buscar paciente" en la card / PATCH (valida `validatePatientLink`).
- **NO existe flujo "crear expediente desde la cita"** (backlog conocido de agenda). Crear
  paciente hoy = ruta interna del doctor-app `POST /api/medical-records/patients`
  (`useNewPatientPage.ts:214`).

**Etapa B — Cita → Ingreso (LedgerEntry)**
Dos caminos INDEPENDIENTES crean el ingreso de una cita, y pueden chocar (§5.2):
1. **Completar la cita** → PATCH COMPLETED + POST ledger (`origin:'cita'`, PAID, con
   patientId/RFC). Es TRX-6, validado en vivo vía agente.
2. **Link de pago pagado** (Stripe/MP con `bookingId`) → el webhook crea el ledger
   (`origin:'webhook_pago'`, PAID, `hasComprobante:true`) — **al momento del PAGO, que puede ser
   ANTES de completar la cita**. Idempotente por `bookingId` (si ya hay entry, no crea).

**Etapa C — Ingreso → Factura (CFDI)**
- Pista #1 para saber si hace falta: `Patient.requiereFactura` (flag del expediente) y
  `LedgerEntry.hasFactura=false` con `origin='cita'` — la killer query de `00` §4.
- Requisitos para emitir: (1) perfil fiscal del doctor con CSD activo (`DoctorFiscalProfile`,
  gating en el POST); (2) receptor completo — RFC, razón social, régimen, uso CFDI, CP fiscal
  (los 5 campos del expediente) o **Público en General** explícito; (3) items+impuestos
  (hoy los arma la UI en `emitCfdi` — regla clase-E7: server-side builder pendiente).
- **Si el paciente no tiene datos fiscales:** `POST /appointments/fiscal-form-link` genera el
  formulario para que el paciente los llene — **requiere `patientId`** (el endpoint lo exige y
  rechaza si el paciente ya tiene rfc+requiereFactura). ⚠️ Consecuencia: **para facturar a un
  walk-in con datos fiscales propios, primero hay que crear/vincular el expediente** — el único
  camino sin expediente es Público en General.
- Al emitir: `CfdiEmitted.ledgerEntryId` + `hasFactura=true` en el entry
  (`facturacion/cfdi/route.ts:287-292`). El POST valida que el `ledgerEntryId` sea del doctor.
- **Camino externo (doctores que emiten fuera):** SAT Descarga baja el CFDI emitido y
  `autoRegisterCfdisToLedger` lo liga a un entry existente por score RFC/nombre/monto/fecha
  (≥0.67 auto-link, 0.50–0.66 needsReview) escribiendo `satCfdiUuid` + `hasFactura:true` — o
  crea un entry nuevo `sat_emitido` si nada matchea.

**Etapa D — Pago (¿ya me pagaron?)**
- Por cita: `PaymentLink`/`MpPaymentPreference.status` (PENDING→PAID, `paidAt`) — 1:1 con
  booking (`bookingId @unique` en ambas).
- Por ingreso: `LedgerEntry.paymentStatus`/`amountPaid` (parciales posibles).
- Por factura PPD: `sat_pagos` (complementos REP) → `sat-ppd-reconcile.ts` actualiza el
  `paymentStatus` del entry ligado por `satCfdiUuid`.
- Conciliación bancaria (money model): `BankSettlementItem`, matching net-of-fee — fuera del
  alcance del asistente v1 (es el bloque Flujo de Dinero).

## 3. La matriz de diagnóstico (el "¿a qué grado está conectado?")

Para CUALQUIER cita, el asistente debe poder responder estas 6 preguntas en orden — cada una es
una lectura concreta:

| # | Pregunta | Dónde se lee | Estados posibles |
|---|---|---|---|
| 1 | ¿La cita existe y en qué estado? | `bookings` (tools de agenda, ya vivos) | PENDING/CONFIRMED/COMPLETED/NO_SHOW/CANCELLED |
| 2 | ¿Tiene expediente? | `booking.patientId` | vinculado · walk-in (sin expediente) |
| 3 | ¿El paciente quiere/puede factura? | `Patient.requiereFactura` + los 5 campos fiscales | datos completos · incompletos (→ formulario fiscal) · no requiere |
| 4 | ¿Ya existe el ingreso? | `ledger_entries WHERE booking_id` | no existe · existe (`origin` dice cómo nació) |
| 5 | ¿Ya está pagado? | `paymentStatus`/`amountPaid` + `payment_links`/`mp_payment_preferences.status` | pagado · pendiente · parcial · link enviado sin pagar |
| 6 | ¿Ya está facturado y entregado? | `hasFactura` + `satCfdiUuid` + `cfdis_emitted.ledgerEntryId` (+ `sat_cfdi_metadata` para emitidos externos) | sin factura · facturado en plataforma · facturado fuera (SAT) · cancelado (satStatus) |

El **flujo feliz completo** que el asistente orquestará (v2, con propuestas):
cita CONFIRMED → completar (ledger `cita` con RFC) → ¿requiereFactura? → datos fiscales OK →
emitir CFDI (liga ledgerEntryId) → ¿enviar por correo? → pago registrado (PAID). Cada flecha
tiene su pre-check en la matriz de arriba; el asistente diagnostica ANTES de proponer.

## 4. Reglas de diagnóstico para el prompt/tools (regla 0 aplicada)

1. **"¿Está facturada?" se resuelve server-side**, nunca por inferencia: facturada =
   `hasFactura=true` ∨ `satCfdiUuid≠null` ∨ existe `cfdis_emitted.ledgerEntryId`. (Tres señales
   porque hay dos caminos de emisión + el matcher.)
2. **"¿Está pagada?" ≠ "¿está completada?"**: un link pagado crea ingreso sin completar la cita;
   completar crea ingreso sin que haya pago electrónico. El tool reporta ambas señales por
   separado (`booking.status` vs `paymentStatus`/link status).
3. **Fuente dual de facturación** (de `01`): "¿cuánto facturé?" = `sat_cfdi_metadata` (todo el
   RFC) cuando hay SAT Descarga configurado; `cfdis_emitted` solo cubre lo emitido en plataforma.
   El tool debe decir QUÉ fuente usó y su frescura (jobs fallidos recientes en `sat_sync_jobs`).
4. **Los datos fiscales del receptor salen SOLO del expediente** (`get_patient_fiscal`) o de
   "Público en General" explícito — nunca de texto libre (regla de `00` §6).
5. **El asistente nunca arma impuestos** (clase-E7, `00` §4) — pendiente el builder server-side.

## 5. Huecos encontrados en esta pasada (2026-07-10)

| # | Hueco | Impacto | Fix candidato |
|---|---|---|---|
| **H1** | `createPaymentLedgerEntry` (webhooks) **no denormaliza `patientId`/`counterpartyRfc`** aunque el booking tenga expediente vinculado | Entradas `webhook_pago` invisibles para "facturas del paciente" y para el matcher SAT por RFC | Leer `booking.patientId` + fiscal del paciente en el helper (mismo patrón que completeBooking) — fix pequeño en `practice-utils.ts` |
| **H2** | **Colisión webhook↔completar**: si el link de pago ya creó el entry, completar la cita → el POST ledger truena con P2002→409 "El ID interno ya existe" (mensaje engañoso) → toast de error en UI; el pre-check de `propose_complete_booking` TAMPOCO detecta el entry existente (`proposals.ts` — verificado: cero refs a ledger existente) | La cita queda COMPLETED pero el flujo reporta error; con agente, card de complete fallaría igual | Pre-check: si existe `ledger_entries.booking_id`, proponer completar SIN doble-call de ledger (solo PATCH) y narrar "el ingreso ya existe (pagado por link)". Endpoint: mensaje 409 específico para bookingId duplicado |
| **H3** | No existe "crear expediente desde cita/asistente" — y el formulario fiscal EXIGE expediente | Un walk-in que pide factura obliga a crear el paciente a mano en `/medical-records/patients/new` | Backlog conocido; candidato a propuesta del asistente en fase 2 (`propose_create_patient`) |
| **H4** | `CfdiEmitted` sin `patientId`/`bookingId` directos | "Facturas del paciente" solo vía JOIN por `ledgerEntryId` (opción A de `00` §3 — suficiente v1 SI el agente siempre liga) | Decisión ya tomada: opción A v1; opción B si nace la pestaña Facturas del expediente |
| **H5** | Filas fallback de SAT (julio) nacen `satStatus='Vigente'` — cancelaciones invisibles hasta el próximo sync de metadata | El asistente podría reportar como vigente una factura cancelada | Ya documentado en `01` (riesgo aceptado); el tool de lectura debe exponer la fecha del último sync exitoso de metadata |

## 6. Implicación para el alcance de lectura (PR F1 ampliado)

El usuario definió el alcance: `/dashboard/medical-records`, `/dashboard/facturacion`,
`/dashboard/sat-descarga`, `/dashboard/pagos` (+ subpáginas), complementando agenda. Mapeo
página → datos → tool candidato:

| Página | Datos que muestra | Tools de lectura candidatos |
|---|---|---|
| medical-records (lista + perfil) | pacientes, datos demográficos y FISCALES, encounters, recetas, notas, timeline | `get_patient_profile` (perfil + fiscal + flags) · `get_patient_history` (encounters/recetas/notas resumidos) — decidir profundidad clínica (¿el asistente de operación necesita leer notas SOAP? tier de privacidad propio) |
| facturacion | perfil fiscal del doctor (CSD/Facturama status), CFDIs emitidos en plataforma | `get_fiscal_profile_status` · `get_cfdis` (emitidos, filtros por fecha/receptor/status) |
| sat-descarga | CFDIs del RFC (metadata+details), jobs de sync, declaración, cobranza PPD | `get_sat_cfdis` (fuente dual con frescura) · `get_sat_sync_status` · (después: declaración/cobranza) |
| pagos | conexión Stripe/MP, links de pago y su status | `get_payment_links` (por cita/fechas/status) · `get_payment_provider_status` |
| (transversal) | la matriz §3 completa para una cita | **`get_billing_status {bookingId}`** — el tool estrella: responde las 6 preguntas de un golpe (expediente, fiscal, ledger, pago, factura, entrega) |

Método idéntico a agenda PR 1: tools server-side read-only vía Prisma en el doctor-app,
`doctorId` de la sesión, definiciones de negocio server-side (regla 0), smoke-test de cada
query shape contra prod ANTES de push, y campaña de permutaciones + evals antes de cualquier
escritura.

## 7. Decisiones abiertas (para cerrar antes de construir)

1. **Profundidad clínica de medical-records**: ¿el asistente lee contenido de encounters/notas
   (dato médico sensible) o solo metadatos (fechas, conteos, títulos)? Recomendación v1: solo
   metadatos + datos fiscales/demográficos — el dato clínico es otro tier de privacidad y otro
   bloque ("agente de expediente médico" del plan original).
2. **H1/H2 se arreglan ANTES de PR F1** (como F1/F2 de agenda: el sustrato primero) — son
   pequeños y el asistente los amplificaría.
3. Las preguntas abiertas de `00` §8 siguen vivas (¿dr-prueba puede timbrar?, panel en
   `/dashboard/facturacion`, IVA de honorarios).

---

*Estado: definición 2026-07-10, verificada contra código. Siguiente: cerrar decisiones §7 →
refactor de módulos → PR F1 (lectura). Relacionado: `00`, `01`,
[`../AGENTE AGENDA/05-REFERENCIA-TECNICA-AGENTE.md`](../AGENTE%20AGENDA/05-REFERENCIA-TECNICA-AGENTE.md).*
