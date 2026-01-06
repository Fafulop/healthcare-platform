# Feature Documentation: Áreas y Subáreas

Complete documentation for the hierarchical categorization system (Areas and Subareas).

---

## Overview

A two-level hierarchical categorization system where:
- **Areas** are top-level categories (e.g., "Ventas", "Compras", "Administración")
- **Subareas** are subcategories within areas (e.g., Area "Ventas" → Subareas: "Online", "Tienda Física")

**User Scoping**: Each user has their own independent set of areas and subareas.

---

## Database Schema (Prisma)

### Area Model
```prisma
model Area {
  id          Int       @id @default(autoincrement())
  userId      String    @map("user_id")
  name        String
  description String?
  createdAt   DateTime  @default(now()) @map("created_at")
  updatedAt   DateTime  @updatedAt @map("updated_at")
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  subareas    Subarea[]

  @@unique([userId, name])
  @@index([userId])
  @@map("areas")
}
```

**Fields Explained**:
- `id`: Auto-incrementing primary key
- `userId`: Foreign key to User table (for data isolation)
- `name`: Area name (e.g., "Ventas")
- `description`: Optional description
- `createdAt/updatedAt`: Timestamps
- `subareas`: One-to-many relation to Subarea model

**Constraints**:
- `@@unique([userId, name])`: User cannot have duplicate area names
- `@@index([userId])`: Fast queries by user
- `onDelete: Cascade`: Deleting area deletes all its subareas

---

### Subarea Model
```prisma
model Subarea {
  id          Int      @id @default(autoincrement())
  areaId      Int      @map("area_id")
  name        String
  description String?
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")
  area        Area     @relation(fields: [areaId], references: [id], onDelete: Cascade)

  @@unique([areaId, name])
  @@index([areaId])
  @@map("subareas")
}
```

**Fields Explained**:
- `id`: Auto-incrementing primary key
- `areaId`: Foreign key to Area table
- `name`: Subarea name (e.g., "Online")
- `description`: Optional description
- `area`: Many-to-one relation to Area

**Constraints**:
- `@@unique([areaId, name])`: Cannot have duplicate subarea names within same area
- `@@index([areaId])`: Fast queries by area
- `onDelete: Cascade`: Deleting area deletes all subareas

---

## API Endpoints

### Base URL: `/api/areas`

### 1. **GET /api/areas**
Get all areas with their subareas for the authenticated user.

**Request**:
```http
GET /api/areas
Authorization: Bearer {token} (or session-based)
```

**Response**:
```json
[
  {
    "id": 1,
    "userId": "user123",
    "name": "Ventas",
    "description": "Área de ventas y comercial",
    "createdAt": "2026-01-05T10:00:00Z",
    "updatedAt": "2026-01-05T10:00:00Z",
    "subareas": [
      {
        "id": 1,
        "areaId": 1,
        "name": "Online",
        "description": "Ventas en línea",
        "createdAt": "2026-01-05T10:00:00Z",
        "updatedAt": "2026-01-05T10:00:00Z"
      },
      {
        "id": 2,
        "areaId": 1,
        "name": "Tienda Física",
        "description": null,
        "createdAt": "2026-01-05T10:00:00Z",
        "updatedAt": "2026-01-05T10:00:00Z"
      }
    ]
  }
]
```

**Implementation**:
```typescript
// GET /api/areas
const areas = await prisma.area.findMany({
  where: { userId: req.user.id },
  include: { subareas: true },
  orderBy: { name: 'asc' }
});
res.json(areas);
```

---

### 2. **POST /api/areas**
Create a new area.

**Request**:
```json
{
  "name": "Compras",
  "description": "Área de compras y proveedores"
}
```

**Response**:
```json
{
  "id": 2,
  "userId": "user123",
  "name": "Compras",
  "description": "Área de compras y proveedores",
  "createdAt": "2026-01-05T11:00:00Z",
  "updatedAt": "2026-01-05T11:00:00Z",
  "subareas": []
}
```

**Validation**:
- `name` is required and must be unique per user
- `description` is optional

**Implementation**:
```typescript
// POST /api/areas
const { name, description } = req.body;

if (!name) {
  return res.status(400).json({ error: 'Name is required' });
}

const area = await prisma.area.create({
  data: {
    userId: req.user.id,
    name,
    description
  },
  include: { subareas: true }
});

res.status(201).json(area);
```

---

### 3. **PUT /api/areas/:id**
Update an area.

**Request**:
```json
{
  "name": "Ventas Actualizadas",
  "description": "Nueva descripción"
}
```

**Response**: Updated area object

**Security**: Verify area belongs to authenticated user

**Implementation**:
```typescript
// PUT /api/areas/:id
const { id } = req.params;
const { name, description } = req.body;

// Verify ownership
const existing = await prisma.area.findFirst({
  where: { id: parseInt(id), userId: req.user.id }
});

if (!existing) {
  return res.status(404).json({ error: 'Area not found' });
}

const area = await prisma.area.update({
  where: { id: parseInt(id) },
  data: { name, description },
  include: { subareas: true }
});

res.json(area);
```

---

### 4. **DELETE /api/areas/:id**
Delete an area and all its subareas.

**Response**: 204 No Content

**Security**: Verify area belongs to authenticated user

**Implementation**:
```typescript
// DELETE /api/areas/:id
const { id } = req.params;

const existing = await prisma.area.findFirst({
  where: { id: parseInt(id), userId: req.user.id }
});

if (!existing) {
  return res.status(404).json({ error: 'Area not found' });
}

await prisma.area.delete({
  where: { id: parseInt(id) }
});

res.status(204).send();
```

---

### 5. **POST /api/areas/:areaId/subareas**
Create a subarea within an area.

**Request**:
```json
{
  "name": "Mayoreo",
  "description": "Ventas al mayoreo"
}
```

**Response**:
```json
{
  "id": 3,
  "areaId": 1,
  "name": "Mayoreo",
  "description": "Ventas al mayoreo",
  "createdAt": "2026-01-05T12:00:00Z",
  "updatedAt": "2026-01-05T12:00:00Z"
}
```

**Implementation**:
```typescript
// POST /api/areas/:areaId/subareas
const { areaId } = req.params;
const { name, description } = req.body;

// Verify area ownership
const area = await prisma.area.findFirst({
  where: { id: parseInt(areaId), userId: req.user.id }
});

if (!area) {
  return res.status(404).json({ error: 'Area not found' });
}

const subarea = await prisma.subarea.create({
  data: {
    areaId: parseInt(areaId),
    name,
    description
  }
});

res.status(201).json(subarea);
```

---

### 6. **PUT /api/areas/:areaId/subareas/:id**
Update a subarea.

**Request**: Same as create

**Security**: Verify area belongs to user

---

### 7. **DELETE /api/areas/:areaId/subareas/:id**
Delete a subarea.

**Response**: 204 No Content

**Security**: Verify area belongs to user

---

## Business Logic

### Validation Rules
1. Area name must be unique per user
2. Subarea name must be unique per area
3. Cannot delete area if referenced by other entities (ledger entries, tasks, etc.)
4. User can only access their own areas

### Data Flow
1. User creates area
2. User creates subareas under area
3. Other features (ledger, tasks, contacts) reference area + subarea as categorization
4. Deleting area cascades to subareas (if no references exist)

---

## Frontend Components

### Area Selector Component
```typescript
interface AreaSelectorProps {
  value: { area: string; subarea: string };
  onChange: (value: { area: string; subarea: string }) => void;
}

// Two-level dropdown:
// 1. Select Area
// 2. Select Subarea (filtered by selected area)
```

### Area Management Page
- List all areas with subareas
- Create/edit/delete areas
- Create/edit/delete subareas
- Nested display (tree view or expandable cards)

---

## Usage in Other Features

Areas and subareas are used for categorization in:
- **Ledger Entries** (flujo de dinero)
- **Tasks**
- **Contacts**
- **Documents**

**Storage**: Store as strings (`area`, `subarea`) not IDs for flexibility

**Example in Ledger**:
```typescript
{
  area: "Ventas",
  subarea: "Online",
  // ... other ledger fields
}
```

---

## Migration Example

```sql
CREATE TABLE areas (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR NOT NULL,
  name VARCHAR NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, name)
);

CREATE TABLE subareas (
  id SERIAL PRIMARY KEY,
  area_id INTEGER NOT NULL REFERENCES areas(id) ON DELETE CASCADE,
  name VARCHAR NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(area_id, name)
);
```

---

## Testing Checklist

- [ ] User can create area
- [ ] User cannot create duplicate area name
- [ ] User can create subarea under area
- [ ] User cannot create duplicate subarea within same area
- [ ] Deleting area deletes all subareas
- [ ] User A cannot see User B's areas
- [ ] Update area name updates successfully
- [ ] Cannot delete area if referenced by ledger/tasks

---

## Complete Example

```typescript
// Example: Complete area/subarea setup for a business

const areas = [
  {
    name: "Ventas",
    description: "Área comercial",
    subareas: ["Online", "Tienda Física", "Mayoreo"]
  },
  {
    name: "Compras",
    description: "Adquisiciones",
    subareas: ["Materia Prima", "Insumos", "Servicios"]
  },
  {
    name: "Administración",
    description: "Gastos administrativos",
    subareas: ["Nómina", "Servicios", "Mantenimiento"]
  }
];
```

---

## Key Points for LLM Recreation

1. **Two-level hierarchy only** - Area → Subarea (no deeper nesting)
2. **User scoping is critical** - Always filter by userId
3. **Cascade deletes** - Area deletion removes subareas
4. **Unique constraints** - Prevent duplicates within scope
5. **String storage in references** - Other features store area/subarea as strings, not IDs
6. **No orphan prevention** - Can delete area even if referenced (consider adding check)

---

**End of Areas Documentation**
