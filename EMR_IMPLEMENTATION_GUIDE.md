# Electronic Medical Records (EMR) Implementation Guide

**Project**: Healthcare Platform - EMR Module for Doctor Portal
**Generated**: 2026-01-08
**Purpose**: Complete guide to implement doctor-centric patient records management

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Core Principles](#core-principles)
3. [Database Schema Design](#database-schema-design)
4. [Implementation Phases](#implementation-phases)
5. [Backend Implementation](#backend-implementation)
6. [Frontend Implementation](#frontend-implementation)
7. [PDF Generation System](#pdf-generation-system)
8. [Security & Compliance](#security--compliance)
9. [Complete Implementation Checklist](#complete-implementation-checklist)

---

## Executive Summary

### What We're Building

A **doctor-centric Electronic Medical Record (EMR) system** where:
- Patients DO NOT have accounts
- All data belongs to and is managed by the doctor
- Clinical history is immutable and auditable
- Prescriptions can be generated as signed PDFs
- Media assets (images, videos, audio) are linked to encounters

### Key Features by Phase

| Phase | Features | Tables | Complexity | Timeline |
|-------|----------|--------|------------|----------|
| **Phase 1** | Patient Profiles + Basic Encounters | 3 | Medium | 2-3 weeks |
| **Phase 2** | Structured SOAP Notes + Timeline | 2 | Medium | 2-3 weeks |
| **Phase 3** | Media Management (Images/Video/Audio) | 2 | Medium | 2-3 weeks |
| **Phase 4** | Prescriptions + PDF Generation | 3 | High | 3-4 weeks |
| **Total** | Complete EMR System | **10 tables** | **High** | **9-13 weeks** |

### Why This Architecture

✅ **Separate schema** - `medical_records.*` isolates sensitive medical data
✅ **Doctor-scoped** - All data belongs to doctor (multi-tenant by `doctorId`)
✅ **Append-only history** - Clinical encounters are immutable with versioning
✅ **HIPAA-ready** - Audit trails, encryption support, access logging
✅ **Professional-grade** - SOAP structure, proper medical terminology

---

## Core Principles

### 1. No Patient Authentication
- Patients exist only within doctor's workspace
- No patient login, no patient portal
- All access controlled by doctor

### 2. Doctor Ownership
- Each patient scoped by `doctorId`
- Doctor has full control over data
- Multi-doctor practices supported (future)

### 3. Clinical Integrity
- Encounters are append-only
- Edits create versions with audit trail
- Prescriptions locked after issuance
- All actions timestamped and logged

### 4. Data Hierarchy
```
Doctor
 └── Patient (Master Record)
      ├── Profile (Demographics + Medical Baseline)
      ├── Clinical Timeline
      │    ├── Encounter #1 (SOAP Note)
      │    ├── Encounter #2 (SOAP Note)
      │    └── Encounter #N (SOAP Note)
      ├── Media Assets
      │    ├── Images
      │    ├── Videos
      │    └── Audio
      ├── Prescriptions
      │    ├── Prescription #1 (with PDF)
      │    └── Prescription #2 (with PDF)
      └── Audit Log
```

---

## Database Schema Design

### Schema Structure

```sql
-- Create new schema for medical records
CREATE SCHEMA IF NOT EXISTS medical_records;
```

### Complete Prisma Schema

Add to `packages/database/prisma/schema.prisma`:

```prisma
// ============================================================================
// MEDICAL RECORDS DOMAIN
// ============================================================================

// -----------------------------------------------------------------------------
// PHASE 1: PATIENT PROFILES + BASIC ENCOUNTERS
// -----------------------------------------------------------------------------

/// Patient Master Record
/// This is the long-lived identity and baseline medical information
model Patient {
  id          String   @id @default(cuid())
  doctorId    String   @map("doctor_id")

  // Identification
  internalId  String   @map("internal_id") @db.VarChar(50)  // Doctor's own patient ID
  firstName   String   @map("first_name") @db.VarChar(100)
  lastName    String   @map("last_name") @db.VarChar(100)
  dateOfBirth DateTime @map("date_of_birth") @db.Date
  sex         String   @db.VarChar(20)  // "male", "female", "other"

  // Contact Information (optional)
  email       String?  @db.VarChar(255)
  phone       String?  @db.VarChar(50)
  address     String?  @db.Text
  city        String?  @db.VarChar(100)
  state       String?  @db.VarChar(100)
  postalCode  String?  @map("postal_code") @db.VarChar(20)

  // Emergency Contact (optional)
  emergencyContactName  String? @map("emergency_contact_name") @db.VarChar(200)
  emergencyContactPhone String? @map("emergency_contact_phone") @db.VarChar(50)
  emergencyContactRelation String? @map("emergency_contact_relation") @db.VarChar(100)

  // Administrative
  firstVisitDate DateTime?  @map("first_visit_date") @db.Date
  lastVisitDate  DateTime?  @map("last_visit_date") @db.Date
  status         String     @default("active") @db.VarChar(20)  // active, inactive, archived
  tags           String[]   // ["diabetic", "post-op", "chronic"]

  // Medical Baseline (versioned through PatientMedicalHistory)
  currentAllergies      String?  @map("current_allergies") @db.Text
  currentChronicConditions String? @map("current_chronic_conditions") @db.Text
  currentMedications    String?  @map("current_medications") @db.Text
  bloodType             String?  @map("blood_type") @db.VarChar(10)

  // Notes (non-visit-specific)
  generalNotes  String?  @map("general_notes") @db.Text

  // Profile photo (optional)
  photoUrl      String?  @map("photo_url") @db.Text

  // Timestamps
  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")

  // Relations
  doctor               Doctor                 @relation(fields: [doctorId], references: [id], onDelete: Cascade)
  encounters           ClinicalEncounter[]
  medicalHistory       PatientMedicalHistory[]
  media                PatientMedia[]
  prescriptions        Prescription[]
  auditLogs            PatientAuditLog[]

  @@unique([doctorId, internalId])
  @@index([doctorId, status])
  @@index([doctorId, firstName, lastName])
  @@index([doctorId, lastVisitDate])
  @@map("patients")
  @@schema("medical_records")
}

/// Versioned Medical History
/// Tracks changes to patient's baseline medical information
model PatientMedicalHistory {
  id          Int      @id @default(autoincrement())
  patientId   String   @map("patient_id")
  doctorId    String   @map("doctor_id")

  // What changed
  fieldName   String   @map("field_name") @db.VarChar(100)  // "allergies", "chronic_conditions", etc.
  oldValue    String?  @map("old_value") @db.Text
  newValue    String?  @map("new_value") @db.Text

  // Who and when
  changedBy   String   @map("changed_by")  // userId who made the change
  changeReason String? @map("change_reason") @db.Text
  changedAt   DateTime @default(now()) @map("changed_at")

  patient     Patient  @relation(fields: [patientId], references: [id], onDelete: Cascade)

  @@index([patientId, changedAt])
  @@index([doctorId, changedAt])
  @@map("patient_medical_history")
  @@schema("medical_records")
}

/// Clinical Encounter (Visit)
/// Each visit is a sealed clinical event with structured notes
model ClinicalEncounter {
  id              String   @id @default(cuid())
  patientId       String   @map("patient_id")
  doctorId        String   @map("doctor_id")

  // Encounter metadata
  encounterDate   DateTime @map("encounter_date")
  encounterType   String   @map("encounter_type") @db.VarChar(50)  // consultation, follow-up, emergency, telemedicine
  chiefComplaint  String   @map("chief_complaint") @db.Text  // Reason for visit
  location        String?  @db.VarChar(100)  // clinic name or "online"

  // Status
  status          String   @default("draft") @db.VarChar(20)  // draft, completed, amended

  // PHASE 1: Simple notes (will be replaced by structured SOAP in Phase 2)
  clinicalNotes   String?  @map("clinical_notes") @db.Text

  // PHASE 2: Structured SOAP notes (added in Phase 2)
  subjective      String?  @db.Text  // Patient-reported symptoms
  objective       String?  @db.Text  // Physical examination findings
  assessment      String?  @db.Text  // Diagnoses and clinical impressions
  plan            String?  @db.Text  // Treatment plan and follow-up

  // Vitals (Phase 2)
  vitalsBloodPressure String? @map("vitals_blood_pressure") @db.VarChar(20)
  vitalsHeartRate     Int?    @map("vitals_heart_rate")
  vitalsTemperature   Decimal? @map("vitals_temperature") @db.Decimal(4, 1)
  vitalsWeight        Decimal? @map("vitals_weight") @db.Decimal(5, 2)
  vitalsHeight        Decimal? @map("vitals_height") @db.Decimal(5, 2)
  vitalsOxygenSat     Int?    @map("vitals_oxygen_sat")
  vitalsOther         String? @map("vitals_other") @db.Text

  // Follow-up
  followUpDate    DateTime? @map("follow_up_date") @db.Date
  followUpNotes   String?   @map("follow_up_notes") @db.Text

  // Audit
  createdBy       String    @map("created_by")  // userId who created
  completedAt     DateTime? @map("completed_at")
  amendedAt       DateTime? @map("amended_at")
  amendmentReason String?   @map("amendment_reason") @db.Text

  // Timestamps
  createdAt       DateTime  @default(now()) @map("created_at")
  updatedAt       DateTime  @updatedAt @map("updated_at")

  // Relations
  patient         Patient           @relation(fields: [patientId], references: [id], onDelete: Cascade)
  versions        EncounterVersion[]
  media           PatientMedia[]
  prescriptions   Prescription[]

  @@index([patientId, encounterDate])
  @@index([doctorId, encounterDate])
  @@index([doctorId, status])
  @@map("clinical_encounters")
  @@schema("medical_records")
}

// -----------------------------------------------------------------------------
// PHASE 2: ENCOUNTER VERSIONING
// -----------------------------------------------------------------------------

/// Encounter Version History
/// Preserves previous versions when encounter is edited
model EncounterVersion {
  id              Int      @id @default(autoincrement())
  encounterId     String   @map("encounter_id")
  versionNumber   Int      @map("version_number")

  // Snapshot of encounter at this version
  encounterData   Json     @map("encounter_data")  // Full JSON snapshot

  // Audit
  createdBy       String   @map("created_by")
  changeReason    String?  @map("change_reason") @db.Text
  createdAt       DateTime @default(now()) @map("created_at")

  encounter       ClinicalEncounter @relation(fields: [encounterId], references: [id], onDelete: Cascade)

  @@unique([encounterId, versionNumber])
  @@index([encounterId, createdAt])
  @@map("encounter_versions")
  @@schema("medical_records")
}

// -----------------------------------------------------------------------------
// PHASE 3: MEDIA MANAGEMENT
// -----------------------------------------------------------------------------

/// Patient Media Assets
/// Images, videos, audio linked to encounters or patient profile
model PatientMedia {
  id              String   @id @default(cuid())
  patientId       String   @map("patient_id")
  doctorId        String   @map("doctor_id")
  encounterId     String?  @map("encounter_id")  // Optional link to specific encounter

  // Media metadata
  mediaType       String   @map("media_type") @db.VarChar(20)  // image, video, audio
  fileName        String   @map("file_name") @db.VarChar(255)
  fileUrl         String   @map("file_url") @db.Text
  fileSize        Int?     @map("file_size")
  mimeType        String?  @map("mime_type") @db.VarChar(100)

  // Thumbnail (for videos)
  thumbnailUrl    String?  @map("thumbnail_url") @db.Text

  // Clinical context
  category        String?  @db.VarChar(100)  // "wound", "x-ray", "dermatology", "lab-result"
  bodyArea        String?  @map("body_area") @db.VarChar(100)
  captureDate     DateTime @map("capture_date")
  description     String?  @db.Text
  doctorNotes     String?  @map("doctor_notes") @db.Text

  // Privacy
  visibility      String   @default("internal") @db.VarChar(20)  // internal, exportable

  // Timestamps
  uploadedBy      String   @map("uploaded_by")
  createdAt       DateTime @default(now()) @map("created_at")

  // Relations
  patient         Patient           @relation(fields: [patientId], references: [id], onDelete: Cascade)
  encounter       ClinicalEncounter? @relation(fields: [encounterId], references: [id], onDelete: SetNull)

  @@index([patientId, captureDate])
  @@index([doctorId, mediaType])
  @@index([encounterId])
  @@map("patient_media")
  @@schema("medical_records")
}

// -----------------------------------------------------------------------------
// PHASE 4: PRESCRIPTIONS
// -----------------------------------------------------------------------------

/// Prescription Record
/// First-class prescription entity with PDF generation
model Prescription {
  id              String   @id @default(cuid())
  patientId       String   @map("patient_id")
  doctorId        String   @map("doctor_id")
  encounterId     String?  @map("encounter_id")  // Optional link to encounter

  // Prescription metadata
  prescriptionDate DateTime @map("prescription_date")
  status          String   @default("draft") @db.VarChar(20)  // draft, issued, cancelled, expired

  // Doctor details (copied at time of issuance for legal integrity)
  doctorFullName  String   @map("doctor_full_name") @db.VarChar(255)
  doctorLicense   String   @map("doctor_license") @db.VarChar(100)
  doctorSignature String?  @map("doctor_signature") @db.Text  // URL to signature image

  // Clinical context
  diagnosis       String?  @db.Text
  clinicalNotes   String?  @map("clinical_notes") @db.Text

  // PDF
  pdfUrl          String?  @map("pdf_url") @db.Text
  pdfGeneratedAt  DateTime? @map("pdf_generated_at")

  // Versioning (for drafts)
  versionNumber   Int      @default(1) @map("version_number")

  // Audit
  issuedBy        String?  @map("issued_by")  // userId who issued
  issuedAt        DateTime? @map("issued_at")
  cancelledAt     DateTime? @map("cancelled_at")
  cancellationReason String? @map("cancellation_reason") @db.Text
  expiresAt       DateTime? @map("expires_at")

  // Timestamps
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  // Relations
  patient         Patient           @relation(fields: [patientId], references: [id], onDelete: Cascade)
  encounter       ClinicalEncounter? @relation(fields: [encounterId], references: [id], onDelete: SetNull)
  medications     PrescriptionMedication[]

  @@index([patientId, prescriptionDate])
  @@index([doctorId, status])
  @@index([doctorId, prescriptionDate])
  @@map("prescriptions")
  @@schema("medical_records")
}

/// Prescription Medications
/// Individual medication items within a prescription
model PrescriptionMedication {
  id              Int      @id @default(autoincrement())
  prescriptionId  String   @map("prescription_id")

  // Medication details
  drugName        String   @map("drug_name") @db.VarChar(255)
  presentation    String?  @db.VarChar(100)  // "tablet", "syrup", "injection"
  dosage          String   @db.VarChar(100)  // "500mg", "10ml"
  frequency       String   @db.VarChar(100)  // "Every 8 hours", "Twice daily"
  duration        String?  @db.VarChar(100)  // "7 days", "2 weeks"
  quantity        String?  @db.VarChar(50)   // "21 tablets", "1 bottle"
  instructions    String   @db.Text          // "Take with food"
  warnings        String?  @db.Text          // "Do not drive"

  // Display order
  order           Int      @default(0)

  prescription    Prescription @relation(fields: [prescriptionId], references: [id], onDelete: Cascade)

  @@index([prescriptionId, order])
  @@map("prescription_medications")
  @@schema("medical_records")
}

// -----------------------------------------------------------------------------
// AUDIT & COMPLIANCE
// -----------------------------------------------------------------------------

/// Patient Audit Log
/// Tracks all access and modifications to patient records
model PatientAuditLog {
  id              Int      @id @default(autoincrement())
  patientId       String   @map("patient_id")
  doctorId        String   @map("doctor_id")

  // Action details
  action          String   @db.VarChar(100)  // "view_profile", "create_encounter", "edit_encounter", "issue_prescription"
  resourceType    String   @map("resource_type") @db.VarChar(50)  // "patient", "encounter", "prescription"
  resourceId      String?  @map("resource_id")  // ID of the resource acted upon

  // Changes (optional)
  changes         Json?    // JSON of what changed

  // User context
  userId          String   @map("user_id")
  userRole        String   @map("user_role") @db.VarChar(50)
  ipAddress       String?  @map("ip_address") @db.VarChar(45)
  userAgent       String?  @map("user_agent") @db.Text

  // Timestamp
  timestamp       DateTime @default(now())

  patient         Patient  @relation(fields: [patientId], references: [id], onDelete: Cascade)

  @@index([patientId, timestamp])
  @@index([doctorId, timestamp])
  @@index([userId, timestamp])
  @@map("patient_audit_logs")
  @@schema("medical_records")
}
```

### Update Doctor Model

Add relations to the existing `Doctor` model:

```prisma
model Doctor {
  // ... existing fields ...

  // NEW: Medical Records Relations
  patients          Patient[]            @relation()

  // ... existing relations ...
}
```

---

## Implementation Phases

### Phase 1: Patient Profiles + Basic Encounters (2-3 weeks)

**Goal**: Create foundation with patient management and simple encounter notes

**Features**:
- ✅ Patient CRUD (Create, Read, Update, Delete)
- ✅ Patient search and filtering
- ✅ Basic encounter creation with free-text notes
- ✅ Encounter list view per patient
- ✅ Patient demographics and contact info
- ✅ Medical baseline (allergies, conditions, medications)

**Database**:
- `patients` table
- `patient_medical_history` table (versioning)
- `clinical_encounters` table (basic fields)

**Backend**:
- `/api/medical-records/patients` (CRUD)
- `/api/medical-records/patients/:id/encounters` (CRUD)
- `/api/medical-records/patients/:id/history` (view changes)

**Frontend**:
- Patient list page with search
- Patient profile page
- New patient form
- Edit patient form
- Encounter list per patient
- New encounter form (simple)

---

### Phase 2: Structured SOAP Notes + Timeline (2-3 weeks)

**Goal**: Professional clinical documentation with medical structure

**Features**:
- ✅ SOAP structure (Subjective, Objective, Assessment, Plan)
- ✅ Vitals capture (BP, HR, temperature, weight, etc.)
- ✅ Timeline view of encounters
- ✅ Encounter versioning (edit history)
- ✅ Rich text editor for clinical notes
- ✅ Follow-up tracking

**Database**:
- Update `clinical_encounters` with SOAP fields and vitals
- `encounter_versions` table

**Backend**:
- Update encounter endpoints with SOAP structure
- Version management endpoints
- Timeline aggregation endpoint

**Frontend**:
- Structured SOAP note editor
- Vitals input component
- Timeline component (visual)
- Encounter version history viewer
- Compare versions feature

---

### Phase 3: Media Management (2-3 weeks)

**Goal**: Clinical media capture and organization

**Features**:
- ✅ Image upload and display
- ✅ Video upload with thumbnails
- ✅ Audio recording and playback
- ✅ Media organization by body area/category
- ✅ Link media to encounters
- ✅ Media gallery per patient
- ✅ Doctor annotations on media

**Database**:
- `patient_media` table

**Backend**:
- `/api/medical-records/patients/:id/media` (CRUD)
- UploadThing endpoints for medical media
- Thumbnail generation for videos
- Audio processing

**Frontend**:
- Media uploader component
- Image gallery
- Video player
- Audio recorder/player
- Media annotation tool
- Body area selector

---

### Phase 4: Prescriptions + PDF Generation (3-4 weeks)

**Goal**: Professional prescription management with signed PDFs

**Features**:
- ✅ Prescription creation with multiple medications
- ✅ Medication database/catalog
- ✅ Prescription status workflow (draft → issued → cancelled)
- ✅ PDF generation with doctor signature
- ✅ Digital signature upload
- ✅ Prescription history per patient
- ✅ Repeat/copy previous prescriptions
- ✅ Email/download PDF

**Database**:
- `prescriptions` table
- `prescription_medications` table
- `patient_audit_logs` table

**Backend**:
- `/api/medical-records/prescriptions` (CRUD)
- `/api/medical-records/prescriptions/:id/medications` (CRUD)
- `/api/medical-records/prescriptions/:id/issue` (lock prescription)
- `/api/medical-records/prescriptions/:id/pdf` (generate PDF)
- PDF generation service (using React PDF or similar)

**Frontend**:
- Prescription form
- Medication builder (add/remove medications)
- Prescription list per patient
- PDF preview
- Digital signature upload
- Prescription status management
- Email prescription feature

---

## Backend Implementation

### Directory Structure

```
apps/api/src/app/api/
└── medical-records/
    ├── patients/
    │   ├── route.ts                          # GET, POST
    │   └── [id]/
    │       ├── route.ts                      # GET, PUT, DELETE
    │       ├── encounters/
    │       │   ├── route.ts                  # GET, POST
    │       │   └── [encounterId]/
    │       │       ├── route.ts              # GET, PUT, DELETE
    │       │       ├── versions/
    │       │       │   └── route.ts          # GET versions
    │       │       └── complete/
    │       │           └── route.ts          # POST (mark complete)
    │       ├── media/
    │       │   ├── route.ts                  # GET, POST
    │       │   └── [mediaId]/
    │       │       └── route.ts              # GET, PUT, DELETE
    │       ├── prescriptions/
    │       │   ├── route.ts                  # GET, POST
    │       │   └── [prescriptionId]/
    │       │       ├── route.ts              # GET, PUT, DELETE
    │       │       ├── issue/
    │       │       │   └── route.ts          # POST (issue prescription)
    │       │       ├── cancel/
    │       │       │   └── route.ts          # POST (cancel prescription)
    │       │       └── pdf/
    │       │           └── route.ts          # GET (generate/download PDF)
    │       ├── history/
    │       │   └── route.ts                  # GET medical history changes
    │       └── timeline/
    │           └── route.ts                  # GET complete timeline
    ├── prescriptions/
    │   └── [id]/
    │       └── medications/
    │           ├── route.ts                  # GET, POST
    │           └── [medicationId]/
    │               └── route.ts              # PUT, DELETE
    └── audit/
        └── route.ts                          # GET audit logs (admin)
```

### Authentication Helper

Create `apps/api/src/lib/medical-auth.ts`:

```typescript
import { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { prisma } from '@healthcare/database';

export interface MedicalAuthContext {
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
): Promise<MedicalAuthContext> {
  const token = await getToken({ req: request as any });

  if (!token) {
    throw new Error('Authentication required');
  }

  // Check role is DOCTOR
  if (token.role !== 'DOCTOR') {
    throw new Error('Doctor role required');
  }

  // Get doctor ID from token
  const doctorId = token.doctorId as string;

  if (!doctorId) {
    throw new Error('No doctor profile linked to user');
  }

  return {
    userId: token.sub as string,
    email: token.email as string,
    role: token.role as string,
    doctorId
  };
}

/**
 * Log audit entry for patient data access
 */
export async function logAudit(params: {
  patientId: string;
  doctorId: string;
  userId: string;
  userRole: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  changes?: any;
  request: NextRequest;
}) {
  try {
    await prisma.patientAuditLog.create({
      data: {
        patientId: params.patientId,
        doctorId: params.doctorId,
        userId: params.userId,
        userRole: params.userRole,
        action: params.action,
        resourceType: params.resourceType,
        resourceId: params.resourceId,
        changes: params.changes,
        ipAddress: params.request.headers.get('x-forwarded-for') ||
                   params.request.headers.get('x-real-ip') ||
                   'unknown',
        userAgent: params.request.headers.get('user-agent') || undefined,
      }
    });
  } catch (error) {
    console.error('Failed to log audit entry:', error);
    // Don't throw - audit logging shouldn't break the request
  }
}
```

### Example API Route: Patients

`apps/api/src/app/api/medical-records/patients/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { requireDoctorAuth, logAudit } from '@/lib/medical-auth';

// GET /api/medical-records/patients
export async function GET(request: NextRequest) {
  try {
    const { doctorId, userId, role } = await requireDoctorAuth(request);

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'active';
    const search = searchParams.get('search') || '';

    const patients = await prisma.patient.findMany({
      where: {
        doctorId,
        status,
        ...(search ? {
          OR: [
            { firstName: { contains: search, mode: 'insensitive' } },
            { lastName: { contains: search, mode: 'insensitive' } },
            { internalId: { contains: search, mode: 'insensitive' } },
          ]
        } : {})
      },
      orderBy: { lastVisitDate: 'desc' },
      select: {
        id: true,
        internalId: true,
        firstName: true,
        lastName: true,
        dateOfBirth: true,
        sex: true,
        phone: true,
        email: true,
        firstVisitDate: true,
        lastVisitDate: true,
        status: true,
        tags: true,
        photoUrl: true,
      }
    });

    return NextResponse.json({ data: patients });
  } catch (error: any) {
    console.error('Error fetching patients:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: error.message.includes('required') ? 403 : 500 }
    );
  }
}

// POST /api/medical-records/patients
export async function POST(request: NextRequest) {
  try {
    const { doctorId, userId, role } = await requireDoctorAuth(request);
    const body = await request.json();

    // Validation
    if (!body.firstName || !body.lastName || !body.dateOfBirth || !body.sex) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Generate internal ID if not provided
    const internalId = body.internalId || `P${Date.now()}`;

    const patient = await prisma.patient.create({
      data: {
        doctorId,
        internalId,
        firstName: body.firstName,
        lastName: body.lastName,
        dateOfBirth: new Date(body.dateOfBirth),
        sex: body.sex,
        email: body.email,
        phone: body.phone,
        address: body.address,
        city: body.city,
        state: body.state,
        postalCode: body.postalCode,
        emergencyContactName: body.emergencyContactName,
        emergencyContactPhone: body.emergencyContactPhone,
        emergencyContactRelation: body.emergencyContactRelation,
        firstVisitDate: new Date(),
        status: 'active',
        tags: body.tags || [],
        currentAllergies: body.currentAllergies,
        currentChronicConditions: body.currentChronicConditions,
        currentMedications: body.currentMedications,
        bloodType: body.bloodType,
        generalNotes: body.generalNotes,
      }
    });

    // Log audit
    await logAudit({
      patientId: patient.id,
      doctorId,
      userId,
      userRole: role,
      action: 'create_patient',
      resourceType: 'patient',
      resourceId: patient.id,
      request
    });

    return NextResponse.json({ data: patient }, { status: 201 });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'Patient with this internal ID already exists' },
        { status: 409 }
      );
    }

    console.error('Error creating patient:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

### Example: Encounter Timeline

`apps/api/src/app/api/medical-records/patients/[id]/timeline/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { requireDoctorAuth, logAudit } from '@/lib/medical-auth';

// GET /api/medical-records/patients/:id/timeline
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { doctorId, userId, role } = await requireDoctorAuth(request);
    const patientId = params.id;

    // Verify patient belongs to doctor
    const patient = await prisma.patient.findFirst({
      where: { id: patientId, doctorId }
    });

    if (!patient) {
      return NextResponse.json(
        { error: 'Patient not found' },
        { status: 404 }
      );
    }

    // Get complete timeline
    const [encounters, media, prescriptions] = await Promise.all([
      prisma.clinicalEncounter.findMany({
        where: { patientId, doctorId },
        orderBy: { encounterDate: 'desc' }
      }),
      prisma.patientMedia.findMany({
        where: { patientId, doctorId },
        orderBy: { captureDate: 'desc' }
      }),
      prisma.prescription.findMany({
        where: { patientId, doctorId },
        include: { medications: true },
        orderBy: { prescriptionDate: 'desc' }
      })
    ]);

    // Build unified timeline
    const timeline = [
      ...encounters.map(e => ({
        type: 'encounter',
        date: e.encounterDate,
        data: e
      })),
      ...media.map(m => ({
        type: 'media',
        date: m.captureDate,
        data: m
      })),
      ...prescriptions.map(p => ({
        type: 'prescription',
        date: p.prescriptionDate,
        data: p
      }))
    ].sort((a, b) => b.date.getTime() - a.date.getTime());

    // Log audit
    await logAudit({
      patientId,
      doctorId,
      userId,
      userRole: role,
      action: 'view_timeline',
      resourceType: 'patient',
      resourceId: patientId,
      request
    });

    return NextResponse.json({ data: timeline });
  } catch (error: any) {
    console.error('Error fetching timeline:', error);
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

```
apps/doctor/src/app/dashboard/
└── medical-records/
    ├── layout.tsx                           # Medical records section layout
    ├── page.tsx                             # Patients list
    ├── patients/
    │   ├── new/
    │   │   └── page.tsx                     # New patient form
    │   └── [id]/
    │       ├── page.tsx                     # Patient profile (overview)
    │       ├── edit/
    │       │   └── page.tsx                 # Edit patient
    │       ├── encounters/
    │       │   ├── page.tsx                 # Encounters list
    │       │   ├── new/
    │       │   │   └── page.tsx             # New encounter
    │       │   └── [encounterId]/
    │       │       ├── page.tsx             # View encounter
    │       │       └── edit/
    │       │           └── page.tsx         # Edit encounter
    │       ├── media/
    │       │   ├── page.tsx                 # Media gallery
    │       │   └── upload/
    │       │       └── page.tsx             # Upload media
    │       ├── prescriptions/
    │       │   ├── page.tsx                 # Prescriptions list
    │       │   ├── new/
    │       │   │   └── page.tsx             # New prescription
    │       │   └── [prescriptionId]/
    │       │       ├── page.tsx             # View prescription
    │       │       └── edit/
    │       │           └── page.tsx         # Edit prescription
    │       └── timeline/
    │           └── page.tsx                 # Unified timeline view
    └── settings/
        └── page.tsx                         # Signature upload, preferences
```

### Shared Components

Create `apps/doctor/src/components/medical-records/`:

```
apps/doctor/src/components/medical-records/
├── PatientCard.tsx                          # Patient summary card
├── PatientSearchBar.tsx                     # Search with filters
├── EncounterCard.tsx                        # Encounter summary
├── SOAPNoteEditor.tsx                       # Structured note editor
├── VitalsInput.tsx                          # Vitals form component
├── TimelineView.tsx                         # Visual timeline
├── MediaGallery.tsx                         # Image/video gallery
├── MediaUploader.tsx                        # Media upload component
├── PrescriptionForm.tsx                     # Prescription builder
├── MedicationList.tsx                       # Medication items editor
├── PrescriptionPDF.tsx                      # PDF preview component
└── AuditLogViewer.tsx                       # Audit trail display
```

### Example Component: Patient Card

`apps/doctor/src/components/medical-records/PatientCard.tsx`:

```typescript
'use client';

import { User, Calendar, Phone, Mail } from 'lucide-react';
import Link from 'next/link';

interface Patient {
  id: string;
  internalId: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  sex: string;
  phone?: string;
  email?: string;
  lastVisitDate?: string;
  tags: string[];
  photoUrl?: string;
}

interface PatientCardProps {
  patient: Patient;
}

export function PatientCard({ patient }: PatientCardProps) {
  const age = calculateAge(patient.dateOfBirth);
  const daysSinceVisit = patient.lastVisitDate
    ? Math.floor((Date.now() - new Date(patient.lastVisitDate).getTime()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <Link href={`/dashboard/medical-records/patients/${patient.id}`}>
      <div className="bg-white rounded-lg shadow hover:shadow-md transition-shadow p-4 cursor-pointer">
        <div className="flex items-start gap-4">
          {/* Photo */}
          <div className="flex-shrink-0">
            {patient.photoUrl ? (
              <img
                src={patient.photoUrl}
                alt={`${patient.firstName} ${patient.lastName}`}
                className="w-16 h-16 rounded-full object-cover"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center">
                <User className="w-8 h-8 text-gray-400" />
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {patient.firstName} {patient.lastName}
                </h3>
                <p className="text-sm text-gray-500">
                  ID: {patient.internalId} • {age} años • {patient.sex}
                </p>
              </div>
            </div>

            {/* Contact */}
            <div className="mt-2 space-y-1">
              {patient.phone && (
                <div className="flex items-center text-sm text-gray-600">
                  <Phone className="w-4 h-4 mr-2" />
                  {patient.phone}
                </div>
              )}
              {patient.email && (
                <div className="flex items-center text-sm text-gray-600">
                  <Mail className="w-4 h-4 mr-2" />
                  {patient.email}
                </div>
              )}
            </div>

            {/* Last Visit */}
            {patient.lastVisitDate && (
              <div className="mt-2 flex items-center text-sm text-gray-500">
                <Calendar className="w-4 h-4 mr-2" />
                Última visita: {formatDate(patient.lastVisitDate)}
                {daysSinceVisit !== null && daysSinceVisit > 0 && (
                  <span className="ml-2 text-xs text-gray-400">
                    ({daysSinceVisit} días)
                  </span>
                )}
              </div>
            )}

            {/* Tags */}
            {patient.tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {patient.tags.map(tag => (
                  <span
                    key={tag}
                    className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

function calculateAge(dateOfBirth: string): number {
  const today = new Date();
  const birth = new Date(dateOfBirth);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('es-MX', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}
```

### Example Page: Patient List

`apps/doctor/src/app/dashboard/medical-records/page.tsx`:

```typescript
'use client';

import { useState, useEffect } from 'react';
import { Plus, Search } from 'lucide-react';
import Link from 'next/link';
import { PatientCard } from '@/components/medical-records/PatientCard';

export default function PatientsPage() {
  const [patients, setPatients] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPatients();
  }, [statusFilter]);

  const fetchPatients = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        status: statusFilter,
        ...(search && { search })
      });

      const res = await fetch(`/api/medical-records/patients?${params}`);
      const data = await res.json();
      setPatients(data.data || []);
    } catch (error) {
      console.error('Error fetching patients:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchPatients();
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Expedientes Médicos</h1>
          <p className="text-gray-600 mt-1">
            Gestiona los expedientes de tus pacientes
          </p>
        </div>
        <Link
          href="/dashboard/medical-records/patients/new"
          className="bg-blue-600 text-white px-4 py-2 rounded-md flex items-center gap-2 hover:bg-blue-700"
        >
          <Plus className="w-5 h-5" />
          Nuevo Paciente
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <form onSubmit={handleSearch} className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por nombre o ID..."
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
            <option value="active">Activos</option>
            <option value="inactive">Inactivos</option>
            <option value="archived">Archivados</option>
          </select>

          <button
            type="submit"
            className="bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded-md"
          >
            Buscar
          </button>
        </form>
      </div>

      {/* Patient List */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando pacientes...</p>
        </div>
      ) : patients.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {patients.map((patient: any) => (
            <PatientCard key={patient.id} patient={patient} />
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-gray-500">No se encontraron pacientes</p>
        </div>
      )}
    </div>
  );
}
```

---

## PDF Generation System

### Technology Choice

**Recommended**: `@react-pdf/renderer` - React components that render to PDF

### Installation

```bash
cd apps/api
pnpm add @react-pdf/renderer
```

### PDF Template Component

Create `apps/api/src/lib/pdf/PrescriptionTemplate.tsx`:

```typescript
import React from 'react';
import { Document, Page, Text, View, Image, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 11,
    fontFamily: 'Helvetica',
  },
  header: {
    marginBottom: 20,
    borderBottom: '2pt solid #333',
    paddingBottom: 10,
  },
  clinicName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  doctorInfo: {
    fontSize: 10,
    color: '#666',
  },
  patientSection: {
    marginTop: 20,
    marginBottom: 20,
    backgroundColor: '#f5f5f5',
    padding: 10,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  patientInfo: {
    fontSize: 10,
  },
  medicationsSection: {
    marginTop: 20,
  },
  medication: {
    marginBottom: 15,
    paddingBottom: 10,
    borderBottom: '1pt solid #e0e0e0',
  },
  medicationName: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  medicationDetails: {
    fontSize: 10,
    marginBottom: 3,
  },
  footer: {
    position: 'absolute',
    bottom: 40,
    left: 40,
    right: 40,
    borderTop: '1pt solid #333',
    paddingTop: 10,
  },
  signature: {
    marginTop: 20,
    marginBottom: 10,
  },
  signatureImage: {
    width: 150,
    height: 50,
  },
  signatureLine: {
    borderTop: '1pt solid #333',
    width: 200,
    marginTop: 40,
    marginBottom: 5,
  },
  timestamp: {
    fontSize: 8,
    color: '#999',
    marginTop: 10,
  },
});

interface PrescriptionPDFProps {
  prescription: {
    id: string;
    prescriptionDate: string;
    doctorFullName: string;
    doctorLicense: string;
    doctorSignature?: string;
    diagnosis?: string;
    clinicalNotes?: string;
    patient: {
      firstName: string;
      lastName: string;
      dateOfBirth: string;
      sex: string;
      internalId: string;
    };
    medications: Array<{
      drugName: string;
      presentation?: string;
      dosage: string;
      frequency: string;
      duration?: string;
      quantity?: string;
      instructions: string;
      warnings?: string;
    }>;
  };
  clinicInfo: {
    name: string;
    address?: string;
    phone?: string;
  };
}

export const PrescriptionPDF: React.FC<PrescriptionPDFProps> = ({
  prescription,
  clinicInfo
}) => {
  const patientAge = calculateAge(prescription.patient.dateOfBirth);

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.clinicName}>{clinicInfo.name}</Text>
          <Text style={styles.doctorInfo}>
            Dr. {prescription.doctorFullName}
          </Text>
          <Text style={styles.doctorInfo}>
            Cédula Profesional: {prescription.doctorLicense}
          </Text>
          {clinicInfo.address && (
            <Text style={styles.doctorInfo}>{clinicInfo.address}</Text>
          )}
          {clinicInfo.phone && (
            <Text style={styles.doctorInfo}>Tel: {clinicInfo.phone}</Text>
          )}
        </View>

        {/* Patient Info */}
        <View style={styles.patientSection}>
          <Text style={styles.sectionTitle}>Información del Paciente</Text>
          <Text style={styles.patientInfo}>
            Paciente: {prescription.patient.firstName} {prescription.patient.lastName}
          </Text>
          <Text style={styles.patientInfo}>
            Edad: {patientAge} años • Sexo: {prescription.patient.sex}
          </Text>
          <Text style={styles.patientInfo}>
            ID: {prescription.patient.internalId}
          </Text>
          <Text style={styles.patientInfo}>
            Fecha: {formatDate(prescription.prescriptionDate)}
          </Text>
        </View>

        {/* Diagnosis */}
        {prescription.diagnosis && (
          <View style={{ marginBottom: 15 }}>
            <Text style={styles.sectionTitle}>Diagnóstico</Text>
            <Text style={{ fontSize: 10 }}>{prescription.diagnosis}</Text>
          </View>
        )}

        {/* Medications */}
        <View style={styles.medicationsSection}>
          <Text style={styles.sectionTitle}>Prescripción</Text>
          {prescription.medications.map((med, index) => (
            <View key={index} style={styles.medication}>
              <Text style={styles.medicationName}>
                {index + 1}. {med.drugName}
                {med.presentation && ` (${med.presentation})`}
              </Text>
              <Text style={styles.medicationDetails}>
                Dosis: {med.dosage}
              </Text>
              <Text style={styles.medicationDetails}>
                Frecuencia: {med.frequency}
              </Text>
              {med.duration && (
                <Text style={styles.medicationDetails}>
                  Duración: {med.duration}
                </Text>
              )}
              {med.quantity && (
                <Text style={styles.medicationDetails}>
                  Cantidad: {med.quantity}
                </Text>
              )}
              <Text style={styles.medicationDetails}>
                Indicaciones: {med.instructions}
              </Text>
              {med.warnings && (
                <Text style={[styles.medicationDetails, { color: '#d32f2f' }]}>
                  ⚠️ {med.warnings}
                </Text>
              )}
            </View>
          ))}
        </View>

        {/* Clinical Notes */}
        {prescription.clinicalNotes && (
          <View style={{ marginTop: 15 }}>
            <Text style={styles.sectionTitle}>Notas Clínicas</Text>
            <Text style={{ fontSize: 10 }}>{prescription.clinicalNotes}</Text>
          </View>
        )}

        {/* Footer with Signature */}
        <View style={styles.footer}>
          <View style={styles.signature}>
            {prescription.doctorSignature ? (
              <Image
                src={prescription.doctorSignature}
                style={styles.signatureImage}
              />
            ) : (
              <View style={styles.signatureLine} />
            )}
            <Text style={{ fontSize: 10, marginTop: 5 }}>
              Dr. {prescription.doctorFullName}
            </Text>
            <Text style={{ fontSize: 9, color: '#666' }}>
              Cédula: {prescription.doctorLicense}
            </Text>
          </View>

          <Text style={styles.timestamp}>
            Prescripción ID: {prescription.id}
          </Text>
          <Text style={styles.timestamp}>
            Generado: {new Date().toLocaleString('es-MX')}
          </Text>
        </View>
      </Page>
    </Document>
  );
};

function calculateAge(dateOfBirth: string): number {
  const today = new Date();
  const birth = new Date(dateOfBirth);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('es-MX', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}
```

### PDF Generation Endpoint

`apps/api/src/app/api/medical-records/prescriptions/[id]/pdf/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { requireDoctorAuth } from '@/lib/medical-auth';
import { renderToBuffer } from '@react-pdf/renderer';
import { PrescriptionPDF } from '@/lib/pdf/PrescriptionTemplate';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { doctorId } = await requireDoctorAuth(request);
    const prescriptionId = params.id;

    // Fetch prescription with all data
    const prescription = await prisma.prescription.findFirst({
      where: {
        id: prescriptionId,
        doctorId
      },
      include: {
        patient: true,
        medications: {
          orderBy: { order: 'asc' }
        }
      }
    });

    if (!prescription) {
      return NextResponse.json(
        { error: 'Prescription not found' },
        { status: 404 }
      );
    }

    // Get doctor/clinic info
    const doctor = await prisma.doctor.findUnique({
      where: { id: doctorId }
    });

    if (!doctor) {
      return NextResponse.json(
        { error: 'Doctor not found' },
        { status: 404 }
      );
    }

    // Generate PDF
    const pdfBuffer = await renderToBuffer(
      <PrescriptionPDF
        prescription={prescription}
        clinicInfo={{
          name: doctor.doctorFullName,
          address: doctor.clinicAddress,
          phone: doctor.clinicPhone
        }}
      />
    );

    // Return PDF
    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="prescription-${prescriptionId}.pdf"`
      }
    });
  } catch (error: any) {
    console.error('Error generating PDF:', error);
    return NextResponse.json(
      { error: 'Failed to generate PDF' },
      { status: 500 }
    );
  }
}
```

---

## Security & Compliance

### Data Protection

1. **Encryption at Rest**
   - Ensure PostgreSQL encryption is enabled
   - Consider field-level encryption for sensitive data

2. **Encryption in Transit**
   - Always use HTTPS
   - Secure WebSocket connections for real-time features

3. **Access Control**
   - Strict doctor-scoping on all queries
   - Audit logs for all patient data access
   - Session timeout policies

### Audit Requirements

All patient data access must be logged:

```typescript
// Automatically log in middleware or route handlers
await logAudit({
  patientId: patient.id,
  doctorId,
  userId,
  userRole,
  action: 'view_patient_profile',
  resourceType: 'patient',
  resourceId: patient.id,
  request
});
```

### HIPAA Considerations (Future)

While not implementing full HIPAA compliance now, the architecture supports:

- ✅ Audit trails (PatientAuditLog)
- ✅ Data encryption
- ✅ Access controls
- ✅ Data minimization
- ⏳ Backup and recovery (to implement)
- ⏳ Data retention policies (to implement)
- ⏳ Patient rights (access, correction, deletion) (to implement)

---

## Complete Implementation Checklist

### Pre-Implementation

- [ ] Read and understand this guide completely
- [ ] Review existing codebase architecture
- [ ] Set up development environment
- [ ] Create feature branch: `feature/emr-system`
- [ ] Backup production database

### Database - Schema Setup

- [ ] Add multi-schema support to Prisma config (already done)
- [ ] Add `medical_records` schema to Prisma
- [ ] Add all EMR models to schema.prisma
- [ ] Update Doctor model with EMR relations
- [ ] Generate Prisma Client
- [ ] Create and test migration
- [ ] Verify existing features still work

### Phase 1: Patient Profiles + Basic Encounters

#### Backend - Phase 1
- [ ] Create `requireDoctorAuth` helper
- [ ] Create `logAudit` helper
- [ ] GET /api/medical-records/patients
- [ ] POST /api/medical-records/patients
- [ ] GET /api/medical-records/patients/:id
- [ ] PUT /api/medical-records/patients/:id
- [ ] DELETE /api/medical-records/patients/:id
- [ ] GET /api/medical-records/patients/:id/encounters
- [ ] POST /api/medical-records/patients/:id/encounters
- [ ] GET /api/medical-records/patients/:id/encounters/:encounterId
- [ ] PUT /api/medical-records/patients/:id/encounters/:encounterId
- [ ] DELETE /api/medical-records/patients/:id/encounters/:encounterId
- [ ] Write tests for all endpoints

#### Frontend - Phase 1
- [ ] Create medical-records section layout
- [ ] Patient list page with search
- [ ] New patient form
- [ ] Patient profile page (overview)
- [ ] Edit patient form
- [ ] Encounter list per patient
- [ ] New encounter form (simple)
- [ ] View encounter page
- [ ] Edit encounter page
- [ ] PatientCard component
- [ ] PatientSearchBar component
- [ ] EncounterCard component

### Phase 2: Structured SOAP Notes

#### Backend - Phase 2
- [ ] Update encounter model with SOAP fields
- [ ] Update encounter endpoints for SOAP structure
- [ ] POST /api/medical-records/patients/:id/encounters/:id/versions
- [ ] GET /api/medical-records/patients/:id/encounters/:id/versions
- [ ] POST /api/medical-records/patients/:id/encounters/:id/complete
- [ ] Write tests

#### Frontend - Phase 2
- [ ] SOAPNoteEditor component (structured editor)
- [ ] VitalsInput component
- [ ] Update encounter form with SOAP structure
- [ ] Encounter version history viewer
- [ ] Compare versions feature
- [ ] TimelineView component (visual timeline)
- [ ] Patient timeline page

### Phase 3: Media Management

#### Backend - Phase 3
- [ ] GET /api/medical-records/patients/:id/media
- [ ] POST /api/medical-records/patients/:id/media
- [ ] GET /api/medical-records/patients/:id/media/:mediaId
- [ ] PUT /api/medical-records/patients/:id/media/:mediaId
- [ ] DELETE /api/medical-records/patients/:id/media/:mediaId
- [ ] Add UploadThing endpoints for medical media
- [ ] Implement thumbnail generation for videos
- [ ] Write tests

#### Frontend - Phase 3
- [ ] MediaUploader component
- [ ] MediaGallery component (images, videos, audio)
- [ ] Video player component
- [ ] Audio recorder/player component
- [ ] Media annotation tool
- [ ] Body area selector
- [ ] Patient media gallery page
- [ ] Media upload page

### Phase 4: Prescriptions + PDF

#### Backend - Phase 4
- [ ] GET /api/medical-records/patients/:id/prescriptions
- [ ] POST /api/medical-records/patients/:id/prescriptions
- [ ] GET /api/medical-records/prescriptions/:id
- [ ] PUT /api/medical-records/prescriptions/:id
- [ ] DELETE /api/medical-records/prescriptions/:id
- [ ] POST /api/medical-records/prescriptions/:id/issue
- [ ] POST /api/medical-records/prescriptions/:id/cancel
- [ ] GET /api/medical-records/prescriptions/:id/pdf
- [ ] POST /api/medical-records/prescriptions/:id/medications
- [ ] PUT /api/medical-records/prescriptions/:id/medications/:medicationId
- [ ] DELETE /api/medical-records/prescriptions/:id/medications/:medicationId
- [ ] Install @react-pdf/renderer
- [ ] Create PrescriptionTemplate component
- [ ] Implement PDF generation service
- [ ] Write tests

#### Frontend - Phase 4
- [ ] PrescriptionForm component
- [ ] MedicationList component (add/remove medications)
- [ ] Prescription list per patient page
- [ ] New prescription page
- [ ] View prescription page
- [ ] Edit prescription page
- [ ] PDF preview modal
- [ ] Digital signature upload in settings
- [ ] Email prescription feature
- [ ] Repeat/copy prescription feature

### Testing & Quality

- [ ] Unit tests for all API routes
- [ ] Integration tests for workflows
- [ ] Frontend component tests
- [ ] Manual testing checklist
- [ ] Performance testing (large patient lists, media)
- [ ] Security audit (SQL injection, XSS, auth bypass)
- [ ] Accessibility testing
- [ ] Cross-browser testing

### Documentation

- [ ] API documentation
- [ ] User guide for doctors
- [ ] Developer documentation
- [ ] Update README

### Deployment

- [ ] Test in staging environment
- [ ] Database migration dry run
- [ ] Performance benchmarks
- [ ] Security review
- [ ] Deploy to production
- [ ] Monitor for errors
- [ ] User training

---

## Success Criteria

### Technical
- [ ] All 10 tables created without errors
- [ ] All API endpoints return correct data
- [ ] Doctor isolation verified (no data leakage)
- [ ] File uploads work correctly
- [ ] PDF generation works reliably
- [ ] Existing features unaffected
- [ ] Performance acceptable (< 500ms for queries)
- [ ] Audit logs capturing all access

### Business
- [ ] Doctor can create and manage patient records
- [ ] Doctor can document clinical encounters
- [ ] Doctor can upload and organize media
- [ ] Doctor can generate prescription PDFs
- [ ] System maintains clinical integrity (versioning)
- [ ] Professional appearance and UX

---

## Next Steps

1. **Review this guide** with your team
2. **Set up timeline** and assign responsibilities
3. **Create feature branch** from main
4. **Start Phase 1**: Patient profiles + basic encounters
5. **Test thoroughly** after each phase
6. **Deploy incrementally** (backend first, then frontend)
7. **Gather feedback** from doctors
8. **Iterate** based on usage

---

**End of EMR Implementation Guide**

**Generated**: 2026-01-08
**Version**: 1.0
