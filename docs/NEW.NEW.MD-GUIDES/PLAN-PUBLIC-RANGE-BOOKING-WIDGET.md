# Plan: Wire RangeBookingWidget into Public App

## Status: IMPLEMENTED — 2026-04-25

---

## 1. Context

The RangeBookingWidget (`apps/public/src/components/doctor/RangeBookingWidget.tsx`) was built in Phase 1 but never wired into the public doctor profile pages. Currently the public app hardcodes `BookingWidget` (slot-based) everywhere. Doctors using range-based scheduling have no public booking flow.

### Goal

Patients visiting a doctor's public profile should see the correct booking widget based on the doctor's scheduling system:
- **Ranges exist** → RangeBookingWidget (service-first flow)
- **No ranges** → BookingWidget (legacy slot-based flow)

---

## 2. Detection Strategy: Count-Based (No DB Migration)

Instead of adding a `schedulingMode` flag to the Doctor model (which requires a migration), detect dynamically by checking if the doctor has any `AvailabilityRange` records.

```
if (doctor has AvailabilityRange records) → RangeBookingWidget
else → BookingWidget (legacy)
```

This means:
- The 3 test doctors who already have ranges automatically get the new flow
- All other doctors stay on slots with zero risk
- No migration, no manual flag-setting
- When a doctor creates their first range, they automatically switch to the new flow

---

## 3. Key Differences Between Widgets

| Aspect | BookingWidget (slots) | RangeBookingWidget (ranges) |
|--------|----------------------|----------------------------|
| Flow order | Date → Time → Service → Form | **Service → Date → Time → Form** |
| Availability API | `GET /api/doctors/[slug]/availability?month=` | `GET /api/doctors/[slug]/range-availability?serviceId=&month=` |
| Booking API | `POST /api/appointments/bookings` (requires `slotId`) | `POST /api/appointments/range-bookings` (requires `doctorId`, `date`, `startTime`) |
| Service selection | Optional, after time | **Required, step 1** (duration needed for gap calculation) |

---

## 4. Files to Modify

### 4.1 `apps/api/src/app/api/doctors/[slug]/route.ts`

Add a `hasRanges` boolean to the doctor response:

```typescript
// After fetching doctor, count ranges
const rangeCount = await prisma.availabilityRange.count({
  where: { doctorId: doctor.id },
});

// Include in response
return { ...doctor, hasRanges: rangeCount > 0 };
```

### 4.2 `apps/public/src/types/doctor.ts`

Add to the DoctorProfile type:

```typescript
hasRanges?: boolean;
```

### 4.3 `apps/public/src/components/doctor/DynamicSections.tsx`

Currently:
```typescript
export const DynamicBookingWidget = dynamic(
  () => import('./BookingWidget'),
  { ssr: false, loading: <Skeleton /> }
);
```

Change to conditionally load based on a prop or create two exports:
```typescript
export const DynamicBookingWidget = dynamic(
  () => import('./BookingWidget'),
  { ssr: false, loading: <Skeleton /> }
);

export const DynamicRangeBookingWidget = dynamic(
  () => import('./RangeBookingWidget'),
  { ssr: false, loading: <Skeleton /> }
);
```

### 4.4 `apps/public/src/components/doctor/DoctorProfileClient.tsx`

Pass `hasRanges` from doctor data. Render `DynamicRangeBookingWidget` or `DynamicBookingWidget` based on the flag.

Sidebar (desktop):
```typescript
{doctor.hasRanges
  ? <DynamicRangeBookingWidget doctorSlug={doctor.slug} ... />
  : <DynamicBookingWidget doctorSlug={doctor.slug} ... />
}
```

### 4.5 `apps/public/src/components/doctor/BookingModal.tsx`

Same conditional logic for the mobile modal:
```typescript
{hasRanges
  ? <RangeBookingWidget doctorSlug={doctorSlug} ... />
  : <BookingWidget doctorSlug={doctorSlug} ... />
}
```

---

## 5. Implementation Order

```
1. Add hasRanges to doctor API response          [API modify]
2. Add hasRanges to DoctorProfile type           [Type modify]
3. Add DynamicRangeBookingWidget export           [DynamicSections modify]
4. Wire conditional rendering in DoctorProfileClient  [Page modify]
5. Wire conditional rendering in BookingModal     [Component modify]
6. Test: doctor WITH ranges → sees RangeBookingWidget
7. Test: doctor WITHOUT ranges → sees BookingWidget (unchanged)
8. Test: full booking flow through RangeBookingWidget
```

---

## 6. Verification

1. Visit a doctor profile that HAS ranges → should see service-first booking flow
2. Visit a doctor profile that has NO ranges → should see classic slot-based flow
3. Book through RangeBookingWidget → booking appears in doctor dashboard
4. Verify confirmation email, SMS, notifications all fire correctly
5. Verify mobile modal also uses the correct widget
6. Verify no regressions on slot-based doctors

---

## 7. Key Files

| File | Action |
|------|--------|
| `apps/api/src/app/api/doctors/[slug]/route.ts` | Add `hasRanges` to response |
| `apps/public/src/types/doctor.ts` | Add `hasRanges` field |
| `apps/public/src/components/doctor/DynamicSections.tsx` | Add RangeBookingWidget dynamic export |
| `apps/public/src/components/doctor/DoctorProfileClient.tsx` | Conditional widget rendering |
| `apps/public/src/components/doctor/BookingModal.tsx` | Conditional widget in modal |
| `apps/public/src/components/doctor/RangeBookingWidget.tsx` | Already built — no changes needed |

---

*Document created 2026-04-25.*
