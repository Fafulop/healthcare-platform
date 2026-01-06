# Feature Documentation: Productos (Products)

Complete documentation for the product catalog and master data system.

---

## Overview

Advanced product management system with:
- **Product Catalog** - Finished products/services you sell
- **Master Data System** - Reusable components/materials organized in categories
- **Bill of Materials (BOM)** - Recipe system defining what components make up each product
- **Product Attributes** - Hierarchical categorization (Attribute → Values)
- **Cost Calculation** - Automatic cost calculation from components

**User Scoping**: Each user has their own independent product catalog and master data.

---

## Architecture Overview

```
ProductAttribute (Category)
  └── ProductAttributeValue (Items)
        └── Used in ProductComponent (BOM)
              └── Defines Product composition

Example:
ProductAttribute: "Materia Prima"
  ├── Value: "Harina (50kg)" - cost: $500, unit: kg
  ├── Value: "Azúcar (25kg)" - cost: $300, unit: kg
  └── Value: "Levadura (1kg)" - cost: $80, unit: kg

Product: "Pan Dulce"
  ├── Component: Harina × 2 kg = $20
  ├── Component: Azúcar × 0.5 kg = $6
  └── Component: Levadura × 0.1 kg = $8
  Total Cost: $34
```

---

## Database Schema (Prisma)

### 1. Product Model

```prisma
model Product {
  id              Int      @id @default(autoincrement())
  userId          String   @map("user_id")

  // Basic Information (field names reused for compatibility)
  businessName    String   @map("business_name") @db.VarChar(255) // Product name
  contactName     String?  @map("contact_name") @db.VarChar(100)  // SKU/Code
  rfc             String?  @db.VarChar(100)                        // Category
  email           String?  @db.VarChar(100)                        // Price
  phone           String?  @db.VarChar(100)                        // Cost

  // Address fields repurposed
  street          String?  @db.VarChar(100)  // Stock quantity
  city            String?  @db.VarChar(100)  // Unit of measure
  state           String?  @db.VarChar(100)  // (unused)
  postalCode      String?  @map("postal_code") @db.VarChar(100) // (unused)
  country         String?  @default("México") @db.VarChar(100)  // (unused)

  // Business Details repurposed
  industry        String?  @db.VarChar(100)  // (unused)
  notes           String?  @db.Text          // Description

  // Status
  status          String   @default("active") @db.VarChar(20) // active, inactive, discontinued

  // File attachments
  logoUrl         String?  @map("logo_url") @db.Text
  logoFileName    String?  @map("logo_file_name") @db.VarChar(255)
  logoFileSize    Int?     @map("logo_file_size")

  // Timestamps
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  // Relations for product composition
  components ProductComponent[]

  // Legacy attribute mappings (not used in new system)
  attributeMappings ProductAttributeMapping[]

  @@unique([userId, businessName])
  @@index([userId, status])
  @@index([userId, rfc]) // category index
  @@index([userId, businessName])
  @@map("products")
}
```

**Field Mapping** (reusing entity structure):
- `businessName` → Product name (e.g., "Pan Dulce")
- `contactName` → SKU/Product code (e.g., "PD-001")
- `rfc` → Category (e.g., "Panadería")
- `email` → Selling price (stored as string, e.g., "150.00")
- `phone` → Base cost (stored as string, e.g., "85.50")
- `street` → Stock quantity (e.g., "100")
- `city` → Unit of measure (e.g., "pza", "kg", "litro")
- `notes` → Product description

**Why reuse fields?** - To maintain compatibility with shared entity management components.

---

### 2. ProductAttribute Model (Master Data Categories)

```prisma
model ProductAttribute {
  id          Int      @id @default(autoincrement())
  userId      String   @map("user_id")
  name        String   @db.VarChar(100) // e.g., "Materia Prima", "Empaques", "Insumos"
  description String?  @db.Text
  order       Int      @default(0) // Display order
  isActive    Boolean  @default(true) @map("is_active")
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  user   User                    @relation(fields: [userId], references: [id], onDelete: Cascade)
  values ProductAttributeValue[]

  @@unique([userId, name])
  @@index([userId, isActive])
  @@index([userId, order])
  @@map("product_attributes")
}
```

**Purpose**: Define categories for master data (e.g., "Materia Prima", "Empaques", "Servicios")

---

### 3. ProductAttributeValue Model (Master Data Items)

```prisma
model ProductAttributeValue {
  id          Int      @id @default(autoincrement())
  attributeId Int      @map("attribute_id")
  value       String   @db.VarChar(255) // e.g., "Harina (50kg)", "Caja pequeña"
  description String?  @db.Text
  cost        String?  @db.VarChar(100) // Cost per unit (e.g., "500.00")
  unit        String?  @db.VarChar(50) // Unit type: pieza, kg, litro, metro, etc.
  order       Int      @default(0) // Display order
  isActive    Boolean  @default(true) @map("is_active")
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  attribute ProductAttribute          @relation(fields: [attributeId], references: [id], onDelete: Cascade)
  productComponents ProductComponent[] // Used in BOMs
  products  ProductAttributeMapping[] // Legacy
  supplierProducts SupplierProductAttributeMapping[]

  @@unique([attributeId, value])
  @@index([attributeId, isActive])
  @@index([attributeId, order])
  @@map("product_attribute_values")
}
```

**Purpose**: Individual items within each category (e.g., within "Materia Prima": "Harina", "Azúcar", "Levadura")

---

### 4. ProductComponent Model (Bill of Materials)

```prisma
model ProductComponent {
  id               Int      @id @default(autoincrement())
  productId        Int      @map("product_id")
  attributeValueId Int      @map("attribute_value_id")
  quantity         Decimal  @db.Decimal(10, 4) // Supports decimals: 0.5, 2.25, 0.0005
  calculatedCost   Decimal  @db.Decimal(12, 2) // Auto-calculated: cost × quantity
  order            Int      @default(0) // Display order
  createdAt        DateTime @default(now()) @map("created_at")
  updatedAt        DateTime @updatedAt @map("updated_at")

  product        Product               @relation(fields: [productId], references: [id], onDelete: Cascade)
  attributeValue ProductAttributeValue @relation(fields: [attributeValueId], references: [id], onDelete: Cascade)

  @@index([productId])
  @@index([attributeValueId])
  @@map("product_components")
}
```

**Purpose**: Defines what materials/components make up each product and in what quantities.

**Cost Calculation**:
```typescript
calculatedCost = attributeValue.cost × quantity
```

---

## API Endpoints

### Products

#### Base URL: `/api/products`

**1. GET /api/products** - List all products
**2. GET /api/products/:id** - Get single product with components
**3. POST /api/products** - Create product
**4. PUT /api/products/:id** - Update product
**5. DELETE /api/products/:id** - Delete product

---

### Product Attributes (Master Data Categories)

#### Base URL: `/api/product-attributes`

**1. GET /api/product-attributes** - List all attributes with values

**Response**:
```json
[
  {
    "id": 1,
    "userId": "user123",
    "name": "Materia Prima",
    "description": "Ingredientes y materias primas",
    "order": 1,
    "isActive": true,
    "values": [
      {
        "id": 1,
        "attributeId": 1,
        "value": "Harina (50kg)",
        "description": "Harina de trigo refinada",
        "cost": "500.00",
        "unit": "kg",
        "order": 1,
        "isActive": true
      },
      {
        "id": 2,
        "attributeId": 1,
        "value": "Azúcar (25kg)",
        "cost": "300.00",
        "unit": "kg",
        "order": 2,
        "isActive": true
      }
    ]
  }
]
```

**2. POST /api/product-attributes** - Create attribute category

**Request**:
```json
{
  "name": "Empaques",
  "description": "Materiales de empaque",
  "order": 2
}
```

**3. PUT /api/product-attributes/:id** - Update attribute
**4. DELETE /api/product-attributes/:id** - Delete attribute (cascades to values)

---

### Product Attribute Values (Master Data Items)

#### Base URL: `/api/product-attributes/:attributeId/values`

**1. POST** - Create value

**Request**:
```json
{
  "value": "Caja pequeña (20x20cm)",
  "description": "Caja de cartón corrugado",
  "cost": "5.50",
  "unit": "pieza",
  "order": 1
}
```

**2. PUT /:id** - Update value
**3. DELETE /:id** - Delete value

---

### Product Components (BOM)

#### Base URL: `/api/products/:productId/components`

**1. GET** - Get all components for a product

**Response**:
```json
[
  {
    "id": 1,
    "productId": 5,
    "attributeValueId": 1,
    "quantity": "2.5000",
    "calculatedCost": "12.50",
    "order": 1,
    "attributeValue": {
      "id": 1,
      "value": "Harina (50kg)",
      "cost": "5.00",
      "unit": "kg"
    }
  }
]
```

**2. POST** - Add component to product

**Request**:
```json
{
  "attributeValueId": 1,
  "quantity": 2.5
}
```

**Implementation**:
```typescript
// POST /api/products/:productId/components
const { attributeValueId, quantity } = req.body;

// Get attribute value to calculate cost
const attributeValue = await prisma.productAttributeValue.findUnique({
  where: { id: attributeValueId }
});

const cost = parseFloat(attributeValue.cost || '0');
const calculatedCost = cost * quantity;

const component = await prisma.productComponent.create({
  data: {
    productId: parseInt(productId),
    attributeValueId,
    quantity,
    calculatedCost
  }
});

res.status(201).json(component);
```

**3. PUT /:id** - Update component quantity (recalculates cost)
**4. DELETE /:id** - Remove component from product

---

## Business Logic

### Cost Calculation Flow

1. **Master Data Item** has base cost (e.g., Harina: $500 per 50kg bag = $10/kg)
2. **Product Component** defines quantity (e.g., uses 2.5 kg)
3. **Calculated Cost** = $10/kg × 2.5kg = $25
4. **Total Product Cost** = Sum of all component costs

**Example**:
```typescript
// Calculate total cost of product
async function calculateProductCost(productId: number): Promise<number> {
  const components = await prisma.productComponent.findMany({
    where: { productId },
    include: { attributeValue: true }
  });

  return components.reduce((total, component) => {
    const unitCost = parseFloat(component.attributeValue.cost || '0');
    const cost = unitCost * parseFloat(component.quantity.toString());
    return total + cost;
  }, 0);
}
```

### Price vs Cost
- **Cost** (`phone` field): Total cost from components (or manually set)
- **Price** (`email` field): Selling price (should be > cost for profit)
- **Margin**: `(price - cost) / price * 100`

---

## Frontend Components

### Product List
- Table view with: Name, SKU, Category, Price, Cost, Stock, Status
- Search/filter by category, status
- Actions: View, Edit, Delete

### Product Form
```typescript
interface ProductFormData {
  businessName: string;     // Product name
  contactName?: string;     // SKU
  rfc?: string;            // Category
  email?: string;          // Price (string)
  phone?: string;          // Cost (string)
  street?: string;         // Stock
  city?: string;           // Unit
  notes?: string;          // Description
  status: 'active' | 'inactive' | 'discontinued';
}
```

### Product Detail View with BOM
- Product information
- **Components list** (Bill of Materials):
  - Material name
  - Quantity needed
  - Unit cost
  - Total cost
- Add/remove components
- Total product cost (auto-calculated)

### Master Data Manager
- Tabbed interface for each attribute category
- Add/edit/delete categories
- Add/edit/delete values within categories
- Inline editing for costs and units

---

## Complete Example

```typescript
// 1. Create Master Data Structure

// Create attribute (category)
const materiasPrimas = await prisma.productAttribute.create({
  data: {
    userId: "user123",
    name: "Materia Prima",
    description: "Ingredientes básicos",
    order: 1
  }
});

// Create values (items)
const harina = await prisma.productAttributeValue.create({
  data: {
    attributeId: materiasPrimas.id,
    value: "Harina (50kg)",
    cost: "500.00",
    unit: "kg",
    order: 1
  }
});

const azucar = await prisma.productAttributeValue.create({
  data: {
    attributeId: materiasPrimas.id,
    value: "Azúcar (25kg)",
    cost: "300.00",
    unit: "kg",
    order: 2
  }
});

// 2. Create Product
const panDulce = await prisma.product.create({
  data: {
    userId: "user123",
    businessName: "Pan Dulce",
    contactName: "PD-001",
    rfc: "Panadería",
    email: "150.00", // Price
    phone: "0",      // Cost (will calculate)
    street: "0",     // Stock
    city: "pza",     // Unit
    notes: "Pan dulce tradicional mexicano",
    status: "active"
  }
});

// 3. Add Components (BOM)
await prisma.productComponent.create({
  data: {
    productId: panDulce.id,
    attributeValueId: harina.id,
    quantity: 2.5,
    calculatedCost: 25.00 // 500/50 * 2.5
  }
});

await prisma.productComponent.create({
  data: {
    productId: panDulce.id,
    attributeValueId: azucar.id,
    quantity: 0.5,
    calculatedCost: 6.00 // 300/25 * 0.5
  }
});

// Total cost: $31.00
// Selling price: $150.00
// Margin: 79.3%
```

---

## Integration with Other Features

### Used By:
1. **Quotations** - Add products to quotes
2. **Firm Orders** - Add products to orders
3. **Inventory** - Track stock levels
4. **Supplier Products** - Map to master data attributes

---

## Migration Example

```sql
-- See schema above for complete SQL
-- Key tables:
-- 1. products
-- 2. product_attributes
-- 3. product_attribute_values
-- 4. product_components
```

---

## Testing Checklist

- [ ] Create product attribute category
- [ ] Create attribute values with costs
- [ ] Create product
- [ ] Add components to product
- [ ] Cost auto-calculates correctly
- [ ] Update component quantity recalculates cost
- [ ] Delete product removes components
- [ ] Delete attribute cascades to values
- [ ] User A cannot see User B's products/attributes

---

## Key Points for LLM Recreation

1. **Dual system**: Products (finished goods) + Master Data (components)
2. **Field reuse**: Product model reuses entity fields for compatibility
3. **BOM system**: ProductComponent defines product composition
4. **Auto-calculation**: Component costs calculate automatically
5. **Hierarchical**: Attribute → Values → Components → Products
6. **Decimal precision**: Quantity supports decimals (0.0001)
7. **Unit flexibility**: String unit field (kg, litro, pza, etc.)
8. **Cost tracking**: Both unit cost and total calculated cost

---

**End of Productos Documentation**
