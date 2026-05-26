# Plan: Registro Financiero Unificado + Conciliacion Bancaria

## Estado Actual: Mapa Completo del Sistema

### El LedgerEntry como centro de todo

El `LedgerEntry` ya es el registro central. Todo movimiento financiero termina (o deberia terminar) como un LedgerEntry. El problema es que llega de muchos lados con datos inconsistentes y sin un modelo claro de "capas de evidencia".

### Fuentes de movimientos (actualizado post Fase A/B/C)

```
FUENTE                        QUE CREA                   ESTADO
─────────────────────────────────────────────────────────────────────
1. Completar Cita            LedgerEntry (auto)          OK (Fase A)
   (CompleteBookingModal)     + CfdiEmitted (opcional)    origin='cita', area/subarea auto

2. Flujo de Dinero           LedgerEntry (manual)        OK (Fase A)
   (new entry form)          + attachments               origin='manual', evidencia 3 capas

3. Ventas (Sales)            LedgerEntry (auto)          OK (Fase A)
                             via Sale                    origin='venta'

4. Compras (Purchases)       LedgerEntry (auto)          OK (Fase A)
                             via Purchase                origin='compra'

5. Facturacion               CfdiEmitted                 OK (Fase A)
   (emision CFDI)            + link a LedgerEntry        hasFactura=true auto

6. Conciliacion Bancaria     BankStatement + movements   OK (Fase B)
   (CSV upload)              → match/create LedgerEntry  origin='banco', reglas aprendidas

7. SAT Descarga              SatCfdiMetadata             OK (Fase C)
   (CFDIs del SAT)           → registrar como LedgerEntry origin='sat_recibido/emitido'
                             + reconciliacion emitidos    auto-create Proveedor

8. Webhooks Stripe/MP        LedgerEntry (auto)          OK (Fase D)
                             via PaymentLink/MpPref      origin='webhook_pago', idempotent
```

### Las 3 capas de evidencia de un movimiento

Cada movimiento financiero puede tener hasta 3 niveles de respaldo:

```
CAPA 1: REGISTRO (siempre existe)
  = LedgerEntry
  - Monto, fecha, concepto, tipo (ingreso/egreso)
  - Area/subarea, forma de pago
  - Estado de pago
  - Origen: cita, venta, manual, SAT, banco

CAPA 2: COMPROBANTE (opcional)
  = LedgerAttachment
  - Foto/PDF del ticket, voucher bancario, nota de venta
  - Comprobante de transferencia, estado de cuenta
  - Cualquier evidencia visual del movimiento

CAPA 3: FACTURA (opcional)
  = CfdiEmitted (emitida por el doctor)
  = LedgerFactura + LedgerFacturaXml (recibida, subida manualmente)
  = SatCfdiMetadata (descargada del SAT)
  - CFDI con validez fiscal (UUID, XML, PDF)
  - Para ingresos: factura emitida al paciente/cliente
  - Para egresos: factura recibida del proveedor
```

**Estado ideal de cada movimiento:**
- Minimo: Capa 1 (registro)
- Bueno: Capa 1 + Capa 2 (registro + comprobante)
- Completo: Capa 1 + Capa 2 + Capa 3 (registro + comprobante + factura)

---

## Diseno: Registro Unificado

### Cambios al modelo LedgerEntry

```prisma
model LedgerEntry {
  // ... campos existentes ...

  // NUEVO: Origen del movimiento (trazabilidad)
  origin          String?   @map("origin") @db.VarChar(30)
  // Valores: "cita", "venta", "manual", "sat_recibido", "banco", "webhook_pago"

  // NUEVO: Estado de evidencia (calculado o almacenado)
  hasComprobante  Boolean   @default(false) @map("has_comprobante")
  hasFactura      Boolean   @default(false) @map("has_factura")

  // NUEVO: Link a conciliacion bancaria
  bankStatementId Int?      @map("bank_statement_id")
  bankStatement   BankStatement? @relation(fields: [bankStatementId], references: [id])

  // NUEVO: Link a movimiento bancario especifico
  bankMovementIdx Int?      @map("bank_movement_idx")

  // NUEVO: Link a SAT (para reconciliacion)
  satCfdiUuid     String?   @unique @map("sat_cfdi_uuid")

  // EXISTENTE pero mejorar uso:
  // bookingId     - ya existe (link a cita)
  // saleId        - ya existe (link a venta)
  // clientId      - ya existe
  // supplierId    - ya existe
}
```

### Nuevo modelo: BankStatement (Estado de Cuenta Bancario)

```prisma
model BankStatement {
  id              Int       @id @default(autoincrement())
  doctorId        String    @map("doctor_id")

  // Metadata del archivo
  fileName        String    @map("file_name") @db.VarChar(255)
  fileUrl         String    @map("file_url") @db.Text
  fileType        String    @map("file_type") @db.VarChar(50)  // "pdf", "csv", "xlsx"

  // Periodo
  bankName        String    @map("bank_name") @db.VarChar(100)
  accountNumber   String    @map("account_number") @db.VarChar(50)
  periodMonth     Int       @map("period_month")    // 1-12
  periodYear      Int       @map("period_year")     // 2026

  // Totales extraidos
  totalDeposits   Decimal?  @map("total_deposits") @db.Decimal(12, 2)
  totalWithdrawals Decimal? @map("total_withdrawals") @db.Decimal(12, 2)
  endingBalance   Decimal?  @map("ending_balance") @db.Decimal(12, 2)

  // Estado de procesamiento
  status          String    @default("uploaded") @map("status") @db.VarChar(20)
  // "uploaded" → "processing" → "processed" → "reviewed"

  movementCount   Int       @default(0) @map("movement_count")
  matchedCount    Int       @default(0) @map("matched_count")
  newCount        Int       @default(0) @map("new_count")

  createdAt       DateTime  @default(now()) @map("created_at")
  updatedAt       DateTime  @updatedAt @map("updated_at")

  // Relations
  doctor          Doctor    @relation(fields: [doctorId], references: [id], onDelete: Cascade)
  movements       BankMovement[]
  ledgerEntries   LedgerEntry[]

  @@unique([doctorId, bankName, accountNumber, periodMonth, periodYear])
  @@index([doctorId])
  @@map("bank_statements")
  @@schema("practice_management")
}

model BankMovement {
  id                Int       @id @default(autoincrement())
  bankStatementId   Int       @map("bank_statement_id")

  // Datos extraidos del estado de cuenta
  transactionDate   DateTime  @map("transaction_date") @db.Date
  description       String    @db.VarChar(500)
  reference         String?   @db.VarChar(255)
  amount            Decimal   @db.Decimal(12, 2)
  movementType      String    @map("movement_type") @db.VarChar(10) // "deposit" | "withdrawal"
  balance           Decimal?  @db.Decimal(12, 2)

  // Categorizacion automatica
  suggestedCategory String?   @map("suggested_category") @db.VarChar(100)
  suggestedArea     String?   @map("suggested_area") @db.VarChar(255)
  suggestedSubarea  String?   @map("suggested_subarea") @db.VarChar(255)

  // Match con sistema
  matchStatus       String    @default("unmatched") @map("match_status") @db.VarChar(20)
  // "matched_auto" | "matched_manual" | "unmatched" | "new_entry" | "ignored"
  matchConfidence   Decimal?  @map("match_confidence") @db.Decimal(3, 2) // 0.00-1.00

  // Link al LedgerEntry (si matched o creado)
  ledgerEntryId     Int?      @unique @map("ledger_entry_id")
  ledgerEntry       LedgerEntry? @relation(fields: [ledgerEntryId], references: [id])

  createdAt         DateTime  @default(now()) @map("created_at")

  // Relations
  bankStatement     BankStatement @relation(fields: [bankStatementId], references: [id], onDelete: Cascade)

  @@index([bankStatementId])
  @@index([matchStatus])
  @@map("bank_movements")
  @@schema("practice_management")
}
```

---

## Logica de Matching y Categorizacion Automatica

### Reglas de match (movimiento bancario vs LedgerEntry existente)

```
PRIORIDAD 1: Match por referencia bancaria
  BankMovement.reference == LedgerEntry.bankMovementId
  AND misma fecha (+/- 1 dia)
  AND mismo monto
  → confidence: 0.99

PRIORIDAD 2: Match por monto + fecha exacta
  BankMovement.amount == LedgerEntry.amount
  AND BankMovement.transactionDate == LedgerEntry.transactionDate
  AND BankMovement.movementType matches LedgerEntry.entryType
  → confidence: 0.85

PRIORIDAD 3: Match por monto + fecha cercana (+/- 2 dias)
  BankMovement.amount == LedgerEntry.amount
  AND fecha dentro de 2 dias
  AND mismo tipo
  → confidence: 0.70

PRIORIDAD 4: Match por monto + concepto similar
  BankMovement.amount == LedgerEntry.amount
  AND BankMovement.description contiene palabras de LedgerEntry.concept
  → confidence: 0.60
```

### Reglas de categorizacion (movimientos nuevos sin match)

```
DEPOSITOS (ingresos):
  - Descripcion contiene "SPEI"/"TRANSFERENCIA" + monto tipico de consulta
    → area: "Consultas Medicas", subarea: servicio mas comun del doctor
  - Descripcion contiene nombre de paciente conocido
    → area: "Consultas Medicas", link sugerido a paciente
  - Deposito recurrente mismo monto
    → sugerir misma categoria que depositos anteriores iguales

RETIROS (egresos):
  - Descripcion contiene "RENTA"/"ALQUILER" (recurrente mensual)
    → area: "Gastos Fijos", subarea: "Renta Consultorio"
  - Descripcion contiene "CFE"/"TELMEX"/"IZZI"/"MEGACABLE"
    → area: "Gastos Fijos", subarea: "Servicios"
  - Descripcion contiene "FARMACIA"/"MATERIAL"/"INSUMOS"
    → area: "Gastos Operativos", subarea: "Insumos Medicos"
  - Descripcion contiene "AMAZON"/"MERCADOLIBRE"
    → area: "Gastos Operativos", subarea: "Compras Varias"
  - Comisiones bancarias (montos pequenos, desc "COMISION"/"ANUALIDAD")
    → area: "Gastos Financieros", subarea: "Comisiones Bancarias"

APRENDIZAJE:
  - Cuando el doctor corrige una categoria, guardar la regla:
    "descripcion contiene X → area Y, subarea Z"
  - Aplicar reglas aprendidas en futuros estados de cuenta
```

### Tabla de reglas aprendidas

```prisma
model BankCategorizationRule {
  id          Int      @id @default(autoincrement())
  doctorId    String   @map("doctor_id")

  // Pattern matching
  pattern     String   @db.VarChar(255)  // texto a buscar en descripcion
  patternType String   @default("contains") @map("pattern_type") @db.VarChar(20)
  // "contains" | "starts_with" | "exact" | "regex"

  // Categoria asignada
  entryType   String   @map("entry_type") @db.VarChar(20)
  area        String   @db.VarChar(255)
  subarea     String?  @db.VarChar(255)
  concept     String?  @db.VarChar(500)

  // Metadata
  timesUsed   Int      @default(1) @map("times_used")
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  doctor      Doctor   @relation(fields: [doctorId], references: [id], onDelete: Cascade)

  @@index([doctorId])
  @@map("bank_categorization_rules")
  @@schema("practice_management")
}
```

---

## Flujo de Usuario: Subir Estado de Cuenta

### Paso 1: Upload
```
Doctor va a: /dashboard/practice/conciliacion-bancaria
Click "Subir estado de cuenta"
  - Selecciona archivo (PDF, CSV, o XLSX)
  - Selecciona banco (BBVA, Banorte, HSBC, Santander, Scotiabank, etc.)
  - Confirma cuenta y periodo (mes/ano)
  - Click "Procesar"
```

### Paso 2: Parsing del archivo
```
Backend recibe archivo:
  1. Detecta formato (CSV directo, PDF con tablas, XLSX)
  2. Para CSV/XLSX: parseo directo de columnas
  3. Para PDF: extraccion de tablas (usar pdf-parse + heuristicas por banco)
  4. Extrae cada movimiento: fecha, descripcion, referencia, monto, tipo, saldo
  5. Crea BankStatement + BankMovement[] en DB
  6. Status: "processing"
```

### Paso 3: Auto-matching + categorizacion
```
Para cada BankMovement:
  1. Buscar match con LedgerEntry existente (reglas de prioridad arriba)
  2. Si match encontrado:
     - matchStatus = "matched_auto"
     - matchConfidence = score
     - ledgerEntryId = matched entry
     - Actualizar LedgerEntry.hasComprobante = true (el estado de cuenta ES comprobante)
  3. Si no match:
     - Aplicar reglas de categorizacion (built-in + aprendidas)
     - matchStatus = "unmatched"
     - Guardar sugerencias: suggestedCategory, suggestedArea, suggestedSubarea

Status: "processed"
```

### Paso 4: Revision por el doctor
```
UI muestra 3 secciones:

MATCHED (verde) - Movimientos que ya estan en el sistema
  ┌─────────┬──────────────────────┬──────────┬───────────┬──────────────────┐
  │ Fecha   │ Descripcion banco    │ Monto    │ Confianza │ Match en sistema │
  ├─────────┼──────────────────────┼──────────┼───────────┼──────────────────┤
  │ 05/01   │ SPEI Juan Perez      │ +$1,500  │ 99%       │ Consulta - Juan  │
  │ 05/03   │ SPEI Maria Lopez     │ +$2,000  │ 85%       │ Cirugia - Maria  │
  └─────────┴──────────────────────┴──────────┴───────────┴──────────────────┘
  [Confirmar todos] o editar individualmente

NUEVOS (amarillo) - Movimientos que no estan en el sistema
  ┌─────────┬──────────────────────┬──────────┬────────────────────────────┐
  │ Fecha   │ Descripcion banco    │ Monto    │ Categoria sugerida         │
  ├─────────┼──────────────────────┼──────────┼────────────────────────────┤
  │ 05/05   │ PAGO CFE             │ -$850    │ Gastos Fijos > Servicios   │
  │ 05/10   │ AMAZON MX            │ -$1,200  │ Gastos Op > Compras Varias │
  │ 05/15   │ DEPOSITO EFECTIVO    │ +$3,000  │ Consultas Medicas          │
  └─────────┴──────────────────────┴──────────┴────────────────────────────┘
  Para cada uno: [Crear registro] [Ignorar] [Editar categoria]
  [Crear todos los sugeridos]

IGNORADOS (gris) - Movimientos que el doctor marco como no relevantes
  (comisiones bancarias que no quiere trackear, transferencias entre cuentas propias, etc.)
```

### Paso 5: Confirmacion
```
Doctor revisa, ajusta categorias, confirma matches
  - Matched: se vinculan definitivamente (LedgerEntry.bankStatementId + bankMovementIdx)
  - Nuevos: se crean LedgerEntries con origin="banco"
  - Ignorados: se marcan como "ignored"
  - Reglas aprendidas: si el doctor cambio categoria, se guarda regla

Status: "reviewed"
```

---

## Mejoras por Fuente — Estado

### Fuente 1: Completar Cita — DONE (Fase A)
- origin='cita', area='Consultas Médicas', subarea=serviceName

### Fuente 2: Flujo de Dinero Manual — DONE (Fase A)
- origin='manual', 3 capas evidencia visual, hasComprobante/hasFactura auto

### Fuente 3: Ventas/Compras — DONE (Fase A)
- origin='venta'/'compra' respectivamente

### Fuente 4: Conciliacion Bancaria — DONE (Fase B)
- CSV upload → parse → match → categorize → confirm → create LedgerEntry
- origin='banco', reglas aprendidas, 5 bancos MX

### Fuente 5: SAT Descarga — DONE (Fase C)
- Registrar CFDIs recibidos/emitidos como LedgerEntries (single + batch)
- Auto-create Proveedor por RFC, concepto desde XML
- Reconciliacion CfdiEmitted vs SAT (matched/missing/cancelled/onlyInSat)

### Fuente 6: Webhook de Pagos — DONE (Fase D)
- Stripe PAID (card + OXXO async) → auto-create LedgerEntry via `createPaymentLedgerEntry`
- MercadoPago approved → auto-create LedgerEntry via `createPaymentLedgerEntry`
- origin='webhook_pago', area='Consultas Medicas', subarea='Pago en Linea'
- formaDePago mapped from provider method (tarjeta/efectivo/transferencia)
- Idempotent: skips if LedgerEntry already exists for bookingId
- hasComprobante=true (the payment provider receipt IS the comprobante)

---

## Vista Unificada: Flujo de Dinero Mejorado

### Indicadores visuales por registro

```
Cada fila en la tabla de flujo de dinero muestra:

ORIGEN          REGISTRO    COMPROBANTE    FACTURA
─────────────────────────────────────────────────
[Cita]          [v]         [ ]            [v]       ← cita facturada sin comprobante
[Manual]        [v]         [v]            [ ]       ← gasto con ticket pero sin factura
[Banco]         [v]         [v]            [v]       ← completo (las 3 capas)
[SAT]           [v]         [ ]            [v]       ← gasto del SAT sin comprobante
[Venta]         [v]         [ ]            [ ]       ← venta sin facturar

Iconos:
  [v] verde = tiene
  [ ] gris  = falta (click para agregar)
  [!] rojo  = inconsistencia (ej: factura cancelada)
```

### Filtros adicionales
```
Filtros existentes: tipo, area, subarea, fecha, banco, porRealizar, busqueda
Filtros nuevos:
  - Origen: cita | manual | venta | sat | banco | webhook
  - Evidencia: con/sin comprobante, con/sin factura
  - Conciliacion: matcheado/no matcheado con banco
  - Estado fiscal: facturado/no facturado
```

---

## Fases de Implementacion

### FASE A: Fundamentos (schema + origin tracking) -- COMPLETADA 2026-05-26
1. [x] Migration: `add-ledger-origin-evidence.sql` — campos `origin`, `has_comprobante`, `has_factura`, `sat_cfdi_uuid` + indexes + backfill
2. [x] Actualizar creacion de LedgerEntry en todas las fuentes: cita→origin='cita', venta→'venta', compra→'compra', manual→'manual'
3. [x] Auto-asignar area="Consultas Medicas"/subarea=serviceName al completar citas
4. [x] `hasComprobante=true` al subir attachments, `hasFactura=true` al subir facturas PDF/XML o emitir CFDI
5. [x] UI: columna "Evidencia" en tabla con origin badge + iconos comprobante/factura (desktop + mobile)
6. [x] UI: filtros por Origen y Evidencia en LedgerFilters
7. [x] Review: compras origin bug fixed ('venta'→'compra'), added 'compra' to ORIGIN_LABELS + filter

### FASE B: Conciliacion Bancaria -- COMPLETADA 2026-05-26
1. [x] Migration: `add-bank-reconciliation.sql` — tablas BankStatement, BankMovement, BankCategorizationRule con FK, indexes, unique constraints
2. [x] CSV Parser: `bank-statement-parser.ts` — 5 parsers especificos (BBVA, Banorte, HSBC, Santander, Scotiabank) + generico, deteccion de delimitador, formatos fecha DD/MM/YYYY, decimales MX
3. [x] Motor de matching: `bank-matching.ts` — 4 niveles de prioridad (referencia 0.99, fecha exacta 0.85, fecha cercana 0.70, concepto similar 0.50-0.65), asignacion greedy por confianza
4. [x] Motor de categorizacion: `bank-categorization.ts` — 30+ reglas built-in (CFE, Telmex, farmacias, Amazon, comisiones, gasolina, SPEI, etc.) + reglas aprendidas del doctor
5. [x] API routes: `conciliacion-bancaria/route.ts` (GET lista, POST upload+parse+match+categorize), `[id]/route.ts` (GET detalle con movimientos, DELETE), `[id]/movements/[movId]/route.ts` (PATCH: confirm_match, unmatch, ignore, create_entry con save rule, update_category)
6. [x] UploadThing: endpoint `bankStatementCsv` para CSV/TXT/XLS en `core.ts`
7. [x] UI lista: `conciliacion-bancaria/page.tsx` — tabla desktop + cards mobile con periodo, banco, depositos/retiros, conciliados/nuevos, acciones ver/eliminar
8. [x] UI upload: `StatementUploadModal.tsx` — file picker, selector banco, cuenta, periodo mes/ano
9. [x] UI detalle: `[id]/page.tsx` — summary cards (total/conciliados/sin match/ignorados), tabs filtro, tabla de movimientos con estado/sugerencia/acciones
10. [x] UI acciones: `MovementActions.tsx` — confirmar match, rechazar, ignorar, restaurar, crear nuevo LedgerEntry (con area/subarea/concepto + opcion guardar regla)
11. [x] Sidebar: link "Conciliacion Bancaria" con icono Landmark
12. [x] Review: 2 runs de /review-feature (backend + UI), 0 bugs, todo pass

### FASE C: Conectar SAT Descarga -- COMPLETADA 2026-05-26
1. [x] API: `POST /api/sat-descarga/register-to-ledger` — registra 1-100 CFDIs como LedgerEntries. origin dinámico (sat_recibido/sat_emitido), hasFactura=true, satCfdiUuid, auto-create Proveedor por RFC, concepto desde XML conceptos, formaPago desde código SAT
2. [x] API: `GET /api/sat-descarga/register-to-ledger?uuids=...` — check cuáles UUIDs ya están registrados
3. [x] API: `GET /api/sat-descarga/reconciliation?month=YYYY-MM` — cross-reference CfdiEmitted (via fiscalProfile.doctorId) vs SatCfdiMetadata por UUID. Retorna matched, missingFromSat, cancelledInSat (con alerta si activa en sistema pero cancelada en SAT), onlyInSat
4. [x] UI: Botón "Registrar" en cada fila de CFDI en SAT page (columna nueva "Registro"), con estado registered/not, loading individual
5. [x] UI: Tab "Reconciliación" en SAT page con 4 cards clickeables (coinciden, no en SAT, cancelados, solo en SAT) + tabla de detalle por categoría
6. [x] Review: /review-feature encontró 1 bug (CfdiEmitted.doctorId no existe, corregido a fiscalProfile.doctorId) + 1 inconsistency (origin hardcoded, corregido a dinámico). Ambos fixed.

### FASE D: Webhook de Pagos → LedgerEntry -- COMPLETADA 2026-05-26
1. [x] Helper: `createPaymentLedgerEntry` en practice-utils.ts — shared por ambos webhooks, idempotent por bookingId, genera internalId, origin='webhook_pago', hasComprobante=true
2. [x] Stripe webhook: `checkout.session.completed` (card→formaDePago='tarjeta') + `checkout.session.async_payment_succeeded` (OXXO→formaDePago='efectivo') → createLedgerFromStripePayment helper
3. [x] MercadoPago webhook: payment `approved` → createPaymentLedgerEntry con mapMpPaymentMethod (credit_card/debit_card→tarjeta, ticket/atm→efectivo, bank_transfer→transferencia)
4. [x] Review: /review-feature — all pass, 0 bugs. Idempotencia doble (webhook level + DB bookingId unique), error handling no causa retries, schema alignment OK, edge cases (null bookingId, dual-provider) cubiertos.

### FASE E: Vista Unificada Mejorada -- COMPLETADA 2026-05-26
1. [x] Filtros por origen y evidencia (done in Phase A)
2. [x] API: `GET /api/practice-management/ledger/completeness` — counts paralelos (total, withComprobante, withFactura, withArea, groupBy origin, groupBy entryType, uncategorized, unpaidIngresos), retorna percentages + alerts con severidad
3. [x] UI: Tab "Completitud" en flujo-de-dinero page con: 4 summary cards (total, %comprobante, %factura, %categorizado), progress bars 3 capas evidencia, breakdown por origen (bar chart), breakdown por tipo (ingreso/egreso con montos), alertas con severidad (sin area, pendientes cobro, sin comprobante, sin factura)
4. [x] Hook: activeTab union extendido a 'movimientos' | 'estado-resultados' | 'completitud'
5. [x] Review: /review-feature (D+E conjunto) — 0 bugs, 0 inconsistencies, 1 minor (error handling silencioso en CompletenessTab → fixed con estado error + mensaje). formatCurrency dedup verificado.

---

## Parsing de Estados de Cuenta por Banco

### Formato CSV (mas facil, prioridad)

Los bancos mexicanos principales permiten exportar CSV desde banca en linea:

```
BBVA:       fecha, concepto, cargo, abono, saldo
Banorte:    fecha, referencia, concepto, cargo, abono, saldo
HSBC:       fecha, descripcion, retiros, depositos, saldo
Santander:  fecha, concepto, referencia, cargo, abono, saldo
Scotiabank: fecha, descripcion, referencia, debito, credito, saldo
```

Cada banco tiene columnas ligeramente diferentes. El sistema:
1. Detecta banco por nombre de columnas o seleccion del usuario
2. Mapea columnas al formato interno (fecha, descripcion, referencia, monto, tipo, saldo)
3. Normaliza fechas y montos

### Formato XLSX (segunda prioridad)
- Misma logica que CSV pero parseando con `xlsx` library
- Los bancos suelen dar el mismo formato en ambos

### Formato PDF (tercera prioridad, mas complejo)
- Usar `pdf-parse` para extraer texto
- Heuristicas por banco para encontrar la tabla de movimientos
- Regex para extraer filas: fecha, descripcion, monto
- Menor precision, requiere revision manual mas cuidadosa

---

## Resumen de Cambios al Schema (implementados)

```
NUEVOS MODELOS (Fase B — migration add-bank-reconciliation.sql):
  - BankStatement (estado de cuenta subido)
  - BankMovement (cada movimiento extraido, linked a LedgerEntry via ledgerEntryId)
  - BankCategorizationRule (reglas aprendidas de categorizacion)

CAMPOS NUEVOS en LedgerEntry (Fase A — migration add-ledger-origin-evidence.sql):
  - origin (String): "cita" | "manual" | "venta" | "compra" | "sat_recibido" | "sat_emitido" | "banco" | "webhook_pago"
  - hasComprobante (Boolean): tiene comprobante adjunto
  - hasFactura (Boolean): tiene factura CFDI
  - satCfdiUuid (String, unique): link a CFDI del SAT (usado por Fase C)

RELACIONES:
  - BankMovement.ledgerEntryId → LedgerEntry (1:1, unique)
  - LedgerEntry.satCfdiUuid → SatCfdiMetadata.uuid (link lógico, no FK)
```

## Progreso General

| Fase | Estado | Fecha |
|------|--------|-------|
| A — Fundamentos (origin, evidencia, filtros) | COMPLETADA | 2026-05-26 |
| B — Conciliacion Bancaria (CSV, match, categorize, UI) | COMPLETADA | 2026-05-26 |
| C — Conectar SAT Descarga (registrar, reconciliar) | COMPLETADA | 2026-05-26 |
| D — Webhook Pagos → LedgerEntry | COMPLETADA | 2026-05-26 |
| E — Dashboard completitud + alertas | COMPLETADA | 2026-05-26 |
