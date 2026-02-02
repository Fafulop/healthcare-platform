-- Migration: Replace AppointmentSlot status enum with isOpen boolean
-- This simplifies slot state management from AVAILABLE/BOOKED/BLOCKED to a simple isOpen flag
-- BOOKED state is now computed from currentBookings >= maxBookings

-- Step 1: Add isOpen column with default true
ALTER TABLE "public"."appointment_slots"
  ADD COLUMN "is_open" BOOLEAN NOT NULL DEFAULT true;

-- Step 2: Migrate existing status values to isOpen
-- BLOCKED → isOpen = false
-- AVAILABLE → isOpen = true
-- BOOKED → isOpen = true (was full, but when freed up should allow bookings again)
UPDATE "public"."appointment_slots"
  SET "is_open" = CASE
    WHEN "status" = 'BLOCKED' THEN false
    ELSE true
  END;

-- Step 3: Drop the old status column
ALTER TABLE "public"."appointment_slots"
  DROP COLUMN "status";

-- Step 4: Drop the SlotStatus enum (no longer needed)
DROP TYPE "public"."SlotStatus";

-- Step 5: Update indexes (remove status-based index, keep others)
-- The existing index "appointment_slots_doctorId_date_status_idx" will be automatically dropped
-- when the status column is dropped. We'll create a new index without status.
CREATE INDEX "appointment_slots_doctorId_date_isOpen_idx"
  ON "public"."appointment_slots"("doctor_id", "date", "is_open");

-- Step 6: Add check constraints for data integrity
ALTER TABLE "public"."appointment_slots"
  ADD CONSTRAINT "current_bookings_non_negative"
  CHECK ("current_bookings" >= 0);

ALTER TABLE "public"."appointment_slots"
  ADD CONSTRAINT "current_bookings_within_max"
  CHECK ("current_bookings" <= "max_bookings");

-- Migration complete!
-- Slots are now either open (isOpen=true) or closed (isOpen=false)
-- The "full" state is computed: currentBookings >= maxBookings
