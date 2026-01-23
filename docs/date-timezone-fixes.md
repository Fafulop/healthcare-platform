# Date Timezone Fixes Documentation

## Problem Summary

When displaying dates in the UI, dates were appearing **one day behind** the actual date. For example, January 23, 2026 was showing as January 22, 2026.

## Root Cause

The issue stems from how JavaScript's `Date` object parses date strings:

```javascript
// PROBLEMATIC: Parses as UTC midnight
new Date("2026-01-23")  // → January 23, 2026 at 00:00:00 UTC

// In Mexico (UTC-6), UTC midnight = 6:00 PM the PREVIOUS day
// So when displayed in local time, it shows January 22, 2026
```

This affects two scenarios:
1. **Generating dates** using `toISOString()` on the server
2. **Displaying dates** using `new Date(dateString)` on the client

---

## Pattern 1: Generating Dates (Server-Side)

### Problematic Code
```javascript
// Returns UTC date, not local date
const today = new Date().toISOString().split('T')[0];
```

### Fixed Code
```javascript
// Use local date components
const now = new Date();
const year = now.getFullYear();
const month = String(now.getMonth() + 1).padStart(2, '0');
const day = String(now.getDate()).padStart(2, '0');
const today = `${year}-${month}-${day}`;
```

### Files with this pattern (need fixing):
- `apps/doctor/src/app/dashboard/practice/cotizaciones/new/page.tsx:67`
- `apps/doctor/src/app/dashboard/practice/cotizaciones/[id]/edit/page.tsx:68`
- `apps/doctor/src/app/dashboard/practice/ventas/new/page.tsx:67`
- `apps/doctor/src/app/dashboard/practice/ventas/[id]/edit/page.tsx:68`
- `apps/doctor/src/app/dashboard/practice/compras/new/page.tsx:74`
- `apps/doctor/src/app/dashboard/practice/compras/[id]/edit/page.tsx:76`
- `apps/doctor/src/app/dashboard/medical-records/patients/[id]/prescriptions/new/page.tsx:197`
- `apps/doctor/src/components/medical-records/EncounterForm.tsx:57`
- `apps/doctor/src/lib/voice-assistant/integration-example.tsx:232,259`
- `apps/doctor/src/app/dashboard/medical-records/patients/[id]/encounters/new/page.tsx:23`

### Already Fixed:
- `apps/doctor/src/app/dashboard/practice/flujo-de-dinero/new/page.tsx:69` ✅

---

## Pattern 2: Displaying Dates (Client-Side)

### Problematic Code
```javascript
// Parses as UTC, displays wrong in local timezone
{new Date(dateString).toLocaleDateString('es-MX')}
```

### Fixed Code
```javascript
// Parse date components directly without UTC conversion
function formatDate(dateStr: string): string {
  try {
    const [year, month, day] = dateStr.split('-').map(Number);
    if (year && month && day) {
      const date = new Date(year, month - 1, day); // month is 0-indexed
      return date.toLocaleDateString('es-MX');
    }
    return dateStr;
  } catch {
    return dateStr;
  }
}

// Usage
{formatDate(dateString)}
```

### Already Fixed:
- `apps/doctor/src/components/voice-assistant/chat/StructuredDataPreview.tsx:338-347` ✅
- `apps/doctor/src/components/voice-assistant/chat/BatchEntryList.tsx:160` ✅

---

## Pattern 3: Server-Side with Specific Timezone (API Routes)

For API routes that need to generate dates in a specific timezone (e.g., Mexico City), use `Intl.DateTimeFormat`:

### Fixed Code (in prompts.ts)
```javascript
function getMexicoDateParts(date: Date): { year: number; month: number; day: number; dayOfWeek: number } {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Mexico_City',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(date);
  const year = parseInt(parts.find(p => p.type === 'year')?.value || '0');
  const month = parseInt(parts.find(p => p.type === 'month')?.value || '0');
  const day = parseInt(parts.find(p => p.type === 'day')?.value || '0');

  return { year, month, day, dayOfWeek };
}

function formatLocalDate(date: Date): string {
  const { year, month, day } = getMexicoDateParts(date);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
```

---

## Quick Reference

| Scenario | Wrong | Right |
|----------|-------|-------|
| Get today's date string | `new Date().toISOString().split('T')[0]` | Use local date components |
| Display a date string | `new Date(str).toLocaleDateString()` | Parse components, then create Date |
| Server needs specific TZ | `new Date()` | Use `Intl.DateTimeFormat` with `timeZone` |

---

## Testing

To verify fixes work correctly:

1. Set your system to a timezone behind UTC (e.g., Mexico City UTC-6)
2. Test around midnight UTC (6 PM in Mexico)
3. Verify dates show correctly in the UI

---

## Files Modified in This Fix

1. `apps/doctor/src/lib/voice-assistant/prompts.ts`
   - Added `getMexicoDateParts()` and `formatLocalDate()` functions
   - Updated `getUserPrompt()` and `generateDateContext()` to use Mexico timezone
   - Added date context section to LLM prompts
   - Updated examples to reference dynamic dates

2. `apps/doctor/src/app/api/voice/structure/route.ts`
   - Passes current date to `getUserPrompt()`

3. `apps/doctor/src/app/api/voice/chat/route.ts`
   - Passes current date to `getChatSystemPrompt()`

4. `apps/doctor/src/components/voice-assistant/chat/StructuredDataPreview.tsx`
   - Fixed date display formatting

5. `apps/doctor/src/components/voice-assistant/chat/BatchEntryList.tsx`
   - Added `formatDate()` helper
   - Fixed date display in batch entry list

6. `apps/doctor/src/app/dashboard/practice/flujo-de-dinero/new/page.tsx`
   - Fixed default date generation for form

7. `apps/doctor/src/app/appointments/page.tsx` ✅ (2026-01-23)
   - Added `getLocalDateString()` helper function
   - Added `formatDateString()` helper function
   - Fixed 9 instances of date timezone bugs:
     - Lines 353, 355, 360: Fixed date string generation for slot filtering
     - Lines 619, 623: Fixed calendar grid date generation and "today" highlighting
     - Line 502: Fixed booking date display in bookings table
     - Line 835: Fixed slot date display in list view

8. `apps/doctor/src/app/appointments/CreateSlotsModal.tsx` ✅ (2026-01-23)
   - Added `getLocalDateString()` helper function
   - Fixed 3 instances of date timezone bugs:
     - Line 293: Fixed min date for single date input
     - Line 309: Fixed min date for start date input
     - Line 322: Fixed min date for end date input

9. `apps/admin/src/app/appointments/page.tsx` ✅ (2026-01-23)
   - Added `getLocalDateString()` helper function
   - Added `formatDateString()` helper function
   - Fixed 3 instances of date timezone bugs:
     - Line 153: Fixed date formatting in CSV export
     - Line 171: Fixed CSV filename date generation
     - Line 368: Fixed booking date display in appointments table

## Medical Records Module Fixes ✅ (2026-01-23)

10. `apps/doctor/src/components/medical-records/TimelineView.tsx` ✅
    - Fixed `formatDate()` function to parse date components manually
    - Line 52: Fixed timeline date display

11. `apps/doctor/src/components/medical-records/PrescriptionCard.tsx` ✅
    - Fixed `formatDate()` function to parse date components manually
    - Line 25: Fixed prescription card date display

12. `apps/doctor/src/components/medical-records/EncounterCard.tsx` ✅
    - Fixed `formatDate()` function to parse date components manually
    - Line 21: Fixed encounter card date display

13. `apps/doctor/src/components/medical-records/PatientCard.tsx` ✅
    - Fixed `formatDate()` function to parse date components manually
    - Line 37: Fixed patient last visit date display

14. `apps/doctor/src/app/dashboard/medical-records/patients/[id]/page.tsx` ✅
    - Fixed `formatDate()` function to parse date components manually
    - Line 95: Fixed patient profile date display

15. `apps/doctor/src/components/medical-records/EncounterForm.tsx` ✅
    - Added `getLocalDateString()` helper function
    - Line 57: Fixed default encounter date initialization

16. `apps/doctor/src/app/dashboard/medical-records/patients/[id]/encounters/new/page.tsx` ✅
    - Added `getLocalDateString()` helper function
    - Line 23: Fixed default encounter date in voice data mapping

17. `apps/doctor/src/app/dashboard/medical-records/patients/[id]/prescriptions/new/page.tsx` ✅
    - Added `getLocalDateString()` helper function
    - Added `formatDateString()` helper function
    - Fixed 2 instances:
      - Line 197: Fixed default prescription date initialization
      - Line 528: Fixed encounter date display in dropdown

18. `apps/doctor/src/components/medical-records/MediaUploader.tsx` ✅
    - Added `formatDateString()` helper function
    - Line 306: Fixed encounter date display in dropdown

19. `apps/doctor/src/app/dashboard/medical-records/patients/[id]/prescriptions/[prescriptionId]/page.tsx` ✅
    - Fixed `formatDate()` function to parse date components manually
    - Line 216: Fixed prescription detail date display

20. `apps/doctor/src/app/dashboard/medical-records/patients/[id]/encounters/[encounterId]/page.tsx` ✅
    - Fixed `formatDate()` function to parse date components manually
    - Line 125: Fixed encounter detail date display
