# Medical Records Module - Complete Documentation

## Overview

The Medical Records module (`/dashboard/medical-records`) is a comprehensive Electronic Health Records (EHR) system designed for medical professionals. It provides a complete patient management solution with features for managing patient data, clinical encounters, prescriptions, media files, and timeline views.

**Language**: The UI is entirely in Spanish (es-MX locale).

---

## Table of Contents

1. [Page Structure](#page-structure)
2. [Main Pages](#main-pages)
   - [Patient List](#1-patient-list-page)
   - [New Patient](#2-new-patient-page)
   - [Patient Profile](#3-patient-profile-page)
   - [Edit Patient](#4-edit-patient-page)
   - [Encounters](#5-encounters)
   - [Timeline](#6-timeline-page)
   - [Media Gallery](#7-media-gallery)
   - [Prescriptions](#8-prescriptions)
3. [Components Reference](#components-reference)
4. [Data Models](#data-models)
5. [API Endpoints](#api-endpoints)
6. [Authentication](#authentication)

---

## Page Structure

```
/dashboard/medical-records/
├── page.tsx                                    # Patient list (main page)
├── patients/
│   ├── new/page.tsx                           # Create new patient
│   └── [id]/
│       ├── page.tsx                           # Patient profile/detail
│       ├── edit/page.tsx                      # Edit patient
│       ├── timeline/page.tsx                  # Clinical timeline
│       ├── media/
│       │   ├── page.tsx                       # Media gallery
│       │   └── upload/page.tsx                # Upload media
│       ├── encounters/
│       │   ├── new/page.tsx                   # New encounter
│       │   └── [encounterId]/
│       │       ├── page.tsx                   # Encounter detail
│       │       ├── edit/page.tsx              # Edit encounter
│       │       └── versions/page.tsx          # Version history
│       └── prescriptions/
│           ├── page.tsx                       # Prescriptions list
│           ├── new/page.tsx                   # New prescription
│           └── [prescriptionId]/
│               ├── page.tsx                   # Prescription detail
│               └── edit/page.tsx              # Edit prescription
```

---

## Main Pages

### 1. Patient List Page

**URL**: `/dashboard/medical-records`

**Purpose**: Main landing page displaying all patients with search and filter capabilities.

#### Header Section
- **Title**: "Expedientes Medicos" (Medical Records)
- **Subtitle**: "Gestiona los expedientes de tus pacientes" (Manage your patients' records)
- **Action Button**: "Nuevo Paciente" (New Patient) - Blue button with Plus icon

#### Search & Filter Bar
| Element | Type | Description |
|---------|------|-------------|
| Search Input | Text field | "Buscar por nombre o ID..." (Search by name or ID) |
| Status Dropdown | Select | Options: Activos, Inactivos, Archivados |
| Search Button | Button | "Buscar" (Search) |

#### Patient Cards Grid
- **Layout**: Responsive grid (1 column mobile, 2 columns tablet, 3 columns desktop)
- **Each card displays**:
  - Patient photo (or default avatar icon)
  - Full name
  - Patient ID, Age, Sex
  - Phone number (with phone emoji)
  - Last visit date
  - Tags (up to 3 shown, "+X" for additional)

#### Empty State
- Large Users icon
- "No se encontraron pacientes" (No patients found)
- "Comienza agregando tu primer paciente" (Start by adding your first patient)
- "Nuevo Paciente" button

#### Loading State
- Centered spinner
- "Cargando expedientes medicos..." (Loading medical records)

---

### 2. New Patient Page

**URL**: `/dashboard/medical-records/patients/new`

**Purpose**: Form to create a new patient record.

#### Header
- **Back Link**: "Volver a Pacientes" (Back to Patients)
- **Title**: "Nuevo Paciente" (New Patient)
- **Subtitle**: "Complete la informacion del paciente" (Complete patient information)

#### Form Sections

##### Section 1: Identificacion (Identification)
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| ID Interno | Text | No | Auto-generated if empty |
| Nombres | Text | Yes | First name(s) |
| Apellidos | Text | Yes | Last name(s) |
| Fecha de Nacimiento | Date | Yes | Date of birth |
| Sexo | Select | Yes | Masculino, Femenino, Otro |
| Tipo de Sangre | Text | No | E.g., A+, O- |

##### Section 2: Informacion de Contacto (Contact Information)
| Field | Type | Required |
|-------|------|----------|
| Telefono | Tel | No |
| Email | Email | No |
| Direccion | Text | No |
| Ciudad | Text | No |
| Estado | Text | No |
| Codigo Postal | Text | No |

##### Section 3: Contacto de Emergencia (Emergency Contact)
| Field | Type | Required |
|-------|------|----------|
| Nombre | Text | No |
| Telefono | Tel | No |
| Relacion | Text | No |

##### Section 4: Informacion Medica (Medical Information)
| Field | Type | Required |
|-------|------|----------|
| Alergias | Textarea | No |
| Condiciones Cronicas | Textarea | No |
| Medicamentos Actuales | Textarea | No |
| Notas Generales | Textarea | No |
| Etiquetas | Text | No | Comma-separated tags |

#### Actions
- **Cancel**: Link back to patient list
- **Create Patient**: Blue button with Save icon

---

### 3. Patient Profile Page

**URL**: `/dashboard/medical-records/patients/[id]`

**Purpose**: Comprehensive view of a single patient's information and history.

#### Header Section
- **Back Link**: "Volver a Pacientes"
- **Patient Photo**: 80x80px circular (or default avatar)
- **Patient Name**: Large heading
- **Patient Info**: ID, Age, Sex
- **Tags**: Displayed as colored pills

#### Action Buttons
| Button | Icon | Description |
|--------|------|-------------|
| Linea de Tiempo | Clock | View clinical timeline |
| Galeria | Image | View media gallery |
| Prescripciones | Pill | View prescriptions |
| Editar | Edit | Edit patient info |
| Nueva Consulta | Plus | Create new encounter (Primary blue button) |

#### Main Content (Two-Column Layout)

##### Left Column (2/3 width)

**Card: Informacion de Contacto**
- Telefono
- Email
- Direccion (full address with city, state, postal code)

**Card: Contacto de Emergencia** (if exists)
- Nombre
- Telefono
- Relacion

**Card: Informacion Medica Importante** (with red alert icon)
- Tipo de Sangre
- Alergias
- Condiciones Cronicas
- Medicamentos Actuales

**Card: Notas Generales** (if exists)

**Card: Consultas Recientes**
- List of encounter cards
- "Ver todas" link
- Empty state with "Crear primera consulta" link

##### Right Column (1/3 width)

**Card: Informacion Rapida**
- Fecha de Nacimiento
- Edad
- Sexo
- Primera Visita
- Ultima Visita
- Estado (Active/Inactive badge)

---

### 4. Edit Patient Page

**URL**: `/dashboard/medical-records/patients/[id]/edit`

**Purpose**: Edit existing patient information.

#### Header
- **Back Link**: "Volver al Paciente"
- **Title**: "Editar Paciente: [Name]"
- **Subtitle**: "Actualice la informacion del paciente"

#### Form
- Same fields as New Patient form
- ID Interno field is disabled (read-only)
- Pre-populated with existing data

#### Actions
- **Cancel**: Back to patient profile
- **Save Changes**: "Guardar Cambios" button

---

### 5. Encounters

#### 5.1 New Encounter Page

**URL**: `/dashboard/medical-records/patients/[id]/encounters/new`

**Purpose**: Create a new clinical encounter/consultation.

##### Header
- **Back Link**: "Volver al Paciente"
- **Title**: "Nueva Consulta"
- **Subtitle**: "Registre los detalles de la consulta"

##### Form Sections

**Section 1: Informacion Basica**
| Field | Type | Required | Options/Notes |
|-------|------|----------|---------------|
| Fecha de Consulta | Date | Yes | Defaults to today |
| Tipo de Consulta | Select | Yes | Consulta, Seguimiento, Emergencia, Telemedicina |
| Motivo de Consulta | Textarea | Yes | Chief complaint |
| Ubicacion | Text | No | Location |
| Estado | Select | No | Borrador, Completada |

**Section 2: Signos Vitales (VitalsInput component)**
| Field | Type | Units |
|-------|------|-------|
| Presion Arterial | Text | mmHg |
| Frecuencia Cardiaca | Number | lpm |
| Temperatura | Number | C |
| Peso | Number | kg |
| Altura | Number | cm |
| Saturacion de Oxigeno | Number | % |
| Otros | Textarea | - |

**Section 3: Documentacion Clinica**
- Toggle between simple notes and SOAP format
- **Simple Notes**: Single textarea for clinical notes
- **SOAP Notes**: Four textareas
  - S (Subjetivo): Patient's subjective experience
  - O (Objetivo): Objective findings
  - A (Evaluacion): Assessment/diagnosis
  - P (Plan): Treatment plan

**Section 4: Seguimiento (Follow-up)**
| Field | Type | Required |
|-------|------|----------|
| Fecha de Seguimiento | Date | No |
| Notas de Seguimiento | Textarea | No |

##### Actions
- Cancel button
- "Crear Consulta" button

---

#### 5.2 Encounter Detail Page

**URL**: `/dashboard/medical-records/patients/[id]/encounters/[encounterId]`

**Purpose**: View complete encounter details.

##### Header
- **Back Link**: "Volver al Paciente"
- **Title**: "Consulta del [Date]"
- **Patient Info**: Name and ID
- **Edit Button**: Link to edit page

##### Content Cards

**Card: Informacion Basica**
- Fecha (with Calendar icon)
- Tipo (with FileText icon)
- Ubicacion (with MapPin icon, if exists)
- Estado (colored dot + label)

**Card: Motivo de Consulta**
- Chief complaint text

**Card: Notas Clinicas** (if exists)
- Clinical notes or SOAP notes display

**Card: Seguimiento** (blue background, if exists)
- Fecha de Seguimiento
- Instrucciones

**Metadata Footer**
- Created date/time
- Last updated date/time

---

#### 5.3 Edit Encounter Page

**URL**: `/dashboard/medical-records/patients/[id]/encounters/[encounterId]/edit`

**Purpose**: Edit existing encounter.

- Same form as New Encounter
- Pre-populated with existing data
- Title: "Editar Consulta"

---

#### 5.4 Encounter Versions Page

**URL**: `/dashboard/medical-records/patients/[id]/encounters/[encounterId]/versions`

**Purpose**: View version history of encounter edits.

##### Header
- **Back Link**: "Volver a la Consulta"
- **Icon**: Clock icon
- **Title**: "Historial de Versiones"
- **Subtitle**: "Revise los cambios realizados a esta consulta a lo largo del tiempo"

##### Layout (Two-Column)

**Left Column: Versions List**
- List of versions with:
  - Version number
  - Created date/time
  - Change reason (if any)
- Selected version highlighted with blue border

**Right Column: Version Details**
- Version number
- Date/time
- Change reason
- **Informacion Basica**: Date, Type, Chief complaint
- **Notas SOAP** (if exists): S, O, A, P sections
- **Notas Clinicas** (if no SOAP)
- **Signos Vitales** (if exists)

##### Empty State
- "No hay versiones anteriores"
- "Las versiones se crean automaticamente cuando se edita una consulta"

---

### 6. Timeline Page

**URL**: `/dashboard/medical-records/patients/[id]/timeline`

**Purpose**: Chronological view of all patient encounters and media.

#### Header
- **Back Link**: "Volver al Paciente"
- **Icon**: Clock icon (blue)
- **Title**: "Linea de Tiempo Clinica"
- **Patient Info**: Name and age
- **Action Button**: "Nueva Consulta"

#### Stats Summary Card
| Stat | Color | Description |
|------|-------|-------------|
| Total de Consultas | Blue | Total encounters |
| Completadas | Green | Completed encounters |
| Borradores | Yellow | Draft encounters |

#### Timeline View
- Vertical timeline with connecting lines
- **Encounter Items** (blue dot):
  - Card with header (chief complaint, date, type, location)
  - Vitals preview (if exists)
  - SOAP notes preview OR clinical notes
  - Footer: "Ver detalles completos"
- **Media Items** (purple dot):
  - Card with header (description, date, type, category)
  - Thumbnail preview
  - Doctor notes
  - Footer: "Ver galeria completa"

---

### 7. Media Gallery

#### 7.1 Media Gallery Page

**URL**: `/dashboard/medical-records/patients/[id]/media`

**Purpose**: View and manage patient media files.

##### Header
- **Back Link**: "Volver al Paciente"
- **Title**: "Galeria de Medios"
- **Patient Info**: Name and ID
- **Action Button**: "Subir Archivo"

##### Filters Panel
| Filter | Type | Options |
|--------|------|---------|
| Media Type | Select | All Types, Images, Videos, Audio |
| Category | Select | All Categories, [dynamic from media] |
| Sort By | Select | Newest First, Oldest First, Type |

- Active filters shown as colored pills
- "Clear all" link

##### Results Count
- "Showing X of Y media items"

##### Media Grid
- Responsive grid (1-4 columns based on screen)
- MediaCard components
- Click to open MediaViewer modal

##### Empty State
- "Aun no se han subido archivos"
- "Subir Primer Archivo" button

---

#### 7.2 Media Upload Page

**URL**: `/dashboard/medical-records/patients/[id]/media/upload`

**Purpose**: Upload new media files.

##### Header
- **Back Link**: "Volver a la Galeria"
- **Title**: "Subir Medios"
- **Patient Info**: Name and ID

##### Upload Form

**File Selection Area**
- Drag and drop zone with dashed border
- File type detection (image/video/audio)
- Selected files list with:
  - File icon
  - File name
  - File size (MB)
  - Remove button

**Size Limits**:
- Images: up to 10MB
- Videos: up to 100MB
- Audio: up to 20MB

**Metadata Fields**
| Field | Type | Options/Notes |
|-------|------|---------------|
| Categoria | Select | wound, x-ray, dermatology, lab-result, procedure, consultation, other |
| Area del Cuerpo | Select | Cabeza, Cuello, Pecho, Abdomen, Espalda, Brazo Derecho, Brazo Izquierdo, Pierna Derecha, Pierna Izquierda, Mano Derecha, Mano Izquierda, Pie Derecho, Pie Izquierdo |
| Vincular a Consulta | Select | List of patient's encounters |
| Descripcion | Text | Brief description |
| Notas del Doctor | Textarea | Private clinical notes |

##### Actions
- Cancel button
- "Subir" button with upload icon

---

### 8. Prescriptions

#### 8.1 Prescriptions List Page

**URL**: `/dashboard/medical-records/patients/[id]/prescriptions`

**Purpose**: View and manage patient prescriptions.

##### Header
- **Back Link**: "Volver al Paciente"
- **Title**: "Prescripciones"
- **Subtitle**: "Gestiona las prescripciones del paciente"
- **Action Button**: "Nueva Prescripcion"

##### Filter
- Status filter dropdown:
  - Todos los estados
  - Borradores (draft)
  - Emitidas (issued)
  - Canceladas (cancelled)

##### Prescription Cards
Each card shows:
- FileText icon
- Diagnosis or "Prescripcion Medica"
- Date (with Calendar icon)
- Medication count (with Pill icon)
- First 3 medication names (+X more if applicable)
- Status badge (colored)

**Status Colors**:
| Status | Color | Label |
|--------|-------|-------|
| draft | Yellow | Borrador |
| issued | Green | Emitida |
| cancelled | Red | Cancelada |
| expired | Gray | Expirada |

##### Empty State
- "No hay prescripciones registradas"
- "Crear Primera Prescripcion" link

---

#### 8.2 New Prescription Page

**URL**: `/dashboard/medical-records/patients/[id]/prescriptions/new`

**Purpose**: Create a new prescription.

##### Header
- **Back Link**: "Volver a Prescripciones"
- **Title**: "Nueva Prescripcion"
- **Patient Info**: Name and ID

##### Form Sections

**Section 1: Informacion General**
| Field | Type | Required |
|-------|------|----------|
| Fecha de Prescripcion | Date | Yes |
| Fecha de Expiracion | Date | No |
| Diagnostico | Text | No |
| Notas Clinicas | Textarea | No |

**Section 2: Informacion del Doctor**
| Field | Type | Required |
|-------|------|----------|
| Nombre Completo | Text | Yes |
| Cedula Profesional | Text | Yes |

**Section 3: Medicamentos (MedicationList)**
Each medication has:
| Field | Type | Required |
|-------|------|----------|
| Medicamento | Text | Yes |
| Presentacion | Text | No |
| Dosis | Text | Yes |
| Frecuencia | Text | Yes |
| Duracion | Text | No |
| Cantidad | Text | No |
| Indicaciones | Textarea | Yes |
| Advertencias | Textarea | No |

- "Agregar Medicamento" button to add more
- Remove button (X) for each medication

##### Actions
- Cancel button
- "Guardar como Borrador" (gray button)
- "Guardar y Emitir" (blue button)

---

#### 8.3 Prescription Detail Page

**URL**: `/dashboard/medical-records/patients/[id]/prescriptions/[prescriptionId]`

**Purpose**: View prescription details and manage status.

##### Header
- **Back Link**: "Volver a Prescripciones"
- **Title**: "Prescripcion Medica"
- **Patient Info**: Name and ID
- **Status Badge**: Colored badge

##### Action Buttons (vary by status)

**If Draft**:
- Editar (Edit)
- Emitir Prescripcion (Issue) - blue button
- Eliminar (Delete) - red outline button

**If Issued**:
- Descargar PDF (Download) - blue button
- Cancelar Prescripcion - red outline button

**If Cancelled**:
- Shows cancellation reason in red box

##### Content Cards

**Card: Informacion General**
- Fecha de Prescripcion
- Fecha de Expiracion (if exists)
- Diagnostico (if exists)
- Notas Clinicas (if exists)

**Card: Informacion del Doctor**
- Nombre Completo
- Cedula Profesional

**Card: Informacion del Paciente**
- Nombre
- ID Interno
- Sexo

**Card: Medicamentos**
- MedicationList component in read-only mode

##### Cancel Modal
When cancelling an issued prescription:
- Modal overlay
- Title: "Cancelar Prescripcion"
- Required textarea: "Motivo de Cancelacion"
- Cancel and Confirm buttons

---

#### 8.4 Edit Prescription Page

**URL**: `/dashboard/medical-records/patients/[id]/prescriptions/[prescriptionId]/edit`

**Purpose**: Edit draft prescriptions only.

- Same form as New Prescription
- Pre-populated with existing data
- Only available for draft status prescriptions
- Error shown if trying to edit non-draft prescription

---

## Components Reference

### Patient Components
| Component | File | Purpose |
|-----------|------|---------|
| PatientCard | `PatientCard.tsx` | Displays patient summary in list |
| PatientForm | `PatientForm.tsx` | Form for creating/editing patients |
| PatientSearchBar | `PatientSearchBar.tsx` | Search and filter controls |

### Encounter Components
| Component | File | Purpose |
|-----------|------|---------|
| EncounterCard | `EncounterCard.tsx` | Displays encounter summary |
| EncounterForm | `EncounterForm.tsx` | Form for creating/editing encounters |
| VitalsInput | `VitalsInput.tsx` | Vital signs input component |
| SOAPNoteEditor | `SOAPNoteEditor.tsx` | SOAP notes structured input |

### Media Components
| Component | File | Purpose |
|-----------|------|---------|
| MediaGallery | `MediaGallery.tsx` | Grid view of media with filters |
| MediaCard | `MediaCard.tsx` | Individual media thumbnail |
| MediaViewer | `MediaViewer.tsx` | Full-screen media viewer modal |
| MediaUploader | `MediaUploader.tsx` | File upload form |

### Prescription Components
| Component | File | Purpose |
|-----------|------|---------|
| PrescriptionCard | `PrescriptionCard.tsx` | Displays prescription summary |
| MedicationList | `MedicationList.tsx` | Manage prescription medications |

### Timeline Components
| Component | File | Purpose |
|-----------|------|---------|
| TimelineView | `TimelineView.tsx` | Chronological event display |

---

## Data Models

### Patient
```typescript
interface Patient {
  id: string;
  internalId: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  sex: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyContactRelation?: string;
  firstVisitDate?: string;
  lastVisitDate?: string;
  status: string;
  tags: string[];
  currentAllergies?: string;
  currentChronicConditions?: string;
  currentMedications?: string;
  bloodType?: string;
  generalNotes?: string;
  photoUrl?: string;
  encounters: Encounter[];
}
```

### Encounter
```typescript
interface Encounter {
  id: string;
  encounterDate: string;
  encounterType: string; // consultation, follow-up, emergency, telemedicine
  chiefComplaint: string;
  location?: string;
  status: string; // draft, completed, amended
  clinicalNotes?: string;
  subjective?: string;
  objective?: string;
  assessment?: string;
  plan?: string;
  vitalsBloodPressure?: string;
  vitalsHeartRate?: number;
  vitalsTemperature?: number;
  vitalsWeight?: number;
  vitalsHeight?: number;
  vitalsOxygenSat?: number;
  vitalsOther?: string;
  followUpDate?: string;
  followUpNotes?: string;
  createdAt: string;
  updatedAt: string;
  patient: Patient;
}
```

### Prescription
```typescript
interface Prescription {
  id: string;
  prescriptionDate: string;
  status: string; // draft, issued, cancelled, expired
  diagnosis?: string;
  clinicalNotes?: string;
  doctorFullName: string;
  doctorLicense: string;
  expiresAt?: string;
  issuedAt?: string;
  issuedBy?: string;
  cancelledAt?: string;
  cancellationReason?: string;
  patient: Patient;
  medications: Medication[];
  createdAt: string;
  updatedAt: string;
}
```

### Medication
```typescript
interface Medication {
  id?: number;
  drugName: string;
  presentation?: string;
  dosage: string;
  frequency: string;
  duration?: string;
  quantity?: string;
  instructions: string;
  warnings?: string;
  order?: number;
}
```

### Media
```typescript
interface Media {
  id: string;
  mediaType: 'image' | 'video' | 'audio';
  fileName: string;
  fileUrl: string;
  thumbnailUrl?: string | null;
  category?: string | null;
  bodyArea?: string | null;
  captureDate: Date | string;
  description?: string | null;
  doctorNotes?: string | null;
  encounterId?: string | null;
}
```

---

## API Endpoints

### Patient Endpoints
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/medical-records/patients` | List patients (with search/filter) |
| POST | `/api/medical-records/patients` | Create patient |
| GET | `/api/medical-records/patients/[id]` | Get patient details |
| PUT | `/api/medical-records/patients/[id]` | Update patient |
| DELETE | `/api/medical-records/patients/[id]` | Delete patient |
| GET | `/api/medical-records/patients/[id]/history` | Get patient history |
| GET | `/api/medical-records/patients/[id]/timeline` | Get patient timeline |

### Encounter Endpoints
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/medical-records/patients/[id]/encounters` | List encounters |
| POST | `/api/medical-records/patients/[id]/encounters` | Create encounter |
| GET | `/api/medical-records/patients/[id]/encounters/[encounterId]` | Get encounter |
| PUT | `/api/medical-records/patients/[id]/encounters/[encounterId]` | Update encounter |
| DELETE | `/api/medical-records/patients/[id]/encounters/[encounterId]` | Delete encounter |
| GET | `/api/medical-records/patients/[id]/encounters/[encounterId]/versions` | Get versions |

### Media Endpoints
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/medical-records/patients/[id]/media` | List media |
| POST | `/api/medical-records/patients/[id]/media` | Create media record |
| GET | `/api/medical-records/patients/[id]/media/[mediaId]` | Get media |
| PUT | `/api/medical-records/patients/[id]/media/[mediaId]` | Update media |
| DELETE | `/api/medical-records/patients/[id]/media/[mediaId]` | Delete media |

### Prescription Endpoints
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/medical-records/patients/[id]/prescriptions` | List prescriptions |
| POST | `/api/medical-records/patients/[id]/prescriptions` | Create prescription |
| GET | `/api/medical-records/patients/[id]/prescriptions/[prescriptionId]` | Get prescription |
| PUT | `/api/medical-records/patients/[id]/prescriptions/[prescriptionId]` | Update prescription |
| DELETE | `/api/medical-records/patients/[id]/prescriptions/[prescriptionId]` | Delete prescription |
| POST | `/api/medical-records/patients/[id]/prescriptions/[prescriptionId]/issue` | Issue prescription |
| POST | `/api/medical-records/patients/[id]/prescriptions/[prescriptionId]/cancel` | Cancel prescription |
| GET | `/api/medical-records/patients/[id]/prescriptions/[prescriptionId]/pdf` | Download PDF |

### Medication Endpoints
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `.../prescriptions/[prescriptionId]/medications` | Add medication |
| PUT | `.../prescriptions/[prescriptionId]/medications/[medicationId]` | Update medication |
| DELETE | `.../prescriptions/[prescriptionId]/medications/[medicationId]` | Delete medication |

---

## Authentication

All pages require authentication via NextAuth.js:

```typescript
const { data: session, status } = useSession({
  required: true,
  onUnauthenticated() {
    redirect("/login");
  },
});
```

- Session includes `doctorId` for doctor-specific operations
- Loading states shown while authentication is verified
- Automatic redirect to `/login` if unauthenticated

---

## UI/UX Features

### Loading States
- Centered spinner with Loader2 icon (animated)
- Loading message in Spanish

### Error States
- Red background boxes with error messages
- "Volver" links to navigate back

### Responsive Design
- Mobile-first approach
- Collapsible action buttons on mobile
- Grid layouts adapt to screen size

### Color Scheme
- Primary: Blue (#2563eb)
- Success: Green
- Warning: Yellow
- Error: Red
- Text: Gray shades

### Date Formatting
- Locale: es-MX
- Format: "Day Month Year" (e.g., "15 de enero de 2025")

---

## File Upload

Media uploads use UploadThing integration:
- `useUploadThing` hook for file uploads
- Separate endpoints for images, videos, and audio
- Automatic thumbnail generation for videos
- Progress tracking during upload

---

*Documentation generated from source code analysis of the Medical Records module.*
