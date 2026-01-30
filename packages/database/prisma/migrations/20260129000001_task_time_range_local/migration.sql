-- Migration: Update tasks table with time range fields
-- Target: Local PostgreSQL (medical_records schema)
-- Date: 2026-01-29
-- Purpose: Replace dueTime with startTime and endTime for calendar integration

-- Rename due_time to start_time
ALTER TABLE "medical_records"."tasks"
RENAME COLUMN "due_time" TO "start_time";

-- Add end_time column
ALTER TABLE "medical_records"."tasks"
ADD COLUMN "end_time" VARCHAR(5);
