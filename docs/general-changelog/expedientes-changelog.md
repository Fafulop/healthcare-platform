# Expedientes (Medical Records) — Refactor Changelog

## What is the Expedientes section?

The **Expedientes** (Medical Records) module is the core clinical workspace of the `apps/doctor` app at `tusalud.pro`. It allows doctors to manage the full lifecycle of patient care:

- **Patients** (`/dashboard/medical-records/patients`) — create and manage patient profiles: demographics, allergies, chronic conditions, medications, blood type, emergency contacts. Each patient has a timeline of all their encounters.
- **Encounters** (`patients/[id]/encounters`) — clinical consultations. Each encounter captures SOAP notes (subjective, objective, assessment, plan), vitals, encounter type, follow-up date, and supports custom templates with user-defined fields. Encounters have a full version history. Voice assistant and Chat IA can pre-fill encounter fields.
- **Prescriptions** (`patients/[id]/prescriptions`) — create, issue, edit, cancel, and download PDF prescriptions. Each prescription has one or more medications. Voice assistant and Chat IA can pre-fill prescription fields.
- **Encounter Templates** (`/templates` and `/custom-templates`) — doctors can define reusable templates with custom fields for their specialty (e.g. dermatology, cardiology). Used when creating encounters to pre-configure available fields.

The module is tightly integrated with the voice assistant (transcription → form population) and the Chat IA panel (LLM field suggestions). It runs entirely within the doctor's authenticated session (`useSession` + NextAuth v5).

---

## Refactor — Date: 2026-03-10

### Goal
Refactor `apps/doctor/src/app/dashboard/medical-records/` to improve code efficiency by extracting hooks and components — no behavioral changes, no new features.

### Results
- **20 new files created** across 5 `_components/` folders
- **10 page files slimmed** — approximately **2,800 lines removed** from page components
- All native `alert()` / `confirm()` calls replaced with `toast.error()` / `practiceConfirm()` throughout the section
- Fixed a `'${API_URL}'` literal bug in `patients/new/page.tsx` (was using an un-interpolated string as a fallback)
- Shared utility functions (`calculateAge`, `formatDateTime`) added to `@/lib/practice-utils` and deduplicated across 6+ files

### Pattern
Same approach used in practice management:
- Create `_components/` folder per section
- Extract a custom hook per page (state, logic, fetching, handlers)
- Keep pages as thin shells that import and wire up hooks
- Work one file at a time

---

## Phase 1 — Shared Utilities

### Step 1.1 — `apps/doctor/src/lib/practice-utils.ts`
**Added two new exports:**
- `calculateAge(dateOfBirth: string): number` — extracted from `patients/[id]/page.tsx` (was duplicated locally)
- `formatDateTime(dateString: string): string` — extracted from `encounters/[encounterId]/page.tsx` (was duplicated locally)

**Already present (now available to all medical-records hooks):**
- `fetchDoctorProfile` — was being re-declared locally in 6 different medical-records files
- `formatDateLong` — was being re-declared as local `formatDate` in 3 files
- `PracticeDoctorProfile` — was being re-declared as local `DoctorProfile` in 6 files

---

## Phase 2 — Prescriptions

### Files created

#### `patients/[id]/prescriptions/_components/prescription-types.ts`
Shared types and pure functions for all 3 prescription pages:
- `PrescriptionDetails` interface — full shape used by detail + edit pages
- `getStatusLabel(status: string): string` — moved from `[prescriptionId]/page.tsx`
- `getStatusColor(status: string): string` — moved from `[prescriptionId]/page.tsx`
- `validateMedications(medications: Medication[]): string | null` — shared validation logic, previously duplicated in `new/page.tsx` and `edit/page.tsx`

#### `patients/[id]/prescriptions/_components/useNewPrescriptionForm.ts`
Extracts all logic from `prescriptions/new/page.tsx`:
- All form state: `prescriptionDate`, `diagnosis`, `clinicalNotes`, `doctorFullName`, `doctorLicense`, `expiresAt`, `medications`
- Patient + encounters fetch (`fetchPatient`)
- Doctor profile fetch via `fetchDoctorProfile` from `practice-utils`
- Voice modal state + `handleModalComplete`
- Voice sidebar state + `handleVoiceConfirm`
- sessionStorage load effect (`?voice=true`)
- Chat IA state: `chatPanelOpen`, `currentFormData` (useMemo), `handleChatFieldUpdates`, `handleChatMedicationUpdates`
- `handleSubmit` — includes **medication rollback logic** (deletes orphaned prescription if any medication POST fails) — copied verbatim, not restructured

> ⚠️ HIGH RISK: medication rollback in `handleSubmit` preserved exactly as original

#### `patients/[id]/prescriptions/_components/useEditPrescriptionForm.ts`
Extracts all logic from `prescriptions/[prescriptionId]/edit/page.tsx`:
- All form state (same fields, no voice/chat)
- Prescription fetch + form population (`fetchPrescription`)
- Doctor profile fetch via `practice-utils`
- `handleSubmit` — includes **medication replace sequence** (DELETE all existing → POST new ones sequentially) — copied verbatim

> ⚠️ HIGH RISK: medication replace sequence (DELETE old → POST new) preserved exactly as original

#### `patients/[id]/prescriptions/_components/usePrescriptionDetail.ts`
Extracts all logic from `prescriptions/[prescriptionId]/page.tsx`:
- Prescription fetch
- Doctor profile fetch via `practice-utils`
- `handleIssue` — `confirm()` replaced with `practiceConfirm()`
- `handleCancel` — cancel modal state + submit
- `handleDelete` — `confirm()` replaced with `practiceConfirm()`
- `handleDownloadPDF`
- Cancel modal state: `showCancelModal`, `cancellationReason`

### Files modified

| File | Before | After | Notes |
|------|--------|-------|-------|
| `prescriptions/new/page.tsx` | 696 lines | ~230 lines | Uses `useNewPrescriptionForm` |
| `prescriptions/[id]/edit/page.tsx` | 395 lines | ~170 lines | Uses `useEditPrescriptionForm` |
| `prescriptions/[id]/page.tsx` | 497 lines | ~220 lines | Uses `usePrescriptionDetail`; `formatDate` → `formatDateLong`; `confirm()` → `practiceConfirm()` |

---

---

## Phase 3 — Encounters

### Files created

#### `patients/[id]/encounters/_components/encounter-types.ts`
- `Encounter` interface — full shape used by detail + versions pages
- `Version` interface — versions history shape
- `getEncounterTypeLabel(type: string): string` — moved from `[encounterId]/page.tsx`

#### `patients/[id]/encounters/_components/useNewEncounterPage.ts`
Extracts all logic from `encounters/new/page.tsx`:
- Doctor profile fetch via `practice-utils`
- Template state + `handleTemplateSelect`
- Voice modal state + `handleModalComplete`
- Voice sidebar state + `handleVoiceConfirm`
- sessionStorage load effect (`?voice=true`)
- Chat panel state: `chatPanelOpen`, `currentFormData`, `currentCustomFieldValues`, `chatFieldUpdates`, `chatCustomFieldUpdates`
- `chatTemplateInfo` + `templateConfig` computed values
- `handleChatUpdateForm` + `handleChatUpdateCustomFields` — **HIGH RISK**: `chatVersionRef.current += 1` + paired `setState` calls preserved verbatim in each handler
- `trackTemplateUsage`, `handleSubmit`

> ⚠️ HIGH RISK: `chatVersionRef` versioning pattern drives `EncounterForm` reconciliation — preserved exactly

#### `patients/[id]/encounters/_components/EncounterVitalsCard.tsx`
Self-contained vitals grid component. Props: 7 vitals fields from `Encounter`. Returns `null` if no vitals present.

#### `patients/[id]/encounters/_components/EncounterSOAPCard.tsx`
Self-contained SOAP notes component. Props: `subjective`, `objective`, `assessment`, `plan`. Returns `null` if all empty.

#### `patients/[id]/encounters/_components/useEncounterDetail.ts`
Extracts all logic from `[encounterId]/page.tsx`:
- `fetchEncounter` + `fetchCustomTemplate`
- Doctor profile fetch via `practice-utils`
- `handleDelete` — `confirm()` replaced with `practiceConfirm()`
- `formatDate` → `formatDateLong` from `practice-utils`
- `formatDateTime` → `formatDateTime` from `practice-utils`
- `getEncounterTypeLabel` → from `encounter-types.ts`

#### `patients/[id]/encounters/_components/useEncounterVersions.ts`
Extracts all logic from `versions/page.tsx`:
- `fetchVersions`, `selectedVersion` state
- `formatDate` → `formatDateTime` from `practice-utils`
- `doctorProfile` was fetched but never used in JSX — dropped

### Files modified

| File | Before | After | Notes |
|------|--------|-------|-------|
| `encounters/new/page.tsx` | 440 lines | ~140 lines | Uses `useNewEncounterPage` |
| `encounters/[encounterId]/page.tsx` | 469 lines | ~190 lines | Uses `useEncounterDetail`; vitals → `EncounterVitalsCard`; SOAP → `EncounterSOAPCard`; `confirm()` → `practiceConfirm()` |
| `encounters/[encounterId]/versions/page.tsx` | 352 lines | ~190 lines | Uses `useEncounterVersions`; `formatDateTime` from `practice-utils` |

---

## Phase 4 — Patient Profile

### Files created

#### `patients/_components/patient-types.ts`
- `Patient` interface — full shape including `encounters: Encounter[]`

#### `patients/_components/usePatientProfile.ts`
Extracts all logic from `patients/[id]/page.tsx`:
- `fetchPatient`
- `handleArchive` — `confirm()` replaced with `practiceConfirm()`
- `calculateAge` + `formatDate` imported from `practice-utils` (no local re-declaration)

#### `patients/_components/useNewPatientPage.ts`
Extracts all logic from `patients/new/page.tsx`:
- Doctor profile fetch via `fetchDoctorProfile` from `practice-utils` (fixes original `'${API_URL}'` literal bug)
- Voice modal state + `handleModalComplete`
- Voice sidebar state + `handleVoiceConfirm`
- sessionStorage load effect (`?voice=true`)
- Auto-open chat effect (`?chat=true`)
- Chat panel state: `chatPanelOpen`, `currentFormSnapshot`, `chatFieldUpdates`, `chatFieldUpdatesVersion`
- `chatFormData` useMemo (20-field snapshot)
- `handleChatFieldUpdates`, `handleSubmit`

### Files modified

| File | Before | After | Notes |
|------|--------|-------|-------|
| `patients/[id]/page.tsx` | 413 lines | ~190 lines | Uses `usePatientProfile`; `confirm()` → `practiceConfirm()` |
| `patients/new/page.tsx` | 380 lines | ~115 lines | Uses `useNewPatientPage`; `'${API_URL}'` literal bug fixed |

---

## Phase 5 — Templates

### Files created

#### `templates/_components/useTemplatesPage.ts`
Extracts all logic from `templates/page.tsx`:
- `fetchTemplates`
- `handleDelete` — `alert()` → `toast.error()`; `confirm()` → `practiceConfirm()`
- `handleSetDefault` — `alert()` → `toast.error()`
- State: `templates`, `loading`, `error`, `deletingId`, `openMenuId`

#### `templates/_components/TemplateCard.tsx`
Extracts the per-template card (icon + info + actions dropdown) from `templates/page.tsx`.
Includes `renderIcon` helper (uses `ICON_COMPONENTS` + `getColorClasses`).
Props: `template`, `deletingId`, `openMenuId`, `onOpenMenu`, `onSetDefault`, `onDelete`.

#### `custom-templates/_components/useCustomTemplatesPage.ts`
Extracts all logic from `custom-templates/page.tsx`:
- `fetchTemplates`
- `handleDelete` — `alert()` → `toast.error()`
- `handleSetDefault` — `alert()` → `toast.error()`
- State: `templates`, `loading`, `error`, `deleteConfirm`
- Dropped unused `useRouter` import from original

### Files modified

| File | Before | After | Notes |
|------|--------|-------|-------|
| `templates/page.tsx` | 316 lines | ~110 lines | Uses `useTemplatesPage` + `TemplateCard` |
| `custom-templates/page.tsx` | 306 lines | ~155 lines | Uses `useCustomTemplatesPage`; `alert()` → `toast.error()` |

---

## Summary — All Phases Complete

### Total files modified: 10 pages slimmed
### Total new files created: 20

| Section | New files | Pages slimmed |
|---------|-----------|---------------|
| Shared utils | — | `practice-utils.ts` (+2 exports) |
| Prescriptions | 4 | 3 pages |
| Encounters | 6 | 3 pages |
| Patients | 3 | 2 pages |
| Templates | 3 | 2 pages |

### alert()/confirm() replacements completed
All native `alert()`/`confirm()` calls replaced in this section:
- `templates/page.tsx` — 2x alert → `toast.error()`, 1x confirm → `practiceConfirm()`
- `custom-templates/page.tsx` — 2x alert → `toast.error()`
- `encounters/[encounterId]/page.tsx` — 1x confirm → `practiceConfirm()`
- `prescriptions/[prescriptionId]/page.tsx` — 2x confirm → `practiceConfirm()`
- `patients/[id]/page.tsx` — 1x confirm → `practiceConfirm()`

---

## Bug Audit & Fixes — Date: 2026-03-10

### Goal
Full audit of the `medical-records` section after the refactor to find bugs and inconsistencies introduced or pre-existing.

### Bugs found and fixed

#### 1. Native `confirm()` in `prescriptions/page.tsx`
The prescriptions list page was not refactored and still used `confirm()` in `handleDelete`.
- Replaced with `await practiceConfirm()`; added `practiceConfirm` import.

#### 2. Dead doctor profile fetch in `prescriptions/page.tsx`
The page fetched `doctorProfile` via a custom local `fetchDoctorProfile()` calling `${API_URL}/api/doctors` with a **hardcoded `http://localhost:4000` fallback**. The fetched profile was never referenced anywhere in JSX — 100% dead code, wasting a network request on every page load.
- Removed: `API_URL` constant, local `DoctorProfile` interface, `doctorProfile` state, `fetchDoctorProfile` function, and the `useEffect` that triggered it.
- `data: session` → `status` only in `useSession` destructure.

#### 3. Dead `doctorProfile` fetch in `useEncounterDetail.ts`
Hook fetched and returned `doctorProfile` via `fetchDoctorProfile` from `practice-utils`, but the page never destructured it and no component consumed it.
- Removed: `doctorProfile` state, `useEffect`, `fetchDoctorProfile`/`PracticeDoctorProfile` import, and the field from the return object.
- `data: session` → `status` only.

#### 4. Dead `doctorProfile` fetch in `usePrescriptionDetail.ts`
Same pattern — hook fetched and returned `doctorProfile`, but the prescription detail page reads doctor name/license directly from `prescription.doctorFullName` / `prescription.doctorLicense` (embedded in the API response). The fetch was never needed.
- Removed: `doctorProfile` state, `useEffect`, `fetchDoctorProfile`/`PracticeDoctorProfile` import, and the field from the return object.
- `data: session` → `status` only.

#### 5. Dead doctor profile fetch in `encounters/[encounterId]/edit/page.tsx`
Same pattern as above — unrefactored page with local `fetchDoctorProfile` using `API_URL || 'http://localhost:4000'`. `doctorProfile` was stored in state but never passed to any component.
- Removed: `API_URL` constant, `DoctorProfile` interface, `doctorProfile` state, `fetchDoctorProfile` function, and its `useEffect`.
- `data: session` → `status` only.

#### 6. Dead doctor profile fetch in `patients/[id]/timeline/page.tsx`
Same pattern. Additionally had a local `calculateAge` duplicate.
- Removed: `API_URL`, `DoctorProfile`, dead fetch/effect.
- Replaced local `calculateAge` with import from `@/lib/practice-utils`.

#### 7. Dead doctor profile fetch + `alert()` in `patients/[id]/media/page.tsx`
Same dead fetch pattern. Additionally had a native `alert()` in `fetchData` error handler, and an unused `useRouter` import/variable.
- Removed: `API_URL`, `DoctorProfile`, dead fetch/effect, unused `useRouter` import, unused `router` variable.
- `alert()` → `toast.error()`; added `toast` import from `@/lib/practice-toast`.

#### 8. Dead doctor profile fetch + `alert()` in `patients/[id]/media/upload/page.tsx`
Same dead fetch pattern. Also had a native `alert()` in `fetchPatient` error handler.
- Removed: `API_URL`, `DoctorProfile`, dead fetch/effect.
- `alert()` → `toast.error()`; added `toast` import from `@/lib/practice-toast`.

### Files modified

| File | Changes |
|------|---------|
| `prescriptions/page.tsx` | `confirm()` → `practiceConfirm()`; removed dead doctorProfile fetch + hardcoded URL |
| `prescriptions/_components/usePrescriptionDetail.ts` | Removed dead doctorProfile fetch |
| `encounters/_components/useEncounterDetail.ts` | Removed dead doctorProfile fetch |
| `encounters/[encounterId]/edit/page.tsx` | Removed dead doctorProfile fetch + hardcoded URL |
| `patients/[id]/timeline/page.tsx` | Removed dead doctorProfile fetch + hardcoded URL; `calculateAge` from `practice-utils` |
| `patients/[id]/media/page.tsx` | Removed dead doctorProfile fetch + hardcoded URL + unused `useRouter`; `alert()` → `toast.error()` |
| `patients/[id]/media/upload/page.tsx` | Removed dead doctorProfile fetch + hardcoded URL; `alert()` → `toast.error()` |

### Root cause
The dead `doctorProfile` pattern was copy-pasted across all pages before the refactor. Pages that were slimmed by the refactor had the fetch dropped when the hook was extracted (e.g. `useEncounterVersions.ts` explicitly dropped it). Pages not covered by the refactor (`prescriptions/page.tsx`, `edit/`, `timeline/`, `media/`, `media/upload/`) retained it.

## No remaining work — all phases complete ✓
