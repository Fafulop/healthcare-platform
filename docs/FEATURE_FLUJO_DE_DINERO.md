# Feature Documentation: Flujo de Dinero (Cash Flow / Ledger)

Complete documentation for the cash flow management system in Mexican Pesos (MXN).

---

## Overview

Comprehensive cash flow tracking system for managing business income and expenses. Features:
- **Ledger entries** in Mexican Pesos (MXN)
- **Income and expense** tracking
- **Area/subarea** categorization
- **Multiple payment methods** (efectivo, transferencia, tarjeta, etc.)
- **File attachments** (receipts, invoices)
- **Invoice management** (PDF and XML facturas)
- **Pending transactions** (por realizar)
- **Bank account** tracking
- **Internal IDs** for transaction reference

**User Scoping**: Each user has independent ledger with isolated transactions.

---

## Database Schema (Prisma)

### 1. LedgerEntryMxn (Main Ledger)

```prisma
model LedgerEntryMxn {
  id              Int                   @id @default(autoincrement())
  userId          String                @map("user_id")
  amount          Decimal               @db.Decimal(12, 2)
  concept         String
  bankAccount     String?               @map("bank_account") @db.VarChar(255)
  formaDePago     String?               @default("efectivo") @map("forma_de_pago") @db.VarChar(50)
  internalId      String                @unique @map("internal_id") @db.VarChar(100)
  bankMovementId  String?               @map("bank_movement_id") @db.VarChar(255)
  entryType       String                @map("entry_type") @db.VarChar(20)
  transactionDate DateTime              @map("transaction_date") @db.Date
  area            String                @db.VarChar(255)
  subarea         String                @db.VarChar(255)
  porRealizar     Boolean               @default(false) @map("por_realizar")
  firmOrderId     Int?                  @map("firm_order_id")
  goodsReceiptId  Int?                  @map("goods_receipt_id")
  fileUrl         String?               @map("file_url")
  fileName        String?               @map("file_name") @db.VarChar(255)
  fileSize        Int?                  @map("file_size")
  fileType        String?               @map("file_type") @db.VarChar(100)
  createdAt       DateTime              @default(now()) @map("created_at")
  updatedAt       DateTime              @updatedAt @map("updated_at")
  attachments     LedgerAttachmentMxn[]
  user            User                  @relation(fields: [userId], references: [id], onDelete: Cascade)
  firmOrder       FirmOrder?            @relation(fields: [firmOrderId], references: [id], onDelete: SetNull)
  goodsReceipt    GoodsReceipt?         @relation(fields: [goodsReceiptId], references: [id], onDelete: SetNull)
  facturas        LedgerFacturaMxn[]
  facturasXml     LedgerFacturaXmlMxn[]

  @@index([userId])
  @@index([entryType])
  @@index([transactionDate])
  @@index([area])
  @@index([subarea])
  @@index([porRealizar])
  @@index([firmOrderId])
  @@index([goodsReceiptId])
  @@index([userId, transactionDate])
  @@index([userId, area, subarea])
  @@index([userId, porRealizar])
  @@index([userId, entryType])
  @@map("ledger_entries_mxn")
}
```

**Fields Explained**:
- `amount`: Transaction amount in MXN (positive for income, can be negative for expense)
- `concept`: Transaction description/concept
- `bankAccount`: Bank account name/number
- `formaDePago`: Payment method (efectivo, transferencia, tarjeta, cheque, etc.)
- `internalId`: Unique internal reference ID (e.g., "ING-2026-001")
- `bankMovementId`: Bank's transaction ID/reference
- `entryType`: "ingreso" or "egreso" (income or expense)
- `transactionDate`: Date of transaction
- `area`, `subarea`: Categorization (from Areas feature)
- `porRealizar`: Boolean flag for pending/future transactions
- `firmOrderId`: Optional link to sales order
- `goodsReceiptId`: Optional link to purchase receipt
- `fileUrl`, `fileName`, `fileSize`, `fileType`: Primary attachment (single file)

**Unique Constraints**:
- `internalId` must be globally unique

**Indexes**: Optimized for common queries (by user, date, type, area, status)

---

### 2. LedgerAttachmentMxn (Additional Attachments)

```prisma
model LedgerAttachmentMxn {
  id             Int            @id @default(autoincrement())
  ledgerEntryId  Int            @map("ledger_entry_id")
  fileName       String         @map("file_name") @db.VarChar(255)
  fileUrl        String         @map("file_url")
  fileSize       Int?           @map("file_size")
  fileType       String?        @map("file_type") @db.VarChar(100)
  attachmentType String         @default("file") @map("attachment_type") @db.VarChar(20)
  uploadedBy     String         @map("uploaded_by")
  createdAt      DateTime       @default(now()) @map("created_at")
  ledgerEntry    LedgerEntryMxn @relation(fields: [ledgerEntryId], references: [id], onDelete: Cascade)

  @@index([ledgerEntryId])
  @@map("ledger_attachments_mxn")
}
```

**Purpose**: Allow multiple file attachments per ledger entry (receipts, contracts, etc.)

---

### 3. LedgerFacturaMxn (Invoice PDFs)

```prisma
model LedgerFacturaMxn {
  id            Int            @id @default(autoincrement())
  ledgerEntryId Int            @map("ledger_entry_id")
  fileName      String         @map("file_name") @db.VarChar(255)
  fileUrl       String         @map("file_url")
  fileSize      Int?           @map("file_size")
  fileType      String?        @map("file_type") @db.VarChar(100)
  folio         String?        @db.VarChar(100)
  uuid          String?        @db.VarChar(100)
  rfcEmisor     String?        @map("rfc_emisor") @db.VarChar(20)
  rfcReceptor   String?        @map("rfc_receptor") @db.VarChar(20)
  total         Decimal?       @db.Decimal(12, 2)
  notes         String?
  uploadedBy    String         @map("uploaded_by")
  createdAt     DateTime       @default(now()) @map("created_at")
  ledgerEntry   LedgerEntryMxn @relation(fields: [ledgerEntryId], references: [id], onDelete: Cascade)

  @@index([ledgerEntryId])
  @@map("ledger_facturas_mxn")
}
```

**Purpose**: Store invoice PDFs with metadata (folio, RFC, total, etc.)

**Mexican Invoice Fields**:
- `folio`: Invoice number
- `uuid`: Unique fiscal folio (UUID from SAT)
- `rfcEmisor`: Issuer's RFC (tax ID)
- `rfcReceptor`: Receiver's RFC (tax ID)

---

### 4. LedgerFacturaXmlMxn (Invoice XML)

```prisma
model LedgerFacturaXmlMxn {
  id            Int            @id @default(autoincrement())
  ledgerEntryId Int            @map("ledger_entry_id")
  fileName      String         @map("file_name") @db.VarChar(255)
  fileUrl       String         @map("file_url")
  fileSize      Int?           @map("file_size")
  xmlContent    String?        @map("xml_content")
  folio         String?        @db.VarChar(100)
  uuid          String?        @unique @db.VarChar(100)
  rfcEmisor     String?        @map("rfc_emisor") @db.VarChar(20)
  rfcReceptor   String?        @map("rfc_receptor") @db.VarChar(20)
  total         Decimal?       @db.Decimal(12, 2)
  subtotal      Decimal?       @db.Decimal(12, 2)
  iva           Decimal?       @db.Decimal(12, 2)
  fecha         DateTime?      @db.Timestamp(6)
  metodoPago    String?        @map("metodo_pago") @db.VarChar(50)
  formaPago     String?        @map("forma_pago") @db.VarChar(50)
  moneda        String?        @db.VarChar(10)
  notes         String?
  uploadedBy    String         @map("uploaded_by")
  createdAt     DateTime       @default(now()) @map("created_at")
  ledgerEntry   LedgerEntryMxn @relation(fields: [ledgerEntryId], references: [id], onDelete: Cascade)

  @@index([ledgerEntryId])
  @@index([uuid])
  @@map("ledger_facturas_xml_mxn")
}
```

**Purpose**: Store and parse XML invoices from Mexican SAT (tax authority)

**Additional Fields**:
- `xmlContent`: Full XML content (for parsing)
- `subtotal`, `iva`: Breakdown of total
- `fecha`: Invoice date
- `metodoPago`: Payment method code (e.g., "PUE", "PPD")
- `formaPago`: Payment form code (e.g., "01", "03")
- `moneda`: Currency code (e.g., "MXN", "USD")

**Unique**: `uuid` is globally unique per SAT regulations

---

## API Endpoints

### Base URL: `/api/ledger-mxn`

### 1. **GET /api/ledger-mxn**
Get all ledger entries with filtering.

**Query Parameters**:
- `entryType`: "ingreso" or "egreso"
- `area`: Filter by area
- `subarea`: Filter by subarea
- `startDate`, `endDate`: Date range
- `porRealizar`: "true" or "false" (pending transactions)
- `bankAccount`: Filter by bank account

**Request**:
```http
GET /api/ledger-mxn?entryType=ingreso&startDate=2026-01-01&endDate=2026-01-31
```

**Response**:
```json
[
  {
    "id": 1,
    "userId": "user123",
    "amount": "5000.00",
    "concept": "Venta de productos enero",
    "bankAccount": "BBVA Empresarial",
    "formaDePago": "transferencia",
    "internalId": "ING-2026-001",
    "bankMovementId": "REF123456",
    "entryType": "ingreso",
    "transactionDate": "2026-01-15",
    "area": "Ventas",
    "subarea": "Online",
    "porRealizar": false,
    "fileUrl": "https://...",
    "fileName": "comprobante.pdf",
    "createdAt": "2026-01-15T10:00:00Z",
    "updatedAt": "2026-01-15T10:00:00Z",
    "attachments": [],
    "facturas": [],
    "facturasXml": []
  }
]
```

---

### 2. **POST /api/ledger-mxn**
Create a new ledger entry.

**Request**:
```json
{
  "amount": 5000.00,
  "concept": "Venta de productos enero",
  "bankAccount": "BBVA Empresarial",
  "formaDePago": "transferencia",
  "internalId": "ING-2026-001",
  "bankMovementId": "REF123456",
  "entryType": "ingreso",
  "transactionDate": "2026-01-15",
  "area": "Ventas",
  "subarea": "Online",
  "porRealizar": false
}
```

**Validation**:
- `amount` required (number)
- `concept` required
- `entryType` must be "ingreso" or "egreso"
- `internalId` must be unique
- `transactionDate` required (ISO date)
- `area` and `subarea` required

**Implementation**:
```typescript
// POST /api/ledger-mxn
const { amount, concept, bankAccount, formaDePago, internalId, entryType, transactionDate, area, subarea, porRealizar } = req.body;

// Validation
if (!amount || !concept || !entryType || !transactionDate || !area || !subarea) {
  return res.status(400).json({ error: 'Missing required fields' });
}

if (!['ingreso', 'egreso'].includes(entryType)) {
  return res.status(400).json({ error: 'entryType must be ingreso or egreso' });
}

// Check unique internalId
const existing = await prisma.ledgerEntryMxn.findUnique({
  where: { internalId }
});

if (existing) {
  return res.status(400).json({ error: 'Internal ID already exists' });
}

const entry = await prisma.ledgerEntryMxn.create({
  data: {
    userId: req.user.id,
    amount,
    concept,
    bankAccount,
    formaDePago: formaDePago || 'efectivo',
    internalId,
    entryType,
    transactionDate: new Date(transactionDate),
    area,
    subarea,
    porRealizar: porRealizar || false
  },
  include: {
    attachments: true,
    facturas: true,
    facturasXml: true
  }
});

res.status(201).json(entry);
```

---

### 3. **PUT /api/ledger-mxn/:id**
Update a ledger entry.

**Security**: Verify entry belongs to user

---

### 4. **DELETE /api/ledger-mxn/:id**
Delete a ledger entry (cascades to attachments, facturas).

---

### 5. **POST /api/ledger-mxn/:id/attachments**
Add file attachment to entry.

**Request**: Multipart form data

---

### 6. **POST /api/ledger-mxn/:id/facturas**
Upload PDF invoice.

**Request**: Multipart form data + optional metadata

```json
{
  "folio": "A-12345",
  "uuid": "12345678-1234-1234-1234-123456789012",
  "rfcEmisor": "AAA010101AAA",
  "rfcReceptor": "BBB020202BBB",
  "total": 5800.00,
  "notes": "Factura de enero"
}
```

---

### 7. **POST /api/ledger-mxn/:id/facturas-xml**
Upload and parse XML invoice.

**Process**:
1. Upload XML file
2. Parse XML content
3. Extract: UUID, RFC, totals, dates, payment info
4. Store parsed data

**Implementation** (XML parsing):
```typescript
// Parse Mexican CFDI XML
import xml2js from 'xml2js';

async function parseFacturaXml(xmlContent: string) {
  const parser = new xml2js.Parser();
  const result = await parser.parseStringPromise(xmlContent);

  const comprobante = result['cfdi:Comprobante'];

  return {
    uuid: comprobante['$']['UUID'],
    folio: comprobante['$']['Folio'],
    fecha: comprobante['$']['Fecha'],
    subtotal: parseFloat(comprobante['$']['SubTotal']),
    total: parseFloat(comprobante['$']['Total']),
    moneda: comprobante['$']['Moneda'],
    metodoPago: comprobante['$']['MetodoPago'],
    formaPago: comprobante['$']['FormaPago'],
    rfcEmisor: comprobante['cfdi:Emisor'][0]['$']['Rfc'],
    rfcReceptor: comprobante['cfdi:Receptor'][0]['$']['Rfc']
    // ... more fields
  };
}
```

---

### 8. **GET /api/ledger-mxn/balance**
Calculate current balance.

**Response**:
```json
{
  "totalIngresos": 150000.00,
  "totalEgresos": 85000.00,
  "balance": 65000.00,
  "pendingIngresos": 5000.00,
  "pendingEgresos": 3000.00
}
```

**Implementation**:
```typescript
// GET /api/ledger-mxn/balance
const ingresos = await prisma.ledgerEntryMxn.aggregate({
  where: { userId: req.user.id, entryType: 'ingreso', porRealizar: false },
  _sum: { amount: true }
});

const egresos = await prisma.ledgerEntryMxn.aggregate({
  where: { userId: req.user.id, entryType: 'egreso', porRealizar: false },
  _sum: { amount: true }
});

const pendingIngresos = await prisma.ledgerEntryMxn.aggregate({
  where: { userId: req.user.id, entryType: 'ingreso', porRealizar: true },
  _sum: { amount: true }
});

const pendingEgresos = await prisma.ledgerEntryMxn.aggregate({
  where: { userId: req.user.id, entryType: 'egreso', porRealizar: true },
  _sum: { amount: true }
});

res.json({
  totalIngresos: ingresos._sum.amount || 0,
  totalEgresos: egresos._sum.amount || 0,
  balance: (ingresos._sum.amount || 0) - (egresos._sum.amount || 0),
  pendingIngresos: pendingIngresos._sum.amount || 0,
  pendingEgresos: pendingEgresos._sum.amount || 0
});
```

---

### 9. **GET /api/ledger-mxn/report**
Generate reports by date range, area, etc.

**Query Parameters**:
- `startDate`, `endDate`
- `groupBy`: "area", "subarea", "month", "bankAccount"

**Response**: Grouped summaries

---

## Business Logic

### Payment Methods (formaDePago)
Common values:
- `efectivo` - Cash
- `transferencia` - Bank transfer
- `tarjeta` - Credit/debit card
- `cheque` - Check
- `deposito` - Deposit

### Entry Types
- `ingreso` - Income (money in)
- `egreso` - Expense (money out)

### Internal ID Format
Suggested format: `{TYPE}-{YEAR}-{NUMBER}`
- Example: `ING-2026-001`, `EGR-2026-042`

### Por Realizar (Pending)
- `porRealizar: true` - Future/pending transaction
- Not included in balance calculations until marked as realized
- Useful for budgeting and forecasting

---

## Frontend Components

### Ledger List View
- Table with: Date, Concept, Area, Amount, Type, Bank Account, Status
- Filters: Date range, entry type, area, por realizar
- Color coding: Green for ingreso, Red for egreso
- Search by concept
- Export to Excel/PDF

### Ledger Entry Form
```typescript
interface LedgerFormData {
  amount: number;
  concept: string;
  bankAccount?: string;
  formaDePago: string;
  internalId: string;
  bankMovementId?: string;
  entryType: 'ingreso' | 'egreso';
  transactionDate: string; // ISO date
  area: string;
  subarea: string;
  porRealizar: boolean;
}
```

### Dashboard Widgets
- Current balance
- Monthly income/expense chart
- Pending transactions list
- Recent entries
- Balance by area (pie chart)

### Invoice Manager
- Upload PDF/XML invoices
- View parsed invoice data
- Match invoices to ledger entries
- Validate UUID uniqueness

---

## Complete Example

```typescript
// Create income entry with invoice

// 1. Create ledger entry
const entry = await prisma.ledgerEntryMxn.create({
  data: {
    userId: "user123",
    amount: 5800.00,
    concept: "Venta de productos a Cliente ABC",
    bankAccount: "BBVA Empresarial",
    formaDePago: "transferencia",
    internalId: "ING-2026-015",
    bankMovementId: "TRF789456123",
    entryType: "ingreso",
    transactionDate: new Date("2026-01-15"),
    area: "Ventas",
    subarea: "Tienda Física",
    porRealizar: false
  }
});

// 2. Upload PDF invoice
const factura = await prisma.ledgerFacturaMxn.create({
  data: {
    ledgerEntryId: entry.id,
    fileName: "factura-A12345.pdf",
    fileUrl: "https://storage.../factura-A12345.pdf",
    fileSize: 123456,
    fileType: "application/pdf",
    folio: "A-12345",
    uuid: "12345678-1234-1234-1234-123456789012",
    rfcEmisor: "AAA010101AAA",
    rfcReceptor: "BBB020202BBB",
    total: 5800.00,
    uploadedBy: "user123"
  }
});

// 3. Upload XML (parsed automatically)
const facturaXml = await prisma.ledgerFacturaXmlMxn.create({
  data: {
    ledgerEntryId: entry.id,
    fileName: "factura-A12345.xml",
    fileUrl: "https://storage.../factura-A12345.xml",
    xmlContent: "<xml>...</xml>",
    folio: "A-12345",
    uuid: "12345678-1234-1234-1234-123456789012",
    rfcEmisor: "AAA010101AAA",
    rfcReceptor: "BBB020202BBB",
    total: 5800.00,
    subtotal: 5000.00,
    iva: 800.00,
    fecha: new Date("2026-01-15"),
    metodoPago: "PUE",
    formaPago: "03",
    moneda: "MXN",
    uploadedBy: "user123"
  }
});
```

---

## Integration with Other Features

### Links to:
1. **FirmOrders** - Track payments for customer orders
2. **GoodsReceipts** - Track payments to suppliers
3. **Areas** - Categorize all transactions
4. **EstadoResultados** - Financial statements

---

## Testing Checklist

- [ ] Create ingreso entry
- [ ] Create egreso entry
- [ ] Unique internalId enforced
- [ ] Calculate balance correctly
- [ ] Por realizar excludes from balance
- [ ] Filter by date range
- [ ] Filter by area/subarea
- [ ] Upload attachments
- [ ] Upload PDF invoice
- [ ] Upload and parse XML invoice
- [ ] UUID uniqueness enforced
- [ ] User A cannot see User B's entries
- [ ] Generate reports by month/area

---

## Key Points for LLM Recreation

1. **Four related tables**: Main ledger + Attachments + PDF invoices + XML invoices
2. **Mexican tax compliance**: UUID, RFC, CFDI XML parsing
3. **Dual amount system**: Completed vs pending (porRealizar)
4. **Multi-file support**: Primary file + unlimited attachments + invoices
5. **Extensive indexing**: Performance-optimized for common queries
6. **Area categorization**: All entries must have area/subarea
7. **Unique internalId**: User-friendly reference system
8. **XML parsing**: Extract fiscal data from SAT XML files

---

**End of Flujo de Dinero Documentation**
