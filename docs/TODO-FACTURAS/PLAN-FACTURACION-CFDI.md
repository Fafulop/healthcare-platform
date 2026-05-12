# Plan de Implementacion: Facturacion CFDI con Facturama Multiemisor

**Fecha:** 2026-05-12
**Status:** Backend + UI implementados y auditados — pendiente: credenciales Facturama y testing E2E

---

## Contexto

En Mexico, los doctores necesitan emitir CFDIs (Comprobantes Fiscales Digitales por Internet) oficiales para sus ingresos. Estos solo pueden ser generados por PACs (Proveedores Autorizados de Certificacion) certificados por el SAT.

Actualmente la app permite **subir facturas existentes** (PDF y XML) al ledger via `LedgerFactura` y `LedgerFacturaXml`. El siguiente paso es **emitir CFDIs directamente desde la app**.

---

## Solucion Elegida: Facturama API Multiemisor

**Proveedor:** [Facturama](https://facturama.mx)
**Documentacion:** https://facturama.elevio.help/es/articles/141
**Sandbox:** https://apisandbox.facturama.mx
**Produccion:** https://api.facturama.mx

### Por que Facturama Multiemisor?

- **Un solo contrato** (nuestra cuenta) permite emitir CFDIs desde multiples RFCs (cada doctor)
- **White-label** - el doctor no necesita cuenta propia en Facturama
- **API REST** con SDKs en Node.js disponibles
- **Incluido con suscripcion anual** - se compran folios que comparten todos los emisores
- **Sandbox completo** para desarrollo sin costo

### Arquitectura Multiemisor

```
TuSalud Platform (nuestra cuenta Facturama)
    |
    |-- Doctor A (RFC: XXXX000000XX1) -- CSD cargado -- puede emitir CFDIs
    |-- Doctor B (RFC: YYYY000000YY2) -- CSD cargado -- puede emitir CFDIs
    |-- Doctor C (RFC: ZZZZ000000ZZ3) -- pendiente setup
```

**Importante:** La API Multiemisor NO es administrable desde el portal web de Facturama. Todo se maneja via HTTP requests desde nuestro backend.

---

## Hallazgos: Estado Actual de la App

### Modelos existentes relacionados (schema `practice_management`)

| Modelo | Proposito |
|--------|-----------|
| `LedgerEntry` | Registro de ingresos/egresos del doctor |
| `LedgerFactura` | PDF de factura subido manualmente |
| `LedgerFacturaXml` | XML CFDI subido y parseado (folio, UUID, RFC, totales) |

### Rutas API existentes

| Ruta | Funcion |
|------|---------|
| `POST /api/practice-management/ledger/:id/facturas` | Guardar metadata de PDF subido |
| `POST /api/practice-management/ledger/:id/facturas-xml` | Parsear y guardar XML CFDI subido |
| `GET` en ambas | Listar facturas de una entrada |

### Parser CFDI existente

Ya existe `@/lib/cfdiParser` que extrae datos de XMLs (UUID, RFC, totales, metodo/forma de pago, moneda).

### Infraestructura DB

- PostgreSQL con schemas: `public`, `practice_management`, `medical_records`, `llm_assistant`
- Migraciones via SQL files (NO `prisma db push` por conflicto con pgvector local)
- Deploy: Railway pgvector-pg17

---

## Workflow de Facturama API Multiemisor

### 1. Registrar CSD del Doctor (una sola vez)

El doctor sube sus archivos CSD (emitidos por el SAT):
- `.cer` - Certificado (public key)
- `.key` - Llave privada (private key)
- Password del `.key`

```
POST /api-lite/csds                    -- Registrar CSD nuevo
PUT  /api-lite/csds/{rfc}              -- Actualizar CSD existente (renovacion)
DELETE /api-lite/csds/{rfc}            -- Eliminar CSD

Body (POST y PUT):
{
  "Certificate": "<base64 del .cer>",
  "PrivateKey": "<base64 del .key>",
  "PrivateKeyPassword": "password123",
  "Rfc": "XAXX010101000",
  "TaxName": "DR JUAN PEREZ LOPEZ",
  "FiscalRegime": "612"  // Regimen fiscal SAT
}
```

### 2. Emitir CFDI

```
POST /api-lite/3/cfdis
{
  "Folio": "1",  // OBLIGATORIO en Multiemisor (auto-generado por nuestra app)
  "Issuer": {
    "Rfc": "XAXX010101000",
    "FiscalRegime": "612",
    "Name": "DR JUAN PEREZ LOPEZ"  // UPPERCASE obligatorio (debe coincidir con Cedula Fiscal)
  },
  "Receiver": {
    "Rfc": "XAXX010101001",
    "Name": "PACIENTE EJEMPLO",  // UPPERCASE obligatorio
    "CfdiUse": "D01",  // Honorarios medicos
    "FiscalRegime": "616",
    "TaxZipCode": "06600"
  },
  "CfdiType": "I",  // Ingreso
  "PaymentForm": "01",  // Efectivo
  "PaymentMethod": "PUE",  // Pago en una sola exhibicion
  "Exportation": "01",  // Sin exportacion (domestico)
  "ExpeditionPlace": "06600",
  "Items": [
    {
      "ProductCode": "85121800",  // Servicios medicos
      "Description": "Consulta medica general",
      "Quantity": 1,
      "UnitCode": "E48",  // Servicio
      "UnitPrice": 1000.00,
      "Subtotal": 1000.00,
      "TaxObject": "02",  // "01" sin impuestos, "02" con impuestos
      "Taxes": [
        {
          "Total": 160.00,
          "Name": "IVA",
          "Rate": 0.16,
          "Base": 1000.00,
          "IsRetention": false
        }
      ],
      "Total": 1160.00
    }
  ],
  // Campos opcionales no-fiscales (aparecen solo en PDF)
  "Observations": "Nota adicional para el PDF",
  "PaymentBankName": "Banamex",
  "PaymentAccountNumber": "1234",
  "OrderNumber": "ORD-001"
}
```

### 3. Consultar, descargar y enviar CFDI emitido

```
GET /api-lite/cfdis/{id}                -- Metadata (detalle)
GET /cfdi/pdf/issuedLite/{id}           -- PDF
GET /cfdi/xml/issuedLite/{id}           -- XML
GET /cfdi/html/issuedLite/{id}          -- HTML (preview en navegador)
GET /cfdi?type=issuedLite&rfcIssuer=... -- Busqueda filtrada (max 100/pagina, formato fecha DD/MM/YYYY)
POST /cfdi?CfdiType=issuedLite&CfdiId={id}&Email={email}  -- Enviar por email
```

**Importante:** Multiemisor usa type `issuedLite` (NO `issued` que es para API Web).

### 4. Cancelar CFDI

```
DELETE /api-lite/cfdis/{id}?rfc={rfc}&motive=02&uuidReplacement=...
```

Response incluye: `Status`, `IsCancelable`, `ExpirationDate`, `AcuseStatus` (codigos 201-312).
Posibles valores de `Status`: `canceled`, `active`, `pending`, `accepted`, `rejected`, `expired`.
Si `IsCancelable` = "Cancelable con aceptacion", el receptor tiene 72 horas para aceptar/rechazar.
Si no responde en 72h, se cancela automaticamente (`expired` → cancelado).

```
GET /acuse/pdf/issuedLite/{id}          -- Acuse de cancelacion (PDF)
GET /acuse/html/issuedLite/{id}         -- Acuse de cancelacion (HTML)
```

Motivos de cancelacion SAT:
- `01` - Comprobante emitido con errores con relacion (requiere `uuidReplacement`)
- `02` - Comprobante emitido con errores sin relacion
- `03` - No se llevo a cabo la operacion
- `04` - Operacion nominativa relacionada en la factura global

---

## Plan de Implementacion

### Fase 1: Schema + Facturama Service Layer

#### Nuevos modelos Prisma (schema `practice_management`)

```prisma
// Perfil fiscal del doctor - datos para emitir CFDIs
model DoctorFiscalProfile {
  id                  Int       @id @default(autoincrement())
  doctorId            String    @unique @map("doctor_id")
  rfc                 String    @db.VarChar(13)
  razonSocial         String    @map("razon_social") @db.VarChar(300)
  regimenFiscal       String    @map("regimen_fiscal") @db.VarChar(5)  // Clave SAT
  regimenFiscalDesc   String?   @map("regimen_fiscal_desc") @db.VarChar(200)
  codigoPostal        String    @map("codigo_postal") @db.VarChar(5)

  // CSD Status
  csdUploaded         Boolean   @default(false) @map("csd_uploaded")
  csdUploadedAt       DateTime? @map("csd_uploaded_at")
  csdValidUntil       DateTime? @map("csd_valid_until")
  facturamaStatus     String    @default("pending") @map("facturama_status") @db.VarChar(20)
  // "pending" | "active" | "error" | "expired"

  createdAt           DateTime  @default(now()) @map("created_at")
  updatedAt           DateTime  @updatedAt @map("updated_at")

  doctor              Doctor    @relation(fields: [doctorId], references: [id], onDelete: Cascade)
  cfdisEmitted        CfdiEmitted[]

  @@map("doctor_fiscal_profiles")
  @@schema("practice_management")
}

// CFDI emitido desde la plataforma via Facturama
model CfdiEmitted {
  id                  Int       @id @default(autoincrement())
  fiscalProfileId     Int       @map("fiscal_profile_id")
  ledgerEntryId       Int?      @map("ledger_entry_id")  // Opcional: vincular a entrada del ledger

  // Facturama reference
  facturamaId         String    @unique @map("facturama_id") @db.VarChar(100)

  // CFDI data
  uuid                String    @unique @db.VarChar(36)   // UUID fiscal (timbre)
  folio               String?   @db.VarChar(50)
  serie               String?   @db.VarChar(10)
  cfdiType            String    @map("cfdi_type") @db.VarChar(5)  // I=Ingreso, E=Egreso, P=Pago

  // Emisor/Receptor
  rfcEmisor           String    @map("rfc_emisor") @db.VarChar(13)
  rfcReceptor         String    @map("rfc_receptor") @db.VarChar(13)
  nombreReceptor      String    @map("nombre_receptor") @db.VarChar(300)
  usoCfdi             String    @map("uso_cfdi") @db.VarChar(10)

  // Montos
  subtotal            Decimal   @db.Decimal(12, 2)
  iva                 Decimal?  @db.Decimal(12, 2)
  retencionIsr        Decimal?  @map("retencion_isr") @db.Decimal(12, 2)
  total               Decimal   @db.Decimal(12, 2)
  moneda              String    @default("MXN") @db.VarChar(5)

  // Pago
  formaPago           String    @map("forma_pago") @db.VarChar(5)
  metodoPago          String    @map("metodo_pago") @db.VarChar(5)

  // Status
  status              String    @default("active") @db.VarChar(20)
  // "active" | "cancelled" | "cancellation_pending"
  cancelledAt         DateTime? @map("cancelled_at")
  cancelMotivo        String?   @map("cancel_motivo") @db.VarChar(5)

  // Archivos generados
  pdfUrl              String?   @map("pdf_url") @db.Text
  xmlUrl              String?   @map("xml_url") @db.Text
  xmlContent          String?   @map("xml_content") @db.Text

  // Fecha de emision
  issuedAt            DateTime  @map("issued_at")
  createdAt           DateTime  @default(now()) @map("created_at")

  fiscalProfile       DoctorFiscalProfile @relation(fields: [fiscalProfileId], references: [id], onDelete: Cascade)
  ledgerEntry         LedgerEntry?        @relation(fields: [ledgerEntryId], references: [id], onDelete: SetNull)

  @@index([fiscalProfileId])
  @@index([ledgerEntryId])
  @@index([rfcEmisor, status])
  @@index([issuedAt])
  @@map("cfdis_emitted")
  @@schema("practice_management")
}
```

#### Facturama API Client (`apps/api/src/lib/facturama.ts`)

```typescript
// Auth: Basic Auth (user:password encoded base64)
// Sandbox: https://apisandbox.facturama.mx
// Production: https://api.facturama.mx

// CSD Management
uploadCSD(payload)                    // POST /api-lite/csds
updateCSD(rfc, payload)               // PUT  /api-lite/csds/{rfc}
getCSDStatus(rfc)                     // GET  /api-lite/csds/{rfc}
deleteCSD(rfc)                        // DELETE /api-lite/csds/{rfc}
listCSDs()                            // GET  /api-lite/csds

// CFDI Operations (Ingreso, Egreso, Pago — all use same endpoint)
createCFDI(payload)                   // POST /api-lite/3/cfdis (payload.CfdiType: I|E|P)
getCFDI(facturamaId)                  // GET  /api-lite/cfdis/{id}
getCFDIFile(id, format)               // GET  /cfdi/{format}/issuedLite/{id}  (pdf|xml|html)
getCFDIPdf(id)                        // wrapper → getCFDIFile(id, 'pdf')
getCFDIXml(id)                        // wrapper → getCFDIFile(id, 'xml')
getCFDIHtml(id)                       // wrapper → getCFDIFile(id, 'html')
cancelCFDI(id, rfc, motive, uuid?)    // DELETE /api-lite/cfdis/{id}?rfc=&motive=
getCancellationAcuse(id, format)      // GET  /acuse/{format}/issuedLite/{id}
sendCFDIByEmail(id, email, opts?)     // POST /cfdi?CfdiType=issuedLite&CfdiId=&Email=
listCFDIs(rfc, filters?)             // GET  /cfdi?type=issuedLite&rfcIssuer=

// SAT Catalogs
getCatalogUsoCfdi(rfc?)                // GET  /api-lite/catalogs/CfdiUses?keyword={rfc}
getCatalogRegimenesFiscales()         // GET  /api-lite/catalogs/FiscalRegimes
getCatalogFormasPago()                // GET  /api-lite/catalogs/PaymentForms
getCatalogMetodosPago()               // GET  /api-lite/catalogs/PaymentMethods
searchProductCodes(query)             // GET  /api-lite/catalogs/ProductsOrServices?keyword=
searchUnitCodes(query)                // GET  /api-lite/catalogs/Units?keyword=

// Validations (each consumes 1 folio)
validateRFC(data)                     // POST /customers/validate
validateCFDIStatus(uuid, issuer, receiver, total)  // GET /cfdi/status
```

### Fase 2: API Routes

| Ruta | Metodo | Funcion |
|------|--------|---------|
| `/api/facturacion/profile` | GET | Obtener perfil fiscal del doctor |
| `/api/facturacion/profile` | POST/PUT | Crear/actualizar perfil fiscal |
| `/api/facturacion/csd` | POST | Subir CSD (cer + key + password) a Facturama |
| `/api/facturacion/csd` | PUT | Actualizar CSD existente (renovacion por expiracion) |
| `/api/facturacion/csd/status` | GET | Verificar status del CSD en Facturama |
| `/api/facturacion/cfdi` | POST | Emitir nuevo CFDI |
| `/api/facturacion/cfdi` | GET | Listar CFDIs emitidos |
| `/api/facturacion/cfdi/[id]` | GET | Detalle de un CFDI |
| `/api/facturacion/cfdi/[id]/pdf` | GET | Descargar PDF |
| `/api/facturacion/cfdi/[id]/xml` | GET | Descargar XML |
| `/api/facturacion/cfdi/[id]/html` | GET | Preview HTML en navegador |
| `/api/facturacion/cfdi/[id]/cancel` | POST | Cancelar CFDI |
| `/api/facturacion/cfdi/[id]/acuse` | GET | Descargar acuse de cancelacion (PDF/HTML via ?format=) |
| `/api/facturacion/cfdi/[id]/email` | POST | Enviar CFDI por email al receptor (con subject, comments, issuerEmail opcionales) |
| `/api/facturacion/cfdi/rep` | POST | Emitir REP (Complemento de Pago 2.0) — para facturas PPD |
| `/api/facturacion/cfdi/egreso` | POST | Emitir Nota de Credito (CFDI Egreso) — devoluciones/descuentos |
| `/api/facturacion/catalogos/[tipo]` | GET | Catalogos SAT (uso_cfdi, regimenes, formas_pago, productos) |
| `/api/facturacion/validar/rfc` | POST | Validar RFC contra SAT (consume 1 folio) |
| `/api/facturacion/validar/cfdi-status` | POST | Consultar status CFDI en SAT (consume 1 folio) |

### Fase 3: UI en Doctor App

#### A. Configuracion Fiscal (Settings)

Nueva seccion en `/dashboard/settings` o pagina dedicada `/dashboard/facturacion/setup`:
- Formulario: RFC, Razon Social, Regimen Fiscal, Codigo Postal
- Upload de archivos CSD (.cer + .key + password)
- Indicador de status (activo/pendiente/error)

#### B. Emision de CFDIs

Nueva pagina `/dashboard/facturacion`:
- Lista de CFDIs emitidos (con filtros por fecha, status)
- Boton "Nueva Factura" -> formulario:
  - Receptor: RFC, Nombre, Regimen Fiscal, CP, Uso CFDI
  - Conceptos: codigo producto SAT, descripcion, cantidad, precio unitario
  - Impuestos: IVA trasladado, retencion ISR (configurable)
  - Forma/metodo de pago
- Acciones por CFDI: ver PDF, preview HTML, descargar XML, enviar por email (con asunto/comentarios), cancelar, descargar acuse de cancelacion

#### C. Integracion con Ledger

- Boton "Facturar" en cada entrada de ingreso del ledger
- Pre-llena datos del CFDI desde la entrada (monto, concepto, cliente)
- Al emitir, vincula el CFDI con el `ledgerEntryId`

---

## Variables de Entorno Necesarias

```env
# Facturama API
FACTURAMA_USER=tu-usuario-facturama
FACTURAMA_PASSWORD=tu-password-facturama
FACTURAMA_API_URL=https://apisandbox.facturama.mx  # cambiar a api.facturama.mx en prod
```

---

## Consideraciones de Seguridad

1. **CSD nunca se almacena en nuestra DB** - se envia directo a Facturama y se descarta
2. **Password del .key** - se transmite via HTTPS, nunca se persiste
3. **Acceso por doctor** - cada doctor solo puede ver/emitir CFDIs con su propio RFC
4. **Audit trail** - cada CFDI emitido queda registrado con timestamp y datos completos
5. **LFPDPPP** - los datos fiscales son datos personales; aplica la misma politica de privacidad

---

## Consideraciones Fiscales SAT

- **Clave de producto SAT** para servicios medicos: `85121800` (Servicios de salud)
- **Clave de unidad**: `E48` (Unidad de servicio)
- **Uso CFDI comun para pacientes**: `D01` (Honorarios medicos, dentales y gastos hospitalarios)
- **Regimenes fiscales comunes para doctores**:
  - `612` - Personas Fisicas con Actividades Empresariales y Profesionales
  - `626` - Regimen Simplificado de Confianza (RESICO)
- **Retencion ISR**: Si el receptor es persona moral, debe retener 10% ISR
- **IVA**: Servicios medicos generalmente estan exentos de IVA (tasa 0% o exento segun el caso)

---

## Progreso de Implementacion

### Completado (2026-05-10)

| Paso | Archivo(s) | Status |
|------|-----------|--------|
| Schema Prisma | `packages/database/prisma/schema.prisma` | Done - modelos `DoctorFiscalProfile` + `CfdiEmitted` agregados |
| Migracion SQL | `packages/database/prisma/migrations/add-facturacion-cfdi-tables.sql` | Done - listo para ejecutar |
| Facturama API Client | `apps/api/src/lib/facturama.ts` | Done - CSD, CFDI, Catalogos, error handling |
| Ruta: Profile | `apps/api/src/app/api/facturacion/profile/route.ts` | Done - GET + POST (upsert) |
| Ruta: CSD Upload | `apps/api/src/app/api/facturacion/csd/route.ts` | Done - POST + PUT + DELETE |
| Ruta: CSD Status | `apps/api/src/app/api/facturacion/csd/status/route.ts` | Done - GET (consulta live a Facturama) |
| Ruta: CFDI CRUD | `apps/api/src/app/api/facturacion/cfdi/route.ts` | Done - GET (list) + POST (emit) |
| Ruta: CFDI Detail | `apps/api/src/app/api/facturacion/cfdi/[id]/route.ts` | Done - GET |
| Ruta: CFDI PDF | `apps/api/src/app/api/facturacion/cfdi/[id]/pdf/route.ts` | Done - GET (binary download) |
| Ruta: CFDI XML | `apps/api/src/app/api/facturacion/cfdi/[id]/xml/route.ts` | Done - GET (binary download) |
| Ruta: CFDI HTML | `apps/api/src/app/api/facturacion/cfdi/[id]/html/route.ts` | Done - GET (preview HTML) |
| Ruta: CFDI Cancel | `apps/api/src/app/api/facturacion/cfdi/[id]/cancel/route.ts` | Done - POST (con response enriquecida) |
| Ruta: CFDI Acuse | `apps/api/src/app/api/facturacion/cfdi/[id]/acuse/route.ts` | Done - GET (acuse cancelacion PDF/HTML) |
| Ruta: CFDI Email | `apps/api/src/app/api/facturacion/cfdi/[id]/email/route.ts` | Done - POST (con subject, comments, issuerEmail) |
| Ruta: REP | `apps/api/src/app/api/facturacion/cfdi/rep/route.ts` | Done - POST (Complemento de Pago 2.0) |
| Ruta: Egreso | `apps/api/src/app/api/facturacion/cfdi/egreso/route.ts` | Done - POST (Nota de Credito) |
| Ruta: Catalogos SAT | `apps/api/src/app/api/facturacion/catalogos/[tipo]/route.ts` | Done - GET (con fallback offline) |
| Ruta: Validaciones | `apps/api/src/app/api/facturacion/validar/[tipo]/route.ts` | Done - POST (RFC, CFDI status) |

### Code Review #1 (2026-05-10)

Review automatizado paso sin issues criticos:
- **32 checks Pass**
- **1 Bug corregido** — variable redundante en cancel route (re-await de params)
- **1 Minor corregido** — validacion de formato email agregada

### Code Review #2 (2026-05-10)

Review sistematico con checklist completo (DB↔Schema↔Migration, API Routes, Input Validation, Response Format, Cross-Cutting):
- **1 Bug corregido** — `cfdiId` scope: variable declarada dentro de `try` no accesible en `catch` (cancel/route.ts). Movida fuera del try block
- **1 Bug corregido** — whitespace bypass: `razonSocial: "   "` pasaba validacion falsy, se guardaba como `""`. Ahora usa `.trim()` en todas las validaciones (profile/route.ts)
- **4 Minor corregidos:**
  - Whitespace en queries de catalogos — ahora se aplica `.trim()` al parametro `q` (catalogos/[tipo]/route.ts)
  - Paginacion sin guardrails — `limit=0` causaba `totalPages: Infinity`. Ahora `limit` clamped a 1–100, `page` min 1, NaN defaults (cfdi/route.ts)
  - Binary responses (PDF/XML) sin `status: 200` explicito — agregado (pdf/route.ts, xml/route.ts)
- **1 Inconsistency aceptada** — `updated_at DEFAULT CURRENT_TIMESTAMP` en migracion es redundante (Prisma `@updatedAt` lo maneja), pero inofensivo y no se modifica para evitar conflictos con DBs ya desplegadas

### Code Review #3 — Facturama API Audit (2026-05-12)

Audit contra documentacion oficial de Facturama Multiemisor. Se encontraron **3 bugs criticos**, **3 issues de alta prioridad**, y **6 features faltantes**.

**Bugs criticos corregidos:**

1. **Download type `issued` → `issuedLite`** — PDF/XML usaban `/cfdi/{format}/issued/{id}` pero Multiemisor requiere `issuedLite`. Causaba 404 en toda descarga. (`facturama.ts`)
2. **Email endpoint completamente incorrecto** — Usaba `POST /api-lite/cfdis/{id}/email` con body, pero el endpoint oficial es `POST /cfdi?CfdiType=issuedLite&CfdiId={id}&Email={email}` con params en query string. (`facturama.ts`)
3. **Listing endpoint incorrecto** — Usaba `GET /api-lite/3/cfdis?rfc=` (endpoint de creacion) en vez de `GET /cfdi?type=issuedLite&rfcIssuer=`. Ahora soporta todos los filtros oficiales: status, dateStart/End, folio, rfcReceiver, taxEntityName. (`facturama.ts`)
4. **CFDI detail endpoint** — Corregido de `/api-lite/3/cfdis/{id}` a `/api-lite/cfdis/{id}`. (`facturama.ts`)

**Issues de alta prioridad corregidos:**

5. **Folio obligatorio en Multiemisor** — Docs oficiales dicen que Folio es mandatorio (no se auto-genera). Ahora se auto-genera secuencial por doctor si no se proporciona. (`cfdi/route.ts`)
6. **Nombres en UPPERCASE** — Tanto `Issuer.Name` como `Receiver.Name` deben ser mayusculas segun SAT/Facturama (deben coincidir con Cedula de Identificacion Fiscal). Ahora aplica `.toUpperCase()` a ambos. (`cfdi/route.ts`)

**Features nuevos agregados:**

7. **Descarga de acuse de cancelacion** — Nuevo endpoint `GET /api/facturacion/cfdi/:id/acuse?format=pdf|html` usando `GET /acuse/{format}/issuedLite/{id}`. (`cfdi/[id]/acuse/route.ts`)
8. **Descarga HTML de CFDI** — Nuevo endpoint `GET /api/facturacion/cfdi/:id/html` para preview en navegador. (`cfdi/[id]/html/route.ts`)
9. **Email con params opcionales** — Ahora soporta `subject`, `comments`, e `issuerEmail` ademas del email destino. (`email/route.ts`)
10. **Cancel response mejorada** — Ahora procesa y retorna `IsCancelable`, `ExpirationDate`, `AcuseStatus`, `AcuseStatusDetails` del response de Facturama. Detecta correctamente status "pending" tanto de respuestas exitosas como de errores. (`cancel/route.ts`, `facturama.ts`)
11. **Funcion generica `getCFDIFile()`** — Soporta pdf, xml, html con un solo metodo base. (`facturama.ts`)
12. **Listing con filtros completos** — Ahora soporta `dateStart`, `dateEnd`, `folio`, `rfcReceiver`, `taxEntityName`, paginacion oficial (page 0-based, 10 items/page). (`facturama.ts`)

### Code Review #4 — Post-fix verification (2026-05-12)

Review sistematico de todos los archivos modificados y nuevos post-audit:
- **22 checks Pass**
- **1 Bug corregido** — Cancel route aceptaba silenciosamente status "active" + "No cancelable" de Facturama (CFDI con documentos relacionados). Ahora retorna 400 con error claro. (`cancel/route.ts`)
- **2 Minor aceptados:**
  - HTML route sin `Content-Disposition` header — intencional, para preview inline en navegador
  - `rfcReceiver` param name vs Facturama `rfc` — intencional, nuestro naming es mas claro

### Audit #2 — Facturama Guide Pages (2026-05-12)

Audit contra paginas guia oficiales de Facturama (`apisandbox.facturama.mx/guias/api-multi/*`):

1. **`updateCSD` (PUT /api-lite/csds/{rfc})** — Faltaba endpoint para actualizar CSD sin borrar y re-crear. Agregado a `facturama.ts` y `csd/route.ts`.
2. **Formato de fecha en listing: `DD/MM/YYYY`** — Documentacion oficial usa `DD/MM/YYYY`, no ISO. Corregidos comentarios en `facturama.ts`.
3. **Paginacion 100/pagina** — Guia oficial dice max 100 resultados por pagina, no 10 como decia el articulo elevio. Corregido comentario.
4. **Cancel statuses adicionales** — Facturama retorna `accepted`, `rejected`, `expired` ademas de `canceled`, `active`, `pending`. Ahora `cancel/route.ts` maneja: rejected → error 400, accepted/expired → cancelled.
5. **Campos opcionales no-fiscales** — `Observations`, `PaymentBankName`, `PaymentAccountNumber`, `OrderNumber` para PDF. Agregados a `CreateCfdiPayload` y `cfdi/route.ts`.
6. **CfdiUses catalogo acepta RFC** — Resultados varian segun tipo de persona (fisica/moral). Ahora pasa `?keyword={rfc}` si se proporciona query.

### Audit #3 — Paginas adicionales del menu Facturama (2026-05-12)

Review de paginas no cubiertas anteriormente: Complemento de Pago, Egreso/Nota de Credito, Recarga de Folios.

**Features implementados (2026-05-12):**

1. **Complemento de Pago 2.0 (REP)** — Implementado en `cfdi/rep/route.ts`. Endpoint `POST /api/facturacion/cfdi/rep` con:
   - `CfdiType: "P"`, sin Items, nodo `Complement.Payments[]` con `Date`, `PaymentForm`, `Amount`, `Currency`
   - `RelatedDocuments[]` con UUID de factura original, parcialidad, saldo anterior/pagado/pendiente
   - Receptor `CfdiUse: "CP01"` (Pagos), validacion de que factura original existe y es PPD
   - Tipos completos: `PaymentComplement`, `PaymentComplementItem`, `PaymentRelatedDocument` en `facturama.ts`

2. **CFDI Egreso / Nota de Credito** — Implementado en `cfdi/egreso/route.ts`. Endpoint `POST /api/facturacion/cfdi/egreso` con:
   - `CfdiType: "E"`, `NameId: "2"` (Nota de Credito)
   - Nodo `Relations: { Type: "01", Cfdis: [{ Uuid }] }` vinculando a factura original
   - Receptor `CfdiUse: "G02"`, validacion de que factura original existe y esta activa
   - Forma de pago defaults a la de la factura original si no se especifica

3. **Nodo `Relations` y `NameId` en tipos** — Agregados a `CreateCfdiPayload` en `facturama.ts`. Usados por Egreso y disponibles para cancelacion con motivo 01.

4. **Nodo `Complement.Payments` en tipos** — Agregado a `CreateCfdiPayload`. Estructura completa con pagos, documentos relacionados, impuestos por documento.

**Features pendientes (no requieren API):**

5. **Recarga de folios** — Proceso administrativo via portal web. No requiere API. Precio: $0.40-$0.50 MXN/folio segun volumen. Requiere suscripcion anual activa.

6. **Retenciones** — Pendiente revision manual.

### Audit #4 — Elevio Help Center completo (2026-05-12)

Review de TODAS las paginas del help center de Facturama (elevio). Articulos cubiertos: autenticacion, CSD, CFDI Multiemisor (creacion, consulta, descarga, cancelacion, acuse, email, listado), JSON examples (Egreso, Complemento de Pago), catalogos, validaciones.

**Corregido:**

1. **Formato fecha en listing** — Docs elevio dicen `aaaa-mm-ddThh:mm:ss` pero ejemplo usa `DD-MM-YYYY`. Corregido comentario de `DD/MM/YYYY` a `DD-MM-YYYY`. (`facturama.ts`)
2. **Paginacion** — Docs elevio dicen 10 resultados/pagina. Corregido comentario de 100 a 10. (`facturama.ts`)
3. **Params faltantes en listCFDIs** — Agregados `folioStart`, `folioEnd`, `orderNumber` segun docs oficiales. (`facturama.ts`)

**Nuevos endpoints implementados:**

4. **Validacion de RFC** — `POST /customers/validate` con Rfc, Name, ZipCode, FiscalRegime. Retorna ExistRfc, MatchName, MatchZipCode, MatchFiscalRegime. Consume 1 folio. (`facturama.ts`, `validar/[tipo]/route.ts`)
5. **Validacion de status CFDI** — `GET /cfdi/status?uuid=&issuerRfc=&receiverRfc=&total=`. Retorna Status (Vigente/Cancelado/No encontrado), IsCancelable. Consume 1 folio. (`facturama.ts`, `validar/[tipo]/route.ts`)
6. **CIF validation descartada** — Solo funciona en produccion (`POST /api/cif`), no en sandbox. No se implementa por ahora.

**Verificado sin cambios necesarios:**

7. **Cancel endpoint con `rfc` param** — Elevio no lo menciona pero guide pages si. Mantenemos `rfc` en la URL ya que es necesario para identificar emisor en Multiemisor.
8. **Egreso/Nota de Credito** — JSON example oficial confirma: NameId "2", CfdiType "E", Relations Type "01", CfdiUse "G02". Nuestra implementacion coincide.
9. **REP/Complemento de Pago** — Docs confirman estructura Complement.Payments con RelatedDocuments. Nuestra implementacion coincide.
10. **CSD upload** — Endpoint y body confirmados. Password test CSDs: `12345678a`.
11. **Descarga archivos** — Tipo `issuedLite`, formatos pdf/xml/html, response con Content base64. Todo correcto.
12. **Email** — Query params confirmados: CfdiType, CfdiId, Email, Subject, Comments, IssuerEmail. Todo correcto.

### UI Implementada (2026-05-12)

| Componente | Archivo | Status |
|-----------|---------|--------|
| Configuracion Fiscal (perfil + CSD) | `apps/doctor/src/app/dashboard/facturacion/page.tsx` — ConfigTab | Done |
| Lista de Facturas (filtros, paginacion, acciones) | Mismo archivo — FacturasListTab | Done — status filter, pagination, type column, cancel, acuse, HTML preview, email |
| Nueva Factura (Ingreso) | Mismo archivo — NuevaFacturaTab | Done — receptor, conceptos, IVA/ISR, forma/metodo pago, totals |
| REP (Complemento de Pago) | Mismo archivo — REPTab | Done — seleccion de factura PPD, pago, parcialidad, saldo |
| Nota de Credito (Egreso) | Mismo archivo — EgresoTab | Done — seleccion de factura original, conceptos, IVA |
| Guia de Facturacion | Mismo archivo — GuiaTab | Done — referencia rapida integrada en la UI |
| Boton "Facturar" en Ledger | `apps/doctor/src/app/dashboard/practice/flujo-de-dinero/[id]/page.tsx` | Done — pre-fill desde entrada de ingreso |

**Integracion Ledger → Facturacion:**
- Boton "Facturar" visible solo en entradas de tipo ingreso
- Navega a `/dashboard/facturacion?from=ledger&...` con query params
- Pre-llena: concepto, monto, nombre del cliente, forma de pago (mapeada a codigos SAT)
- Vincula el CFDI emitido con el `ledgerEntryId` en la base de datos

### Pendiente

| Paso | Prioridad | Bloqueado por |
|------|-----------|---------------|
| Obtener credenciales sandbox Facturama | Alta | Registro en facturama.mx |
| ~~Agregar soporte REP (Complemento de Pago)~~ | ~~Alta~~ | Done — `cfdi/rep/route.ts` |
| ~~Agregar soporte Nota de Credito (Egreso)~~ | ~~Media~~ | Done — `cfdi/egreso/route.ts` |
| ~~UI: Configuracion Fiscal (settings page)~~ | ~~Media~~ | Done — ConfigTab |
| ~~UI: Pagina de Facturacion (list + create)~~ | ~~Media~~ | Done — FacturasListTab + NuevaFacturaTab |
| ~~UI: REP y Nota de Credito~~ | ~~Media~~ | Done — REPTab + EgresoTab |
| ~~UI: Integracion con Ledger (boton "Facturar")~~ | ~~Media~~ | Done — flujo-de-dinero/[id] |
| Testing E2E contra sandbox | Alta | Credenciales |
| Deploy a produccion | Baja | Todo lo anterior |

### Comandos para activar

```bash
# 1. Validar schema
cd packages/database && npx prisma validate

# 2. Ejecutar migracion local
cd packages/database && npx prisma db execute --file prisma/migrations/add-facturacion-cfdi-tables.sql --schema prisma/schema.prisma

# 3. Regenerar Prisma Client
pnpm db:generate

# 4. Ejecutar migracion en Railway (antes de deploy)
cd packages/database && npx prisma db execute --file prisma/migrations/add-facturacion-cfdi-tables.sql --url "postgresql://postgres:PASSWORD@yamanote.proxy.rlwy.net:51502/railway"
```

---

## Referencias

### Facturama API Multiemisor (auditadas 2026-05-12)
- Proceso general: https://facturama.elevio.help/es/articles/141
- Carga de CSD: https://facturama.elevio.help/es/articles/100
- Conversion CSD a base64: https://facturama.elevio.help/es/articles/126
- Guia creacion CFDI 4.0: https://apisandbox.facturama.mx/guias/api-multi/cfdi/factura
- Detalle de factura: https://facturama.elevio.help/es/articles/121
- Descarga PDF/XML/HTML: https://facturama.elevio.help/es/articles/107
- Busqueda filtrada: https://facturama.elevio.help/es/articles/119
- Envio por email: https://facturama.elevio.help/es/articles/137
- Cancelacion: https://facturama.elevio.help/es/articles/108
- Acuse de cancelacion: https://facturama.elevio.help/es/articles/110
- Campos adicionales CFDI: https://apisandbox.facturama.mx/guias/api-multi/cfdi/campos-adicionales
- Consultar CFDIs: https://apisandbox.facturama.mx/guias/api-multi/cfdi/consultar
- CSD management: https://apisandbox.facturama.mx/guias/api-multi/csds
- Complemento de Pago: https://facturama.elevio.help/es/articles/80
- Nota de Credito (Egreso): https://facturama.elevio.help/es/articles/94
- Recarga de folios: https://facturama.elevio.help/es/articles/146
- Coleccion Postman: https://facturama.elevio.help/es/articles/163
- Sandbox: https://apisandbox.facturama.mx

### SAT
- Catalogo Regimenes Fiscales: http://omawww.sat.gob.mx/tramitesyservicios/Paginas/catalogos_702.htm
- Catalogo Uso CFDI: incluido en API Facturama `/catalogs/CfdiUses`
- CFDI 4.0 (version vigente): Anexo 20 del SAT
