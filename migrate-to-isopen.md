# Migration Guide: status → isOpen

## Overview
This migration replaces the `status` enum (AVAILABLE/BOOKED/BLOCKED) with a simpler `isOpen` boolean field.

## What Changed

**Before:**
```typescript
status: 'AVAILABLE' | 'BOOKED' | 'BLOCKED'
```

**After:**
```typescript
isOpen: boolean // true = open for bookings, false = blocked by doctor
```

**isFull (computed):**
```typescript
isFull = currentBookings >= maxBookings
```

## Running the Migration

```bash
cd packages/database

# 1. Run the migration
npx prisma migrate deploy

# 2. Regenerate Prisma Client
npx prisma generate

# 3. Verify migration
npx prisma db pull
```

## Migration Details

The SQL migration does the following:

1. ✅ Adds `is_open` column (default `true`)
2. ✅ Migrates data:
   - `BLOCKED` → `isOpen = false`
   - `AVAILABLE` → `isOpen = true`
   - `BOOKED` → `isOpen = true`
3. ✅ Drops `status` column
4. ✅ Drops `SlotStatus` enum
5. ✅ Updates indexes
6. ✅ Adds check constraints for data integrity

## After Migration

**TypeScript Usage:**
```typescript
// Check if slot can accept bookings
const canBook = slot.isOpen && (slot.currentBookings < slot.maxBookings);

// Open slot for bookings
await prisma.appointmentSlot.update({
  where: { id: slotId },
  data: { isOpen: true }
});

// Close slot for bookings
await prisma.appointmentSlot.update({
  where: { id: slotId },
  data: { isOpen: false }
});
```

## Rollback Plan

If you need to rollback:

```sql
-- Add status column back
ALTER TABLE "appointment_slots" ADD COLUMN "status" VARCHAR(20);

-- Re-create enum
CREATE TYPE "SlotStatus" AS ENUM ('AVAILABLE', 'BOOKED', 'BLOCKED');

-- Migrate data back
UPDATE "appointment_slots"
  SET "status" = CASE
    WHEN NOT "is_open" THEN 'BLOCKED'::SlotStatus
    WHEN "current_bookings" >= "max_bookings" THEN 'BOOKED'::SlotStatus
    ELSE 'AVAILABLE'::SlotStatus
  END;

-- Drop isOpen
ALTER TABLE "appointment_slots" DROP COLUMN "is_open";
```

## Next Steps

After running this migration, you need to:
1. ✅ Update API routes (Task #2-#5)
2. ✅ Update frontend components
3. ✅ Test all appointment flows
