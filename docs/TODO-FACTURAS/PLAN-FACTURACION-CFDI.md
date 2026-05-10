# Plan de Implementacion: Facturacion CFDI con Facturama Multiemisor

**Fecha:** 2026-05-10
**Status:** Backend implementado (schema + API client + routes) — pendiente: UI, credenciales Facturama, testing

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
POST /api-lite/csd
{
  "Certificate": "<base64 del .cer>",
  "PrivateKey": "<base64 del .key>",
  "PrivateKeyPassword": "password123",
  "Rfc": "XAXX010101000",
  "TaxName": "Dr. Juan Perez Lopez",
  "FiscalRegime": "612"  // Regimen fiscal SAT
}
```

### 2. Emitir CFDI

```
POST /api-lite/3/cfdis
{
  "Issuer": {
    "Rfc": "XAXX010101000",
    "FiscalRegime": "612",
    "Name": "Dr. Juan Perez Lopez"
  },
  "Receiver": {
    "Rfc": "XAXX010101001",
    "Name": "Paciente Ejemplo",
    "CfdiUse": "D01",  // Honorarios medicos
    "FiscalRegime": "616",
    "TaxZipCode": "06600"
  },
  "CfdiType": "I",  // Ingreso
  "PaymentForm": "01",  // Efectivo
  "PaymentMethod": "PUE",  // Pago en una sola exhibicion
  "ExpeditionPlace": "06600",
  "Items": [
    {
      "ProductCode": "85121800",  // Servicios medicos
      "Description": "Consulta medica general",
      "Quantity": 1,
      "UnitCode": "E48",  // Servicio
      "UnitPrice": 1000.00,
      "Subtotal": 1000.00,
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
  ]
}
```

### 3. Descargar PDF/XML del CFDI emitido

```
GET /api-lite/cfdis/{id}       -- Metadata
GET /cfdi/pdf/issued/{id}       -- PDF
GET /cfdi/xml/issued/{id}       -- XML
```

### 4. Cancelar CFDI

```
DELETE /api-lite/cfdis/{id}?motive=02&uuidReplacement=...
```

Motivos de cancelacion SAT:
- `01` - Comprobante emitido con errores con relacion
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
// Facturama API Multiemisor client
// Auth: Basic Auth (user:password encoded base64)
// Sandbox: https://apisandbox.facturama.mx
// Production: https://api.facturama.mx

class FacturamaClient {
  // CSD Management
  uploadCSD(rfc, certificate, privateKey, password, taxName, fiscalRegime)
  getCSDStatus(rfc)
  deleteCSD(rfc)

  // CFDI Operations
  createCFDI(cfdiPayload)
  getCFDI(id)
  getCFDIPdf(id)
  getCFDIXml(id)
  cancelCFDI(id, motive, uuidReplacement?)
  listCFDIs(rfc, filters?)

  // Catalogs
  getUsoCfdi()
  getRegimenesFiscales()
  getFormasPago()
  getProductCodes(query)
}
```

### Fase 2: API Routes

| Ruta | Metodo | Funcion |
|------|--------|---------|
| `/api/facturacion/profile` | GET | Obtener perfil fiscal del doctor |
| `/api/facturacion/profile` | POST/PUT | Crear/actualizar perfil fiscal |
| `/api/facturacion/csd` | POST | Subir CSD (cer + key + password) a Facturama |
| `/api/facturacion/csd/status` | GET | Verificar status del CSD en Facturama |
| `/api/facturacion/cfdi` | POST | Emitir nuevo CFDI |
| `/api/facturacion/cfdi` | GET | Listar CFDIs emitidos |
| `/api/facturacion/cfdi/[id]` | GET | Detalle de un CFDI |
| `/api/facturacion/cfdi/[id]/pdf` | GET | Descargar PDF |
| `/api/facturacion/cfdi/[id]/xml` | GET | Descargar XML |
| `/api/facturacion/cfdi/[id]/cancel` | POST | Cancelar CFDI |
| `/api/facturacion/cfdi/[id]/email` | POST | Enviar CFDI por email al receptor |
| `/api/facturacion/catalogos/[tipo]` | GET | Catalogos SAT (uso_cfdi, regimenes, formas_pago, productos) |

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
- Acciones por CFDI: ver PDF, descargar XML, enviar por email, cancelar

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
| Ruta: CSD Upload | `apps/api/src/app/api/facturacion/csd/route.ts` | Done - POST + DELETE |
| Ruta: CSD Status | `apps/api/src/app/api/facturacion/csd/status/route.ts` | Done - GET (consulta live a Facturama) |
| Ruta: CFDI CRUD | `apps/api/src/app/api/facturacion/cfdi/route.ts` | Done - GET (list) + POST (emit) |
| Ruta: CFDI Detail | `apps/api/src/app/api/facturacion/cfdi/[id]/route.ts` | Done - GET |
| Ruta: CFDI PDF | `apps/api/src/app/api/facturacion/cfdi/[id]/pdf/route.ts` | Done - GET (binary download) |
| Ruta: CFDI XML | `apps/api/src/app/api/facturacion/cfdi/[id]/xml/route.ts` | Done - GET (binary download) |
| Ruta: CFDI Cancel | `apps/api/src/app/api/facturacion/cfdi/[id]/cancel/route.ts` | Done - POST |
| Ruta: CFDI Email | `apps/api/src/app/api/facturacion/cfdi/[id]/email/route.ts` | Done - POST |
| Ruta: Catalogos SAT | `apps/api/src/app/api/facturacion/catalogos/[tipo]/route.ts` | Done - GET (con fallback offline) |

### Code Review (2026-05-10)

Review automatizado paso sin issues criticos:
- **32 checks Pass**
- **1 Bug corregido** — variable redundante en cancel route (re-await de params)
- **1 Minor corregido** — validacion de formato email agregada

### Pendiente

| Paso | Prioridad | Bloqueado por |
|------|-----------|---------------|
| Obtener credenciales sandbox Facturama | Alta | Registro en facturama.mx |
| Ejecutar migracion SQL contra DB local | Alta | Credenciales no necesarias |
| Ejecutar migracion SQL contra Railway | Alta | Antes de deploy |
| Regenerar Prisma Client (`pnpm db:generate`) | Alta | Migracion local |
| UI: Configuracion Fiscal (settings page) | Media | Nada |
| UI: Pagina de Facturacion (list + create) | Media | Nada |
| UI: Integracion con Ledger (boton "Facturar") | Media | UI Facturacion |
| Testing E2E contra sandbox | Media | Credenciales |
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

- Facturama Multiemisor docs: https://facturama.elevio.help/es/articles/141
- Facturama API Sandbox: https://apisandbox.facturama.mx
- Catalogo SAT Regimenes Fiscales: http://omawww.sat.gob.mx/tramitesyservicios/Paginas/catalogos_702.htm
- Catalogo SAT Uso CFDI: incluido en API Facturama `/catalogs/CfdiUses`
- CFDI 4.0 (version vigente): Anexo 20 del SAT
