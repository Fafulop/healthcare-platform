-- AlterTable
ALTER TABLE "practice_management"."quotation_items" ADD COLUMN     "tax_amount" DECIMAL(12,2) DEFAULT 0,
ADD COLUMN     "tax_rate" DECIMAL(5,4) DEFAULT 0.16;
