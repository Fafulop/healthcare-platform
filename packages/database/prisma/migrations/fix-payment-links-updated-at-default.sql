-- Fix: Add DEFAULT to updated_at column (Prisma handles this client-side,
-- but adding DEFAULT ensures safety for any direct SQL inserts)
ALTER TABLE "public"."payment_links"
  ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;
