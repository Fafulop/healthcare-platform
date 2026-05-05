# Plan: PDF Print Settings for Encounter Documents

**Date:** 2026-04-30
**Status:** Planned

---

## Problem

Doctors often have **pre-printed stationery** (papel membretado) with their clinic logo, name, address, and contact info already printed at the top and/or bottom of the paper. When they export an encounter PDF and print it on this paper, the PDF's own header (blue "CONSULTA MEDICA" bar) and footer ("tusalud.pro — Generado el...") overlap with the pre-printed content.

They need:
1. A way to **toggle off** the header and footer so they don't clash with the pre-printed paper
2. **Configurable blank margins** at the top/bottom to reserve space for the pre-printed areas
3. These settings saved as **defaults per doctor**, so they don't have to adjust every time
4. Control over which **sections** appear in the PDF (patient box, vitals, etc.)

---

## Current State

### PDF Generation
- **File:** `apps/doctor/src/lib/pdf/encounter-pdf.ts`
- **Library:** jsPDF (client-side generation)
- **Functions:**
  - `generateEncounterPDF(encounter, customTemplate?)` — single encounter
  - `generateTimelinePDF(encounters, patient)` — full patient history

### Current hardcoded elements
| Element | Lines | Description |
|---|---|---|
| Header bar | 70-81 | Blue rectangle (0,0 → full width, 32pt) with "CONSULTA MEDICA", date, status |
| Patient box | 84-106 | Gray rounded rect with patient name, ID, sex, age |
| Encounter meta | 108-118 | "Tipo: Seguimiento" line |
| Chief complaint | 120-127 | "Motivo de Consulta" section |
| Vitals | 129-159 | "Signos Vitales" section with blue box |
| SOAP notes | 161-190 | Color-coded S/O/A/P sections |
| Clinical notes | 192-199 | Free text notes (only when no SOAP) |
| Custom data | 201-228 | Custom template fields |
| Follow-up | 230-261 | "Seguimiento" section with date |
| Footer | 263-272 | "tusalud.pro — Generado el..." + page numbers on every page |

### Existing template system
- `EncounterTemplate` model in Prisma (medical_records schema)
- Has `fieldVisibility` JSON for controlling which **form fields** to show during data entry
- Does NOT currently control PDF output — only the encounter form UI

---

## Proposed Solution

### 1. Database: Add `pdf_settings` to Doctor model

Add a single `JSONB` column to the `doctors` table:

```prisma
// In Doctor model (schema.prisma)
pdfSettings  Json?  @map("pdf_settings")
```

**SQL migration** (`packages/database/prisma/migrations/add-pdf-settings-to-doctors.sql`):
```sql
ALTER TABLE public.doctors
  ADD COLUMN IF NOT EXISTS "pdf_settings" JSONB;
```

Already added to schema.prisma and migration file created — needs to be executed.

### 2. TypeScript: PdfSettings interface

**File:** `apps/doctor/src/types/pdf-settings.ts`

```typescript
export interface PdfSettings {
  // Header & Footer
  showHeader: boolean;        // Blue bar with "CONSULTA MEDICA" + date + status
  showFooter: boolean;        // "tusalud.pro — Generado el..." line
  showPageNumbers: boolean;   // "Pagina X de Y"

  // Margins (mm) — extra blank space for pre-printed letterhead
  topMarginMm: number;        // Default: 0 (no extra margin beyond the 14pt standard)
  bottomMarginMm: number;     // Default: 0

  // Section visibility
  showPatientBox: boolean;    // Patient name/ID/sex/age box
  showEncounterMeta: boolean; // "Tipo: Seguimiento" line
  showVitals: boolean;        // Vitals section
  showFollowUp: boolean;      // Follow-up section
}
```

**Default values** (when `pdfSettings` is null):
```typescript
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

### 3. Update PDF Generation

Modify `generateEncounterPDF` signature:

```typescript
export async function generateEncounterPDF(
  encounter: any,
  customTemplate?: any | null,
  pdfSettings?: PdfSettings | null,  // NEW
): Promise<void>
```

Changes inside the function:
- **Header (lines 70-82):** Wrap in `if (settings.showHeader)`. When hidden, start content at `y = settings.topMarginMm * 2.835 + 14` (convert mm to pt) instead of `y = 40`
- **Patient box (lines 84-106):** Wrap in `if (settings.showPatientBox)`
- **Encounter meta (lines 108-118):** Wrap in `if (settings.showEncounterMeta)`
- **Vitals (lines 129-159):** Wrap in `if (settings.showVitals)`
- **Follow-up (lines 230-261):** Wrap in `if (settings.showFollowUp)`
- **Footer (lines 263-272):** Wrap in `if (settings.showFooter || settings.showPageNumbers)`. Conditionally render each part
- **Page break threshold:** Adjust based on `bottomMarginMm` — reduce the threshold by `bottomMarginMm * 2.835` so content doesn't overflow into the reserved bottom area

Same changes apply to `generateTimelinePDF`.

### 4. API Endpoint

**File:** `apps/doctor/src/app/api/doctor/pdf-settings/route.ts`

Following the same pattern as `api/doctor/booking-field-settings/route.ts`:

```
GET  /api/doctor/pdf-settings  → Returns current pdfSettings (or defaults if null)
PUT  /api/doctor/pdf-settings  → Saves pdfSettings JSON to doctor record
```

### 5. UI: PDF Settings Dialog

**File:** `apps/doctor/src/components/medical-records/PdfSettingsDialog.tsx`

A dialog/modal accessible from the encounter detail page, next to the PDF download button. Contains:

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
|  Margen superior: [____] mm               |
|  Margen inferior: [____] mm               |
|                                           |
|  Secciones del Documento                  |
|  [x] Datos del paciente                   |
|  [x] Tipo de consulta                     |
|  [x] Signos vitales                       |
|  [x] Seguimiento                          |
|                                           |
|  [Vista Previa]  [Guardar como Default]   |
+------------------------------------------+
```

**Behavior:**
- Settings are loaded from the API on mount
- Changes can be applied to the current PDF download without saving (one-time)
- "Guardar como Default" saves them to the database for future PDFs
- The dialog opens via a gear/settings icon next to the existing PDF button

### 6. Wire Into Encounter Detail Flow

**File:** `apps/doctor/src/app/dashboard/medical-records/patients/[id]/encounters/_components/useEncounterDetail.ts`

- Add state for `pdfSettings` and `showPdfSettingsDialog`
- Fetch PDF settings on mount (from `/api/doctor/pdf-settings`)
- Pass `pdfSettings` to `generateEncounterPDF(encounter, customTemplate, pdfSettings)`
- Expose dialog toggle to the page component

**File:** `apps/doctor/src/app/dashboard/medical-records/patients/[id]/encounters/[encounterId]/page.tsx`

- Add a settings icon button next to the existing PDF button
- Render `<PdfSettingsDialog>` component

---

## UI Change on Encounter Detail Page

Current buttons:
```
[PDF] [Editar] [Eliminar]
```

New buttons:
```
[PDF ▼] [Editar] [Eliminar]
      |
      +-- Descargar PDF
      +-- Configuracion de impresion...
```

Or simpler: a gear icon next to the PDF button:
```
[PDF] [⚙] [Editar] [Eliminar]
```

---

## Files to Create/Modify

| File | Action | Description |
|---|---|---|
| `packages/database/prisma/schema.prisma` | Modified | Added `pdfSettings Json?` to Doctor model |
| `packages/database/prisma/migrations/add-pdf-settings-to-doctors.sql` | Created | SQL migration for the column |
| `apps/doctor/src/types/pdf-settings.ts` | Create | PdfSettings interface + defaults |
| `apps/doctor/src/lib/pdf/encounter-pdf.ts` | Modify | Accept and use PdfSettings in both functions |
| `apps/doctor/src/app/api/doctor/pdf-settings/route.ts` | Create | GET/PUT API for doctor PDF settings |
| `apps/doctor/src/components/medical-records/PdfSettingsDialog.tsx` | Create | Settings dialog UI |
| `apps/doctor/src/app/dashboard/.../useEncounterDetail.ts` | Modify | Load PDF settings, pass to PDF generator |
| `apps/doctor/src/app/dashboard/.../[encounterId]/page.tsx` | Modify | Add settings button + dialog |

---

## Execution Order

1. Run SQL migration against local database
2. Run `pnpm db:generate` to regenerate Prisma client
3. Create `types/pdf-settings.ts`
4. Create `api/doctor/pdf-settings/route.ts`
5. Update `encounter-pdf.ts` to accept PdfSettings
6. Create `PdfSettingsDialog.tsx`
7. Update `useEncounterDetail.ts` and encounter detail page
8. Test locally
9. Run SQL migration against Railway
10. Deploy

---

## Example: Doctor with Pre-printed Letterhead

**Scenario:** Dr. Garcia has paper with a 3cm header (clinic logo + name) and 2cm footer (address + phone).

**Settings:**
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

**Result:** The PDF starts content 30mm from the top (blank area for the pre-printed logo), no blue bar, no "tusalud.pro" footer, but page numbers still appear. The bottom 20mm is reserved blank for the pre-printed address.

---

## Future Enhancements (Not in this PR)

- Per-template PDF overrides (each custom template could have its own PDF settings)
- Custom header text (replace "CONSULTA MEDICA" with doctor's own clinic name)
- Doctor logo/signature in the PDF header
- Paper size selection (Letter vs A4)
- Font size preferences
