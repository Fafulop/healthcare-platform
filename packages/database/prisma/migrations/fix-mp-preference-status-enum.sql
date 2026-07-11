-- mp_payment_preferences.status was created as TEXT in prod while the Prisma
-- schema (and payment_links.status) declare the "PaymentLinkStatus" enum.
-- Writes/reads worked (values are valid labels), but any Prisma WHERE filter
-- on status failed with 42883: operator does not exist: text = "PaymentLinkStatus"
-- (found 2026-07-11 by the xdom-cuanto-me-deben eval → get_payment_links
-- status filter; also latent in the ledger evidence orphan heuristic).
-- Idempotent: skips if the column is already the enum.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'mp_payment_preferences'
      AND column_name = 'status'
      AND udt_name = 'text'
  ) THEN
    ALTER TABLE public.mp_payment_preferences ALTER COLUMN status DROP DEFAULT;
    ALTER TABLE public.mp_payment_preferences
      ALTER COLUMN status TYPE "PaymentLinkStatus"
      USING status::"PaymentLinkStatus";
    ALTER TABLE public.mp_payment_preferences
      ALTER COLUMN status SET DEFAULT 'PENDING'::"PaymentLinkStatus";
  END IF;
END $$;
