# Feature Documentation: Proveedores (Suppliers)

Complete documentation for the supplier management system.

---

## Overview

Supplier/vendor management system for storing and managing business suppliers. Nearly identical to Clients but used for purchasing relationships. Each supplier can have:
- Business information (name, RFC, contact details)
- Address information
- Logo/image attachment
- Status tracking (active/inactive)
- Link to supplier products and goods receipts

**User Scoping**: Each user has their own independent supplier list.

---

## Database Schema (Prisma)

```prisma
model Proveedor {
  id              Int      @id @default(autoincrement())
  userId          String   @map("user_id")

  // Basic Information
  businessName    String   @map("business_name") @db.VarChar(255)
  contactName     String?  @map("contact_name") @db.VarChar(255)
  rfc             String?  @db.VarChar(13)
  email           String?  @db.VarChar(255)
  phone           String?  @db.VarChar(50)

  // Address
  street          String?  @db.VarChar(255)
  city            String?  @db.VarChar(100)
  state           String?  @db.VarChar(100)
  postalCode      String?  @map("postal_code") @db.VarChar(20)
  country         String   @default("México") @db.VarChar(100)

  // Business Details
  industry        String?  @db.VarChar(100)
  notes           String?  @db.Text

  // Status
  status          String   @default("active") @db.VarChar(20)

  // File attachments (logo)
  logoUrl         String?  @map("logo_url") @db.Text
  logoFileName    String?  @map("logo_file_name") @db.VarChar(255)
  logoFileSize    Int?     @map("logo_file_size")

  // Timestamps
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  user            User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  supplierProducts SupplierProduct[]
  goodsReceipts   GoodsReceipt[]

  @@unique([userId, businessName])
  @@index([userId, status])
  @@index([userId, businessName])
  @@map("proveedores")
}
```

**Fields Explained**:
- Identical structure to Client model
- `supplierProducts`: Products offered by this supplier
- `goodsReceipts`: Purchase receipts/deliveries from this supplier

**Note**: The schema is intentionally identical to Clients to allow code reuse and consistent data structure.

---

## API Endpoints

### Base URL: `/api/proveedores`

All endpoints are **identical** to Clientes API with these URLs:

### 1. **GET /api/proveedores**
Get all suppliers with optional filtering.

**Query Parameters**: Same as clients (status, search)

---

### 2. **GET /api/proveedores/:id**
Get a single supplier by ID.

---

### 3. **POST /api/proveedores**
Create a new supplier.

**Request**:
```json
{
  "businessName": "Distribuidora XYZ S.A.",
  "contactName": "Carlos Ruiz",
  "rfc": "DXY010122XXX",
  "email": "ventas@xyz.com.mx",
  "phone": "+52 55 9876 5432",
  "street": "Insurgentes Sur 890",
  "city": "Ciudad de México",
  "state": "CDMX",
  "postalCode": "03100",
  "country": "México",
  "industry": "Distribución",
  "notes": "Proveedor principal de materia prima",
  "status": "active"
}
```

**Validation**: Identical to Clientes

---

### 4. **PUT /api/proveedores/:id**
Update a supplier.

---

### 5. **DELETE /api/proveedores/:id**
Delete a supplier.

**Security Check**: May want to prevent deletion if supplier has:
- Related supplier products
- Related goods receipts with pending payments

---

### 6. **POST /api/proveedores/:id/logo**
Upload supplier logo.

---

### 7. **DELETE /api/proveedores/:id/logo**
Delete supplier logo.

---

## Business Logic

### Same as Clientes:
- Business name required and unique per user
- RFC validation (12-13 characters)
- Email format validation
- Status: "active" or "inactive"
- Country defaults to "México"

### Additional Considerations:
- Suppliers may have payment terms (net 30, net 60, etc.) - add field if needed
- Supplier rating/performance tracking - add fields if needed
- Default currency for transactions - add field if needed

---

## Frontend Components

### Supplier List View
Identical to Clients:
- Table/card view
- Search and filter
- Sort options
- CRUD actions

### Supplier Form
Same fields as Client form:
```typescript
interface ProveedorFormData {
  businessName: string;
  contactName?: string;
  rfc?: string;
  email?: string;
  phone?: string;
  street?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country: string;
  industry?: string;
  notes?: string;
  status: 'active' | 'inactive';
}
```

### Supplier Detail View
- All supplier information
- Logo display
- **List of supplier products** (unique to suppliers)
- **List of goods receipts** (purchase history)
- Edit/delete buttons

---

## Integration with Other Features

### Used By:
1. **SupplierProducts** - Catalog of products from this supplier
2. **GoodsReceipts** - Purchase receipts from this supplier
3. **Ledger Entries** - Payment tracking for supplier invoices

**Example Usage**:
```typescript
// Creating a goods receipt from supplier
{
  proveedorId: 3,
  receiptNumber: "RC-2026-001",
  receiptDate: "2026-01-05",
  // ... items, amounts
}
```

---

## Difference from Clientes

| Aspect | Clientes (Clients) | Proveedores (Suppliers) |
|--------|-------------------|------------------------|
| Purpose | Sales relationships | Purchase relationships |
| Related to | Quotations, Orders | Supplier Products, Receipts |
| Money flow | Receive from clients | Pay to suppliers |
| Documents | Invoices (outgoing) | Invoices (incoming) |

**Schema**: Identical structure for consistency and code reuse

---

## Code Reuse Pattern

Since Clientes and Proveedores share identical schemas, you can create shared utilities:

```typescript
// shared/entityService.ts
class EntityService<T> {
  constructor(private model: any) {}

  async findAll(userId: string, filters: any) {
    return this.model.findMany({
      where: { userId, ...filters },
      orderBy: { businessName: 'asc' }
    });
  }

  async create(userId: string, data: T) {
    return this.model.create({
      data: { userId, ...data }
    });
  }

  // ... other CRUD methods
}

// Usage
const clientService = new EntityService(prisma.client);
const proveedorService = new EntityService(prisma.proveedor);
```

---

## Migration Example

```sql
CREATE TABLE proveedores (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR NOT NULL,
  business_name VARCHAR(255) NOT NULL,
  contact_name VARCHAR(255),
  rfc VARCHAR(13),
  email VARCHAR(255),
  phone VARCHAR(50),
  street VARCHAR(255),
  city VARCHAR(100),
  state VARCHAR(100),
  postal_code VARCHAR(20),
  country VARCHAR(100) DEFAULT 'México',
  industry VARCHAR(100),
  notes TEXT,
  status VARCHAR(20) DEFAULT 'active',
  logo_url TEXT,
  logo_file_name VARCHAR(255),
  logo_file_size INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, business_name)
);

CREATE INDEX idx_proveedores_user_status ON proveedores(user_id, status);
CREATE INDEX idx_proveedores_user_name ON proveedores(user_id, business_name);
```

---

## Testing Checklist

Same as Clientes plus:
- [ ] Create supplier with supplier products
- [ ] Create goods receipt for supplier
- [ ] Cannot delete supplier with pending receipts (if implemented)
- [ ] Search works across all fields
- [ ] Logo upload/delete works

---

## Complete Example

```typescript
// Example: Creating a supplier

const proveedor = {
  businessName: "Distribuidora Nacional S.A. de C.V.",
  contactName: "Roberto Sánchez",
  rfc: "DNA010122XXX",
  email: "roberto@distrnacional.mx",
  phone: "+52 81 8888 9999",
  street: "Av. Constitución 456",
  city: "Monterrey",
  state: "Nuevo León",
  postalCode: "64000",
  country: "México",
  industry: "Distribución Mayorista",
  notes: "Plazo de pago: 30 días. Entrega semanal los martes.",
  status: "active"
};
```

---

## Key Points for LLM Recreation

1. **Nearly identical to Clientes** - Same structure, different purpose
2. **Reuse code** - Create shared utilities for both models
3. **Different relationships** - Links to SupplierProducts and GoodsReceipts
4. **Purchase context** - Used in buying/receiving flows
5. **Payment terms** - Consider adding fields for payment conditions
6. **User scoping critical** - Always filter by userId

---

**End of Proveedores Documentation**
