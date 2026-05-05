# Plan: PDF Print Settings for Encounter Documents (V2)

**Date:** 2026-05-04
**Status:** Implemented
**Supersedes:** `docs/NEW.MD-GUIDES/PLAN-PDF-PRINT-SETTINGS.md`

---

## Problem

Doctors often have **pre-printed stationery** (papel membretado) with their clinic logo, name, address, and contact info already printed on the paper. When they export an encounter PDF and print it on this paper, the PDF's own header and footer overlap with the pre-printed content.

Additionally, doctors who create **custom templates** (plantillas personalizadas) via the FormBuilder need per-field control over what appears in the PDF output.

They need:
1. Toggle off the header and footer so they don't clash with pre-printed paper
2. Configurable blank margins at top/bottom for pre-printed areas
3. These settings saved as **defaults per doctor** (paper/layout preferences)
4. Per-field control over what appears in the PDF for **custom templates**

---

## Current State

### Two template systems coexist

| System | Model field | How fields work | PDF rendering |
|--------|------------|-----------------|---------------|
| **Standard templates** (`isCustom: false`) | `fieldVisibility` JSON toggles fixed fields (vitals, SOAP, follow-up) | Fixed set of `EncounterFieldKey` fields | `encounter-pdf.ts` renders each section with hardcoded logic |
| **Custom templates** (`isCustom: true`) | `customFields` JSON array of `FieldDefinition` (user-defined fields via FormBuilder) | Dynamic fields: text, textarea, number, date, dropdown, radio, checkbox, file | `encounter-pdf.ts` lines 201-228 iterate `customFields` and render label/value pairs from `encounter.customData` |

### PDF Generation

- **File:** `apps/doctor/src/lib/pdf/encounter-pdf.ts`
- **Library:** jsPDF (client-side, default units = **mm**)
- **Functions:**
  - `generateEncounterPDF(encounter, customTemplate?)` -- single encounter
  - `generateTimelinePDF(encounters, patient)` -- full patient history

### Current hardcoded elements in `generateEncounterPDF`

| Element | Lines | Description |
|---------|-------|-------------|
| Header bar | 70-81 | Blue rectangle (0,0 -> full width, 32mm) with "CONSULTA MEDICA", date, status |
| Patient box | 84-106 | Gray rounded rect with patient name, ID, sex, age |
| Encounter meta | 108-118 | "Tipo: Seguimiento" line |
| Chief complaint | 120-127 | "Motivo de Consulta" section (skipped when `isCustom`) |
| Vitals | 129-159 | "Signos Vitales" section with blue box |
| SOAP notes | 161-190 | Color-coded S/O/A/P sections |
| Clinical notes | 192-199 | Free text notes (only when no SOAP) |
| Custom data | 201-228 | Custom template fields from `customData` |
| Follow-up | 230-261 | "Seguimiento" section with date |
| Footer | 263-272 | "tusalud.pro -- Generado el..." + page numbers on every page |

### Key files

| File | Purpose |
|------|---------|
| `apps/doctor/src/lib/pdf/encounter-pdf.ts` | PDF generation logic |
| `apps/doctor/src/types/custom-encounter.ts` | `FieldDefinition` interface for custom templates |
| `apps/doctor/src/types/encounter-template.ts` | Standard template types |
| `apps/doctor/src/components/form-builder/ConfigPanel.tsx` | Right sidebar in FormBuilder (field properties) |
| `apps/doctor/src/app/dashboard/medical-records/patients/[id]/encounters/_components/useEncounterDetail.ts` | Encounter detail hook (calls `generateEncounterPDF`) |
| `apps/doctor/src/app/dashboard/medical-records/patients/[id]/encounters/[encounterId]/page.tsx` | Encounter detail page with PDF button |
| `packages/database/prisma/schema.prisma` | `pdfSettings Json?` already added to Doctor model (line 167) |
| `packages/database/prisma/migrations/add-pdf-settings-to-doctors.sql` | SQL migration already created, not yet executed |

---

## Design Decision: Two Layers

### Why two layers?

- **Paper preferences** (margins, header, footer) depend on the doctor's physical stationery -- same for all encounters regardless of template
- **Content preferences** (which fields appear in the PDF) depend on the template -- a dermatology template shows different fields than a pediatric one

### Layer 1: Doctor-level settings (paper/layout)

Stored in `Doctor.pdfSettings` (JSONB). Controls physical paper concerns.

### Layer 2: Per-field setting on custom templates

Stored in `FieldDefinition.showInPdf` (boolean). Controls which custom fields appear in the PDF. Configured in the FormBuilder when designing the template.

For standard templates, the PDF already respects whether sections have data (vitals only render if vitals exist, SOAP only renders if SOAP fields have content). No extra toggles needed.

---

## Proposed Solution

### 1. Database: `pdf_settings` on Doctor model (already done)

Schema already has:
```prisma
// In Doctor model (schema.prisma line 167)
pdfSettings  Json?  @map("pdf_settings")
```

SQL migration already exists:
```
packages/database/prisma/migrations/add-pdf-settings-to-doctors.sql
```

**Needs:** Execute migration against local DB and Railway.

### 2. TypeScript: PdfSettings interface

**File:** `apps/doctor/src/types/pdf-settings.ts`

```typescript
export interface PdfSettings {
  // Header & Footer
  showHeader: boolean;
  showFooter: boolean;
  showPageNumbers: boolean;

  // Margins (mm) -- extra blank space for pre-printed letterhead
  // jsPDF uses mm by default, so these values are used directly (NO conversion)
  topMarginMm: number;       // 0-80
  bottomMarginMm: number;    // 0-80

  // Standard section visibility
  showPatientBox: boolean;
  showEncounterMeta: boolean;
  showVitals: boolean;
  showFollowUp: boolean;
}

export const DEFAULT_PDF_SETTINGS: PdfSettings = {
  showHeader: true,
  showFooter: true,
  showPageNumbers: true,
  topMarginMm: 0,
  bottomMarginMm: 0,
  showPatientBox: true,
  showEncounterMeta: true,
  showVitals: true,
  showFollowUp: true,
};
```

**Important:** jsPDF default unit is **mm**, not pt. Values like `y = 40` in the current code are already in mm. The original plan had `topMarginMm * 2.835` (mm-to-pt conversion) which is **wrong**. Use `topMarginMm` directly.

### 3. Add `showInPdf` to FieldDefinition

**File:** `apps/doctor/src/types/custom-encounter.ts`

Add one field to the existing interface:

```typescript
export interface FieldDefinition {
  // ... all existing fields stay unchanged ...

  // PDF output control
  showInPdf?: boolean;  // default: true -- toggle in FormBuilder ConfigPanel
}
```

### 4. Update PDF Generation

**File:** `apps/doctor/src/lib/pdf/encounter-pdf.ts`

#### 4a. Change function signature

```typescript
export async function generateEncounterPDF(
  encounter: any,
  customTemplate?: any | null,
  pdfSettings?: PdfSettings | null,  // NEW
): Promise<void>
```

#### 4b. Merge settings with defaults at top of function

```typescript
const settings = { ...DEFAULT_PDF_SETTINGS, ...(pdfSettings || {}) };
```

#### 4c. Clamp margins server-side and client-side

```typescript
settings.topMarginMm = Math.max(0, Math.min(80, settings.topMarginMm));
settings.bottomMarginMm = Math.max(0, Math.min(80, settings.bottomMarginMm));
```

#### 4d. Wrap sections in conditionals

| Section | Condition | Start Y when hidden |
|---------|-----------|-------------------|
| Header (lines 70-81) | `if (settings.showHeader)` | `y = settings.topMarginMm + 14` instead of `y = 40` |
| Patient box (lines 84-106) | `if (settings.showPatientBox)` | skip, y unchanged |
| Encounter meta (lines 108-118) | `if (settings.showEncounterMeta)` | skip, y unchanged |
| Vitals (lines 129-159) | `if (settings.showVitals)` | skip, y unchanged |
| Follow-up (lines 230-261) | `if (settings.showFollowUp)` | skip, y unchanged |
| Footer text (line 270) | `if (settings.showFooter)` | skip |
| Page numbers (line 271) | `if (settings.showPageNumbers)` | skip |

#### 4e. Adjust page break threshold

All 5 calls to `pageBreakIfNeeded` must use adjusted threshold:

```typescript
const bottomReserve = settings.bottomMarginMm;
const breakThreshold = H - 14 - bottomReserve;  // H = page height in mm (297 for A4)
// Replace all pageBreakIfNeeded(doc, y, 255) with pageBreakIfNeeded(doc, y, breakThreshold)
```

Also adjust footer Y position:
```typescript
// Current: doc.text(..., m, H - 8)
// New:     doc.text(..., m, H - 8 - settings.bottomMarginMm)
```

#### 4f. Filter custom fields by `showInPdf`

Change line 209 area:

```typescript
// Current:
const entries: [string, any][] = fields
  ? fields
      .map((f: any): [string, any] => [f.labelEs || f.label || f.name, encounter.customData![f.name]])
      .filter(([, v]) => v !== undefined && v !== null && v !== '')
  : Object.entries(encounter.customData).filter(([, v]) => v !== undefined && v !== null && v !== '');

// New:
const entries: [string, any][] = fields
  ? fields
      .filter((f: any) => f.showInPdf !== false)  // NEW: respect showInPdf flag
      .map((f: any): [string, any] => [f.labelEs || f.label || f.name, encounter.customData![f.name]])
      .filter(([, v]) => v !== undefined && v !== null && v !== '')
  : Object.entries(encounter.customData).filter(([, v]) => v !== undefined && v !== null && v !== '');
```

### 5. API Endpoint

**File:** `apps/doctor/src/app/api/doctor/pdf-settings/route.ts`

Following the same pattern as `api/doctor/booking-field-settings/route.ts`:

```
GET   /api/doctor/pdf-settings  -> Returns current pdfSettings (or defaults if null)
PATCH /api/doctor/pdf-settings  -> Saves pdfSettings JSON to doctor record
```

Uses `PATCH` (not PUT) to match existing API patterns. Server-side validation:
- `topMarginMm` and `bottomMarginMm` must be numbers between 0 and 80
- All boolean fields must be booleans

### 6. Add toggle in FormBuilder ConfigPanel

**File:** `apps/doctor/src/components/form-builder/ConfigPanel.tsx`

Add a checkbox to the field properties sidebar:

```
Propiedades de [field type]
  ...existing fields...

  PDF
  [x] Mostrar en PDF
```

When unchecked, sets `showInPdf: false` on the `FieldDefinition`. Default is `true` (show all fields).

This is the most intuitive UX: the doctor toggles PDF visibility per field while designing the template, not in a separate settings dialog.

### 7. UI: PDF Settings Dialog (doctor-level)

**File:** `apps/doctor/src/components/medical-records/PdfSettingsDialog.tsx`

A dialog accessible from the encounter detail page, next to the PDF button. Contains **only paper/layout settings** (not custom field toggles -- those are in FormBuilder):

```
+------------------------------------------+
|  Configuracion de Impresion PDF           |
|                                           |
|  Encabezado y Pie de Pagina               |
|  [x] Mostrar encabezado (barra azul)     |
|  [x] Mostrar pie de pagina (tusalud.pro) |
|  [x] Mostrar numeros de pagina           |
|                                           |
|  Margenes para Papel Membretado           |
|  Margen superior: [____] mm  (0-80)      |
|  Margen inferior: [____] mm  (0-80)      |
|                                           |
|  Secciones del Documento                  |
|  [x] Datos del paciente                   |
|  [x] Tipo de consulta                     |
|  [x] Signos vitales                       |
|  [x] Seguimiento                          |
|                                           |
|        [Vista Previa]  [Guardar]          |
+------------------------------------------+
```

**Behavior:**
- Settings loaded from API on dialog open (lazy -- not on page mount)
- "Vista Previa" generates PDF in-memory and opens in new tab via `doc.output('bloburl')`
- "Guardar" saves to database via PATCH
- Dialog opens via gear icon next to PDF button

### 8. Wire Into Encounter Detail Flow

**File:** `apps/doctor/src/app/dashboard/medical-records/patients/[id]/encounters/_components/useEncounterDetail.ts`

- Add state: `pdfSettings`, `showPdfSettingsDialog`
- **Lazy-load**: fetch PDF settings only when doctor clicks PDF button or opens settings dialog (not on page mount)
- Pass `pdfSettings` to `generateEncounterPDF(encounter, customTemplate, pdfSettings)`

**File:** `apps/doctor/src/app/dashboard/medical-records/patients/[id]/encounters/[encounterId]/page.tsx`

Current buttons:
```
[PDF] [Editar] [Eliminar]
```

New buttons:
```
[PDF] [gear icon] [Editar] [Eliminar]
```

Gear icon opens `<PdfSettingsDialog>`.

---

## Scope

### Phase 1: Encounter PDF
Single encounter PDF (`generateEncounterPDF`) + FormBuilder `showInPdf` toggle.

### Phase 2: Prescription PDF
Prescription PDF (`handleDownloadPDF` in `usePrescriptionDetail`) with `rx*` settings. See [Phase 2 section](#phase-2-prescription-pdf-settings-2026-05-04) below.

## Encounter PDF Scope

`generateTimelinePDF` is a summary view with a different structure (inline vitals per encounter, patient summary box instead of patient detail box). Applying PDF settings to it would require significant rework for limited benefit -- doctors rarely print timelines on letterhead.

**V1 scope:** `generateEncounterPDF` only.
**Future:** Timeline PDF settings if requested.

---

## Files Created/Modified

| File | Action | Description |
|------|--------|-------------|
| `packages/database/prisma/schema.prisma` | Done (prior) | `pdfSettings Json?` on Doctor model (line 167) |
| `packages/database/prisma/migrations/add-pdf-settings-to-doctors.sql` | Done (prior) | SQL migration — executed against local DB |
| `apps/doctor/src/types/pdf-settings.ts` | Created | PdfSettings interface + DEFAULT_PDF_SETTINGS |
| `apps/doctor/src/types/custom-encounter.ts` | Modified | Added `showInPdf?: boolean` to FieldDefinition |
| `apps/doctor/src/lib/pdf/encounter-pdf.ts` | Modified | Accepts PdfSettings, wraps sections in conditionals, filters custom fields by showInPdf, dynamic page break thresholds |
| `apps/doctor/src/app/api/doctor/pdf-settings/route.ts` | Created | GET/PATCH with boolean + number validation (0-80mm), merges with existing settings |
| `apps/doctor/src/components/medical-records/PdfSettingsDialog.tsx` | Created | Settings dialog with toggles, margin inputs, save/preview buttons |
| `apps/doctor/src/components/form-builder/ConfigPanel.tsx` | Modified | Added "Mostrar en PDF" checkbox in field properties sidebar |
| `apps/doctor/src/app/dashboard/.../useEncounterDetail.ts` | Modified | Lazy-loads PDF settings on first PDF click, caches result, exposes dialog state |
| `apps/doctor/src/app/dashboard/.../[encounterId]/page.tsx` | Modified | Added Settings icon button next to PDF + PdfSettingsDialog component |

---

## Execution Order

1. ~~Run SQL migration against local database~~ Done
2. ~~Run `pnpm db:generate` to regenerate Prisma client~~ Done
3. ~~Create `types/pdf-settings.ts`~~ Done
4. ~~Add `showInPdf` to `FieldDefinition` in `types/custom-encounter.ts`~~ Done
5. ~~Create `api/doctor/pdf-settings/route.ts`~~ Done
6. ~~Update `encounter-pdf.ts` (accept PdfSettings + filter showInPdf)~~ Done
7. ~~Add toggle to `ConfigPanel.tsx` in FormBuilder~~ Done
8. ~~Create `PdfSettingsDialog.tsx`~~ Done
9. ~~Update `useEncounterDetail.ts` and encounter detail page~~ Done
10. Test locally with both standard and custom template encounters
11. Run SQL migration against Railway (**before** deploying code)
12. Deploy

### Code Review

All 8 checklist sections passed (2026-05-04):
- DB/Schema/Migration: `pdfSettings Json?` matches `ADD COLUMN IF NOT EXISTS "pdf_settings" JSONB`
- API: auth before DB, consistent response shape, boolean + number validation, merge-on-PATCH
- Hook: lazy-load with cache, settings passed to PDF generator, new state exposed
- Dialog: all props used, onSettingsLoaded updates parent correctly
- PDF: all sections conditional, dynamic thresholds, showInPdf filter, correct mm units (no conversion)
- ConfigPanel: `showInPdf !== false` default, correct handler
- Page: Settings icon + dialog wired correctly
- Cross-cutting: types consistent, no hardcoded values, route names match patterns

---

## Example Scenarios

### Scenario 1: Standard encounter on pre-printed paper

Dr. Garcia has paper with a 3cm header (clinic logo) and 2cm footer (address).

**Doctor-level settings:**
```json
{
  "showHeader": false,
  "showFooter": false,
  "showPageNumbers": true,
  "topMarginMm": 30,
  "bottomMarginMm": 20,
  "showPatientBox": true,
  "showEncounterMeta": true,
  "showVitals": true,
  "showFollowUp": true
}
```

**Result:** PDF starts content 30mm from top, no blue bar, no "tusalud.pro" footer, page numbers still appear, bottom 20mm reserved blank.

### Scenario 2: Custom dermatology template

Dr. Lopez created a "Dermatologia" custom template with fields:
- Tipo de Lesion (dropdown) -- `showInPdf: true`
- Ubicacion (text) -- `showInPdf: true`
- Notas Internas (textarea) -- `showInPdf: false` (private notes, not for patient)
- Fotografias Referencia (file) -- `showInPdf: false` (files can't render in PDF)

**Doctor-level settings:** all defaults (full header/footer, no extra margins).

**Result:** PDF shows header, patient box, "Tipo de Lesion" and "Ubicacion" values, but skips "Notas Internas" and "Fotografias Referencia".

### Scenario 3: Custom template on pre-printed paper

Dr. Ramirez uses pre-printed paper AND a custom "Seguimiento Diabetes" template with fields where some are marked `showInPdf: false`.

**Both layers apply:**
- Doctor-level: no header, 25mm top margin, no footer
- Field-level: only fields with `showInPdf !== false` appear

---

## Corrections from V1 Plan

| Issue | V1 (wrong) | V2 (correct) |
|-------|-----------|--------------|
| Unit conversion | `topMarginMm * 2.835` (mm to pt) | Use `topMarginMm` directly (jsPDF defaults to mm) |
| API method | PUT | PATCH (matches existing patterns) |
| Settings fetch | On page mount | Lazy-load on PDF click or dialog open |
| Custom template support | Not addressed | `showInPdf` on FieldDefinition + filter in PDF |
| Margin validation | None | Clamp 0-80mm server-side and client-side |
| Timeline PDF | "Same changes apply" | Out of scope for V1 |
| Preview button | No implementation detail | `doc.output('bloburl')` opened in new tab |

---

## Phase 2: Prescription PDF Settings (2026-05-04)

Extended the same `pdfSettings` JSONB column with `rx*`-prefixed fields for prescription PDFs. No new migration needed — the fields are stored in the same JSON object.

### New rx* fields added to PdfSettings

```typescript
// Added to PdfSettings interface in types/pdf-settings.ts
rxShowHeader: boolean;      // RECETA MÉDICA header bar
rxShowFooter: boolean;      // Doctor name + signature footer
rxShowPatientBox: boolean;  // Patient info box
rxShowDiagnosis: boolean;   // Diagnosis line
rxShowClinicalNotes: boolean; // Clinical notes section
rxTopMarginMm: number;      // 0-80mm top margin
rxBottomMarginMm: number;   // 0-80mm bottom margin
```

### Files Created/Modified (Phase 2)

| File | Action | Description |
|------|--------|-------------|
| `apps/doctor/src/types/pdf-settings.ts` | Modified | Added `rx*` fields to interface + defaults |
| `apps/doctor/src/app/api/doctor/pdf-settings/route.ts` | Modified | Added `rx*` keys to BOOLEAN_KEYS and NUMBER_KEYS validation arrays |
| `apps/doctor/src/components/medical-records/PrescriptionPdfSettingsDialog.tsx` | Created | Settings dialog for prescription PDF (sends only `rx*` fields in PATCH) |
| `apps/doctor/src/app/dashboard/.../usePrescriptionDetail.ts` | Modified | Added `pdfSettings` state, `fetchPdfSettings()` with caching, conditional PDF sections using `rx` settings, parallel fetch with `Promise.all` |
| `apps/doctor/src/app/dashboard/.../.../[prescriptionId]/page.tsx` | Modified | Added Settings gear icon next to "Descargar PDF" (only when `status === 'issued'`), wired PrescriptionPdfSettingsDialog |

### Design Notes

- **Separation of concerns:** `PrescriptionPdfSettingsDialog` only sends `rx*` fields in its PATCH body, so it never overwrites encounter settings in the same JSONB column
- **Parallel fetching:** `handleDownloadPDF` fetches template settings (`/api/prescription-template`) and PDF settings (`/api/doctor/pdf-settings`) in parallel via `Promise.all`
- **Conditional sections:** Header, patient box, diagnosis, clinical notes, and footer all wrapped in `if (rx.show*)` conditionals with dynamic Y positioning
- **Dynamic layout:** `footerY = pageH - footerH - rx.bottomMarginMm`, `maxContentY = footerY - 6`, `topReset = rx.topMarginMm + 14`

### Code Review (Phase 2)

All sections passed (2026-05-04):
- DB/Schema: No new columns — reuses existing `pdf_settings` JSONB
- API: `rx*` keys added to existing validation arrays, auth unchanged
- Hook: lazy-load with cache, `Promise.all` parallel fetch, rx settings extracted with fallback defaults
- Dialog: all 3 props used, only sends rx* fields in PATCH
- Page: Settings icon conditionally shown for `issued` prescriptions
- Cross-cutting: `rx` prefix convention cleanly separates prescription from encounter settings

---

## Future Enhancements

- Per-template PDF overrides on `EncounterTemplate.pdfSettings` (e.g., one template always hides vitals in PDF)
- Custom header text (replace "CONSULTA MEDICA" with doctor's clinic name)
- Doctor logo/signature image in PDF header
- Paper size selection (Letter vs A4)
- Font size preferences
- Timeline PDF settings
- PDF field reordering (different order than form)
