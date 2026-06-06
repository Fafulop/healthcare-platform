-- Add source and unlinkedAt columns to sat_pagos for manual link/unlink support
ALTER TABLE practice_management.sat_pagos
  ADD COLUMN "source" VARCHAR(10) NOT NULL DEFAULT 'auto',
  ADD COLUMN "unlinked_at" TIMESTAMPTZ;
