# Feature Documentation: Clientes (Clients)

Complete documentation for the client management system.

---

## Overview

Client management system for storing and managing business customers/clients. Each client can have:
- Business information (name, RFC, contact details)
- Address information
- Logo/image attachment
- Status tracking (active/inactive)

**User Scoping**: Each user has their own independent client list.

---

## Database Schema (Prisma)

```prisma
model Client {
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

  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  quotations      Quotation[]
  firmOrders      FirmOrder[]

  @@unique([userId, businessName])
  @@index([userId, status])
  @@index([userId, businessName])
  @@map("clients")
}
```

**Fields Explained**:
- `businessName`: Company/business name (required, unique per user)
- `contactName`: Primary contact person name
- `rfc`: Mexican tax ID (RFC - Registro Federal de Contribuyentes)
- `email`, `phone`: Contact information
- `street`, `city`, `state`, `postalCode`, `country`: Full address
- `industry`: Business sector/industry
- `notes`: Free text notes
- `status`: "active" or "inactive"
- `logoUrl`, `logoFileName`, `logoFileSize`: Company logo attachment
- `quotations`, `firmOrders`: Relations to quotation and order systems

**Constraints**:
- `@@unique([userId, businessName])`: User cannot have duplicate client business names
- `@@index([userId, status])`: Fast filtering by status
- `onDelete: Cascade`: Deleting user deletes all clients

---

## API Endpoints

### Base URL: `/api/clients`

### 1. **GET /api/clients**
Get all clients for authenticated user with optional filtering.

**Query Parameters**:
- `status` (optional): Filter by status ("active" or "inactive")
- `search` (optional): Search in businessName, contactName, email

**Request**:
```http
GET /api/clients?status=active&search=acme
```

**Response**:
```json
[
  {
    "id": 1,
    "userId": "user123",
    "businessName": "ACME Corporation",
    "contactName": "Juan Pérez",
    "rfc": "ACM001122XXX",
    "email": "contacto@acme.com",
    "phone": "+52 55 1234 5678",
    "street": "Av. Reforma 123",
    "city": "Ciudad de México",
    "state": "CDMX",
    "postalCode": "06600",
    "country": "México",
    "industry": "Tecnología",
    "notes": "Cliente preferente",
    "status": "active",
    "logoUrl": "https://...",
    "logoFileName": "acme-logo.png",
    "logoFileSize": 45678,
    "createdAt": "2026-01-01T10:00:00Z",
    "updatedAt": "2026-01-05T10:00:00Z"
  }
]
```

**Implementation**:
```typescript
// GET /api/clients
const { status, search } = req.query;

const where: any = { userId: req.user.id };

if (status) {
  where.status = status;
}

if (search) {
  where.OR = [
    { businessName: { contains: search, mode: 'insensitive' } },
    { contactName: { contains: search, mode: 'insensitive' } },
    { email: { contains: search, mode: 'insensitive' } }
  ];
}

const clients = await prisma.client.findMany({
  where,
  orderBy: { businessName: 'asc' }
});

res.json(clients);
```

---

### 2. **GET /api/clients/:id**
Get a single client by ID.

**Response**: Single client object or 404

**Security**: Verify client belongs to authenticated user

---

### 3. **POST /api/clients**
Create a new client.

**Request**:
```json
{
  "businessName": "ACME Corporation",
  "contactName": "Juan Pérez",
  "rfc": "ACM001122XXX",
  "email": "contacto@acme.com",
  "phone": "+52 55 1234 5678",
  "street": "Av. Reforma 123",
  "city": "Ciudad de México",
  "state": "CDMX",
  "postalCode": "06600",
  "country": "México",
  "industry": "Tecnología",
  "notes": "Cliente preferente",
  "status": "active"
}
```

**Response**: Created client object (201)

**Validation**:
- `businessName` is required
- `businessName` must be unique per user
- `rfc` format validation (optional): 12-13 characters, alphanumeric
- `email` format validation
- `status` must be "active" or "inactive"

**Implementation**:
```typescript
// POST /api/clients
const { businessName, contactName, rfc, email, phone, street, city, state, postalCode, country, industry, notes, status } = req.body;

// Validation
if (!businessName) {
  return res.status(400).json({ error: 'Business name is required' });
}

if (email && !isValidEmail(email)) {
  return res.status(400).json({ error: 'Invalid email format' });
}

if (status && !['active', 'inactive'].includes(status)) {
  return res.status(400).json({ error: 'Status must be active or inactive' });
}

const client = await prisma.client.create({
  data: {
    userId: req.user.id,
    businessName,
    contactName,
    rfc,
    email,
    phone,
    street,
    city,
    state,
    postalCode,
    country: country || 'México',
    industry,
    notes,
    status: status || 'active'
  }
});

res.status(201).json(client);
```

---

### 4. **PUT /api/clients/:id**
Update a client.

**Request**: Same fields as POST

**Response**: Updated client object

**Security**: Verify client belongs to authenticated user

---

### 5. **DELETE /api/clients/:id**
Delete a client.

**Response**: 204 No Content

**Security**:
- Verify client belongs to authenticated user
- Check if client has related quotations/orders (optional: prevent deletion or cascade)

---

### 6. **POST /api/clients/:id/logo**
Upload client logo.

**Request**: Multipart form data with file

**Response**:
```json
{
  "logoUrl": "https://storage.../logo.png",
  "logoFileName": "acme-logo.png",
  "logoFileSize": 45678
}
```

**Implementation**:
```typescript
// POST /api/clients/:id/logo
// Using file upload service (e.g., UploadThing, S3)

const file = req.file;
const { id } = req.params;

// Verify ownership
const client = await prisma.client.findFirst({
  where: { id: parseInt(id), userId: req.user.id }
});

if (!client) {
  return res.status(404).json({ error: 'Client not found' });
}

// Upload file (implementation depends on your file storage)
const uploadResult = await uploadFile(file);

// Update client with logo info
const updated = await prisma.client.update({
  where: { id: parseInt(id) },
  data: {
    logoUrl: uploadResult.url,
    logoFileName: file.originalname,
    logoFileSize: file.size
  }
});

res.json({
  logoUrl: updated.logoUrl,
  logoFileName: updated.logoFileName,
  logoFileSize: updated.logoFileSize
});
```

---

### 7. **DELETE /api/clients/:id/logo**
Delete client logo.

**Response**: 204 No Content

---

## Business Logic

### Validation Rules
1. Business name is required and unique per user
2. RFC format: 12-13 alphanumeric characters (Mexico tax ID)
3. Email must be valid format if provided
4. Status can only be "active" or "inactive"
5. Country defaults to "México"

### RFC Validation (Optional)
```typescript
function isValidRFC(rfc: string): boolean {
  // Mexican RFC format: 12-13 alphanumeric characters
  // Example: XAXX010101000 (person) or ABC001122XXX (company)
  return /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/.test(rfc);
}
```

### Email Validation
```typescript
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
```

---

## Frontend Components

### Client List View
- Table/card view of all clients
- Search bar (searches businessName, contactName, email)
- Filter by status (active/inactive)
- Sort by name, creation date
- Actions: View, Edit, Delete

### Client Form (Create/Edit)
```typescript
interface ClientFormData {
  businessName: string;        // Required
  contactName?: string;
  rfc?: string;
  email?: string;
  phone?: string;
  street?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country: string;              // Default "México"
  industry?: string;
  notes?: string;
  status: 'active' | 'inactive';
}
```

### Client Detail View
- Display all client information
- Show logo (if exists)
- Edit/delete buttons
- List of related quotations/orders
- Activity timeline

### Logo Upload Component
- Drag & drop or file picker
- Image preview
- File size limit (e.g., 5MB)
- Supported formats: PNG, JPG, SVG

---

## Integration with Other Features

### Used By:
1. **Quotations** - Link quotations to clients
2. **Firm Orders** - Link orders to clients
3. **Invoicing** - Client info for invoices

**Example Usage**:
```typescript
// Creating a quotation for a client
{
  clientId: 5,
  quotationNumber: "COT-2026-001",
  // ... other fields
}
```

---

## Migration Example

```sql
CREATE TABLE clients (
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

CREATE INDEX idx_clients_user_status ON clients(user_id, status);
CREATE INDEX idx_clients_user_name ON clients(user_id, business_name);
```

---

## Testing Checklist

- [ ] Create client with required fields only
- [ ] Create client with all fields
- [ ] Duplicate business name returns error
- [ ] Invalid email returns error
- [ ] Invalid RFC format returns error (if validation enabled)
- [ ] Search finds clients by name/email
- [ ] Filter by status works
- [ ] Update client information
- [ ] Upload/delete logo
- [ ] Delete client
- [ ] User A cannot see User B's clients
- [ ] Cascade delete when user is deleted

---

## Complete Example

```typescript
// Example: Creating a complete client

const client = {
  businessName: "Industrias ACME S.A. de C.V.",
  contactName: "María García",
  rfc: "IAC010122XXX",
  email: "maria.garcia@acme.mx",
  phone: "+52 55 1234 5678",
  street: "Paseo de la Reforma 505, Piso 12",
  city: "Ciudad de México",
  state: "CDMX",
  postalCode: "06500",
  country: "México",
  industry: "Manufactura",
  notes: "Cliente desde 2020. Descuento del 10% en pedidos mayores a $50,000.",
  status: "active"
};
```

---

## Key Points for LLM Recreation

1. **RFC is optional but recommended** - Mexican tax ID system
2. **Business name is unique per user** - Primary identifier
3. **All address fields are optional** - Flexible data collection
4. **Logo storage** - Requires file upload integration
5. **Status management** - Simple active/inactive toggle
6. **Relations** - Used by quotations and firm orders
7. **User scoping critical** - Always filter by userId
8. **Search functionality** - Multi-field search across name, contact, email

---

**End of Clientes Documentation**
