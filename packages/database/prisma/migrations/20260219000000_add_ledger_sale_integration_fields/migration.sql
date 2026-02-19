-- AlterTable: Add sale/purchase integration columns to ledger_entries
-- These fields were added to the Prisma schema but migration was never generated.

ALTER TABLE "practice_management"."ledger_entries"
  ADD COLUMN IF NOT EXISTS "transaction_type" VARCHAR(20) DEFAULT 'N/A',
  ADD COLUMN IF NOT EXISTS "sale_id" INTEGER,
  ADD COLUMN IF NOT EXISTS "purchase_id" INTEGER,
  ADD COLUMN IF NOT EXISTS "client_id" INTEGER,
  ADD COLUMN IF NOT EXISTS "supplier_id" INTEGER,
  ADD COLUMN IF NOT EXISTS "payment_status" VARCHAR(20);

-- AddForeignKey: sale_id -> sales
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ledger_entries_sale_id_fkey'
  ) THEN
    ALTER TABLE "practice_management"."ledger_entries"
      ADD CONSTRAINT "ledger_entries_sale_id_fkey"
      FOREIGN KEY ("sale_id") REFERENCES "practice_management"."sales"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END$$;

-- AddForeignKey: client_id -> clients
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ledger_entries_client_id_fkey'
  ) THEN
    ALTER TABLE "practice_management"."ledger_entries"
      ADD CONSTRAINT "ledger_entries_client_id_fkey"
      FOREIGN KEY ("client_id") REFERENCES "practice_management"."clients"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END$$;

-- AddForeignKey: supplier_id -> proveedores
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ledger_entries_supplier_id_fkey'
  ) THEN
    ALTER TABLE "practice_management"."ledger_entries"
      ADD CONSTRAINT "ledger_entries_supplier_id_fkey"
      FOREIGN KEY ("supplier_id") REFERENCES "practice_management"."proveedores"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END$$;
