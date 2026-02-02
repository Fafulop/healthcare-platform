# Encounter Template System

## Overview

The Encounter Template System allows doctors to create personalized encounter templates ("plantillas") for different use cases. Templates control which fields are visible during encounter creation and can set default values, streamlining the documentation process for common visit types.

**Examples of templates:**
- "Consulta Dermatología" - Dermatology consultation with skin-specific fields
- "Seguimiento Diabetes" - Diabetes follow-up with relevant vitals
- "Urgencia Pediátrica" - Pediatric emergency with quick-entry mode
- "Telemedicina" - Online consultation without physical exam vitals

---

## Features

### Field Visibility Control
Templates can show/hide optional fields:
- **Location** - Where the encounter takes place
- **Vitals** - All 7 vital sign fields (BP, HR, temp, weight, height, SpO2, other)
- **Clinical Notes** - Simple notes or SOAP format fields
- **Follow-up** - Date and notes for next visit

### Default Values
Templates can pre-fill values for:
- Encounter type (consultation, follow-up, emergency, telemedicine)
- Location (e.g., "Consulta en línea" for telemedicine)
- Clinical notes templates
- SOAP field templates
- Follow-up notes

### Additional Settings
- **SOAP Mode** - Default to structured SOAP notes or simple clinical notes
- **Default Template** - One template can be marked as default for new encounters
- **Usage Tracking** - Track how often each template is used

### Limits
- Maximum **3 templates per doctor** (1 default + 2 custom)
- Default "Consulta General" template is auto-created and cannot be deleted

---

## Database Schema

```prisma
model EncounterTemplate {
  id              String   @id @default(cuid())
  doctorId        String   @map("doctor_id")

  // Metadata
  name            String   @db.VarChar(100)
  description     String?  @db.Text
  icon            String?  @db.VarChar(50)     // Lucide icon name
  color           String?  @db.VarChar(20)     // Tailwind color

  // Configuration (JSON)
  fieldVisibility Json     @map("field_visibility")
  defaultValues   Json     @map("default_values")

  // Settings
  useSOAPMode     Boolean  @default(false) @map("use_soap_mode")
  isDefault       Boolean  @default(false) @map("is_default")
  isActive        Boolean  @default(true)  @map("is_active")
  displayOrder    Int      @default(0) @map("display_order")

  // Usage tracking
  usageCount      Int      @default(0) @map("usage_count")
  lastUsedAt      DateTime? @map("last_used_at")

  // Timestamps
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  doctor          Doctor   @relation(...)

  @@unique([doctorId, name])
  @@index([doctorId, isActive])
  @@map("encounter_templates")
  @@schema("medical_records")
}
```

---

## API Endpoints

### List Templates
```
GET /api/medical-records/templates
```
Returns all active templates for the authenticated doctor. Auto-creates default template if none exist.

### Create Template
```
POST /api/medical-records/templates
```
**Body:**
```json
{
  "name": "Consulta Dermatología",
  "description": "Plantilla para consultas dermatológicas",
  "icon": "eye",
  "color": "purple",
  "fieldVisibility": {
    "location": true,
    "vitalsBloodPressure": false,
    ...
  },
  "defaultValues": {
    "encounterType": "consultation"
  },
  "useSOAPMode": true,
  "isDefault": false
}
```

### Get Template
```
GET /api/medical-records/templates/[id]
```

### Update Template
```
PUT /api/medical-records/templates/[id]
```

### Delete Template
```
DELETE /api/medical-records/templates/[id]
```
Soft deletes by setting `isActive=false`. Cannot delete the default template.

### Track Usage
```
POST /api/medical-records/templates/[id]/usage
```
Increments usage count and updates `lastUsedAt` timestamp.

---

## Files Structure

### New Files Created

```
apps/doctor/src/
├── types/
│   └── encounter-template.ts          # TypeScript types
├── constants/
│   └── encounter-fields.ts            # Field definitions, presets, validation
├── components/medical-records/
│   ├── TemplateSelector.tsx           # Dropdown for selecting templates
│   └── TemplateEditor.tsx             # Form for creating/editing templates
├── app/
│   ├── api/medical-records/templates/
│   │   ├── route.ts                   # GET list, POST create
│   │   └── [id]/
│   │       ├── route.ts               # GET, PUT, DELETE
│   │       └── usage/
│   │           └── route.ts           # POST usage tracking
│   └── dashboard/medical-records/templates/
│       ├── page.tsx                   # Template list page
│       ├── new/
│       │   └── page.tsx               # Create template page
│       └── [id]/edit/
│           └── page.tsx               # Edit template page

packages/database/prisma/
└── schema.prisma                      # Added EncounterTemplate model
```

### Modified Files

| File | Changes |
|------|---------|
| `schema.prisma` | Added `EncounterTemplate` model, added relation to `Doctor` |
| `EncounterForm.tsx` | Added `templateConfig` prop for conditional field rendering |
| `VitalsInput.tsx` | Added `fieldVisibility` prop to show/hide individual vitals |
| `SOAPNoteEditor.tsx` | Added `fieldVisibility` prop to show/hide SOAP fields |
| `patients/[id]/encounters/new/page.tsx` | Integrated `TemplateSelector`, template usage tracking |

---

## UI Flow

### New Encounter Page
```
┌─────────────────────────────────────────────┐
│  Nueva Consulta                             │
├─────────────────────────────────────────────┤
│  Plantilla: [▼ Seleccionar plantilla]       │  ← TemplateSelector
│    • Consulta General              ⭐        │
│    • Seguimiento Rápido                     │
│    • Consulta Dermatología                  │
│    ─────────────────────────────────        │
│    + Administrar plantillas                 │
├─────────────────────────────────────────────┤
│  [EncounterForm with visible fields only]   │
└─────────────────────────────────────────────┘
```

### Template Management (`/dashboard/medical-records/templates`)
```
┌─────────────────────────────────────────────┐
│  Plantillas de Consulta    [+ Nueva]        │
├─────────────────────────────────────────────┤
│  ┌─────────────────────────────────────┐    │
│  │ 🩺 Consulta General         ⭐ •••  │    │
│  │ Plantilla completa para consultas   │    │
│  │ Usado 45 veces                      │    │
│  └─────────────────────────────────────┘    │
│  ┌─────────────────────────────────────┐    │
│  │ ⏱️ Seguimiento Rápido          ••• │    │
│  │ Plantilla simplificada              │    │
│  │ Usado 23 veces                      │    │
│  └─────────────────────────────────────┘    │
└─────────────────────────────────────────────┘
```

### Template Editor
- Name, description input
- Icon selection (16 Lucide icons)
- Color selection (10 Tailwind colors)
- Field visibility toggles by group (Vitals, Clinical, Follow-up)
- Default value inputs for applicable fields
- SOAP mode toggle
- Set as default checkbox

---

## Voice Assistant Integration

Templates work seamlessly with the voice assistant:

1. **Templates do NOT restrict voice extraction** - All fields are still extracted from voice input
2. **Voice data overrides template defaults** - If voice extracts a value, it takes precedence
3. **Hidden fields remain in form state** - Data is preserved even if not displayed
4. **Template affects display only** - The UI shows only visible fields, but all data is saved

---

## Preset Templates

The system includes built-in presets that doctors can use as starting points:

### Quick Follow-up (`quickFollowUp`)
- Simplified for brief follow-up visits
- Hides "Other Vitals"
- Defaults to SOAP mode
- Sets encounter type to "follow-up"

### Telemedicine (`telemedicine`)
- For online consultations
- Hides vitals that can't be measured remotely (BP, HR, temp, SpO2, other)
- Defaults location to "Consulta en línea"
- Sets encounter type to "telemedicine"

### Emergency (`emergency`)
- For urgent care
- Hides follow-up notes (focus on immediate care)
- Uses simple notes mode (faster entry)
- Sets encounter type to "emergency"

### Pediatric (`pediatric`)
- Full template for pediatric consultations
- All fields visible
- Uses SOAP mode
- Baby icon, pink color

---

## Setup Instructions

1. **Run database migration:**
   ```powershell
   cd packages/database
   npx prisma db push
   npx prisma generate
   ```

2. **Access template management:**
   Navigate to `/dashboard/medical-records/templates`

3. **Create your first template:**
   Click "+ Nueva Plantilla" and configure fields

4. **Use templates:**
   When creating a new encounter, select a template from the dropdown

---

## Field Configuration Reference

| Field | Can Hide | Can Set Default |
|-------|----------|-----------------|
| encounterDate | ❌ | ❌ |
| encounterType | ❌ | ✅ |
| chiefComplaint | ❌ | ❌ |
| location | ✅ | ✅ |
| vitalsBloodPressure | ✅ | ❌ |
| vitalsHeartRate | ✅ | ❌ |
| vitalsTemperature | ✅ | ❌ |
| vitalsWeight | ✅ | ❌ |
| vitalsHeight | ✅ | ❌ |
| vitalsOxygenSat | ✅ | ❌ |
| vitalsOther | ✅ | ❌ |
| clinicalNotes | ✅ | ✅ |
| subjective (S) | ✅ | ✅ |
| objective (O) | ✅ | ✅ |
| assessment (A) | ✅ | ✅ |
| plan (P) | ✅ | ✅ |
| followUpDate | ✅ | ❌ |
| followUpNotes | ✅ | ✅ |

---

## Validation Rules

1. **Template name** - Required, max 100 characters, unique per doctor
2. **Field visibility** - At least one clinical field must be visible
3. **Template limit** - Maximum 3 templates per doctor
4. **Default template** - Cannot be deleted, can be customized
5. **Duplicate names** - Not allowed within same doctor's templates
