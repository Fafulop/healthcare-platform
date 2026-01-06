# Practice Management Implementation Guide

**Project**: Healthcare Platform - Practice Management Module
**Generated**: 2026-01-05
**Purpose**: Complete guide to implement business management features for doctors

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Architectural Analysis](#architectural-analysis)
3. [Critical Adaptations Required](#critical-adaptations-required)
4. [Database Schema Design](#database-schema-design)
5. [Backend Implementation](#backend-implementation)
6. [Frontend Implementation](#frontend-implementation)
7. [Implementation Phases](#implementation-phases)
8. [Migration Strategy](#migration-strategy)
9. [Testing Strategy](#testing-strategy)
10. [Integration Points](#integration-points)
11. [Complete Implementation Checklist](#complete-implementation-checklist)

---

## Executive Summary

### What We're Adding

We are adding a **complete practice management system** to enable doctors to manage their practice business operations:

| Feature | Purpose | Tables | Complexity |
|---------|---------|--------|------------|
| **Áreas y Subáreas** | Categorization system | 2 | Low |
| **Clientes** | Client/customer management | 1 | Medium |
| **Proveedores** | Supplier/vendor management | 1 | Medium |
| **Productos** | Product catalog + BOM | 4 | High |
| **Flujo de Dinero** | Accounting ledger | 4 | Very High |
| **Total** | Practice Management | **12 tables** | **High** |

### Why This Approach Works

Following the architectural principles from the guide:

✅ **Single database** - No operational complexity
✅ **Separate schema** - `practice_management.*` isolates new domain
✅ **Modular backend** - New API routes in isolated module
✅ **Doctor scoping** - All data scoped by `doctorId`
✅ **Future flexibility** - Can extract to microservice later if needed

---

## Architectural Analysis

### Current System Domain Map

```
┌─────────────────────────────────────────────────────────────┐
│                    EXISTING SYSTEM                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Domain 1: Identity & Access                                │
│    • User, Role                                             │
│    • NextAuth OAuth                                         │
│                                                             │
│  Domain 2: Public Marketplace                               │
│    • Doctor profiles (public schema)                        │
│    • Services, Education, Certificates                      │
│    • FAQs, CarouselItems                                    │
│                                                             │
│  Domain 3: Scheduling                                       │
│    • AppointmentSlot, Booking                               │
│    • Patient bookings (anonymous)                           │
│                                                             │
│  Domain 4: Content                                          │
│    • Article (blog posts)                                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### New Domain Being Added

```
┌─────────────────────────────────────────────────────────────┐
│              NEW: PRACTICE MANAGEMENT                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Domain 5: Practice Management (NEW)                        │
│    • CRM (Clients, Suppliers)                               │
│    • Product Catalog (Products, Master Data, BOM)          │
│    • Accounting (Ledger, Invoices, Cash Flow)              │
│    • Categorization (Areas, Subareas)                      │
│                                                             │
│  Characteristics:                                           │
│    ✓ Private (only doctor access)                          │
│    ✓ Financial data (sensitive)                            │
│    ✓ Doctor-scoped (multi-tenant by doctorId)              │
│    ✓ No public access                                      │
│    ✓ Self-contained business logic                         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Domain Separation Decision

**Decision**: Use PostgreSQL schemas to separate domains

```sql
-- Existing tables stay in default schema
public.doctors
public.users
public.appointments
public.articles
...

-- New tables go in separate schema
practice_management.areas
practice_management.subareas
practice_management.clients
practice_management.proveedores
practice_management.products
...
```

**Why schemas, not separate database?**

| Consideration | Separate DB | Schemas | Winner |
|---------------|-------------|---------|--------|
| Logical isolation | ✅ | ✅ | Tie |
| Operational complexity | ❌ High | ✅ Low | **Schemas** |
| Transaction support | ❌ Distributed | ✅ Local | **Schemas** |
| Backup strategy | ❌ 2 systems | ✅ 1 system | **Schemas** |
| Connection pooling | ❌ 2 pools | ✅ 1 pool | **Schemas** |
| Future extraction | ✅ Easier | ⚠️ Possible | Schemas OK |
| Developer experience | ❌ Complex | ✅ Simple | **Schemas** |
| Current scale (~100 docs) | ❌ Overkill | ✅ Perfect | **Schemas** |

**Conclusion**: Schemas provide 90% of the benefits with 10% of the complexity.

---

## Critical Adaptations Required

### 1. Tenant Scoping: `userId` → `doctorId`

**Original system** (from docs):
```typescript
// User = business owner (one user = one business)
model Client {
  userId  String  // ← Scope by user
  // ...
}
```

**Our system** (healthcare platform):
```typescript
// Doctor = tenant (one doctor = one practice)
model Client {
  doctorId  String  // ← Scope by doctor instead!
  // ...
}
```

**WHY?** In the healthcare platform:
- `User` = staff account (admins, doctors)
- `Doctor` = practice/profile (the actual business entity)
- Multi-tenancy is **by doctor, not by user**

### 2. Authentication Context

**Original system**:
```typescript
// JWT contains userId
const { userId } = await validateToken(req);

// Query scoped by userId
const clients = await prisma.client.findMany({
  where: { userId }
});
```

**Our system**:
```typescript
// JWT contains userId + role + doctorId
const { userId, role, doctorId } = await validateToken(req);

// Must verify user is a doctor and has doctorId
if (role !== 'DOCTOR' || !doctorId) {
  return res.status(403).json({ error: 'Doctor access required' });
}

// Query scoped by doctorId
const clients = await prisma.client.findMany({
  where: { doctorId }
});
```

### 3. Mexican Pesos (MXN) → Multi-Currency Consideration

**Original system**: All amounts in MXN (Mexican Pesos)

**Our system**: Doctors may be in different countries

**Decision**: Keep MXN for now, add currency field for future

```prisma
model LedgerEntry {
  amount   Decimal  @db.Decimal(12, 2)
  currency String   @default("MXN") @db.VarChar(3)
  // ...
}
```

### 4. File Upload Integration

**Original system**: Uses generic file upload service

**Our system**: Already has UploadThing configured

**Adaptation**: Reuse existing UploadThing infrastructure from admin app

```typescript
// apps/api/src/app/api/uploadthing/core.ts
export const ourFileRouter = {
  imageUploader: f({ image: { maxFileSize: "4MB" } })
    .middleware(async ({ req }) => {
      const { doctorId } = await validateAuth(req);
      return { doctorId };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      console.log("Upload complete for doctor:", metadata.doctorId);
      return { uploadedBy: metadata.doctorId };
    }),

  // Add new endpoints for practice management
  clientLogoUploader: f({ image: { maxFileSize: "2MB" } })
    .middleware(async ({ req }) => {
      const { doctorId } = await validateAuth(req);
      return { doctorId };
    })
    .onUploadComplete(/* ... */),

  invoicePdfUploader: f({ pdf: { maxFileSize: "10MB" } })
    .middleware(async ({ req }) => {
      const { doctorId } = await validateAuth(req);
      return { doctorId };
    })
    .onUploadComplete(/* ... */),

  invoiceXmlUploader: f({
    "application/xml": { maxFileSize: "5MB" }
  })
    .middleware(async ({ req }) => {
      const { doctorId } = await validateAuth(req);
      return { doctorId };
    })
    .onUploadComplete(/* ... */),
};
```

---

## Database Schema Design

### Schema Structure

```sql
-- Create new schema for practice management
CREATE SCHEMA IF NOT EXISTS practice_management;

-- Set search path (optional, for convenience)
-- ALTER DATABASE your_db SET search_path TO public, practice_management;
```

### Complete Prisma Schema

Add to `packages/database/prisma/schema.prisma`:

```prisma
// ============================================================================
// PRACTICE MANAGEMENT DOMAIN
// ============================================================================

// -----------------------------------------------------------------------------
// 1. CATEGORIZATION (Areas & Subareas)
// -----------------------------------------------------------------------------

model Area {
  id          Int       @id @default(autoincrement())
  doctorId    String    @map("doctor_id")
  name        String    @db.VarChar(255)
  description String?   @db.Text
  createdAt   DateTime  @default(now()) @map("created_at")
  updatedAt   DateTime  @updatedAt @map("updated_at")

  doctor      Doctor    @relation(fields: [doctorId], references: [id], onDelete: Cascade)
  subareas    Subarea[]

  @@unique([doctorId, name])
  @@index([doctorId])
  @@map("areas")
  @@schema("practice_management")
}

model Subarea {
  id          Int      @id @default(autoincrement())
  areaId      Int      @map("area_id")
  name        String   @db.VarChar(255)
  description String?  @db.Text
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  area        Area     @relation(fields: [areaId], references: [id], onDelete: Cascade)

  @@unique([areaId, name])
  @@index([areaId])
  @@map("subareas")
  @@schema("practice_management")
}

// -----------------------------------------------------------------------------
// 2. CRM - CLIENTS
// -----------------------------------------------------------------------------

model Client {
  id              Int      @id @default(autoincrement())
  doctorId        String   @map("doctor_id")

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

  doctor          Doctor   @relation("DoctorClients", fields: [doctorId], references: [id], onDelete: Cascade)

  @@unique([doctorId, businessName])
  @@index([doctorId, status])
  @@index([doctorId, businessName])
  @@map("clients")
  @@schema("practice_management")
}

// -----------------------------------------------------------------------------
// 3. CRM - SUPPLIERS (PROVEEDORES)
// -----------------------------------------------------------------------------

model Proveedor {
  id              Int      @id @default(autoincrement())
  doctorId        String   @map("doctor_id")

  // Basic Information (identical to Client)
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

  doctor          Doctor   @relation("DoctorProveedores", fields: [doctorId], references: [id], onDelete: Cascade)

  @@unique([doctorId, businessName])
  @@index([doctorId, status])
  @@index([doctorId, businessName])
  @@map("proveedores")
  @@schema("practice_management")
}

// -----------------------------------------------------------------------------
// 4. PRODUCT CATALOG - MASTER DATA
// -----------------------------------------------------------------------------

model ProductAttribute {
  id          Int      @id @default(autoincrement())
  doctorId    String   @map("doctor_id")
  name        String   @db.VarChar(100)
  description String?  @db.Text
  order       Int      @default(0)
  isActive    Boolean  @default(true) @map("is_active")
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  doctor      Doctor                 @relation(fields: [doctorId], references: [id], onDelete: Cascade)
  values      ProductAttributeValue[]

  @@unique([doctorId, name])
  @@index([doctorId, isActive])
  @@index([doctorId, order])
  @@map("product_attributes")
  @@schema("practice_management")
}

model ProductAttributeValue {
  id          Int      @id @default(autoincrement())
  attributeId Int      @map("attribute_id")
  value       String   @db.VarChar(255)
  description String?  @db.Text
  cost        Decimal? @db.Decimal(10, 2)
  unit        String?  @db.VarChar(50)
  order       Int      @default(0)
  isActive    Boolean  @default(true) @map("is_active")
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  attribute         ProductAttribute   @relation(fields: [attributeId], references: [id], onDelete: Cascade)
  productComponents ProductComponent[]

  @@unique([attributeId, value])
  @@index([attributeId, isActive])
  @@index([attributeId, order])
  @@map("product_attribute_values")
  @@schema("practice_management")
}

// -----------------------------------------------------------------------------
// 5. PRODUCT CATALOG - PRODUCTS
// -----------------------------------------------------------------------------

model Product {
  id              Int      @id @default(autoincrement())
  doctorId        String   @map("doctor_id")

  // Product Information
  name            String   @db.VarChar(255)
  sku             String?  @db.VarChar(100)
  category        String?  @db.VarChar(100)
  description     String?  @db.Text

  // Pricing
  price           Decimal? @db.Decimal(10, 2)
  cost            Decimal? @db.Decimal(10, 2)

  // Inventory
  stockQuantity   Int?     @default(0)
  unit            String?  @db.VarChar(50)

  // Status
  status          String   @default("active") @db.VarChar(20)

  // Image
  imageUrl        String?  @map("image_url") @db.Text
  imageFileName   String?  @map("image_file_name") @db.VarChar(255)
  imageFileSize   Int?     @map("image_file_size")

  // Timestamps
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  doctor          Doctor             @relation(fields: [doctorId], references: [id], onDelete: Cascade)
  components      ProductComponent[]

  @@unique([doctorId, name])
  @@index([doctorId, status])
  @@index([doctorId, category])
  @@map("products")
  @@schema("practice_management")
}

model ProductComponent {
  id               Int      @id @default(autoincrement())
  productId        Int      @map("product_id")
  attributeValueId Int      @map("attribute_value_id")
  quantity         Decimal  @db.Decimal(10, 4)
  calculatedCost   Decimal  @db.Decimal(12, 2)
  order            Int      @default(0)
  createdAt        DateTime @default(now()) @map("created_at")
  updatedAt        DateTime @updatedAt @map("updated_at")

  product        Product               @relation(fields: [productId], references: [id], onDelete: Cascade)
  attributeValue ProductAttributeValue @relation(fields: [attributeValueId], references: [id], onDelete: Cascade)

  @@index([productId])
  @@index([attributeValueId])
  @@map("product_components")
  @@schema("practice_management")
}

// -----------------------------------------------------------------------------
// 6. ACCOUNTING - LEDGER (CASH FLOW)
// -----------------------------------------------------------------------------

model LedgerEntry {
  id              Int                @id @default(autoincrement())
  doctorId        String             @map("doctor_id")
  amount          Decimal            @db.Decimal(12, 2)
  concept         String             @db.VarChar(500)
  bankAccount     String?            @map("bank_account") @db.VarChar(255)
  formaDePago     String?            @default("efectivo") @map("forma_de_pago") @db.VarChar(50)
  internalId      String             @map("internal_id") @db.VarChar(100)
  bankMovementId  String?            @map("bank_movement_id") @db.VarChar(255)
  entryType       String             @map("entry_type") @db.VarChar(20)
  transactionDate DateTime           @map("transaction_date") @db.Date
  area            String             @db.VarChar(255)
  subarea         String             @db.VarChar(255)
  porRealizar     Boolean            @default(false) @map("por_realizar")

  // File attachment (single primary file)
  fileUrl         String?            @map("file_url") @db.Text
  fileName        String?            @map("file_name") @db.VarChar(255)
  fileSize        Int?               @map("file_size")
  fileType        String?            @map("file_type") @db.VarChar(100)

  // Timestamps
  createdAt       DateTime           @default(now()) @map("created_at")
  updatedAt       DateTime           @updatedAt @map("updated_at")

  doctor          Doctor             @relation(fields: [doctorId], references: [id], onDelete: Cascade)
  attachments     LedgerAttachment[]
  facturas        LedgerFactura[]
  facturasXml     LedgerFacturaXml[]

  @@unique([doctorId, internalId])
  @@index([doctorId])
  @@index([doctorId, entryType])
  @@index([doctorId, transactionDate])
  @@index([doctorId, area, subarea])
  @@index([doctorId, porRealizar])
  @@map("ledger_entries")
  @@schema("practice_management")
}

model LedgerAttachment {
  id             Int           @id @default(autoincrement())
  ledgerEntryId  Int           @map("ledger_entry_id")
  fileName       String        @map("file_name") @db.VarChar(255)
  fileUrl        String        @map("file_url") @db.Text
  fileSize       Int?          @map("file_size")
  fileType       String?       @map("file_type") @db.VarChar(100)
  attachmentType String        @default("file") @map("attachment_type") @db.VarChar(20)
  createdAt      DateTime      @default(now()) @map("created_at")

  ledgerEntry    LedgerEntry   @relation(fields: [ledgerEntryId], references: [id], onDelete: Cascade)

  @@index([ledgerEntryId])
  @@map("ledger_attachments")
  @@schema("practice_management")
}

model LedgerFactura {
  id            Int          @id @default(autoincrement())
  ledgerEntryId Int          @map("ledger_entry_id")
  fileName      String       @map("file_name") @db.VarChar(255)
  fileUrl       String       @map("file_url") @db.Text
  fileSize      Int?         @map("file_size")
  fileType      String?      @map("file_type") @db.VarChar(100)
  folio         String?      @db.VarChar(100)
  uuid          String?      @db.VarChar(100)
  rfcEmisor     String?      @map("rfc_emisor") @db.VarChar(20)
  rfcReceptor   String?      @map("rfc_receptor") @db.VarChar(20)
  total         Decimal?     @db.Decimal(12, 2)
  notes         String?      @db.Text
  createdAt     DateTime     @default(now()) @map("created_at")

  ledgerEntry   LedgerEntry  @relation(fields: [ledgerEntryId], references: [id], onDelete: Cascade)

  @@index([ledgerEntryId])
  @@map("ledger_facturas")
  @@schema("practice_management")
}

model LedgerFacturaXml {
  id            Int          @id @default(autoincrement())
  ledgerEntryId Int          @map("ledger_entry_id")
  fileName      String       @map("file_name") @db.VarChar(255)
  fileUrl       String       @map("file_url") @db.Text
  fileSize      Int?         @map("file_size")
  xmlContent    String?      @map("xml_content") @db.Text
  folio         String?      @db.VarChar(100)
  uuid          String?      @unique @db.VarChar(100)
  rfcEmisor     String?      @map("rfc_emisor") @db.VarChar(20)
  rfcReceptor   String?      @map("rfc_receptor") @db.VarChar(20)
  total         Decimal?     @db.Decimal(12, 2)
  subtotal      Decimal?     @db.Decimal(12, 2)
  iva           Decimal?     @db.Decimal(12, 2)
  fecha         DateTime?    @db.Timestamp(6)
  metodoPago    String?      @map("metodo_pago") @db.VarChar(50)
  formaPago     String?      @map("forma_pago") @db.VarChar(50)
  moneda        String?      @db.VarChar(10)
  notes         String?      @db.Text
  createdAt     DateTime     @default(now()) @map("created_at")

  ledgerEntry   LedgerEntry  @relation(fields: [ledgerEntryId], references: [id], onDelete: Cascade)

  @@index([ledgerEntryId])
  @@index([uuid])
  @@map("ledger_facturas_xml")
  @@schema("practice_management")
}
```

### Update Doctor Model

Add relations to the existing `Doctor` model in `packages/database/prisma/schema.prisma`:

```prisma
model Doctor {
  // ... existing fields ...

  // NEW: Practice Management Relations
  areas              Area[]              @relation()
  clients            Client[]            @relation("DoctorClients")
  proveedores        Proveedor[]         @relation("DoctorProveedores")
  productAttributes  ProductAttribute[]
  products           Product[]
  ledgerEntries      LedgerEntry[]

  // ... existing relations ...
}
```

---

## Backend Implementation

### Directory Structure

Create new module in `apps/api/src/app/api/`:

```
apps/api/src/app/api/
├── practice-management/
│   ├── areas/
│   │   ├── route.ts                      # GET, POST /api/practice-management/areas
│   │   └── [id]/
│   │       ├── route.ts                  # GET, PUT, DELETE /api/practice-management/areas/:id
│   │       └── subareas/
│   │           ├── route.ts              # POST /api/practice-management/areas/:id/subareas
│   │           └── [subareaId]/
│   │               └── route.ts          # PUT, DELETE
│   ├── clients/
│   │   ├── route.ts                      # GET, POST
│   │   └── [id]/
│   │       ├── route.ts                  # GET, PUT, DELETE
│   │       └── logo/
│   │           └── route.ts              # POST, DELETE
│   ├── proveedores/
│   │   ├── route.ts
│   │   └── [id]/
│   │       ├── route.ts
│   │       └── logo/
│   │           └── route.ts
│   ├── products/
│   │   ├── route.ts
│   │   └── [id]/
│   │       ├── route.ts
│   │       └── components/
│   │           ├── route.ts              # GET, POST
│   │           └── [componentId]/
│   │               └── route.ts          # PUT, DELETE
│   ├── product-attributes/
│   │   ├── route.ts
│   │   └── [id]/
│   │       ├── route.ts
│   │       └── values/
│   │           ├── route.ts
│   │           └── [valueId]/
│   │               └── route.ts
│   └── ledger/
│       ├── route.ts
│       ├── balance/
│       │   └── route.ts                  # GET balance summary
│       ├── report/
│       │   └── route.ts                  # GET reports
│       └── [id]/
│           ├── route.ts
│           ├── attachments/
│           │   └── route.ts
│           ├── facturas/
│           │   └── route.ts
│           └── facturas-xml/
│               └── route.ts
```

### Authentication Helper

Create `apps/api/src/lib/practice-auth.ts`:

```typescript
import { NextRequest } from 'next/server';
import { validateAuthToken } from './auth';

export interface DoctorAuthContext {
  userId: string;
  email: string;
  role: string;
  doctorId: string;
}

/**
 * Validates that the request is from an authenticated doctor
 * Returns doctorId for scoping queries
 */
export async function requireDoctorAuth(
  request: NextRequest
): Promise<DoctorAuthContext> {
  // Validate token
  const authData = await validateAuthToken(request);

  // Check role is DOCTOR
  if (authData.role !== 'DOCTOR') {
    throw new Error('Doctor role required');
  }

  // Get doctor from user
  const user = await prisma.user.findUnique({
    where: { id: authData.userId },
    include: { doctor: true }
  });

  if (!user?.doctor) {
    throw new Error('No doctor profile linked to user');
  }

  return {
    userId: authData.userId,
    email: authData.email,
    role: authData.role,
    doctorId: user.doctor.id
  };
}
```

### Example API Route: Areas

`apps/api/src/app/api/practice-management/areas/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { requireDoctorAuth } from '@/lib/practice-auth';

// GET /api/practice-management/areas
export async function GET(request: NextRequest) {
  try {
    const { doctorId } = await requireDoctorAuth(request);

    const areas = await prisma.area.findMany({
      where: { doctorId },
      include: { subareas: true },
      orderBy: { name: 'asc' }
    });

    return NextResponse.json({ data: areas });
  } catch (error: any) {
    if (error.message === 'Doctor role required' ||
        error.message === 'No doctor profile linked to user') {
      return NextResponse.json(
        { error: error.message },
        { status: 403 }
      );
    }

    console.error('Error fetching areas:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/practice-management/areas
export async function POST(request: NextRequest) {
  try {
    const { doctorId } = await requireDoctorAuth(request);
    const body = await request.json();

    const { name, description } = body;

    // Validation
    if (!name) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      );
    }

    // Create area
    const area = await prisma.area.create({
      data: {
        doctorId,
        name,
        description
      },
      include: { subareas: true }
    });

    return NextResponse.json({ data: area }, { status: 201 });
  } catch (error: any) {
    if (error.code === 'P2002') {
      // Unique constraint violation
      return NextResponse.json(
        { error: 'Area name already exists' },
        { status: 409 }
      );
    }

    console.error('Error creating area:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

### Example API Route: Ledger Balance

`apps/api/src/app/api/practice-management/ledger/balance/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { requireDoctorAuth } from '@/lib/practice-auth';

// GET /api/practice-management/ledger/balance
export async function GET(request: NextRequest) {
  try {
    const { doctorId } = await requireDoctorAuth(request);

    // Aggregate income (completed)
    const ingresos = await prisma.ledgerEntry.aggregate({
      where: {
        doctorId,
        entryType: 'ingreso',
        porRealizar: false
      },
      _sum: { amount: true }
    });

    // Aggregate expenses (completed)
    const egresos = await prisma.ledgerEntry.aggregate({
      where: {
        doctorId,
        entryType: 'egreso',
        porRealizar: false
      },
      _sum: { amount: true }
    });

    // Aggregate pending income
    const pendingIngresos = await prisma.ledgerEntry.aggregate({
      where: {
        doctorId,
        entryType: 'ingreso',
        porRealizar: true
      },
      _sum: { amount: true }
    });

    // Aggregate pending expenses
    const pendingEgresos = await prisma.ledgerEntry.aggregate({
      where: {
        doctorId,
        entryType: 'egreso',
        porRealizar: true
      },
      _sum: { amount: true }
    });

    const totalIngresos = ingresos._sum.amount || 0;
    const totalEgresos = egresos._sum.amount || 0;
    const balance = totalIngresos - totalEgresos;

    return NextResponse.json({
      data: {
        totalIngresos,
        totalEgresos,
        balance,
        pendingIngresos: pendingIngresos._sum.amount || 0,
        pendingEgresos: pendingEgresos._sum.amount || 0
      }
    });
  } catch (error: any) {
    console.error('Error calculating balance:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

---

## Frontend Implementation

### Directory Structure

Create new section in doctor dashboard:

```
apps/doctor/src/app/dashboard/
├── practice/                            # NEW: Practice Management
│   ├── layout.tsx                       # Shared layout with sidebar nav
│   ├── page.tsx                         # Practice dashboard home
│   ├── areas/
│   │   ├── page.tsx                     # List areas/subareas
│   │   └── [id]/
│   │       └── edit/
│   │           └── page.tsx             # Edit area
│   ├── clients/
│   │   ├── page.tsx                     # Client list
│   │   ├── new/
│   │   │   └── page.tsx                 # Create client
│   │   └── [id]/
│   │       └── edit/
│   │           └── page.tsx             # Edit client
│   ├── proveedores/
│   │   ├── page.tsx
│   │   ├── new/
│   │   │   └── page.tsx
│   │   └── [id]/
│   │       └── edit/
│   │           └── page.tsx
│   ├── products/
│   │   ├── page.tsx                     # Product list
│   │   ├── new/
│   │   │   └── page.tsx                 # Create product
│   │   ├── [id]/
│   │   │   └── edit/
│   │   │       └── page.tsx             # Edit product + BOM
│   │   └── master-data/
│   │       └── page.tsx                 # Manage attributes/values
│   └── ledger/
│       ├── page.tsx                     # Ledger list
│       ├── new/
│       │   └── page.tsx                 # Create entry
│       ├── [id]/
│       │   └── edit/
│       │       └── page.tsx             # Edit entry
│       └── balance/
│           └── page.tsx                 # Balance & reports
├── blog/                                # EXISTING
│   └── ...
└── appointments/                        # EXISTING
    └── ...
```

### Shared Components

Create `apps/doctor/src/components/practice/`:

```
apps/doctor/src/components/practice/
├── AreaSelector.tsx                    # Two-level dropdown
├── EntityForm.tsx                      # Reusable form for Client/Proveedor
├── ProductBOMEditor.tsx                # Bill of Materials editor
├── LedgerEntryForm.tsx                 # Ledger entry form
├── InvoiceUploader.tsx                 # PDF/XML invoice upload
├── BalanceSummary.tsx                  # Balance widget
└── FileUploader.tsx                    # Generic file upload
```

### Example Component: Area Selector

`apps/doctor/src/components/practice/AreaSelector.tsx`:

```typescript
'use client';

import { useState, useEffect } from 'react';

interface Area {
  id: number;
  name: string;
  subareas: Subarea[];
}

interface Subarea {
  id: number;
  name: string;
}

interface AreaSelectorProps {
  value: { area: string; subarea: string };
  onChange: (value: { area: string; subarea: string }) => void;
}

export function AreaSelector({ value, onChange }: AreaSelectorProps) {
  const [areas, setAreas] = useState<Area[]>([]);
  const [selectedArea, setSelectedArea] = useState<Area | null>(null);

  useEffect(() => {
    // Fetch areas from API
    fetch('/api/practice-management/areas')
      .then(res => res.json())
      .then(data => setAreas(data.data));
  }, []);

  useEffect(() => {
    if (value.area) {
      const area = areas.find(a => a.name === value.area);
      setSelectedArea(area || null);
    }
  }, [value.area, areas]);

  const handleAreaChange = (areaName: string) => {
    const area = areas.find(a => a.name === areaName);
    setSelectedArea(area || null);
    onChange({ area: areaName, subarea: '' });
  };

  const handleSubareaChange = (subareaName: string) => {
    onChange({ area: value.area, subarea: subareaName });
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Área
        </label>
        <select
          value={value.area}
          onChange={(e) => handleAreaChange(e.target.value)}
          className="w-full border border-gray-300 rounded-md px-3 py-2"
        >
          <option value="">Seleccionar área...</option>
          {areas.map(area => (
            <option key={area.id} value={area.name}>
              {area.name}
            </option>
          ))}
        </select>
      </div>

      {selectedArea && selectedArea.subareas.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Subárea
          </label>
          <select
            value={value.subarea}
            onChange={(e) => handleSubareaChange(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2"
          >
            <option value="">Seleccionar subárea...</option>
            {selectedArea.subareas.map(subarea => (
              <option key={subarea.id} value={subarea.name}>
                {subarea.name}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
```

### Example Page: Client List

`apps/doctor/src/app/dashboard/practice/clients/page.tsx`:

```typescript
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Search, Plus } from 'lucide-react';

interface Client {
  id: number;
  businessName: string;
  contactName?: string;
  email?: string;
  phone?: string;
  status: string;
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchClients();
  }, [statusFilter]);

  const fetchClients = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }

      const res = await fetch(`/api/practice-management/clients?${params}`);
      const data = await res.json();
      setClients(data.data);
    } catch (error) {
      console.error('Error fetching clients:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredClients = clients.filter(client =>
    client.businessName.toLowerCase().includes(search.toLowerCase()) ||
    client.contactName?.toLowerCase().includes(search.toLowerCase()) ||
    client.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Clientes</h1>
        <Link
          href="/dashboard/practice/clients/new"
          className="bg-blue-600 text-white px-4 py-2 rounded-md flex items-center gap-2 hover:bg-blue-700"
        >
          <Plus className="w-5 h-5" />
          Nuevo Cliente
        </Link>
      </div>

      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar clientes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2"
          >
            <option value="all">Todos</option>
            <option value="active">Activos</option>
            <option value="inactive">Inactivos</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">Cargando...</div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Empresa
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Contacto
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Teléfono
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Estado
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredClients.map(client => (
                <tr key={client.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {client.businessName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {client.contactName || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {client.email || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {client.phone || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      client.status === 'active'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {client.status === 'active' ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Link
                      href={`/dashboard/practice/clients/${client.id}/edit`}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      Editar
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredClients.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              No se encontraron clientes
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

---

## Implementation Phases

### Phase 0: Preparation (1-2 days)

**Goal**: Set up infrastructure without breaking existing system

- [ ] Review and understand current system architecture
- [ ] Set up PostgreSQL schema support in Prisma
- [ ] Add practice management relations to Doctor model
- [ ] Create `requireDoctorAuth` helper function
- [ ] Set up new directory structures (API + Frontend)
- [ ] Run database migration (creates empty tables)
- [ ] Test that existing features still work

### Phase 1: Foundation - Areas (2-3 days)

**Goal**: Implement simplest feature, establish patterns

**Backend**:
- [ ] Create Area and Subarea models
- [ ] Implement API routes:
  - [ ] GET /api/practice-management/areas
  - [ ] POST /api/practice-management/areas
  - [ ] PUT /api/practice-management/areas/:id
  - [ ] DELETE /api/practice-management/areas/:id
  - [ ] POST /api/practice-management/areas/:id/subareas
  - [ ] PUT /api/practice-management/areas/:id/subareas/:subareaId
  - [ ] DELETE /api/practice-management/areas/:id/subareas/:subareaId
- [ ] Test all CRUD operations
- [ ] Test doctor scoping (isolation)

**Frontend**:
- [ ] Create practice management section in doctor dashboard
- [ ] Build area management page
- [ ] Build AreaSelector component
- [ ] Test UI end-to-end

**Validation**:
- [ ] Doctor can create areas
- [ ] Doctor can create subareas under areas
- [ ] Duplicate names are rejected
- [ ] Deleting area cascades to subareas
- [ ] Doctor A cannot see Doctor B's areas

### Phase 2: CRM - Clients & Suppliers (3-4 days)

**Goal**: Implement entity management, file uploads

**Backend**:
- [ ] Create Client and Proveedor models
- [ ] Implement Client API routes (full CRUD + logo upload)
- [ ] Implement Proveedor API routes (copy from Client)
- [ ] Add UploadThing endpoints for logos
- [ ] Test file uploads
- [ ] Test CRUD operations

**Frontend**:
- [ ] Build client list page
- [ ] Build client form (create/edit)
- [ ] Build logo uploader component
- [ ] Reuse components for Proveedores
- [ ] Test UI end-to-end

**Validation**:
- [ ] Doctor can manage clients
- [ ] Doctor can manage suppliers
- [ ] File uploads work correctly
- [ ] Search and filter work
- [ ] Data isolation verified

### Phase 3: Products & Master Data (5-7 days)

**Goal**: Implement complex hierarchical system with BOM

**Backend**:
- [ ] Create ProductAttribute and ProductAttributeValue models
- [ ] Create Product and ProductComponent models
- [ ] Implement Product Attributes API (CRUD for attributes + values)
- [ ] Implement Products API (CRUD + components)
- [ ] Implement cost calculation logic
- [ ] Test BOM calculations

**Frontend**:
- [ ] Build master data management page
- [ ] Build product list page
- [ ] Build product form
- [ ] Build BOM editor component
- [ ] Build cost calculator display
- [ ] Test complex interactions

**Validation**:
- [ ] Doctor can create attribute categories
- [ ] Doctor can add values with costs/units
- [ ] Doctor can create products
- [ ] Doctor can add components to products
- [ ] Costs calculate correctly
- [ ] Quantity changes update costs

### Phase 4: Accounting - Ledger (7-10 days)

**Goal**: Implement most complex feature with invoicing

**Backend**:
- [ ] Create LedgerEntry model
- [ ] Create LedgerAttachment, LedgerFactura, LedgerFacturaXml models
- [ ] Implement Ledger API (CRUD)
- [ ] Implement balance calculation endpoint
- [ ] Implement report generation endpoint
- [ ] Implement attachment upload
- [ ] Implement PDF invoice upload
- [ ] Implement XML invoice upload + parsing
- [ ] Add Mexican CFDI XML parser
- [ ] Test all ledger operations

**Frontend**:
- [ ] Build ledger list page
- [ ] Build ledger entry form with AreaSelector
- [ ] Build balance/dashboard page
- [ ] Build invoice uploader
- [ ] Build reports page
- [ ] Add charts/visualizations
- [ ] Test complex workflows

**Validation**:
- [ ] Doctor can create income/expense entries
- [ ] Balance calculates correctly
- [ ] Pending entries excluded from balance
- [ ] File attachments work
- [ ] PDF invoices upload
- [ ] XML invoices parse correctly
- [ ] UUID uniqueness enforced
- [ ] Reports generate correctly

### Phase 5: Integration & Polish (3-5 days)

**Goal**: Connect everything, fix bugs, optimize

- [ ] Test all features together
- [ ] Test cross-feature workflows
- [ ] Add loading states
- [ ] Add error handling
- [ ] Optimize database queries
- [ ] Add proper TypeScript types
- [ ] Write API documentation
- [ ] Performance testing
- [ ] Security audit
- [ ] User acceptance testing

### Total Estimated Time: 3-5 weeks

**Note**: These are estimates for a single developer. Adjust based on team size and experience.

---

## Migration Strategy

### Step-by-Step Migration

#### 1. Add Schema to Prisma

Update `packages/database/prisma/schema.prisma`:

```prisma
// At the top, configure multi-schema support
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["multiSchema"]
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  schemas  = ["public", "practice_management"]
}

// Then add all models (see Database Schema Design section)
```

#### 2. Generate Migration

```bash
cd packages/database

# Generate Prisma Client with new models
pnpm db:generate

# Create migration
pnpm prisma migrate dev --name add_practice_management

# This will:
# 1. Create practice_management schema
# 2. Create all 12 tables
# 3. Add foreign keys to Doctor model
```

#### 3. Verify Migration

```sql
-- Connect to your database and verify

-- Check schema exists
SELECT schema_name FROM information_schema.schemata
WHERE schema_name = 'practice_management';

-- Check tables exist
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'practice_management';

-- Should return:
-- areas, subareas, clients, proveedores,
-- products, product_attributes, product_attribute_values, product_components,
-- ledger_entries, ledger_attachments, ledger_facturas, ledger_facturas_xml
```

#### 4. Test Existing Features

```bash
# Run all existing tests
pnpm test

# Manually test:
# - Doctor profiles load
# - Appointments work
# - Blog posts work
# - No errors in console
```

#### 5. Deploy Backend API Routes

```bash
# Add new API routes one feature at a time
# Start with Areas, then Clients, etc.

# Test each feature before moving to next
```

#### 6. Deploy Frontend Pages

```bash
# Add new dashboard pages one feature at a time
# Test each in isolation before integrating
```

### Rollback Plan

If something goes wrong:

```bash
# Option 1: Rollback last migration
cd packages/database
pnpm prisma migrate rollback

# Option 2: Drop practice_management schema
# (keeps existing data intact)
psql -d your_database -c "DROP SCHEMA IF EXISTS practice_management CASCADE;"

# Option 3: Restore from backup
# (always backup before major migrations!)
```

---

## Testing Strategy

### Unit Tests

Create `apps/api/src/app/api/practice-management/__tests__/`:

```typescript
// areas.test.ts
describe('Areas API', () => {
  it('should create area for doctor', async () => {
    // Test implementation
  });

  it('should not allow duplicate area names', async () => {
    // Test implementation
  });

  it('should isolate areas by doctor', async () => {
    // Test implementation
  });

  // ... more tests
});
```

### Integration Tests

```typescript
// integration.test.ts
describe('Practice Management Integration', () => {
  it('should complete full ledger entry workflow', async () => {
    // 1. Create areas
    // 2. Create client
    // 3. Create ledger entry with area categorization
    // 4. Upload invoice
    // 5. Verify balance
  });

  it('should calculate product cost from components', async () => {
    // 1. Create attributes
    // 2. Create values with costs
    // 3. Create product
    // 4. Add components
    // 5. Verify total cost
  });
});
```

### Manual Testing Checklist

#### Areas
- [ ] Create area
- [ ] Create subarea
- [ ] Edit area
- [ ] Delete area (cascades to subareas)
- [ ] Duplicate name rejected
- [ ] Doctor isolation verified

#### Clients
- [ ] Create client
- [ ] Upload logo
- [ ] Search clients
- [ ] Filter by status
- [ ] Edit client
- [ ] Delete client
- [ ] Doctor isolation verified

#### Products
- [ ] Create attribute category
- [ ] Add attribute values
- [ ] Create product
- [ ] Add components to product
- [ ] Cost calculates correctly
- [ ] Update component quantity updates cost
- [ ] Delete product removes components

#### Ledger
- [ ] Create income entry
- [ ] Create expense entry
- [ ] Balance calculates correctly
- [ ] Pending entries excluded from balance
- [ ] Upload attachment
- [ ] Upload PDF invoice
- [ ] Upload XML invoice
- [ ] XML parses correctly
- [ ] Generate report

### Performance Testing

```typescript
// performance.test.ts
describe('Performance', () => {
  it('should handle 1000 ledger entries efficiently', async () => {
    // Create 1000 entries
    // Verify query time < 1s
  });

  it('should handle 100 products with components', async () => {
    // Create complex product catalog
    // Verify list loads < 500ms
  });
});
```

---

## Integration Points

### How Practice Management Connects to Existing Features

```
┌──────────────────────────────────────────────────────────┐
│                    EXISTING SYSTEM                       │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Doctor Profile                                          │
│    ├── Public profile (existing)                         │
│    ├── Appointment scheduling (existing)                 │
│    ├── Blog (existing)                                   │
│    └── Practice Management (NEW) ──────────────┐        │
│                                                 │        │
└─────────────────────────────────────────────────┼────────┘
                                                  │
                                                  │
┌─────────────────────────────────────────────────▼────────┐
│              PRACTICE MANAGEMENT MODULE                  │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Private Dashboard (Doctor App Only)                     │
│                                                          │
│  1. Areas & Subareas                                     │
│     • Used to categorize everything                      │
│                                                          │
│  2. Clients                                              │
│     • Could link to Bookings (future)                    │
│     • Could generate invoices (future)                   │
│                                                          │
│  3. Suppliers                                            │
│     • Purchase tracking                                  │
│                                                          │
│  4. Products                                             │
│     • Could link to Services (future)                    │
│     • Cost calculation for practice                      │
│                                                          │
│  5. Ledger                                               │
│     • Track all income/expenses                          │
│     • Mexican tax compliance                             │
│     • Business analytics                                 │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### Potential Future Integrations

#### 1. Bookings → Clients

```typescript
// Future: Link patient bookings to clients
model Booking {
  // ... existing fields ...
  clientId  Int?  // Optional link to Client
  client    Client?  @relation(fields: [clientId], references: [id])
}
```

#### 2. Services → Products

```typescript
// Future: Link doctor services to product catalog
model Service {
  // ... existing fields ...
  productId  Int?  // Optional link to Product
  product    Product?  @relation(fields: [productId], references: [id])
}
```

#### 3. Appointments → Ledger

```typescript
// Future: Automatically create ledger entry when appointment is paid
async function completeAppointmentPayment(bookingId: number, amount: number) {
  // 1. Mark booking as paid
  // 2. Create ledger entry
  await prisma.ledgerEntry.create({
    data: {
      doctorId,
      amount,
      concept: `Cita médica - Paciente ${patientName}`,
      entryType: 'ingreso',
      area: 'Ingresos',
      subarea: 'Consultas',
      // ...
    }
  });
}
```

### Current Integration: None Required

For initial implementation, **no integration with existing features is required**. Practice Management is a **standalone module** that doctors can use independently.

---

## Complete Implementation Checklist

### Pre-Implementation

- [ ] Read and understand this guide completely
- [ ] Review existing codebase architecture
- [ ] Set up development environment
- [ ] Create feature branch: `feature/practice-management`
- [ ] Backup production database (if applicable)

### Database

- [ ] Add multi-schema support to Prisma config
- [ ] Add all 12 practice management models
- [ ] Update Doctor model with new relations
- [ ] Generate Prisma Client
- [ ] Create and test migration
- [ ] Verify existing features still work

### Backend - Auth & Utilities

- [ ] Create `requireDoctorAuth` helper
- [ ] Add UploadThing endpoints for practice management
- [ ] Create shared validation utilities
- [ ] Create shared error handling

### Backend - Areas API

- [ ] GET /api/practice-management/areas
- [ ] POST /api/practice-management/areas
- [ ] PUT /api/practice-management/areas/:id
- [ ] DELETE /api/practice-management/areas/:id
- [ ] POST /api/practice-management/areas/:id/subareas
- [ ] PUT /api/practice-management/areas/:id/subareas/:id
- [ ] DELETE /api/practice-management/areas/:id/subareas/:id
- [ ] Write tests

### Backend - Clients API

- [ ] GET /api/practice-management/clients
- [ ] GET /api/practice-management/clients/:id
- [ ] POST /api/practice-management/clients
- [ ] PUT /api/practice-management/clients/:id
- [ ] DELETE /api/practice-management/clients/:id
- [ ] POST /api/practice-management/clients/:id/logo
- [ ] DELETE /api/practice-management/clients/:id/logo
- [ ] Write tests

### Backend - Proveedores API

- [ ] Copy and adapt all Client endpoints
- [ ] Write tests

### Backend - Product Attributes API

- [ ] GET /api/practice-management/product-attributes
- [ ] POST /api/practice-management/product-attributes
- [ ] PUT /api/practice-management/product-attributes/:id
- [ ] DELETE /api/practice-management/product-attributes/:id
- [ ] POST /api/practice-management/product-attributes/:id/values
- [ ] PUT /api/practice-management/product-attributes/:id/values/:id
- [ ] DELETE /api/practice-management/product-attributes/:id/values/:id
- [ ] Write tests

### Backend - Products API

- [ ] GET /api/practice-management/products
- [ ] GET /api/practice-management/products/:id
- [ ] POST /api/practice-management/products
- [ ] PUT /api/practice-management/products/:id
- [ ] DELETE /api/practice-management/products/:id
- [ ] GET /api/practice-management/products/:id/components
- [ ] POST /api/practice-management/products/:id/components
- [ ] PUT /api/practice-management/products/:id/components/:id
- [ ] DELETE /api/practice-management/products/:id/components/:id
- [ ] Write tests for cost calculation

### Backend - Ledger API

- [ ] GET /api/practice-management/ledger
- [ ] GET /api/practice-management/ledger/:id
- [ ] POST /api/practice-management/ledger
- [ ] PUT /api/practice-management/ledger/:id
- [ ] DELETE /api/practice-management/ledger/:id
- [ ] GET /api/practice-management/ledger/balance
- [ ] GET /api/practice-management/ledger/report
- [ ] POST /api/practice-management/ledger/:id/attachments
- [ ] POST /api/practice-management/ledger/:id/facturas
- [ ] POST /api/practice-management/ledger/:id/facturas-xml
- [ ] Implement XML parser (CFDI)
- [ ] Write tests

### Frontend - Shared Components

- [ ] AreaSelector component
- [ ] EntityForm component (reusable for Client/Proveedor)
- [ ] ProductBOMEditor component
- [ ] LedgerEntryForm component
- [ ] InvoiceUploader component
- [ ] BalanceSummary widget
- [ ] FileUploader component

### Frontend - Areas

- [ ] Areas management page
- [ ] Create/edit area modal
- [ ] Create/edit subarea modal

### Frontend - Clients

- [ ] Client list page
- [ ] Client create page
- [ ] Client edit page
- [ ] Logo upload functionality

### Frontend - Proveedores

- [ ] Supplier list page
- [ ] Supplier create page
- [ ] Supplier edit page
- [ ] Logo upload functionality

### Frontend - Products

- [ ] Master data management page
- [ ] Product list page
- [ ] Product create page
- [ ] Product edit page with BOM editor
- [ ] Cost calculation display

### Frontend - Ledger

- [ ] Ledger list page with filters
- [ ] Ledger entry create page
- [ ] Ledger entry edit page
- [ ] Balance dashboard page
- [ ] Reports page
- [ ] Invoice upload functionality

### Testing

- [ ] Unit tests for all API routes
- [ ] Integration tests for workflows
- [ ] Frontend component tests
- [ ] Manual testing checklist completed
- [ ] Performance testing
- [ ] Security audit
- [ ] Cross-browser testing

### Documentation

- [ ] API documentation
- [ ] User guide for doctors
- [ ] Admin guide
- [ ] Developer documentation
- [ ] Update README

### Deployment

- [ ] Test in staging environment
- [ ] Database migration dry run
- [ ] Performance benchmarks
- [ ] Security review
- [ ] Deploy to production
- [ ] Monitor for errors
- [ ] User training/onboarding

---

## Key Decisions Summary

### 1. Architecture: Single DB + Schemas ✅

**Decision**: Use PostgreSQL schemas to separate domains
**Rationale**: Perfect balance of isolation and simplicity at current scale

### 2. Tenant Scoping: doctorId ✅

**Decision**: Scope all data by `doctorId`, not `userId`
**Rationale**: Doctor = business entity in healthcare platform

### 3. Implementation Order ✅

**Decision**: Areas → Clients → Suppliers → Products → Ledger
**Rationale**: Build foundation first, add complexity gradually

### 4. File Storage: UploadThing ✅

**Decision**: Reuse existing UploadThing infrastructure
**Rationale**: Already configured, proven to work

### 5. Currency: MXN Default ✅

**Decision**: Keep MXN as default, add currency field for future
**Rationale**: Most users in Mexico, easy to extend later

---

## Success Criteria

### Technical

- [ ] All 12 tables created without errors
- [ ] All API endpoints return correct data
- [ ] Doctor isolation verified (no data leakage)
- [ ] File uploads work correctly
- [ ] Existing features unaffected
- [ ] Performance acceptable (< 500ms for list queries)
- [ ] No security vulnerabilities

### Business

- [ ] Doctor can manage areas and categorize entries
- [ ] Doctor can track clients and suppliers
- [ ] Doctor can manage product catalog with costs
- [ ] Doctor can track cash flow and generate reports
- [ ] Doctor can upload and manage invoices
- [ ] System complies with Mexican tax requirements (CFDI)

### User Experience

- [ ] Interface is intuitive and easy to use
- [ ] Workflows are logical and efficient
- [ ] Error messages are clear and helpful
- [ ] Loading states provide feedback
- [ ] Mobile responsive (bonus)

---

## Next Steps

1. **Review this guide** with your team
2. **Set up timeline** and assign responsibilities
3. **Create feature branch** and start Phase 0
4. **Implement iteratively** following the phases
5. **Test thoroughly** at each phase
6. **Deploy incrementally** (backend first, then frontend)
7. **Gather feedback** from doctors using the system
8. **Iterate and improve** based on real usage

---

## Support & Questions

For questions about specific sections:

- **Architecture decisions** → Review "Architectural Analysis" section
- **Database schema** → Review "Database Schema Design" section
- **API implementation** → Review "Backend Implementation" section
- **Frontend components** → Review "Frontend Implementation" section
- **Migration strategy** → Review "Migration Strategy" section
- **Testing approach** → Review "Testing Strategy" section

---

**End of Practice Management Implementation Guide**

**Generated**: 2026-01-05
**Version**: 1.0
**Last Updated**: 2026-01-05
