-- Rename due_time to start_time
ALTER TABLE "medical_records"."tasks" RENAME COLUMN "due_time" TO "start_time";

-- Add end_time column
ALTER TABLE "medical_records"."tasks" ADD COLUMN "end_time" VARCHAR(5);
