# Complete System Documentation

Master documentation for all business features in App Papas system.

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Feature Modules](#feature-modules)
3. [Data Flow & Integration](#data-flow--integration)
4. [Database Architecture](#database-architecture)
5. [API Structure](#api-structure)
6. [Implementation Order](#implementation-order)
7. [Complete Integration Example](#complete-integration-example)

---

## System Overview

### Purpose
Business management system for Mexican companies with:
- Cash flow tracking (MXN)
- Client and supplier management
- Product catalog with BOM
- Hierarchical categorization
- Invoice management (SAT compliance)

### Tech Stack (Reference)
- **Backend**: Express + TypeScript + Prisma + PostgreSQL
- **Frontend**: Next.js 14 + React + TypeScript
- **Authentication**: Google OAuth (not included in this extraction)

### Core Principle
**User Scoping**: Every feature isolates data by `userId` - users never see each other's data.

---

## Feature Modules

### 1. Áreas y Subáreas (Categorization)
**Purpose**: Two-level hierarchical categorization system

**Documentation**: [FEATURE_AREAS.md](./FEATURE_AREAS.md)

**Key Points**:
- Foundation for all other features
- Area → Subareas structure
- Used for categorizing ledger, tasks, contacts, documents

**Example**:
```
Area: "Ventas"
  ├── Subarea: "Online"
  ├── Subarea: "Tienda Física"
  └── Subarea: "Mayoreo"
```

**Tables**: `areas`, `subareas`

---

### 2. Clientes (Clients)
**Purpose**: Customer/client management

**Documentation**: [FEATURE_CLIENTES.md](./FEATURE_CLIENTES.md)

**Key Points**:
- Business information (RFC, contact, address)
- Logo attachment
- Status tracking
- Links to quotations and orders

**Example**:
```json
{
  "businessName": "ACME Corporation",
  "rfc": "ACM001122XXX",
  "email": "contacto@acme.com"
}
```

**Tables**: `clients`

---

### 3. Proveedores (Suppliers)
**Purpose**: Supplier/vendor management

**Documentation**: [FEATURE_PROVEEDORES.md](./FEATURE_PROVEEDORES.md)

**Key Points**:
- Identical structure to Clientes
- Used for purchasing relationships
- Links to supplier products and goods receipts

**Example**:
```json
{
  "businessName": "Distribuidora XYZ",
  "rfc": "DXY010122XXX",
  "email": "ventas@xyz.com"
}
```

**Tables**: `proveedores`

---

### 4. Productos (Products & Master Data)
**Purpose**: Product catalog with component-based cost calculation

**Documentation**: [FEATURE_PRODUCTOS.md](./FEATURE_PRODUCTOS.md)

**Key Points**:
- Dual system: Finished products + Master data components
- Bill of Materials (BOM) - recipe system
- Automatic cost calculation from components
- Hierarchical attributes (Category → Items)

**Example**:
```
Master Data:
  Attribute: "Materia Prima"
    └── Value: "Harina (50kg)" - $500, unit: kg

Product: "Pan Dulce"
  └── Component: Harina × 2.5 kg = $12.50
```

**Tables**: `products`, `product_attributes`, `product_attribute_values`, `product_components`

---

### 5. Flujo de Dinero (Cash Flow / Ledger)
**Purpose**: Comprehensive cash flow tracking in MXN

**Documentation**: [FEATURE_FLUJO_DE_DINERO.md](./FEATURE_FLUJO_DE_DINERO.md)

**Key Points**:
- Income (ingreso) and expense (egreso) tracking
- Multiple payment methods
- Invoice management (PDF + XML parsing)
- Pending transactions (por realizar)
- Links to orders and receipts

**Example**:
```json
{
  "amount": 5000.00,
  "concept": "Venta de productos",
  "entryType": "ingreso",
  "area": "Ventas",
  "subarea": "Online",
  "formaDePago": "transferencia"
}
```

**Tables**: `ledger_entries_mxn`, `ledger_attachments_mxn`, `ledger_facturas_mxn`, `ledger_facturas_xml_mxn`

---

## Data Flow & Integration

### How Features Connect

```
┌─────────────────────────────────────────────────────────────┐
│                           User                              │
└────────────────────────┬────────────────────────────────────┘
                         │
         ┌───────────────┼───────────────┐
         │               │               │
    ┌────▼────┐    ┌────▼────┐    ┌────▼────┐
    │ Áreas   │    │Clientes │    │Proveedor│
    └────┬────┘    └────┬────┘    └────┬────┘
         │              │              │
         │              │              │
    ┌────▼──────────────▼──────────────▼────┐
    │         Flujo de Dinero                │
    │  (categorized by área/subárea)         │
    │  (linked to clients/suppliers)         │
    └────────────────────────────────────────┘
         │
         │
    ┌────▼────────────────┐
    │     Productos       │
    │  (Master Data)      │
    └─────────────────────┘
```

### Integration Points

#### 1. Areas → All Features
- **Ledger entries** categorized by area/subarea
- **Tasks** categorized by area/subarea
- **Contacts** categorized by area/subarea
- **Documents** categorized by area/subarea

**Storage**: Stored as strings, not foreign keys

```typescript
{
  area: "Ventas",
  subarea: "Online"
  // ... other fields
}
```

---

#### 2. Clientes → Sales Flow
```
Cliente
  └── Quotation (optional)
        └── FirmOrder (sales order)
              └── LedgerEntry (payment tracking)
```

**Example**:
```typescript
// Create firm order for client
const order = await prisma.firmOrder.create({
  data: {
    userId: "user123",
    clientId: 5,
    firmOrderNumber: "PF-2026-001",
    total: 10000.00,
    // ... other fields
  }
});

// Track payment in ledger
const payment = await prisma.ledgerEntryMxn.create({
  data: {
    userId: "user123",
    amount: 10000.00,
    concept: `Pago de orden ${order.firmOrderNumber}`,
    entryType: "ingreso",
    firmOrderId: order.id,
    // ... other fields
  }
});
```

---

#### 3. Proveedores → Purchase Flow
```
Proveedor
  └── SupplierProduct (catalog)
        └── GoodsReceipt (purchase receipt)
              └── LedgerEntry (payment tracking)
```

**Example**:
```typescript
// Receive goods from supplier
const receipt = await prisma.goodsReceipt.create({
  data: {
    userId: "user123",
    proveedorId: 3,
    receiptNumber: "RC-2026-001",
    totalAmount: 5000.00,
    // ... other fields
  }
});

// Track payment in ledger
const payment = await prisma.ledgerEntryMxn.create({
  data: {
    userId: "user123",
    amount: 5000.00,
    concept: `Pago de recepción ${receipt.receiptNumber}`,
    entryType: "egreso",
    goodsReceiptId: receipt.id,
    // ... other fields
  }
});
```

---

#### 4. Productos → Quotations/Orders
Products are added to quotations and orders:

```typescript
// Quotation item references product
{
  quotationId: 1,
  itemType: "product",
  itemId: 5, // Product ID
  description: "Pan Dulce",
  quantity: 100,
  unitPrice: 15.00,
  subtotal: 1500.00
}
```

---

## Database Architecture

### Entity Relationship Overview

```
User (authentication - not included)
  │
  ├── Area
  │     └── Subarea
  │
  ├── Client
  │     ├── Quotation
  │     │     └── QuotationItem → Product
  │     └── FirmOrder
  │           ├── FirmOrderItem → Product
  │           └── LedgerEntryMxn (payment)
  │
  ├── Proveedor
  │     ├── SupplierProduct → ProductAttributeValue
  │     └── GoodsReceipt
  │           ├── GoodsReceiptItem → ProductAttributeValue
  │           └── LedgerEntryMxn (payment)
  │
  ├── Product
  │     └── ProductComponent → ProductAttributeValue
  │
  ├── ProductAttribute
  │     └── ProductAttributeValue
  │
  └── LedgerEntryMxn
        ├── LedgerAttachmentMxn
        ├── LedgerFacturaMxn
        └── LedgerFacturaXmlMxn
```

### Total Tables: 25+

**Core Features (5)**:
1. areas, subareas (2)
2. clients (1)
3. proveedores (1)
4. products, product_attributes, product_attribute_values, product_components (4)
5. ledger_entries_mxn, ledger_attachments_mxn, ledger_facturas_mxn, ledger_facturas_xml_mxn (4)

**Extended Features** (optional):
- quotations, quotation_items
- firm_orders, firm_order_items
- supplier_products, supplier_product_attribute_mappings
- goods_receipts, goods_receipt_items
- inventory_count_sessions, inventory_count_items
- estado_resultados
- services

---

## API Structure

### Base URL Pattern
All APIs follow REST conventions under `/api/`

### Endpoint Structure

```
/api/areas
  GET     /                    - List all areas
  POST    /                    - Create area
  PUT     /:id                 - Update area
  DELETE  /:id                 - Delete area
  POST    /:areaId/subareas    - Create subarea
  PUT     /:areaId/subareas/:id - Update subarea
  DELETE  /:areaId/subareas/:id - Delete subarea

/api/clients
  GET     /                    - List clients
  GET     /:id                 - Get client
  POST    /                    - Create client
  PUT     /:id                 - Update client
  DELETE  /:id                 - Delete client
  POST    /:id/logo            - Upload logo
  DELETE  /:id/logo            - Delete logo

/api/proveedores
  (Same structure as clients)

/api/products
  GET     /                    - List products
  GET     /:id                 - Get product
  POST    /                    - Create product
  PUT     /:id                 - Update product
  DELETE  /:id                 - Delete product
  GET     /:id/components      - List components
  POST    /:id/components      - Add component
  PUT     /:id/components/:compId - Update component
  DELETE  /:id/components/:compId - Delete component

/api/product-attributes
  GET     /                    - List attributes with values
  POST    /                    - Create attribute
  PUT     /:id                 - Update attribute
  DELETE  /:id                 - Delete attribute
  POST    /:id/values          - Create value
  PUT     /:id/values/:valueId - Update value
  DELETE  /:id/values/:valueId - Delete value

/api/ledger-mxn
  GET     /                    - List entries
  GET     /:id                 - Get entry
  POST    /                    - Create entry
  PUT     /:id                 - Update entry
  DELETE  /:id                 - Delete entry
  GET     /balance             - Calculate balance
  GET     /report              - Generate report
  POST    /:id/attachments     - Add attachment
  POST    /:id/facturas        - Add PDF invoice
  POST    /:id/facturas-xml    - Add XML invoice
```

### Authentication Middleware
All routes require user authentication:

```typescript
router.use(requireAuth); // Your auth middleware

// Then all routes filter by req.user.id
const data = await prisma.model.findMany({
  where: { userId: req.user.id }
});
```

---

## Implementation Order

### Recommended Implementation Sequence

#### Phase 1: Foundation
1. **Areas & Subareas** (simplest, used by everything)
   - Create database models
   - Implement CRUD API
   - Build frontend UI
   - Test thoroughly

#### Phase 2: Entities
2. **Clientes** (standalone, good test case)
   - Use as template for entity management
   - Test file uploads (logo)

3. **Proveedores** (copy from Clientes)
   - Reuse code/components
   - Verify code sharing works

#### Phase 3: Complex Features
4. **Productos** (complex with master data)
   - Product attributes system
   - BOM/components
   - Cost calculation logic

5. **Flujo de Dinero** (most complex)
   - Main ledger
   - Attachments
   - Invoice management
   - XML parsing
   - Reporting

#### Phase 4: Integration
6. **Connect everything**
   - Link orders to ledger
   - Link receipts to ledger
   - Test full business flows

---

## Complete Integration Example

### Full Business Flow: Sale to Payment

```typescript
// 1. Create client
const client = await prisma.client.create({
  data: {
    userId: "user123",
    businessName: "ACME Corp",
    rfc: "ACM001122XXX",
    email: "contacto@acme.com"
  }
});

// 2. Create product with components
const product = await prisma.product.create({
  data: {
    userId: "user123",
    businessName: "Pan Dulce",
    email: "15.00", // Price
    phone: "8.50",  // Cost
    status: "active"
  }
});

// 3. Create quotation
const quotation = await prisma.quotation.create({
  data: {
    userId: "user123",
    clientId: client.id,
    quotationNumber: "COT-2026-001",
    issueDate: new Date(),
    validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    total: 1500.00,
    status: "approved"
  }
});

// 4. Add items to quotation
const item = await prisma.quotationItem.create({
  data: {
    quotationId: quotation.id,
    itemType: "product",
    itemId: product.id,
    description: "Pan Dulce",
    quantity: 100,
    unitPrice: 15.00,
    subtotal: 1500.00
  }
});

// 5. Convert to firm order
const order = await prisma.firmOrder.create({
  data: {
    userId: "user123",
    clientId: client.id,
    quotationId: quotation.id,
    firmOrderNumber: "PF-2026-001",
    orderDate: new Date(),
    deliveryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    total: 1500.00,
    paymentStatus: "pending",
    area: "Ventas",
    subarea: "Online"
  }
});

// 6. Track payment in ledger
const payment = await prisma.ledgerEntryMxn.create({
  data: {
    userId: "user123",
    amount: 1500.00,
    concept: `Pago de orden ${order.firmOrderNumber} - ${client.businessName}`,
    entryType: "ingreso",
    transactionDate: new Date(),
    area: "Ventas",
    subarea: "Online",
    bankAccount: "BBVA Empresarial",
    formaDePago: "transferencia",
    internalId: "ING-2026-001",
    firmOrderId: order.id,
    porRealizar: false
  }
});

// 7. Upload invoice
const factura = await prisma.ledgerFacturaMxn.create({
  data: {
    ledgerEntryId: payment.id,
    fileName: "factura-A001.pdf",
    fileUrl: "https://storage.../factura-A001.pdf",
    folio: "A-001",
    uuid: "12345678-1234-1234-1234-123456789012",
    rfcEmisor: "YOUR_RFC_HERE",
    rfcReceptor: client.rfc,
    total: 1500.00,
    uploadedBy: "user123"
  }
});

// 8. Update order payment status
await prisma.firmOrder.update({
  where: { id: order.id },
  data: { paymentStatus: "paid" }
});
```

### Result
- Client created and managed
- Product with calculated cost
- Quotation generated
- Order processed
- Payment tracked in ledger
- Invoice linked
- All categorized by area/subarea
- Full audit trail

---

## Key Architectural Principles

### 1. User Scoping
**Every query** must filter by `userId`:
```typescript
where: { userId: req.user.id }
```

### 2. Cascade Deletes
User deletion cascades to all data:
```prisma
user User @relation(fields: [userId], references: [id], onDelete: Cascade)
```

### 3. Area Categorization
Most features use area/subarea for organization:
```typescript
{
  area: string,      // From Areas feature
  subarea: string    // From Subareas feature
}
```

### 4. String IDs for References
Internal IDs are user-friendly strings:
```typescript
{
  internalId: "ING-2026-001",    // Ledger
  firmOrderNumber: "PF-2026-001", // Orders
  quotationNumber: "COT-2026-001" // Quotations
}
```

### 5. Money as Decimal
All amounts use `Decimal(12, 2)`:
```prisma
amount Decimal @db.Decimal(12, 2)
```

### 6. Soft Deletes via Status
Use status instead of hard deletes:
```typescript
status: "active" | "inactive" | "discontinued"
```

### 7. File Storage Pattern
Consistent file attachment structure:
```typescript
{
  fileUrl: string,
  fileName: string,
  fileSize: number,
  fileType: string
}
```

---

## Testing Strategy

### Unit Tests
- Individual CRUD operations
- Validation rules
- Calculations (costs, balances)

### Integration Tests
- User scoping (isolation)
- Cascade deletes
- Cross-feature links (orders → ledger)

### End-to-End Tests
- Complete business flows
- Multi-feature scenarios

### Test Checklist per Feature
- [ ] Create with required fields
- [ ] Create with all fields
- [ ] Validation errors
- [ ] Update operations
- [ ] Delete operations
- [ ] User A cannot access User B's data
- [ ] Unique constraints enforced
- [ ] Foreign key relationships work
- [ ] Cascade deletes work

---

## Migration Strategy

### From Scratch
1. Create database
2. Apply Prisma schema
3. Run `prisma generate`
4. Run `prisma db push` or `prisma migrate dev`

### Adding to Existing Project
1. Copy models to your schema
2. Adjust `userId` to match your User model
3. Run migration
4. Implement APIs one feature at a time
5. Build frontend components
6. Test integration

---

## Documentation Files

### Individual Feature Docs
1. [FEATURE_AREAS.md](./FEATURE_AREAS.md) - Areas and Subareas
2. [FEATURE_CLIENTES.md](./FEATURE_CLIENTES.md) - Client Management
3. [FEATURE_PROVEEDORES.md](./FEATURE_PROVEEDORES.md) - Supplier Management
4. [FEATURE_PRODUCTOS.md](./FEATURE_PRODUCTOS.md) - Products & Master Data
5. [FEATURE_FLUJO_DE_DINERO.md](./FEATURE_FLUJO_DE_DINERO.md) - Cash Flow / Ledger

### This Document
**COMPLETE_SYSTEM_DOCUMENTATION.md** - Integration and overview

---

## Quick Start for LLMs

### To Recreate This System:

1. **Read this document** for overall architecture
2. **Read individual feature docs** for detailed implementation
3. **Follow implementation order** (Areas → Clients → Suppliers → Products → Ledger)
4. **Copy database models** from Prisma schemas in each doc
5. **Implement APIs** using the endpoint specs
6. **Build frontend** using the component guides
7. **Test integration** using the complete examples

### To Integrate into Existing Project:

1. **Extract what you need** (don't copy everything)
2. **Adapt to your structure** (don't blindly copy-paste)
3. **Start with one feature** (test before moving to next)
4. **Reuse patterns** (Clients = Suppliers pattern)
5. **Connect gradually** (get each feature working standalone first)

---

## Support

For questions about specific features, refer to their individual documentation files.

For overall architecture and integration questions, refer to this document.

---

**End of Complete System Documentation**

Generated: 2026-01-05
Version: 1.0
