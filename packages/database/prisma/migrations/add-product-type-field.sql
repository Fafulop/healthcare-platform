-- Migration: Add type field to products table
-- Purpose: Distinguish between physical products and medical services
-- Date: 2026-02-04

-- Add type column with default value 'product' for existing records
ALTER TABLE practice_management.products
ADD COLUMN IF NOT EXISTS type VARCHAR(20) NOT NULL DEFAULT 'product';

-- Add comment to document the field
COMMENT ON COLUMN practice_management.products.type IS 'Product type: product (physical inventory) or service (medical service)';

-- Create index for efficient filtering by type
CREATE INDEX IF NOT EXISTS products_doctor_id_type_idx
    ON practice_management.products(doctor_id, type);
